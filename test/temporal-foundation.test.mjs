import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { run, submitRun } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
import { createTaskTime, taskTimeMessage } from '../src/temporal.mjs';
const selection={anchorInstant:'2026-10-28T00:30:00.000Z',timeZone:'America/Los_Angeles'};
const expected=createTaskTime(selection);
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'temporal-foundation',version:'1'},plugins:[],adapters:[]};
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/temporal-foundation-'));}

test('fixed taskTime does not bypass missing working-input consumer admission',async()=>{
 const outputRoot=await directory();let calls=0;const allowedTools=['read_page'];
 await assert.rejects(run({question:'Interpret the explicit task anchor.',taskTime:selection,contextBytes:4000,allowedTools,outputRoot,gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Must not execute.'};}}}),error=>error.code==='WORKING_INPUT_TOOL_UNAVAILABLE');
 assert.equal(calls,0);assert.deepEqual(allowedTools,['read_page']);assert.deepEqual(await readdir(outputRoot),[]);
});

test('one-hour admission preserves the first taskTime and deadline on omitted-anchor repeat',async()=>{
 const directoryPath=await directory(),store=await openSession({directory:directoryPath});let calls=0;
 const options={question:'Preserve the first admitted task clock.',taskTime:selection,limits:{maxRounds:4,maxTools:4,timeoutMs:3600000},outputRoot:join(directoryPath,'runs'),gateway:{mode:'fixture',async next(){calls++;}},durable:{store,runId:'temporal-one-hour',grantId:'temporal-foundation',bindings}};
 try{
  const original=await submitRun(options);assert.deepEqual(original.definition.config.taskTime,expected);assert.equal(original.definition.limits.timeoutMs,3600000);
  const repeated=await submitRun({...options,taskTime:{timeZone:selection.timeZone}});assert.deepEqual(repeated,original);
  await assert.rejects(submitRun({...options,taskTime:{...selection,timeZone:'Asia/Tokyo'}}),error=>error.code==='RUN_BINDINGS_MISMATCH');
  assert.deepEqual(store.inspect(original.runId).definition,original.definition);assert.deepEqual(original.rootUsage,{model:0,tool:0});assert.equal(calls,0);
 }finally{store.close();}
});

test('cancelled temporal dispatch preserves unknown identity and original time on zero-call cold read',async()=>{
 const directoryPath=await directory(),controller=new AbortController();let store=await openSession({directory:directoryPath});let models=0,tools=0,first,saved;
 const extension={name:'temporal_pending',description:'Synthetic pending effect.',parameters:{type:'object',properties:{},additionalProperties:false},validate(){},execute(){tools++;controller.abort();return new Promise(()=>{});}};
 const options={question:'Keep original task time through cancellation.',taskTime:selection,limits:{maxRounds:4,maxTools:4,timeoutMs:300000},outputRoot:join(directoryPath,'runs'),requireReport:false,extensions:[extension],signal:controller.signal,gateway:{mode:'fixture',async next({messages}){models++;assert.deepEqual(messages[1],taskTimeMessage(expected));return{kind:'calls',calls:[{id:'pending-time',name:extension.name,arguments:{}}]};}},durable:{store,grantId:'temporal-foundation',bindings}};
 try{
  first=await run(options);assert.equal(first.status,'cancelled');assert.equal(first.unknownEffects.length,1);saved=store.inspect(first.runId);
  assert.deepEqual(saved.definition.config.taskTime,expected);assert.deepEqual(saved.snapshot.unknownEffects,first.unknownEffects);assert.equal(Object.hasOwn(saved.snapshot,'inFlight'),false);
  assert.deepEqual(store.cancel(first.runId),saved);
 }finally{store.close();}
 store=await openSession({directory:directoryPath});
 try{
  const result=await run({...options,taskTime:undefined,signal:undefined,durable:{...options.durable,store,runId:first.runId}});
  assert.equal(result.status,'cancelled');assert.deepEqual(result.unknownEffects,first.unknownEffects);assert.deepEqual(result.rootUsage,{model:1,tool:1});assert.equal(models,1);assert.equal(tools,1);assert.deepEqual(store.inspect(first.runId),saved);
 }finally{store.close();}
});
