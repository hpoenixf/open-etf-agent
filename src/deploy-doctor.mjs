import {constants} from 'node:fs';
import {access,lstat,open,realpath} from 'node:fs/promises';
import {request} from 'node:http';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const check=(status,code,next,details={})=>({status,code,next,...details});
export const versionPattern=/^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const packageName=/^(?:@[a-z0-9_-]+\/)?[a-z0-9][a-z0-9._-]*$/;
const defaultRoot=fileURLToPath(new URL('..',import.meta.url));

async function readJson(path,limit){
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size>limit)throw new Error('CONFIG_FILE_UNSAFE');
    const buffer=Buffer.alloc(limit+1);
    let offset=0;
    while(offset<buffer.length){
      const {bytesRead}=await handle.read(buffer,offset,buffer.length-offset,offset);
      if(!bytesRead)break;
      offset+=bytesRead;
    }
    if(offset>limit)throw new Error('CONFIG_FILE_UNSAFE');
    return JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(buffer.subarray(0,offset)));
  }finally{await handle.close();}
}

async function installation(root){
  const incomplete=check('error','INSTALLATION_INCOMPLETE','Use the intended release checkout with its package manifest and dependency lock.');
  let pkg,lock;
  try{
    [pkg,lock]=await Promise.all([readJson(join(root,'package.json'),65536),readJson(join(root,'package-lock.json'),2*1024*1024)]);
    const cli=await lstat(join(root,'src','gui-cli.mjs'));
    if(!cli.isFile()||pkg.name!=='open-etf-agent'||typeof pkg.version!=='string'||!versionPattern.test(pkg.version)||
      lock?.lockfileVersion!==3||lock.packages?.['']?.name!==pkg.name||lock.packages[''].version!==pkg.version)return {result:incomplete};
  }catch{return {result:incomplete};}
  const names=Object.keys(pkg.dependencies??{});
  const dependencies=await Promise.all(names.map(async name=>{
    if(!packageName.test(name))return false;
    try{
      const dependency=await readJson(join(root,'node_modules',name,'package.json'),262144);
      return dependency.version===lock?.packages?.['node_modules/'+name]?.version&&dependency.name===name;
    }catch{return false;}
  }));
  const missingDependencies=dependencies.filter(value=>!value).length;
  const result=missingDependencies?
    check('error','DEPENDENCIES_INCOMPLETE','Run npm ci --ignore-scripts from the intended release checkout.',{missingDependencies}):
    check('ok','READY','The release manifest, lock and direct dependencies are present.');
  return {pkg,result};
}

function runtime(pkg,{expectedVersion,expectedNode}){
  const node=process.versions.node;
  const app=pkg?.version??null;
  const range=/^>=(\d{1,4}\.\d{1,4}\.\d{1,4}) <(\d{1,4})$/.exec(pkg?.engines?.node??'');
  const details={node,app,expectedNode:expectedNode??null,expectedVersion:expectedVersion??null,
    supportedRange:range?range[0]:null};
  if(expectedVersion&&app&&expectedVersion!==app||expectedNode&&expectedNode!==node){
    return check('error','VERSION_MISMATCH','Use the requested release checkout and the same Node executable as the service launcher.',details);
  }
  if(!range)return check('skipped','ENGINE_RANGE_UNAVAILABLE','Verify the installation manifest before checking its Node range.',details);
  const numeric=version=>version.split('.').reduce((value,part)=>value*10000+Number(part),0);
  if(!versionPattern.test(node)||numeric(node)<numeric(range[1])||Number(node.split('.')[0])>=Number(range[2])){
    return check('error','NODE_UNSUPPORTED','Switch the launch environment to a supported Node version.',details);
  }
  return check('ok','SUPPORTED','The current Node and selected release match these checks.',details);
}

async function permissions(projectDir){
  if(!projectDir)return check('skipped','PROJECT_NOT_SELECTED','Pass --project DIR to check your service data directory.');
  let candidate=resolve(projectDir),isProject=true;
  for(;;){
    try{
      const stat=await lstat(candidate);
      if(!stat.isDirectory()||await realpath(candidate)!==candidate){
        return check('error','DIRECTORY_UNSAFE','Select an ordinary project directory and avoid symlink ancestors.');
      }
      await access(candidate,constants.R_OK|constants.W_OK|constants.X_OK);
      return isProject?check('ok','ACCESSIBLE','This account has read, write and search access.'):
        check('info','PROJECT_DIRECTORY_MISSING','The nearest existing parent is accessible for a first launch.');
    }catch(error){
      if(error.code!=='ENOENT'||candidate===dirname(candidate)){
        return check('error','DIRECTORY_INACCESSIBLE','Check directory ownership and read, write and search access for the launch account.');
      }
      candidate=dirname(candidate);
      isProject=false;
    }
  }
}

async function configuration({mode,liveConfig,projectDir},install){
  if(mode==='live'){
    if(!liveConfig)return check('error','LIVE_CONFIG_REQUIRED','Pass the existing live launch config with --live-config FILE.');
    try{
      const config=await readJson(resolve(liveConfig),16384);
      if(install.status!=='ok')return check('skipped','LIVE_VALIDATOR_UNAVAILABLE','Complete the installation, then retry live config validation.');
      const {prepareGuiLiveConfig}=await import('./gui-live-config.mjs');
      prepareGuiLiveConfig(config,process.env);
    }catch(error){
      if(error.code==='ENOENT')return check('error','LIVE_CONFIG_REQUIRED','Check that the selected live configuration file exists.');
      if(error.code==='GUI_LIVE_API_KEY_ENV_REQUIRED')return check('error','LIVE_ENV_REQUIRED','Supply ETF_GUI_PROVIDER_KEY through the existing launch environment.');
      return check('error','LIVE_CONFIG_INVALID','Review the selected config against the existing live launch guide.');
    }
  }
  if(!projectDir)return mode==='live'?check('ok','LIVE_CONFIG_VALID','The live launch settings are valid. Pass --project DIR to check project initialization.'):
    check('skipped','PROJECT_NOT_SELECTED','Pass --project DIR to check whether project configuration exists.');
  try{
    const file=await lstat(join(resolve(projectDir),'project.json'));
    if(!file.isFile())return check('error','PROJECT_CONFIG_UNSAFE','Use the project configuration created by the normal launcher.');
    await access(join(resolve(projectDir),'project.json'),constants.R_OK);
    return check('ok','CONFIG_PRESENT','The project config is readable. Check the launch logs if initialization still fails.');
  }catch(error){
    if(error.code==='ENOENT')return check('info','PROJECT_NOT_INITIALIZED','Run the normal launcher when you are ready to initialize this project.');
    return check('error','PROJECT_CONFIG_INACCESSIBLE','Check the project config permissions for the launch account.');
  }
}

async function health(port){
  if(port===undefined)return check('skipped','PROBE_NOT_REQUESTED','Pass --port N to check an existing local GUI listener.');
  try{
    const {statusCode,headers}=await new Promise((done,fail)=>{
      const req=request({hostname:'127.0.0.1',port,path:'/',method:'HEAD',agent:false,signal:AbortSignal.timeout(1500)},res=>{
        done({statusCode:res.statusCode,headers:res.headers});
        res.destroy();
      });
      req.once('error',fail);
      req.end();
    });
    const gui=statusCode===200&&headers['content-type']?.startsWith('text/html')&&
      headers['referrer-policy']==='no-referrer'&&headers['cross-origin-resource-policy']==='same-origin';
    if(gui)return check('ok','HTTP_RESPONDING','The local GUI homepage responded. Check service logs for deeper readiness.',{httpStatus:statusCode,serviceVersion:null});
    return check('error','UNEXPECTED_HTTP_RESPONSE','Confirm this is the direct local GUI port. Redirects are not followed.',{httpStatus:statusCode,serviceVersion:null});
  }catch{
    return check('error','SERVICE_UNREACHABLE','Check whether the service is running and listening on the selected loopback port.');
  }
}

export async function diagnoseDeployment({root=defaultRoot,mode='offline',projectDir,liveConfig,port,expectedVersion,expectedNode}={}){
  const {pkg,result}=await installation(resolve(root));
  const [config,dirs,service]=await Promise.all([configuration({mode,liveConfig,projectDir},result),permissions(projectDir),health(port)]);
  const checks={installation:result,runtime:runtime(pkg,{expectedVersion,expectedNode}),configuration:config,permissions:dirs,health:service};
  return {schemaVersion:'deploy-doctor@1',mode,ok:Object.values(checks).every(item=>item.status!=='error'),checks};
}
