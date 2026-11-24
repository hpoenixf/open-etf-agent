import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {preparePublication} from '../src/publication.mjs';
import {sha256} from '../src/source.mjs';

const body='Original synthetic final body.';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'strict-publication',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
async function fixture(t,{strict=true,route='final',clock}={}){
 const base=resolve('test-output');await mkdir(base,{recursive:true});
 const directory=await mkdtemp(join(base,'strict-publication-'));
 const store=await openSession({directory,...(clock?{clock,leaseMs:30000}:{})});
 t.after(async()=>{try{store.close();}finally{await rm(directory,{recursive:true,force:true});}});
 let calls=0,notices=0;
 const gateway={mode:'fixture',async next({messages}){
  calls++;
  if(route==='final')return{kind:'final',text:body};
  if(calls===1)return call('read','read_page',{documentId:'atlas-a',page:1});
  if(calls===2){
   const source=messages.find(m=>m.callId==='read').result.value;
   return call('save','save_report',{text:'Synthetic research [1].',sourceIds:[route==='report'?source.sourceId:'atlas-a']});
  }
  assert.equal(route,'report','a degraded candidate must not cause another model call');
  assert.equal(calls,3);
  assert.equal(messages.find(m=>m.callId==='save').result.status,'succeeded');
  return{kind:'final',text:body};
 }};
 const options={question:'Validate strict report delivery.',outputRoot:join(directory,'runs'),requireReport:true,publication:true,
  ...(strict?{reportDelivery:'artifact-required@1'}:{}),gateway,limits:{maxRounds:4,maxTools:4,timeoutMs:10000},
  durable:{store,grantId:'synthetic-strict-publication',bindings,onPublication(){notices++;}}};
 function rows(runId){
  const db=new DatabaseSync(join(directory,'session.sqlite'),{readOnly:true});
  try{return ['publication_versions','publication_events'].map(table=>db.prepare(`SELECT count(*) AS n FROM ${table} WHERE run_id=?`).get(runId).n);}
  finally{db.close();}
 }
 return{store,options,calls:()=>calls,notices:()=>notices,rows};
}
function assertNoPublication(f,outcome){
 assert.equal(outcome.receipt,null);
 // Check physical durable effects, not just the returned status.
 assert.deepEqual(f.rows(outcome.runId),[0,0]);
 assert.equal(f.notices(),0);
 assert.equal(outcome.publication,undefined);
 assert.equal(f.store.publication(outcome.runId),null);
 assert.deepEqual(f.store.publicationRevisions(outcome.runId),[]);
}
for(const route of ['final','degraded'])test('strict '+route+' without a report leaves zero Publication effects',async t=>{
 const f=await fixture(t,{route});
 const outcome=await run(f.options);
 assert.equal(outcome.status,'failed');
 assert.equal(outcome.code,'REPORT_ARTIFACT_REQUIRED');
 if(route==='degraded')assert.equal(f.store.inspect(outcome.runId).snapshot.messages.at(-1).result.deliveryAssessment?.semanticStatus,'unreviewed');
 assertNoPublication(f,outcome);
 assert.equal(f.calls(),route==='final'?1:2);
 const replay=await run({...f.options,durable:{...f.options.durable,runId:outcome.runId}});
 assert.deepEqual(replay,outcome);
 assert.equal(f.calls(),route==='final'?1:2);
 assert.deepEqual(f.rows(outcome.runId),[0,0]);
});
test('strict valid report receipt and canonical body both survive exact durable readback',async t=>{
 const f=await fixture(t,{route:'report'});
 const outcome=await run(f.options);
 assert.equal(outcome.status,'completed',outcome.code);
 const receipt=outcome.receipt;
 assert.equal(receipt.operationId,'save');
 const bytes=await readFile(join(outcome.directory,'report.md'));
 assert.equal(bytes.length,receipt.bytes);
 assert.equal(sha256(bytes),receipt.sha256);
 assert.match(bytes.toString(),/^Synthetic research \[1\]\./);
 assert.deepEqual(f.store.inspect(outcome.runId).snapshot.host.receipt,receipt);
 assert.equal(f.store.confirmPublication(outcome.publication).content.text,body);
 assert.deepEqual(f.rows(outcome.runId),[1,1]);
 assert.equal(f.calls(),3);
 assert.equal(f.notices(),1);
});
for(const route of ['final','degraded'])test('ordinary report-delivery mode still publishes '+route+' original body without report receipt',async t=>{
 const f=await fixture(t,{strict:false,route});
 const outcome=await run(f.options);
 assert.equal(outcome.status,'completed',outcome.code);
 assert.equal(outcome.receipt,null);
 const confirmed=f.store.confirmPublication(outcome.publication);
 assert.equal(confirmed.content.text,route==='final'?body:'Synthetic research [1].');
 if(route==='degraded')assert.equal(confirmed.content.assessment.semanticStatus,'unreviewed');
 assert.deepEqual(f.rows(outcome.runId),[1,1]);assert.equal(f.notices(),1);
});
test('strict Run user cancellation at proposal seal retains cancellation and no Publication',async t=>{
 const f=await fixture(t),abort=new AbortController();
 const outcome=await run({...f.options,signal:abort.signal,durable:{...f.options.durable,onCheckpoint({phase}){if(phase==='proposal-sealed')abort.abort();}}});
 assert.equal(outcome.status,'cancelled');
 assert.equal(outcome.code,'CANCELLED');
 assert.equal(f.store.inspect(outcome.runId).status,'cancelled');
 assertNoPublication(f,outcome);assert.equal(f.calls(),1);
});
test('strict recovery of a sealed proposal does not dispatch or publish a missing report',async t=>{
 const f=await fixture(t),stop=new AbortController();
 const interrupted=await run({...f.options,hostSignal:stop.signal,durable:{...f.options.durable,onCheckpoint({phase}){if(phase==='proposal-sealed')stop.abort();}}});
 assert.equal(interrupted.status,'interrupted');
 assert.equal(f.store.inspect(interrupted.runId).snapshot.phase,'proposal-sealed');
 assertNoPublication(f,interrupted);
 const outcome=await run({...f.options,durable:{...f.options.durable,runId:interrupted.runId}});
 assert.equal(outcome.status,'failed');assert.equal(outcome.code,'REPORT_ARTIFACT_REQUIRED');
 assertNoPublication(f,outcome);assert.equal(f.calls(),1);
});
test('strict guard does not erase a body committed by an older Runtime',async t=>{
 const f=await fixture(t),stop=new AbortController();
 const interrupted=await run({...f.options,hostSignal:stop.signal,durable:{...f.options.durable,onCheckpoint({phase}){if(phase==='proposal-sealed')stop.abort();}}});
 assert.equal(interrupted.status,'interrupted');
 const {runId,rootId}=interrupted;
 // Reconstruct the exact old ordering (original Publication transaction before
 // final decision) through the real Session claim in this isolated fixture.
 const old=f.store.claim(runId,'synthetic-legacy-runtime');
 let committed;
 try{committed=old.publish(preparePublication({runId,rootId,text:body}));}finally{old.release();}
 const outcome=await run({...f.options,durable:{...f.options.durable,runId}});
 assert.equal(outcome.status,'failed');assert.equal(outcome.code,'REPORT_ARTIFACT_REQUIRED');
 assert.deepEqual(f.rows(runId),[1,1]);
 assert.equal(f.store.confirmPublication(committed.receipt).content.text,body);
 assert.equal(f.notices(),0);
 assert.equal(f.calls(),1);
});
test('a strict proposal sealed just before the deadline cannot use the strict guard to mask expiry',async t=>{
 const start=Date.now();
 t.mock.timers.enable({apis:['Date'],now:start});
 const f=await fixture(t,{clock:()=>Date.now()});
 const outcome=await run({...f.options,durable:{...f.options.durable,onCheckpoint({phase,runId}){
  if(phase==='proposal-sealed')t.mock.timers.setTime(f.store.inspect(runId).definition.deadlineAt);
 }}});
 assert.equal(outcome.status,'failed');
 assert.equal(outcome.code,'DEADLINE_EXPIRED');
 assertNoPublication(f,outcome);
 assert.equal(f.calls(),1);
});
test('strict mode does not imply settlement or redispatch after a reserved model attempt is unknown',async t=>{
 const f=await fixture(t),stop=new AbortController();
 const interrupted=await run({...f.options,hostSignal:stop.signal,durable:{...f.options.durable,onCheckpoint({phase}){if(phase==='model-reserved')stop.abort();}}});
 assert.equal(interrupted.status,'interrupted');
 const saved=f.store.inspect(interrupted.runId);
 assert.equal(saved.snapshot.phase,'model-reserved');
 assert.equal(saved.rootUsage.model,1);
 const outcome=await run({...f.options,durable:{...f.options.durable,runId:interrupted.runId}});
 assert.equal(outcome.status,'failed');
 assert.equal(outcome.code,'MODEL_OUTCOME_UNKNOWN');
 assert.equal(outcome.gatewayOutcome,'unknown');
 assertNoPublication(f,outcome);
 assert.equal(f.store.inspect(interrupted.runId).rootUsage.model,1);
 assert.equal(f.calls(),0);
});
