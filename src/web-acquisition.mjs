import {mkdir,open,constants} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectResearchProject,readProjectJson} from './research-project.mjs';
import {loadProjectSources,persistWebAcquisition} from './project-sources.mjs';
import {safeDirectory,ensureSafeDirectory,publishImmutable} from './storage-files.mjs';
import {acquireWebPage} from './web-transport.mjs';
import {normalizeWebUrl} from './web-policy.mjs';
import {normalizeWebAcquisitionPlan,validateWebAcquisitionTerminal,acquisitionBytes,acquisitionHash,ACQUISITION_LIMITS} from './web-acquisition-records.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const id=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value))fail('WEB_ACQUISITION_ID_INVALID');return value;};
async function syncDirectory(path){const handle=await open(path,constants.O_RDONLY);try{await handle.sync();}finally{await handle.close();}}
async function publish(path,name,value){await publishImmutable(path,name,acquisitionBytes(value));await syncDirectory(path);}

/** A finite explicit acquisition. An existing operation ID is never dispatched again. */
export async function acquireProjectWebSources({projectDir,acquisitionId,urls,allowedRedirectUrls=[],baseManifestSha256=null,approvePublicFetch=false,signal}={}){
 if(approvePublicFetch!==true)fail('WEB_ACQUISITION_APPROVAL_REQUIRED');
 signal?.throwIfAborted();id(acquisitionId);
 if(!Array.isArray(urls)||urls.length<1||urls.length>4||!Array.isArray(allowedRedirectUrls)||allowedRedirectUrls.length>12)fail('WEB_ACQUISITION_SELECTION_INVALID');
 const selected=urls.map(normalizeWebUrl),redirects=allowedRedirectUrls.map(normalizeWebUrl);
 if(new Set(selected).size!==selected.length||new Set(redirects).size!==redirects.length||redirects.some(u=>selected.includes(u)))fail('WEB_ACQUISITION_SELECTION_INVALID');
 projectDir=await safeDirectory(projectDir);const project=await inspectResearchProject({projectDir});
 const plan=normalizeWebAcquisitionPlan({schemaVersion:'web-acquisition-plan@1',projectId:project.projectId,acquisitionId,baseManifestSha256,urls:selected,allowedUrls:[...selected,...redirects],profile:'public-static-web@1',limits:{...ACQUISITION_LIMITS}});
 if(baseManifestSha256!==null)await loadProjectSources({projectDir,manifestSha256:baseManifestSha256,signal});
 const operations=await ensureSafeDirectory(join(projectDir,'web-acquisitions')),directory=join(operations,acquisitionId);
 // mkdir claims the operation before any request. Even a crash before plan
 // publication leaves a held identity; neither failure nor time permits replay.
 try{await mkdir(directory,{mode:0o700});}catch(error){if(error.code==='EEXIST')fail('WEB_ACQUISITION_ALREADY_EXISTS');throw error;}
 await syncDirectory(operations);await safeDirectory(directory);await publish(directory,'plan.json',plan);
 const controller=new AbortController(),forward=()=>controller.abort(Object.assign(new Error('WEB_CANCELLED'),{code:'WEB_CANCELLED'})),timer=setTimeout(()=>controller.abort(Object.assign(new Error('WEB_TIMEOUT'),{code:'WEB_TIMEOUT'})),ACQUISITION_LIMITS.timeoutMs);
 signal?.addEventListener('abort',forward,{once:true});if(signal?.aborted)forward();
 const observations=[];let requests=0,bytes=0,textBytes=0,active=false;
 try{
  for(const url of selected){
   controller.signal.throwIfAborted();if(requests>=ACQUISITION_LIMITS.requests)fail('WEB_REQUEST_LIMIT');active=true;
   const observation=await acquireWebPage({url,allowedUrls:plan.allowedUrls,signal:controller.signal,limits:{requests:ACQUISITION_LIMITS.requests-requests,totalBytes:ACQUISITION_LIMITS.originalBytes-bytes}});
   active=false;requests+=observation.requestCount;bytes+=observation.body.length;textBytes+=Buffer.byteLength(observation.pages.join(''));
   if(bytes>ACQUISITION_LIMITS.originalBytes||textBytes>ACQUISITION_LIMITS.textBytes)fail('WEB_ACQUISITION_TOTAL_LIMIT');
   observations.push(observation);
  }
  const result=await persistWebAcquisition({projectDir,admission:plan,observations,signal:controller.signal});
  const terminal={schemaVersion:'web-acquisition-terminal@1',projectId:project.projectId,acquisitionId,admissionSha256:acquisitionHash(plan),status:'succeeded',manifestSha256:result.manifestSha256,completedPages:observations.length,requestCount:requests,unknownRequests:0,originalBytes:bytes,textBytes,automaticReplayAllowed:false};
  validateWebAcquisitionTerminal(terminal,plan);await publish(directory,'terminal.json',terminal);return{...result,acquisition:terminal};
 }catch(error){
  // A dispatch may outlive the caller's wait. Account only observed owner facts,
  // and preserve an unknown rather than guessing successful remote settlement.
  const partial=active&&Number.isSafeInteger(error?.requestCount)?error.requestCount:0;
  const dispatchOutcomeKnown=!active||['not-dispatched','outcome-unknown','response-observed'].includes(error?.dispatchState);
  const unknown=!dispatchOutcomeKnown?null:active?(error?.dispatchState==='not-dispatched'?0:Math.max(0,partial-(Number.isSafeInteger(error?.responseCount)?error.responseCount:0))):0;
  const code=typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{1,80}$/.test(error.code)?error.code:'WEB_ACQUISITION_FAILED';
  const terminal={schemaVersion:'web-acquisition-terminal@1',projectId:project.projectId,acquisitionId,admissionSha256:acquisitionHash(plan),status:'failed',manifestSha256:null,completedPages:observations.length,requestCount:requests+partial,unknownRequests:unknown,dispatchOutcomeKnown,code,automaticReplayAllowed:false};
  try{validateWebAcquisitionTerminal(terminal,plan);await publish(directory,'terminal.json',terminal);}catch{ /* original held plan remains authoritative on persistence uncertainty */ }
  throw Object.assign(new Error(code),{code,acquisition:terminal});
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',forward);}
}

export async function inspectWebAcquisition({projectDir,acquisitionId}={}){
 id(acquisitionId);projectDir=await safeDirectory(projectDir);const project=await inspectResearchProject({projectDir});
 const directory=await safeDirectory(join(projectDir,'web-acquisitions',acquisitionId));
 let plan;try{plan=normalizeWebAcquisitionPlan(await readProjectJson(join(directory,'plan.json'),65536));}catch(error){if(error.code==='ENOENT')return {status:'unknown',acquisitionId,automaticReplayAllowed:false,reason:'operation claimed before readable plan'};throw error;}
 if(plan.projectId!==project.projectId||plan.acquisitionId!==acquisitionId)fail('WEB_ACQUISITION_IDENTITY_CHANGED');
 let terminal;try{terminal=await readProjectJson(join(directory,'terminal.json'),8192);}catch(error){if(error.code==='ENOENT')return{plan,status:'unknown',automaticReplayAllowed:false};throw error;}
 terminal=validateWebAcquisitionTerminal(terminal,plan);
 if(terminal.status==='succeeded'){
  const source=await loadProjectSources({projectDir,manifestSha256:terminal.manifestSha256});
  if(source.manifest.acquisition.admissionSha256!==terminal.admissionSha256||Object.entries(source.webAcquisition).some(([k,v])=>terminal[k]!==v))fail('WEB_ACQUISITION_IDENTITY_CHANGED');
 }
 return{plan,...terminal};
}
