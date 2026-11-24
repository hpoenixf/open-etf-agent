import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {validateControlObservations} from '../src/run-control.mjs';
import {childExecutionBinding,createAsyncChildExecutionBindings} from '../src/child-execution.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';

const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'run-control-publication-test',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
async function fixture(name,{controlledLease=false}={}){
 const base=resolve('test-output');await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,'run-control-publication-'));let now=Date.now(),calls=0;
 const store=await openSession({directory,...(controlledLease?{clock:()=>now,leaseMs:1000}:{})});
 const options={question:'Synthetic committed publication control.',outputRoot:join(directory,'runs'),requireReport:false,publication:true,gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Original synthetic committed body.'};}},limits:{maxRounds:3,maxTools:3,timeoutMs:10000},durable:{store,grantId:'synthetic-control-publication-grant',bindings}};
 const evidence={schema:'run-control-publication-test-evidence@1',name,syntheticOnly:true};
 return{directory,store,options,evidence,calls:()=>calls,advancePastLease(runId){now=store.inspect(runId).leaseUntil+1;},async close(){try{evidence.modelCalls=calls;await writeFile(join(base,'run-control-publication-'+randomUUID()+'.safe.json'),JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});}finally{store.close();await rm(directory,{recursive:true,force:true});}}};
}
function notificationObservation(outcome){const observations=outcome.controlObservations?.filter(x=>x.owner==='publication-notification')??[];assert.equal(observations.length,1);assert.deepEqual(observations[0],{owner:'publication-notification',runId:outcome.runId,code:'PUBLICATION_NOTIFICATION_UNCONFIRMED',status:'unconfirmed'});return observations[0];}
const notificationFailure=()=>Object.assign(Error('Synthetic notification failed'),{code:'SYNTHETIC_NOTIFICATION_FAILED'});

for(const asynchronous of [false,true])test(`unified control preserves exact committed receipt after ${asynchronous?'asynchronous':'synchronous'} notification failure`,async()=>{
 const f=await fixture(asynchronous?'async-notification':'sync-notification');let committed,notifications=0;
 try{
  const onPublication=value=>{notifications++;committed=structuredClone(value.receipt);if(asynchronous)return Promise.resolve().then(()=>{throw notificationFailure();});throw notificationFailure();};
  const outcome=await run({...f.options,durable:{...f.options.durable,onPublication}});f.evidence.outcome=outcome;f.evidence.committedReceipt=committed;
  assert.equal(outcome.status,'completed');assert.equal(outcome.code,null);assert.equal(notifications,1);assert.equal(f.calls(),1);assert.deepEqual(outcome.publication,committed);assert.deepEqual(f.store.confirmPublication(committed).receipt,committed);assert.equal(f.store.confirmPublication(committed).content.text,'Original synthetic committed body.');notificationObservation(outcome);
  const original=f.store.inspect(outcome.runId);assert.equal(original.status,'completed');assert.deepEqual(original.snapshot.controlObservations,outcome.controlObservations);assert.equal(f.store.publicationRevisions(outcome.runId).length,1);
  const cold=await run({...f.options,durable:{...f.options.durable,runId:outcome.runId,onPublication}});assert.equal(cold.status,'completed');assert.deepEqual(cold.publication,committed);assert.deepEqual(cold.controlObservations,outcome.controlObservations);assert.equal(notifications,1,'terminal replay cannot claim notification redelivery');assert.equal(f.calls(),1);f.evidence.terminalReplayConfirmed=true;
 }finally{await f.close();}
});

for(const cancellation of ['user-signal','session-cancel'])test(`unified control does not hide ${cancellation} behind a committed notification failure`,async()=>{
 const f=await fixture(cancellation),abort=new AbortController();let committed;
 try{
  const outcome=await run({...f.options,signal:abort.signal,durable:{...f.options.durable,onPublication({runId,receipt}){committed=structuredClone(receipt);if(cancellation==='user-signal')abort.abort();else f.store.cancel(runId);throw notificationFailure();}}});f.evidence.outcome=outcome;f.evidence.committedReceipt=committed;
  assert.equal(outcome.status,'cancelled');assert.equal(f.store.inspect(outcome.runId).status,'cancelled');assert.deepEqual(f.store.confirmPublication(committed).receipt,committed);assert.deepEqual(outcome.publication,committed);assert.equal(f.calls(),1);assert.equal((outcome.controlObservations??[]).filter(x=>x.owner==='publication-notification').length,0,'cancelled authority cannot authorize a continue observation');
 }finally{await f.close();}
});

test('unified control cannot complete under an expired Session lease after a new owner claims during notification',async()=>{
 const f=await fixture('expired-lease-new-owner',{controlledLease:true});let newClaim,oldFence,committed;
 try{
  const outcome=await run({...f.options,durable:{...f.options.durable,onClaim({fence}){oldFence=fence;},onPublication({runId,receipt}){committed=structuredClone(receipt);f.advancePastLease(runId);newClaim=f.store.claim(runId,'synthetic-new-owner');throw notificationFailure();}}});f.evidence.outcome=outcome;f.evidence.committedReceipt=committed;
  assert.equal(outcome.status,'failed');assert.equal(outcome.code,'STALE_WRITER');assert.ok(newClaim.fence>oldFence);const original=f.store.inspect(outcome.runId);assert.equal(original.owner,newClaim.owner);assert.equal(original.fence,newClaim.fence);assert.equal(original.status,'active');assert.notEqual(original.snapshot.phase,'terminal');assert.equal(newClaim.read().status,'active');assert.deepEqual(f.store.confirmPublication(committed).receipt,committed);assert.equal(f.calls(),1);f.evidence.newOwner={owner:newClaim.owner,fence:newClaim.fence,status:original.status};
 }finally{try{newClaim?.release();}finally{await f.close();}}
});

// Deliberate corruption is restricted to this test's newly created synthetic DB.
// No retained dogfood Session, raw log or external data is opened here.
for(const corruption of ['tampered-commit','missing-commit'])test(`unified control refuses notification downgrade for ${corruption}`,async()=>{
 const f=await fixture(corruption);let committed;
 try{
  const outcome=await run({...f.options,durable:{...f.options.durable,onPublication({runId,receipt}){committed=structuredClone(receipt);const db=new DatabaseSync(join(f.directory,'session.sqlite'));try{if(corruption==='tampered-commit')db.prepare('UPDATE publication_versions SET payload_hash=? WHERE run_id=?').run('0'.repeat(64),runId);else{db.prepare('DELETE FROM publication_events WHERE run_id=?').run(runId);db.prepare('DELETE FROM publication_versions WHERE run_id=?').run(runId);}}finally{db.close();}throw notificationFailure();}}});f.evidence.outcome=outcome;f.evidence.originalReceipt=committed;
  assert.equal(outcome.status,'failed');assert.equal(outcome.code,'PUBLICATION_IDENTITY_UNAVAILABLE');assert.throws(()=>f.store.confirmPublication(committed),{code:'PUBLICATION_IDENTITY_UNAVAILABLE'});assert.notEqual(f.store.inspect(outcome.runId).status,'completed');assert.equal((outcome.controlObservations??[]).filter(x=>x.owner==='publication-notification').length,0);assert.equal(f.calls(),1);
 }finally{await f.close();}
});

test('typed Child cleanup reason accepts only its declared owner/code pair',()=>{
 const fact={owner:'child-cleanup',runId:'child-cleanup-run',code:'CHILD_CLEANUP_FAILED',status:'unconfirmed'};
 assert.doesNotThrow(()=>validateControlObservations({controlObservations:[fact]},fact.runId));
 for(const change of [{owner:'log'},{owner:['child-cleanup']},{owner:{toString:()=> 'child-cleanup'}},{code:'LOG_WRITE_FAILED'},{status:'settled'},{runId:'different-run'}])
  assert.throws(()=>validateControlObservations({controlObservations:[{...fact,...change}]},fact.runId),/INVALID_CONTROL_OBSERVATIONS/);
});
for(const primaryFailure of [false,true])test('durable Child cleanup failure preserves '+(primaryFailure?'the original failure':'the committed Publication'),async()=>{
 const f=await fixture(primaryFailure?'child-close-after-error':'child-close-after-commit');
 let token,failClose=false,failedReads=0,modelCalls=0;
 const selected={question:f.options.question,documents:['atlas-a'],execution:{schemaVersion:'child-execution@2',maxChildren:1,maxConcurrent:1,methods:[CLAIM_COMPARISON_METHOD]}};
 const childBindings=createAsyncChildExecutionBindings({
  ...selected,outputRoot:f.options.outputRoot,parentClaim:()=>token,
  store:{...f.store,listChildren(runId){
   if(failClose){failedReads++;throw new Error('Synthetic Child cleanup could not inspect original children');}
   return f.store.listChildren(runId);
  }},
  gatewayFactory(){assert.fail('No Child request was admitted by this fixture');}
 });
 const options={...f.options,extensions:childBindings,allowedDocuments:selected.documents,
  gateway:{mode:'fixture',async next(){modelCalls++;if(primaryFailure){failClose=true;throw Object.assign(new Error('Synthetic primary failure'),{code:'SYNTHETIC_PRIMARY_FAILURE'});}return {kind:'final',text:'Original synthetic committed body.'};}},
  durable:{...f.options.durable,bindings:{...bindings,adapters:[...bindings.adapters,childExecutionBinding(selected)]},onClaim:value=>{token=value;},onPublication:()=>{failClose=true;}}
 };
 try{
  const result=await run(options);
  assert.equal(failedReads,1);
  assert.equal(modelCalls,1);
  assert.equal(result.cleanup.effectsStopped,false);
  const persisted=f.store.inspect(result.runId);
  assert.equal(persisted.status,primaryFailure?'failed':'completed');
  assert.equal(persisted.snapshot.code,primaryFailure?'SYNTHETIC_PRIMARY_FAILURE':null);
  assert.equal(persisted.snapshot.phase,'terminal');
  assert.deepEqual(persisted.snapshot.controlObservations,[{owner:'child-cleanup',runId:result.runId,code:'CHILD_CLEANUP_FAILED',status:'unconfirmed'}]);
  const original=f.store.publication(result.runId);
  if(primaryFailure)assert.equal(original,null);
  else{
   assert.equal(original.content.text,'Original synthetic committed body.');
   assert.deepEqual(f.store.confirmPublication(result.publication).receipt,original.receipt);
  }
 }finally{f.store.close();await rm(f.directory,{recursive:true,force:true});}
});
