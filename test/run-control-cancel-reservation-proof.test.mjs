import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';

const lateAnswer='This late provider fixture answer must not get published.';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'cancel-proof',version:'1'},
 plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
const cut=()=>Object.assign(new Error('Synthetic cancel transport fault'),{code:'FIXTURE_CANCEL_ERROR'});

for(const mode of ['before-commit','after-commit-lost-ack','actual-success','returned-active-noop','missing-method','mismatched-fence','late-provider-result'])
 test('operator stop at durable model reservation: '+mode,{timeout:8000},async t=>{
  await mkdir('test-output',{recursive:true});
  const directory=await mkdtemp(resolve('test-output/cancel-reservation-proof-'));
  let shift=0;
  const opts={directory,clock:()=>Date.now()+shift,leaseMs:5000};
  let store=await openSession(opts);
  t.after(async()=>{store?.close();await rm(directory,{recursive:true,force:true});});
  const command=new AbortController();
  let calls=0,attempts=0,finishes=0,releases=0,publishes=0,claimAtStart,attemptedNeverAgain=false;
  const wrapped={...store,
   cancel:mode==='missing-method'?undefined:runId=>{
    attempts++;
    assert.equal(store.inspect(runId).snapshot.phase,'model-reserved');
    if(mode==='before-commit'||mode==='late-provider-result')throw cut();
    if(mode==='returned-active-noop')return store.inspect(runId);
    const result=store.cancel(runId);
    if(mode==='after-commit-lost-ack')throw cut();
    return result;
   },
   inspect(runId){
    const actual=store.inspect(runId);
    if(mode==='mismatched-fence'&&actual.status==='cancelled')return {...actual,fence:actual.fence+1};
    return actual;
   },
   claim(...args){
    const claim=store.claim(...args);claimAtStart=claim;
    return {...claim,
     finish(...a){finishes++;return claim.finish(...a);},
     release(...a){releases++;return claim.release(...a);},
     publish(...a){publishes++;return claim.publish(...a);},
    };
   }};
  const original={question:'Synthetic operator cancellation tests reserved execution only.',publication:true,
   outputRoot:join(directory,'outputs'),limits:{maxRounds:2,maxTools:2,timeoutMs:30000},
   gateway:{mode:'fixture',async next(){calls++;if(attemptedNeverAgain)assert.fail('lost cancel must never redispatch an unresolved reservation');
    return new Promise(resolve=>{
     queueMicrotask(()=>{
      if(mode==='late-provider-result')resolve({kind:'final',text:lateAnswer});
      command.abort();
     });
    });
   }},
   durable:{store:wrapped,grantId:'cancel-proof-grant',bindings}};
  const result=await run({...original,signal:command.signal});
  const current=store.inspect(result.runId);
  assert.equal(calls,1);assert.equal(attempts,mode==='missing-method'?0:1);
  assert.equal(publishes,0);assert.equal(store.publication(result.runId),null);assert.equal(result.answer,'');
  assert.equal(result.gatewayOutcome,'unknown');
  const committed=['after-commit-lost-ack','actual-success','mismatched-fence'].includes(mode);
  const proved=committed&&mode!=='mismatched-fence';
  assert.equal(result.status,proved?'cancelled':'unconfirmed');
  assert.equal(result.code,proved?'CANCELLED':'CANCEL_COMMIT_UNCONFIRMED');
  assert.equal(finishes,0);assert.equal(releases,0);
  assert.equal(current.status,committed?'cancelled':'active');
  assert.equal(current.rootStatus,committed?'cancelled':'active');
  assert.equal(current.snapshot.phase,committed?'terminal':'model-reserved');assert.equal(current.snapshot.gatewayOutcome,'unknown');
  assert.equal(current.owner,committed?null:claimAtStart.owner);assert.equal(current.fence,claimAtStart.fence);
  assert.equal(current.rootUsage.model,1);
  if(mode!=='late-provider-result')assert.equal(result.cleanup?.effectsStopped,false);
  store.close();store=await openSession({directory,readOnly:true});
  const cold=store.inspect(result.runId);assert.equal(cold.status,current.status);assert.equal(cold.fence,current.fence);
  assert.equal(cold.snapshot.gatewayOutcome,'unknown');assert.equal(store.publication(result.runId),null);
  if(!committed){
   store.close();store=await openSession(opts);
   attemptedNeverAgain=true;
   const recovery={...original,durable:{...original.durable,store,runId:result.runId}};
   await assert.rejects(run(recovery),{code:'LEASE_BUSY'});
   shift=6000;
   const afterExpiry=await run(recovery);
   assert.equal(afterExpiry.status,'failed');assert.equal(afterExpiry.code,'MODEL_OUTCOME_UNKNOWN');
   assert.equal(calls,1);assert.equal(store.inspect(result.runId).rootUsage.model,1);
   assert.equal(store.publication(result.runId),null);
  }
 });
