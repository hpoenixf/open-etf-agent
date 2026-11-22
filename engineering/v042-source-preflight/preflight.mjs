import {readFile,mkdtemp,realpath,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const resource=name=>new URL(name,import.meta.url);
const plan=JSON.parse(await readFile(resource('plan.json'),'utf8'));
const pins=JSON.parse(await readFile(resource('reader-pins.json'),'utf8'));
const parse=(args)=>{
 const valid=new Set(['--list','--check-only','--approved-direct-read','--repo','--staging-root','--site','--ids']);
 const out=new Map();
 for(let i=0;i<args.length;i++){
  const a=args[i];if(!valid.has(a)||out.has(a))throw Error('Bad or duplicate option');
  if(['--list','--check-only','--approved-direct-read'].includes(a))out.set(a,true);
  else{const v=args[++i];if(!v||v.startsWith('--'))throw Error('Missing option value');out.set(a,v);}
 }
 return out;
};
const sha=(kind,s)=>createHash(kind).update(s).digest('hex');
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const args=parse(process.argv.slice(2));
for(const row of plan.selection){
 const u=new URL(row.url);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
    !row.scope.some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))throw Error('Invalid authority in plan');
 for(const c of row.checks)new RegExp(c.pattern,'iu');
}
if(args.has('--list')){process.stdout.write(JSON.stringify(plan,null,2)+'\n');process.exit(0);}
const repo=args.get('--repo');
if(!repo||!isAbsolute(repo)||await realpath(repo)!==repo)throw Error('Need exact absolute repository directory');
for(const [path,expected] of Object.entries(pins)){
 if(gitBlob(await readFile(join(repo,path)))!==expected)throw Error('Pinned native module does not match: '+path);
}
if(args.has('--check-only')){
 console.log(JSON.stringify({candidate:plan.candidate,readerBlobsMatch:Object.keys(pins).length,noDispatch:true}));
 process.exit(0);
}
const site=args.get('--site'), staging=args.get('--staging-root');
if(!args.has('--approved-direct-read')||!['SG','Sofia'].includes(site)||!args.has('--ids')||!staging||!isAbsolute(staging)||await realpath(staging)!==staging)throw Error('Need explicitly approved native probes, labeled site, approved URL IDs and isolated absolute workspace');
const ids=args.get('--ids').split(',');
if(!ids.length||ids.length>4||new Set(ids).size!==ids.length)throw Error('Select one to four approved exact IDs');
const selected=ids.map(id=>plan.selection.find(e=>e.id===id));
if(selected.some(x=>!x||x.disabled))throw Error('Unknown, not scoped, or disabled selection');
const entry=name=>pathToFileURL(join(repo,'src',name)).href;
const {createResearchProject}=await import(entry('research-project.mjs'));
const {openOwnerWeb}=await import(entry('gui-owner-web.mjs'));
const {inspectWebAcquisition}=await import(entry('web-acquisition.mjs'));
const projectDir=await mkdtemp(join(staging,'open042-preflight-'));
await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',
   gateway:{mode:'fixture',provider:'fixture',protocol:'fixture@1',model:'no-model-preflight'},capabilities:['report']}});
const runId='provider-free-source-preflight', [page]=openOwnerWeb({profile:{web:true},projectDir,runId});
const block=new Set(), stopCodes=new Set(['WEB_ACCESS_DENIED','WEB_RATE_LIMIT','WEB_RATE_LIMITED','WEB_ROBOTS_DISALLOWED','WEB_ROBOTS_WORK_LIMIT','WEB_ROBOTS_REDIRECT','WEB_ROBOTS_INVALID','WEB_ROBOTS_DELAY_UNSUPPORTED','WEB_REDIRECT_NOT_ADMITTED']);
const results=[];
for(const selectedUrl of selected){
 const {id:callId,url,checks}=selectedUrl, host=new URL(url).hostname;
 const context={id:callId,host,url,caseIds:selectedUrl.cases};
 if(block.has(host)){results.push({...context,status:'not-probed-prior-policy-stop'});continue;}
 const nativeId='page-'+sha('sha256',JSON.stringify([runId,callId])).slice(0,40);
 let out,errorCode;
 try{
  page.validate({url});
  out=await page.execute({url},{callId,signal:AbortSignal.timeout(35000)});
  await page.verifyResult(out,{call:{id:callId,arguments:{url}}});
 }catch(error){errorCode=typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{1,90}$/.test(error.code)?error.code:'PRECHECK_NATIVE_ERROR';}
 let native;
 try{native=await inspectWebAcquisition({projectDir,acquisitionId:nativeId});}catch{}
 const code=errorCode??out?.reason??native?.code;
 if(!native||native.status==='unknown'||stopCodes.has(code)||native.unknownRequests===null||native.unknownRequests>0)block.add(host);
 const supported=out?.kind==='public-web-page@1'&&!errorCode&&native?.status==='succeeded';
 let markers={};
 if(supported){
  const text=out.text.normalize('NFKC').replace(/\s+/gu,' ').trim();
  markers=Object.fromEntries(checks.map(({id,pattern})=>[id,new RegExp(pattern,'iu').test(text)]));
 }
 results.push({...context,status:supported?'native-page-read':'not-verified',...(code?{code}:{}), markers,
  ...(supported?{manifestSha256:out.manifestSha256,textSha256:out.textSha256,originalSha256:out.originalSha256,
   firstPageOnly:true,pagesAcquired:out.pages}:{}),
  unknownRequests:native?.unknownRequests??null,nativeRequestCount:native?.requestCount??null});
}
const report={schemaVersion:'open042-source-preflight-result@1',candidate:plan.candidate,site,
  at:new Date().toISOString(),networkProfile:'system-direct@1',modelRequests:0,readerBlobsVerified:Object.keys(pins).length,results};
await writeFile(join(projectDir,'preflight.safe.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify(report,null,2));
