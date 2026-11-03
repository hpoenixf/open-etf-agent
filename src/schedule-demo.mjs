import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openSession } from './session.mjs';
import { SCHEDULE_PROFILE } from './schedule.mjs';
import { confirmScheduledRun, materializeScheduledRun } from './runtime.mjs';
import { workRun } from './worker.mjs';
import { PUBLICATION_BINDING } from './publication.mjs';
import { sha256 } from './source.mjs';

// A finite public synthetic recipe, not a scheduler, transport, or executor.
// Nothing here discovers future instants or invokes itself after exit.
export async function scheduleDemoOptions(store, { hostSignal } = {}) {
 const contentSha256=sha256(Buffer.concat([await readFile(new URL(import.meta.url)),await readFile(new URL('../fixtures/documents.json',import.meta.url))]));
 const gateway={mode:'fixture',async next({messages}){
  const calls=messages.filter(message=>message.role==='tool');
  const ask=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
  if(!calls.some(item=>item.callId==='source-a'))return ask('source-a','read_page',{documentId:'atlas-a',page:1});
  if(!calls.some(item=>item.callId==='source-b'))return ask('source-b','read_page',{documentId:'atlas-b',page:1});
  if(!calls.some(item=>item.callId==='report'))return ask('report','save_report',{text:'# Scheduled synthetic guide comparison\n\nThe two original public synthetic guide pages were acquired [1] [2]. This fixture checks identity and execution mechanics, not financial advice or model quality.',sourceIds:calls.filter(item=>item.result?.value?.sourceId).map(item=>item.result.value.sourceId)});
  return {kind:'final',text:'Saved the original scheduled synthetic report with both original source identities.'};
 }};
 return {question:'Compare both public synthetic atlas guide pages and save one original sourced report.',gateway,outputRoot:join(store.directory,'runs'),requireReport:true,publication:true,allowedTools:['read_page','save_report'],allowedDocuments:['atlas-a','atlas-b'],limits:{maxRounds:36,maxTools:72,timeoutMs:3600000},...(hostSignal?{hostSignal}:{}),durable:{store,grantId:'scheduled-public-synthetic-v1',rootLimits:{model:57,tool:72},bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'schedule-public-synthetic',version:'1'},plugins:[],adapters:[{id:'schedule-public-synthetic',version:'1',contentSha256},PUBLICATION_BINDING]}}};
}
export async function confirmScheduleDemo({directory,schedule}){
 const store=await openSession({directory,profile:SCHEDULE_PROFILE});
 try{return await confirmScheduledRun(await scheduleDemoOptions(store),schedule);}finally{store.close();}
}
export async function wakeScheduleDemo({directory,reference,hostSignal}){
 const store=await openSession({directory,profile:SCHEDULE_PROFILE});
 try{
  const options=await scheduleDemoOptions(store,{hostSignal});
  const occurrence=await materializeScheduledRun(options,reference);
  if(occurrence.state!=='materialized')return {occurrence};
  // One invocation of the original Worker; it alone owns lease/resume/unknown.
  const outcome=await workRun({...options,durable:{...options.durable,runId:occurrence.runId}});
  return {occurrence:store.inspectSchedule(reference),outcome};
 }finally{store.close();}
}
