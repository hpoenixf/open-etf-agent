import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {createHookChain} from '../src/hooks.mjs';
import {INTERACTION_BINDING,INTERACTION_PROFILE} from '../src/human-interaction.mjs';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'finalization',version:'1'},plugins:[],adapters:[]};
async function fixture(t,{release,signal,failOutcome=false,interaction=false}={}){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/finalization-lease-'));
 const store=await openSession({directory,leaseMs:500,...(interaction?{profile:INTERACTION_PROFILE}:{})});let renewals=0,runId,realClaim,released=false,modelCalls=0;
 const observed={...store,claim(...args){realClaim=store.claim(...args);runId=realClaim.runId;return{...realClaim,renew(){renewals++;return realClaim.renew();},rootBudget:{...realClaim.rootBudget,snapshot(){if(released&&failOutcome)throw Error('SYNTHETIC_OUTCOME_FAILURE');return realClaim.rootBudget.snapshot();}}};}};
 t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
 const options={question:'Synthetic finalization lease check.',outputRoot:join(directory,'runs'),signal,gateway:{mode:'fixture',async next(){modelCalls++;await sleep(80);return interaction?{kind:'calls',calls:[{id:'synthetic-ask',name:'ask_response',arguments:{question:'Synthetic clarification?'}}]}:{kind:'final',text:'Original synthetic final.'};}},hooks:createHookChain({timeoutMs:1800,release:[async()=>{await release?.({store,runId,claim:realClaim,renewals:()=>renewals});released=true;}]}),limits:{maxRounds:2,maxTools:2,timeoutMs:5000},...(interaction?{ordinaryResponse:true,interaction:{schemaVersion:INTERACTION_PROFILE,maxQuestions:1}}:{}),durable:{store:observed,grantId:'finalization-lease',bindings:interaction?{...bindings,adapters:[INTERACTION_BINDING]}:bindings}};
 return{store,execute:()=>run(options),renewals:()=>renewals,modelCalls:()=>modelCalls,runId:()=>runId};
}

test('original claim renews through asynchronous release and stops after terminal settlement',async t=>{
 let before,after;const f=await fixture(t,{release:async x=>{before=x.renewals();await sleep(1100);after=x.renewals();assert.equal(x.store.inspect(x.runId).owner,x.claim.owner);assert.equal(x.store.inspect(x.runId).fence,x.claim.fence);}});
 const result=await f.execute();assert.equal(result.status,'completed');assert.equal(result.code,null);assert.ok(after>before,'actual original heartbeat must remain active during release');
 const saved=f.store.inspect(result.runId);assert.equal(saved.status,'completed');assert.equal(saved.owner,null);assert.deepEqual(saved.rootUsage,{model:1,tool:0});assert.equal(f.modelCalls(),1);
 const count=f.renewals();await sleep(210);assert.equal(f.renewals(),count,'no heartbeat after run returns');
});

test('external cancellation during a release longer than one lease remains authoritative',async t=>{
 const abort=new AbortController();const f=await fixture(t,{signal:abort.signal,release:async()=>{await sleep(650);abort.abort();await sleep(20);}});
 const result=await f.execute();assert.equal(result.status,'cancelled');assert.equal(result.code,'CANCELLED');assert.equal(f.store.inspect(result.runId).status,'cancelled');assert.equal(f.modelCalls(),1);
 const count=f.renewals();await sleep(210);assert.equal(f.renewals(),count);
});

test('an actually expired writer is not revived or settled by finalization',async t=>{
 const f=await fixture(t,{release:async()=>{const until=performance.now()+650;while(performance.now()<until){};}});
 const result=await f.execute();assert.equal(result.status,'failed');assert.equal(result.code,'STALE_WRITER');assert.equal(f.store.inspect(result.runId).status,'active');assert.equal(f.modelCalls(),1);
 const count=f.renewals();await sleep(210);assert.equal(f.renewals(),count);
});

test('unexpected outcome construction failure still stops the finalization heartbeat',async t=>{
 const f=await fixture(t,{failOutcome:true,release:async()=>{await sleep(650);}});
 await assert.rejects(f.execute(),/SYNTHETIC_OUTCOME_FAILURE/);const count=f.renewals();await sleep(210);assert.equal(f.renewals(),count);assert.equal(f.modelCalls(),1);
});

test('waiting for a response preserves the original question across a long legitimate release',async t=>{
 const f=await fixture(t,{interaction:true,release:()=>sleep(650)});
 const result=await f.execute();assert.equal(result.status,'awaiting-response',result.code);assert.equal(result.code,null);assert.ok(result.questionId);
 const saved=f.store.inspect(result.runId);assert.equal(saved.status,'active');assert.equal(saved.owner,null);assert.equal(saved.snapshot.phase,'awaiting-response');assert.deepEqual(saved.rootUsage,{model:1,tool:1});
 assert.equal(f.modelCalls(),1);const count=f.renewals();await sleep(210);assert.equal(f.renewals(),count);
});

for(const cancellation of ['external signal','durable session'])test('waiting-response release reports authoritative cancellation from '+cancellation,async t=>{
 const abort=new AbortController();const f=await fixture(t,{interaction:true,signal:abort.signal,release:async({store,runId})=>{await sleep(650);if(cancellation==='external signal')abort.abort();else store.cancel(runId);await sleep(20);}});
 const result=await f.execute();assert.equal(result.status,'cancelled');assert.equal(result.code,'CANCELLED');assert.equal(result.questionId,undefined);
 const saved=f.store.inspect(result.runId);assert.equal(saved.status,'cancelled');assert.equal(saved.owner,null);assert.deepEqual(saved.rootUsage,{model:1,tool:1});assert.equal(f.modelCalls(),1);
 const count=f.renewals();await sleep(210);assert.equal(f.renewals(),count);
});
