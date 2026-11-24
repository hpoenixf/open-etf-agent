import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {decideRunControl} from '../src/run-control.mjs';

const body='已保存的原始正文。\nOriginal verified body.';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'post-publication-timeout',version:'1'},
 plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
const timeout=()=>Object.assign(new Error('Synthetic external TIMEOUT code'),{code:'TIMEOUT'});
test('Run Control does not select unconfirmed delivery without typed proof of both obligations',()=>{
 for(const proof of [undefined,true,{kind:'verified-body-only'},{kind:'settled-effects-only'}])
  assert.equal(decideRunControl({kind:'post-publication-checkpoint-deadline',proof}).action,'legacy');
 assert.deepEqual(decideRunControl({kind:'post-publication-checkpoint-deadline',proof:{kind:'same-fence-publication-and-settled-effects'}}),{
  action:'return-without-finish',status:'unconfirmed',reason:'POST_PUBLICATION_CHECKPOINT_TIMEOUT',
 });
});
for(const mode of ['owned-postcommit-deadline','prepublication-deadline','observer-fake-timeout','persisted-cancel','lost-fence'])
 test('canonical body and terminal truth: '+mode,{timeout:8000},async t=>{
  await mkdir('test-output',{recursive:true});
  const directory=await mkdtemp(resolve('test-output/publication-observer-deadline-'));
  let temporalOffset=0;
  let store=await openSession({directory,clock:()=>Date.now()+temporalOffset,leaseMs:5000});
  t.after(async()=>{store?.close();await rm(directory,{recursive:true,force:true});});
  const command=new AbortController();
  let calls=0,writes=0,releases=0,publications=0,matched=0,notification=0,receipt,successor;
  const wrapped={...store,claim(...args){
   const claim=store.claim(...args);
   return {...claim,
    finish(...a){writes++;return claim.finish(...a);},
    release(...a){releases++;return claim.release(...a);},
    publish(...a){publications++;return claim.publish(...a);},
   };
  }};
  const result=await run({question:'Control observer must not rewrite canonical body.',publication:true,signal:command.signal,
   outputRoot:join(directory,'outputs'),limits:{maxRounds:2,maxTools:2,timeoutMs:720},
   gateway:{mode:'fixture',async next(){calls++;return {kind:'final',text:body};}},
   durable:{store:wrapped,grantId:'checkpoint-deadline-grant',bindings,
    onPublication(){notification++;},
    onCheckpoint(event){
     if(event.phase!==(mode==='prepublication-deadline'?'proposal-sealed':'publication-committed'))return;
     matched++;receipt=event.receipt;
     if(receipt)assert.equal(store.confirmPublication(receipt).content.text,body);
     if(mode==='observer-fake-timeout')throw timeout();
     if(mode==='persisted-cancel')queueMicrotask(()=>command.abort());
     if(mode==='lost-fence'){temporalOffset=6000;successor=store.claim(event.runId,'successor');}
     return new Promise(()=>{});
    },
   }});
  const observed=store.inspect(result.runId);
  assert.equal(calls,1);assert.equal(matched,1);assert.equal(notification,0);
  if(mode==='owned-postcommit-deadline'){
   assert.equal(result.status,'unconfirmed');assert.equal(result.code,'POST_PUBLICATION_CHECKPOINT_TIMEOUT');
   assert.equal(result.answer,body);assert.equal(writes,0);assert.equal(releases,0);
   assert.equal(observed.status,'active');assert.equal(observed.snapshot.phase,'proposal-sealed');
   assert.equal(observed.snapshot.gatewayOutcome,'settled');assert.deepEqual(observed.snapshot.unknownEffects,[]);
  }else if(mode==='persisted-cancel'){
   assert.equal(result.status,'cancelled');assert.equal(observed.status,'cancelled');
  }else if(mode==='lost-fence'){
   assert.equal(result.status,'failed');assert.equal(result.code,'STALE_WRITER');
   assert.equal(observed.owner,'successor');assert.equal(observed.fence,successor.fence);
  }else{
   assert.equal(result.status,'failed');assert.equal(result.code,'TIMEOUT');assert.equal(observed.status,'failed');
  }
  if(mode==='prepublication-deadline'){
   assert.equal(publications,0);assert.equal(store.publication(result.runId),null);
  }else{
   assert.equal(publications,1);assert.equal(store.confirmPublication(receipt).content.text,body);
   assert.equal(store.publicationRevisions(result.runId).length,1);
   store.close();store=await openSession({directory,readOnly:true});
   assert.equal(store.confirmPublication(receipt).content.text,body);
   assert.equal(store.inspect(result.runId).status,observed.status);
  }
 });
