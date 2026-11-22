// Explicit opt-in only; this is not a postinstall hook or startup dependency.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,mkdir,mkdtemp,readFile,readlink,realpath,rm,symlink,writeFile} from 'node:fs/promises';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const REGISTRY='https://registry.npmjs.org';
const MANIFEST_SHA256='bfa5f3e66c01ff1655c1e93ada5d9f8780d62dbb1ff9a06aaf325cba92a917d4';
const LOCK_SHA256='92517784461e429a3523551d1d3459f1f9db214527136e0403f5daf04f2f8576';
const VERSION='1.7.27';
const PACKAGE_COUNT=21;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sameSet=(record,expected)=>record&&typeof record==='object'&&!Array.isArray(record)&&Object.keys(record).sort().join(',')===expected;
async function stat(path) {
  try{return await lstat(path);}catch(e){if(e.code!=='ENOENT')throw e;return null;}
}
async function directory(path,optional=false) {
  const x=await stat(path);
  if(!x&&optional)return;
  if(!x?.isDirectory()||x.isSymbolicLink()||await realpath(path)!==path)fail('ACCOUNT_INSTALL_DIRECTORY');
}
async function jsonFile(path,max,expectedSha) {
  const x=await stat(path);
  if(!x)fail('ACCOUNT_INSTALL_INPUT_UNAVAILABLE');
  if(!x.isFile()||x.isSymbolicLink()||x.size>max)fail('ACCOUNT_INSTALL_INPUT_PATH');
  const bytes=await readFile(path);
  if(bytes.length>max||expectedSha&&hash(bytes)!==expectedSha)fail('ACCOUNT_INSTALL_LOCK_CHANGED');
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{fail('ACCOUNT_INSTALL_INPUT_INVALID');}
}
function verifyLock(manifest,lock,expectedPackages) {
  const dependency=manifest.dependencies;
  if(!sameSet(dependency,'better-auth')||dependency['better-auth']!==VERSION||
     ['optionalDependencies','devDependencies','peerDependencies','overrides','workspaces'].some(k=>manifest[k]!==undefined)||
     Object.keys(manifest.scripts??{}).some(k=>k!=='test'))fail('ACCOUNT_INSTALL_MANIFEST');
  const root=lock.packages?.[''];
  if(lock.lockfileVersion!==3||!root||!sameSet(root.dependencies,'better-auth')||root.dependencies['better-auth']!==VERSION||
     root.name!==manifest.name||root.version!==manifest.version)fail('ACCOUNT_INSTALL_LOCK_FORMAT');
  const entries=Object.entries(lock.packages).filter(([key])=>key!=='');
  if(entries.length!==expectedPackages)fail('ACCOUNT_INSTALL_LOCK_GRAPH');
  for (const [path,pkg] of entries) {
    if(!path.startsWith('node_modules/')||!/^[a-zA-Z0-9@._/-]+$/.test(path)||path.split('/').some(s=>s==='..'||s==='.'||!s)||
       typeof pkg.resolved!=='string'||typeof pkg.integrity!=='string'||!/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity))
      fail('ACCOUNT_INSTALL_LOCK_GRAPH');
    let url;
    try{url=new URL(pkg.resolved);}catch{fail('ACCOUNT_INSTALL_LOCK_ORIGIN');}
    if(url.origin!==REGISTRY||url.username||url.password||url.search||url.hash||url.href!==pkg.resolved||
       !url.pathname.endsWith('.tgz'))fail('ACCOUNT_INSTALL_LOCK_ORIGIN');
  }
  const exact=lock.packages['node_modules/better-auth'];
  if(exact?.version!==VERSION||exact.resolved!==REGISTRY+'/better-auth/-/better-auth-'+VERSION+'.tgz')
    fail('ACCOUNT_INSTALL_LOCK_VERSION');
}
function installNpm({sidecar,configDir}){
  const bin=dirname(process.execPath);
  const result=spawnSync(join(bin,'npm'),['ci','--ignore-scripts','--no-audit','--no-fund',
    '--strict-ssl=true','--fetch-retries=0','--fetch-timeout=15000','--registry='+REGISTRY,'--replace-registry-host=never',
    '--userconfig',join(configDir,'user.npmrc'),'--globalconfig',join(configDir,'global.npmrc'),
    '--cache',join(configDir,'cache')],{
    cwd:sidecar,stdio:'inherit',
    env:{PATH:bin+':/usr/bin:/bin',HOME:configDir,LC_ALL:'C'},
  });
  if(result.error||result.status!==0)fail('ACCOUNT_INSTALL_NPM_FAILED');
}
async function checkBinding(binding,target) {
  const present=await stat(binding);
  if(!present)return false;
  if(!present.isSymbolicLink()||await readlink(binding)!==target)fail('ACCOUNT_INSTALL_FOREIGN_BINDING');
  return true;
}

// Test injection is in-process only. CLI options cannot replace vetted inputs
// or install executables. The expected release lock is fixed in this file.
export async function installAccountDeps({projectRoot,expectedManifestSha=MANIFEST_SHA256,expectedLockSha=LOCK_SHA256,expectedPackages=PACKAGE_COUNT,run=installNpm}) {
  await directory(projectRoot);
  const sidecar=join(projectRoot,'tooling','account-auth-runtime');
  const targetDir=join(projectRoot,'node_modules');
  if(!await stat(sidecar))fail('ACCOUNT_INSTALL_INPUT_UNAVAILABLE');
  await directory(sidecar);
  await directory(targetDir);
  if(await stat(join(sidecar,'.npmrc')))fail('ACCOUNT_INSTALL_NPM_CONFIG');
  await directory(join(sidecar,'node_modules'),true);
  const manifest=await jsonFile(join(sidecar,'package.json'),8192,expectedManifestSha);
  const lock=await jsonFile(join(sidecar,'package-lock.json'),524288,expectedLockSha);
  verifyLock(manifest,lock,expectedPackages);
  const binding=join(targetDir,'better-auth');
  const installedDir=join(sidecar,'node_modules','better-auth');
  const target=relative(targetDir,installedDir);
  const alreadyBound=await checkBinding(binding,target);
  const scratch=join(projectRoot,'test-output');
  try{await mkdir(scratch,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
  await directory(scratch);
  const configDir=await mkdtemp(join(scratch,'account-auth-install-'));
  try{
    for(const name of ['user.npmrc','global.npmrc'])await writeFile(join(configDir,name),'',{flag:'wx',mode:0o600});
    await run({sidecar,configDir});
    await directory(join(sidecar,'node_modules'));
    await directory(installedDir);
    const installed=await jsonFile(join(installedDir,'package.json'),65536);
    if(installed.name!=='better-auth'||installed.version!==VERSION||
      !(await stat(join(installedDir,'dist','index.mjs')))?.isFile())fail('ACCOUNT_INSTALL_ACTUAL_PACKAGE');
    await directory(targetDir);
    const stillBound=await checkBinding(binding,target);
    if(alreadyBound!==stillBound)fail('ACCOUNT_INSTALL_BINDING_RACE');
    if(!stillBound)await symlink(target,binding,'dir');
    if(await realpath(binding)!==installedDir)fail('ACCOUNT_INSTALL_BINDING_RACE');
    return Object.freeze({status:'installed',version:VERSION,verifiedPackages:expectedPackages});
  }finally{
    await rm(configDir,{recursive:true,force:true});
  }
}
if(import.meta.main) {
  try{
    if(process.argv.length!==2||!['linux','darwin'].includes(process.platform))fail('ACCOUNT_INSTALL_USAGE');
    const [major,minor,patch]=process.versions.node.split('.').map(Number);
    if(major!==26||minor<8||minor===8&&patch<1)fail('ACCOUNT_INSTALL_NODE_VERSION');
    const projectRoot=await realpath(fileURLToPath(new URL('../',import.meta.url)));
    console.log(JSON.stringify(await installAccountDeps({projectRoot})));
  }catch(e){
    console.error(/^ACCOUNT_INSTALL_[A-Z_]+$/.test(e.code??'')?e.code:'ACCOUNT_INSTALL_FAILED');
    process.exitCode=1;
  }
}
