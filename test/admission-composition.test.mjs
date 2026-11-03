import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createSharedAdmission } from '../src/admission.mjs';
import { openSession } from '../src/session.mjs';
import { run, submitRun, confirmScheduledRun, materializeScheduledRun } from '../src/runtime.mjs';

import { workRun } from '../src/worker.mjs';
import { SCHEDULE_PROFILE, SCHEDULE_COMPOSITION_BINDING, scheduleRunId } from '../src/schedule.mjs';
import { PUBLICATION_BINDING } from '../src/publication.mjs';

const bindings={gateway:{mode:'live',provider:'offline-fixture',protocol:'chat-completions',model:'synthetic',version:'1'},plugins:[],adapters:[]};
async function setup(extra={}){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/admission-composition-'));
 const session=await openSession({directory:join(directory,'session'),leaseMs:30000,...extra});
 const admission=await createSharedAdmission({directory:join(directory,'capacity'),routeId:'composition-offline',pollMs:1,queueTimeoutMs:5000});
 return {directory,session,admission,async close(){admission.close();session.close();await rm(directory,{recursive:true,force:true});}};
}
for(const unknown of [false,true])test(`same-group Child uses its original root reservation; unknown=${unknown}`,async()=>{
 const f=await setup();const seen=[];let child,childWrapper,rejectedParentTicket,childRunId;
 try{
  const raw={mode:'live',async next(input){seen.push(input.reservation);if(input.reservation.runId!=='parent'&&unknown)throw new Error('synthetic transport lost');return {kind:'final',text:'Synthetic answer.'};}};
  const parentWrapper=f.admission.wrap(raw,{session:f.session,runId:'parent'});
  const options={question:'Parent synthetic question',outputRoot:join(f.directory,'runs'),gateway:parentWrapper,limits:{maxRounds:3,maxTools:3,timeoutMs:2000},durable:{store:f.session,runId:'parent',grantId:'synthetic',bindings,rootLimits:{model:3,tool:3},async onCheckpoint({phase}){
   if(phase!=='model-reserved'||child)return;
   const parent=f.session.inspect('parent');
   child=await run({question:'Child synthetic question',taskId:'synthetic-child',outputRoot:join(f.directory,'runs'),gateway:parentWrapper,limits:{maxRounds:2,maxTools:2,timeoutMs:1000},durable:{store:f.session,parentRunId:'parent',parentClaim:{owner:parent.owner,fence:parent.fence},rootId:parent.rootId,grantId:'synthetic',bindings,rootLimits:{model:3,tool:3},onCheckpoint({phase,runId}){if(phase==='model-reserved'){childRunId=runId;childWrapper=parentWrapper.bindRun({session:f.session,runId});}}}});
  }}};
  await submitRun(options);const result=await run(options);
  const tickets=f.admission.snapshot().requests;
  assert.ok(child, 'Parent stopped before Child: '+result.code);
  assert.equal(child.status,unknown?'failed':'completed',child.code);
  assert.equal(f.session.inspect('parent').rootUsage.model,2);
  assert.equal(tickets.length,2);
  assert.deepEqual(tickets.map(t=>t.rootId),['parent','parent']);
  assert.deepEqual(tickets.map(t=>t.modelOrdinal),[2,1]);
  assert.equal(tickets[0].runId,childRunId);assert.equal(tickets[0].state,unknown?'unknown':'completed');
  assert.equal(result.status,unknown?'failed':'completed',result.code);
  assert.equal(seen.length,unknown?1:2);
  if(!unknown){rejectedParentTicket=await childWrapper.next({messages:[],reservation:seen[1]}).then(()=>null,e=>e);assert.equal(rejectedParentTicket.code,'ADMISSION_RESERVATION_REQUIRED');}
  assert.throws(()=>parentWrapper.bindRun({session:{inspect:f.session.inspect},runId:'child'}),/ADMISSION_BINDING_MISMATCH/);
  assert.equal(f.session.inspect(childRunId).rootUsage.model,2);
 }finally{await f.close();}
});

test('bindRun refuses another root and a foreign Session before dispatch',async()=>{
 const f=await setup();let calls=0;
 try{
  const raw={mode:'live',async next(){calls++;return{kind:'final',text:'unused'};}};
  for(const id of ['a','b'])await submitRun({question:id,gateway:raw,outputRoot:join(f.directory,'runs'),durable:{store:f.session,runId:id,grantId:'synthetic',bindings}});
  const wrapped=f.admission.wrap(raw,{session:f.session,runId:'a'});
  assert.throws(()=>wrapped.bindRun({session:f.session,runId:'b'}),/ADMISSION_BINDING_MISMATCH/);
  assert.equal(calls,0);assert.equal(f.admission.snapshot().requests.length,0);
 }finally{await f.close();}
});

for(const mode of ['normal','unknown','timeout'])test(`managed summary original Admission request: ${mode}`,async(t)=>{
 const f=await setup();const seen=[];let mainCalls=0,summaryCalls=0,adopted=false;
 let entered,releaseLate;const summaryEntered=new Promise(r=>{entered=r;}),lateRelease=new Promise(r=>{releaseLate=r;});
 try{
  const documentCatalog={schemaVersion:'document-catalog@1',id:'summary-fixture',documents:[{id:'evidence',name:'Synthetic compaction evidence',version:'v1',pages:['Original synthetic bounded evidence. '.repeat(150)]}]};
  const raw={mode:'live',async next(input){
   seen.push(structuredClone({...input,reservation:{...input.reservation},signal:undefined}));
   if(input.reservation.purpose==='compaction'){
    summaryCalls++;assert.deepEqual(input.tools,[]);
    if(mode==='unknown')throw new Error('synthetic summary transport lost');
    if(mode==='timeout'){entered();await new Promise(resolve=>{if(input.signal.aborted)resolve();else input.signal.addEventListener('abort',resolve,{once:true});});await lateRelease;}
    return{kind:'final',text:'Derived short summary. Exact original remains authoritative.'};
   }
   mainCalls++;
   if(mainCalls<=2)return{kind:'calls',calls:[{id:'read-'+mainCalls,name:'read_page',arguments:{documentId:'evidence',page:1}}]};
   adopted=input.messages.some(message=>message.result?.value?.kind==='derived-working-note');
   return{kind:'final',text:'Synthetic final answer.'};
  }};
  const options={question:'Read synthetic evidence twice, then conclude.',gateway:f.admission.wrap(raw,{session:f.session,runId:'summary-root'}),outputRoot:join(f.directory,'runs'),documentCatalog,contextBytes:32000,workingInput:{compaction:{mode:'gateway',thresholdBytes:1000,summaryTimeoutMs:mode==='timeout'?10:5000}},limits:{maxRounds:5,maxTools:5,timeoutMs:30000},durable:{store:f.session,runId:'summary-root',grantId:'synthetic',bindings,rootLimits:{model:6,tool:5}}};
  await submitRun(options);if(mode==='timeout')t.mock.timers.enable({apis:['setTimeout']});const running=run(options);if(mode==='timeout'){await summaryEntered;t.mock.timers.tick(10);}const result=await running;
  assert.equal(summaryCalls,1,JSON.stringify({code:result.code,mainCalls,summaryCalls}));
  assert.equal(result.status,mode==='normal'?'completed':'failed',result.code);
  assert.equal(mainCalls,mode==='normal'?3:2);
  assert.equal(adopted,mode==='normal');
  assert.deepEqual(seen.map(x=>x.reservation.modelOrdinal),mode==='normal'?[1,2,3,4]:[1,2,3]);
  assert.equal(seen[2].reservation.purpose,'compaction');assert.equal(seen[2].reservation.round,2);
  assert.equal(f.session.inspect('summary-root').rootUsage.model,seen.length);
  if(mode!=='normal'){
   assert.equal(result.code,'COMPACTION_OUTCOME_UNKNOWN');
   assert.equal(f.session.inspect('summary-root').snapshot.gatewayOutcome,'unknown');
   const before=seen.length;const reread=await run(options);assert.equal(reread.status,'failed');assert.equal(seen.length,before);
   if(mode==='timeout'){releaseLate();await nextTurn();}
   assert.equal(mainCalls,2);assert.equal(adopted,false);
   assert.equal(f.session.inspect('summary-root').snapshot.gatewayOutcome,'unknown');
   if(mode==='unknown')assert.equal(f.admission.snapshot().requests[2].state,'unknown');
  }
 }finally{releaseLate();if(mode==='timeout')t.mock.timers.reset();await f.close();}
});

test('Schedule composition uses same Admission summary and original Publication',async()=>{
 const due=Date.now()+300;let clock=due-100;const f=await setup({profile:SCHEDULE_PROFILE,clock:()=>clock});let main=0,summary=0,sourceId;const reservations=[];
 try{
  const schedule={scheduleId:'summary-composition',definitionRevision:1,scheduledInstant:new Date(due).toISOString(),timeZone:'UTC',maxLatenessMs:1000};
  const documentCatalog={schemaVersion:'document-catalog@1',id:'scheduled-summary',documents:[{id:'evidence',name:'Synthetic scheduled evidence',version:'v1',pages:['Original scheduled synthetic evidence. '.repeat(150)]}]};
  const raw={mode:'live',async next(input){reservations.push({...input.reservation});if(input.reservation.purpose==='compaction'){summary++;return{kind:'final',text:'Derived brief evidence, exact original retained.'};}
   main++;if(main<=2)return{kind:'calls',calls:[{id:'read-'+main,name:'read_page',arguments:{documentId:'evidence',page:1}}]};
   if(main===3){sourceId=input.messages.filter(m=>m.result?.value?.sourceId).at(-1).result.value.sourceId;assert.ok(input.messages.some(m=>m.result?.value?.kind==='derived-working-note'));return{kind:'calls',calls:[{id:'report',name:'save_report',arguments:{text:'# Original synthetic schedule report',sourceIds:[sourceId]}}]};}
   return{kind:'final',text:'Synthetic scheduled summary report completed.'};
  }};
  const options={question:'Read evidence twice, summarize derived context and save source-backed report.',documentCatalog,allowedDocuments:['evidence'],allowedTools:['read_page','read_result','read_note','save_report'],gateway:f.admission.wrap(raw,{session:f.session,runId:scheduleRunId(schedule)}),outputRoot:join(f.directory,'runs'),publication:true,requireReport:true,contextBytes:32000,workingInput:{compaction:{mode:'gateway',thresholdBytes:1000,summaryTimeoutMs:1000}},limits:{maxRounds:6,maxTools:5,timeoutMs:2000},durable:{store:f.session,grantId:'synthetic',rootLimits:{model:10,tool:5},bindings:{...bindings,adapters:[PUBLICATION_BINDING,SCHEDULE_COMPOSITION_BINDING]}}};
  const confirmed=await confirmScheduledRun(options,schedule);assert.equal(reservations.length,0);
  assert.equal((await materializeScheduledRun(options,confirmed.reference)).state,'not-due');assert.equal(reservations.length,0);
  clock=due;const occurrence=await materializeScheduledRun(options,confirmed.reference);assert.equal(reservations.length,0);
  const final=await workRun({...options,durable:{...options.durable,runId:occurrence.runId}});
  assert.equal(final.run.status,'completed',final.run.snapshot.code);assert.ok(summary>=1);assert.equal(main,4);assert.ok(final.publication);
  assert.equal(final.run.rootUsage.model,reservations.length);assert.deepEqual(reservations.map(r=>r.modelOrdinal),reservations.map((_,i)=>i+1));
  assert.ok(f.admission.snapshot().requests.every(t=>t.state==='completed'&&t.runId===occurrence.runId));
  assert.match(await readFile(join(final.run.directory,'report.md'),'utf8'),/Original synthetic schedule report/);
  const count=reservations.length;await workRun({...options,durable:{...options.durable,runId:occurrence.runId}});assert.equal(reservations.length,count);
 }finally{await f.close();}
});
