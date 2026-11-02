import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { run } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
import { createTaskTime,taskTimeMessage } from '../src/temporal.mjs';
const taskTime={anchorInstant:'2026-10-28T00:30:00.000Z',timeZone:'America/Los_Angeles'};
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'ordinary-foundation',version:'1'},plugins:[],adapters:[{id:'ordinary-response',version:'1'}]};
async function setup(){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/ordinary-foundation-'));return{directory,store:await openSession({directory,profile:'ordinary-response@1'})};}
function options(store,directory,gateway){return{question:'Use one original ordinary reply without granting authority.',ordinaryResponse:true,requireReport:false,taskTime,limits:{maxRounds:4,maxTools:4,timeoutMs:3600000},outputRoot:join(directory,'runs'),gateway,durable:{store,grantId:'ordinary-foundation',bindings}};}
const question={kind:'calls',calls:[{id:'ask-foundation',name:'ask_response',arguments:{question:'Which fixed synthetic label?'}}]};

test('one-hour support never removes the ordinary fixture-only gateway guard',async()=>{
 const {store,directory}=await setup();let calls=0;
 try{for(const mode of ['live','test']){const opts=options(store,directory,{mode,async next(){calls++;return question;}});opts.durable.bindings={...bindings,gateway:{...bindings.gateway,mode}};await assert.rejects(run(opts),error=>error.code==='ORDINARY_PROFILE_REQUIRED');}assert.equal(calls,0);}finally{store.close();}
});

test('one-hour ordinary question always yields, receipt-only then adopts once with original taskTime',async()=>{
 let {store,directory}=await setup();let calls=0,first,done,original;
 const gateway={mode:'fixture',async next({messages}){calls++;assert.deepEqual(messages[1],taskTimeMessage(createTaskTime(taskTime)));const reply=messages.find(m=>m.role==='tool'&&m.callId==='ask-foundation');if(!reply)return question;assert.equal(reply.result.value.text,'fixed synthetic reply');return{kind:'final',text:'Original reply consumed.'};}};
 const opts=options(store,directory,gateway);
 try{
  first=await run(opts);assert.equal(first.status,'awaiting-response');assert.equal(calls,1);original=store.inspect(first.runId);assert.equal(original.definition.limits.timeoutMs,3600000);assert.equal(original.owner,null);
  store.receiveResponse({runId:first.runId,questionId:first.questionId,responseId:'ordinary-hour-reply',text:'fixed synthetic reply'});assert.deepEqual(store.inspect(first.runId),original);assert.equal(store.responseStatus(first.runId).status,'received-not-adopted');
  done=await run({...opts,taskTime:undefined,durable:{...opts.durable,runId:first.runId}});assert.equal(done.status,'completed');assert.equal(calls,2);assert.deepEqual(done.rootUsage,{model:2,tool:1});assert.equal(store.responseStatus(first.runId).status,'adopted');assert.deepEqual(store.inspect(first.runId).definition,original.definition);
 }finally{store.close();}
 store=await openSession({directory});
 try{const read=await run({...opts,taskTime:undefined,durable:{...opts.durable,store,runId:first.runId}});assert.deepEqual(read,done);assert.equal(calls,2);assert.deepEqual(store.inspect(first.runId).definition,original.definition);}finally{store.close();}
});

test('ordinary receipt survives cancellation without unknown invention or response adoption',async()=>{
 let {store,directory}=await setup();let calls=0,first,receipt,definition;
 const opts=options(store,directory,{mode:'fixture',async next(){calls++;return question;}});
 try{first=await run(opts);definition=store.inspect(first.runId).definition;receipt=store.receiveResponse({runId:first.runId,questionId:first.questionId,responseId:'cancelled-original',text:'retain exact synthetic reply'});const cancelled=store.cancel(first.runId);assert.deepEqual(cancelled.snapshot.unknownEffects,[]);assert.equal(Object.hasOwn(cancelled.snapshot,'inFlight'),false);assert.deepEqual(store.cancel(first.runId),cancelled);assert.equal(store.responseStatus(first.runId).adoptedAt,null);}finally{store.close();}
 store=await openSession({directory});
 try{const read=await run({...opts,taskTime:undefined,durable:{...opts.durable,store,runId:first.runId}});assert.equal(read.status,'cancelled');assert.deepEqual(read.unknownEffects,[]);assert.deepEqual(read.rootUsage,{model:1,tool:1});assert.equal(calls,1);const fact=store.response(first.runId,first.questionId);assert.deepEqual(fact.receipt,receipt);assert.equal(fact.adoption,null);assert.deepEqual(store.inspect(first.runId).definition,definition);}finally{store.close();}
});
