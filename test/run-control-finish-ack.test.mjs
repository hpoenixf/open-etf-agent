import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {decideRunControl} from '../src/run-control.mjs';

const body='已发布的原始正文。\nOriginal canonical body.';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'finish-ack',version:'1'},
 plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
const cut=()=>Object.assign(new Error('Synthetic acknowledgment loss'),{code:'FIXTURE_FINISH_ACK_ERROR'});

test('Run Control does not preserve merely because some terminal state was observed',()=>{
 for(const proof of [undefined,null,true,{kind:'some-finish',status:'completed'},{kind:'same-fence-finish-committed',status:'cancelled'}]){
  assert.deepEqual(decideRunControl({kind:'finish-ack-missing',proof}),{action:'unconfirmed',reason:'FINISH_COMMIT_UNCONFIRMED'});
 }
 assert.deepEqual(decideRunControl({kind:'finish-ack-missing',proof:{kind:'same-fence-finish-committed',status:'completed'}}),
  {action:'preserve',reason:'FINISH_COMMIT_VERIFIED'});
});

for(const mode of ['lost-after-commit','before-write','mismatched-readback']){
 test('real SQLite finish observation: '+mode,{timeout:8000},async t=>{
  await mkdir('test-output',{recursive:true});
  const directory=await mkdtemp(resolve('test-output/finish-ack-'));
  let store=await openSession({directory});
  t.after(async()=>{store?.close();await rm(directory,{recursive:true,force:true});});
  let calls=0,writes=0,proofs=0,releases=0,publications=0,checked,originalClaim;
  const counters=()=>({calls,writes,proofs,releases,publications});
  const wrapped={...store,claim(...args){
   originalClaim=store.claim(...args);const claim=originalClaim;
   return {...claim,
    finish(expected){checked=structuredClone(expected);writes++;if(mode!=='before-write')claim.finish(expected);throw cut();},
    confirmTerminalFinish(expected){
     proofs++;
     return claim.confirmTerminalFinish(mode==='mismatched-readback'?{...expected,rounds:expected.rounds+1}:expected);
    },
    publish(...args){publications++;return claim.publish(...args);},
    release(){releases++;return claim.release();},
   };
  }};
  const options={question:'Read exact original body after finish acknowledgment fault.',publication:true,
   outputRoot:join(directory,'outputs'),limits:{maxRounds:2,maxTools:2,timeoutMs:30000},
   gateway:{mode:'fixture',async next(){calls++;return {kind:'final',text:body};}},
   durable:{store:wrapped,grantId:'finish-ack-grant',bindings}};
  const result=await run(options);
  assert.equal(result.answer,body);assert.equal(result.status,mode==='lost-after-commit'?'completed':'failed');
  assert.equal(result.code,mode==='lost-after-commit'?null:'FIXTURE_FINISH_ACK_ERROR');
  assert.deepEqual(counters(),{calls:1,writes:1,proofs:1,releases:mode==='lost-after-commit'?0:1,publications:1});
  const persisted=store.inspect(result.runId);
  assert.equal(persisted.fence,originalClaim.fence);assert.equal(persisted.owner,null);assert.equal(persisted.leaseUntil,0);
  assert.equal(persisted.status,mode==='before-write'?'active':'completed');
  assert.equal(originalClaim.confirmTerminalFinish({...checked,answer:'corrupt body'}),null);
  assert.equal(store.confirmPublication(result.publication).content.text,body);
  assert.equal(store.publicationRevisions(result.runId).length,1);
  const counts={...counters()};
  store.close();store=await openSession({directory});
  assert.equal(store.confirmPublication(result.publication).content.text,body);
  if(mode!=='before-write'){
   const cold=await run({...options,durable:{...options.durable,store,runId:result.runId}});
   assert.equal(cold.status,'completed');assert.equal(cold.answer,body);assert.deepEqual(cold.publication,result.publication);
  }
  assert.deepEqual(counters(),counts);
 });
}
