import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { run } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
import { preparePublication } from '../src/publication.mjs';

const body='已提交正文。\nOriginal transaction body.';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'publication-caller-ack',version:'1'},
 plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
for(const mode of ['lost-after-commit','before-write','mismatched-prepared','event-corrupt','old-fence','cancelled']){
 test('real SQLite initial Publication caller acknowledgement: '+mode,{timeout:8000},async t=>{
  await mkdir('test-output',{recursive:true});
  const directory=await mkdtemp(resolve('test-output/publication-caller-ack-'));
  let now=Date.now(),store=await openSession({directory,clock:()=>now,leaseMs:1000});
  t.after(async()=>{store?.close();await rm(directory,{recursive:true,force:true});});
  let calls=0,writes=0,proofs=0,notifications=0,outcomeReceipt,winner;
  const facade={...store,claim(...args){
   const claim=store.claim(...args);
   return {...claim,
    publish(prepared){
     writes++;
     if(mode!=='before-write'){
      outcomeReceipt=claim.publish(prepared).receipt;
      if(mode==='event-corrupt'){
       const db=new DatabaseSync(join(directory,'session.sqlite'));
       try{db.prepare("UPDATE publication_events SET event='{}' WHERE run_id=?").run(outcomeReceipt.runId);}finally{db.close();}
      }
      if(mode==='old-fence'){now=store.inspect(outcomeReceipt.runId).leaseUntil+1;winner=store.claim(outcomeReceipt.runId,'next-fixture-owner');}
      if(mode==='cancelled')store.cancel(outcomeReceipt.runId);
     }
     throw Object.assign(new Error('Synthetic Publication acknowledgement failure'),{code:'FIXTURE_PUBLISH_ACK_ERROR'});
    },
    confirmInitialPublication(prepared){
     proofs++;
     const candidate=mode==='mismatched-prepared'?preparePublication({runId:prepared.runId,rootId:prepared.rootId,text:'Different immutable answer.'}):prepared;
     const proof=claim.confirmInitialPublication(candidate);
     if(mode==='mismatched-prepared')assert.equal(proof,null);
     return proof;
    },
   };
  }};
  const options={question:'Read back the exact answer after Publication acknowledgment loss.',publication:true,
   outputRoot:join(directory,'outputs'),limits:{maxRounds:2,maxTools:2,timeoutMs:30000},
   gateway:{mode:'fixture',async next(){calls++;return {kind:'final',text:body};}},
   durable:{store:facade,grantId:'publication-caller-ack-grant',bindings,onPublication(){notifications++;}}};
  const outcome=await run(options);
  assert.equal(calls,1);assert.equal(writes,1);
  const persisted=store.inspect(outcome.runId);
  if(mode==='event-corrupt')assert.throws(()=>store.publicationRevisions(outcome.runId),{code:'PUBLICATION_IDENTITY_UNAVAILABLE'});
  else assert.equal(store.publicationRevisions(outcome.runId).length,mode==='before-write'?0:1);
  assert.deepEqual(persisted.rootUsage,{model:1,tool:0});
  if(mode==='lost-after-commit'){
   assert.equal(outcome.status,'completed');
   assert.deepEqual(outcome.publication,outcomeReceipt);
   assert.equal(persisted.status,'completed');
   assert.equal(proofs,1);assert.equal(notifications,1);
   store.close();store=await openSession({directory});
   const cold=await run({...options,durable:{...options.durable,store,runId:outcome.runId}});
   assert.equal(cold.answer,body);assert.equal(cold.status,'completed');
   assert.deepEqual(cold.publication,outcomeReceipt);
   assert.equal(calls,1);assert.equal(writes,1);assert.equal(notifications,1);
  }else{
   assert.equal(outcome.status,mode==='cancelled'?'cancelled':'failed');
   assert.equal(notifications,0);
   if(winner){
    assert.equal(persisted.status,'active');
    assert.equal(persisted.fence,winner.fence);
    assert.equal(persisted.owner,'next-fixture-owner');
   }
  }
  if(outcomeReceipt&&mode!=='event-corrupt')assert.equal(store.confirmPublication(outcomeReceipt).content.text,body);
 });
}
