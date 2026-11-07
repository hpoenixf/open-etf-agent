import {submitResearchTask,listResearchScheduledTasks,inspectResearchScheduledTask,materializeResearchScheduledTask,workResearchTask,cancelResearchTask} from './research-project.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function confirmScheduledTask({confirmOnce,...request}){
 if(confirmOnce!==true)fail('SCHEDULE_EXPLICIT_CONFIRMATION_REQUIRED');
 if(!request.schedule)fail('PROJECT_SCHEDULE_REQUIRED');
 await submitResearchTask(request);
 return inspectScheduledTask(request);
}
export const inspectScheduledTask=inspectResearchScheduledTask;
export async function listScheduledTasks({projectDir}){return{items:await listResearchScheduledTasks({projectDir})};}
export async function cancelScheduledTask({projectDir,runId}){
 await inspectScheduledTask({projectDir,runId});
 await cancelResearchTask({projectDir,runId});
 return inspectScheduledTask({projectDir,runId});
}
// One bounded serial sweep. No timer, background process, recurrence, or automatic
// resume of an already materialized/possibly unknown Run. Original Worker owns work.
export async function runDueScheduledTasks({projectDir,limit=16,hostSignal,gateway,resolveControls}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>32)fail('SCHEDULE_INVALID_LIMIT');
 if(resolveControls!==undefined&&typeof resolveControls!=='function')fail('SCHEDULE_INVALID_CONTROLS');
 const listed=await listScheduledTasks({projectDir});const items=[];let attempted=0;
 for(const listedTask of listed.items){
  if(hostSignal?.aborted||attempted>=limit)break;
  const runId=listedTask.definition.runId;
  // Re-read immediately before the original atomic materialization and claim.
  const current=await inspectScheduledTask({projectDir,runId});
  if(current.schedule.state!=='confirmed')continue;
  const due=Date.parse(current.definition.schedule.scheduledInstant);
  if(Date.now()<due)continue;
  if(Date.now()>=due+current.definition.schedule.maxLatenessMs){
   await materializeResearchScheduledTask({projectDir,runId});
   items.push({runId,state:(await inspectScheduledTask({projectDir,runId})).schedule.state});continue;
  }
  const controls=resolveControls?await resolveControls(current.definition):{gateway};
  if(hostSignal?.aborted)break;
  // Controls are resolved before a final fresh eligibility observation. They may
  // be asynchronous; cancellation or another wake during it must remain effective.
  const latest=await inspectScheduledTask({projectDir,runId});
  if(latest.schedule.state!=='confirmed')continue;
  if(Date.now()>=due+current.definition.schedule.maxLatenessMs){await materializeResearchScheduledTask({projectDir,runId});items.push({runId,state:'missed'});continue;}
  attempted++;
  const result=await workResearchTask({...controls,projectDir,runId,hostSignal});
  items.push({runId,state:(await inspectScheduledTask({projectDir,runId})).schedule.state,workerStatus:result.workerStatus??null});
 }
 return{attempted,items,interrupted:hostSignal?.aborted===true};
}
