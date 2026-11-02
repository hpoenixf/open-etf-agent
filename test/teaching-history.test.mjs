import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {run} from '../src/runtime.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
import {openSession} from '../src/session.mjs';
import {createChatGateway} from '../src/gateway.mjs';
const publication=true;
const sha=x=>createHash('sha256').update(x).digest('hex');
const bindings={gateway:{mode:'live',provider:'local',protocol:'teaching-fixture@1',model:'teaching',version:'1'},plugins:[],adapters:publication?[{id:'publication',version:'publication@1'}]:[]};
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/teaching-history-'));}
const gateway=response=>createChatGateway({endpoint:'https://synthetic.invalid/v1/chat/completions',model:'teaching',apiKey:'synthetic',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:async()=>new Response(JSON.stringify({choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:response}}]}))});
test('teaching owner seam: escaped complete body survives original durable checkpoint and reopen',async()=>{
 const directoryPath=await directory(),text='\u0001'.repeat(256*1024);let store=await openSession({directory:directoryPath});let outcome;
 try{outcome=await run({question:'Return the complete synthetic lesson.',gateway:gateway(text),outputRoot:join(directoryPath,'runs'),...(publication?{publication:true}:{}),durable:{store,grantId:'teaching-fixture',bindings}});assert.equal(outcome.status,'completed',outcome.code);assert.equal(outcome.answer,text);const state=store.inspect(outcome.runId);assert.equal(state.snapshot.answer,text);assert.ok(Buffer.byteLength(JSON.stringify(state.snapshot))>3*1048576);if(publication)assert.equal(store.confirmPublication(outcome.publication).content.text,text);}finally{store.close();}
 const before=sha(await readFile(join(directoryPath,'session.sqlite')));store=await openSession({directory:directoryPath});try{assert.equal(store.inspect(outcome.runId).snapshot.answer,text);if(publication)assert.equal(store.confirmPublication(outcome.publication).content.text,text);}finally{store.close();}assert.equal(sha(await readFile(join(directoryPath,'session.sqlite'))),before);
});
test('teaching owner seam: useful defaults and explicit report, round and tool limits remain authoritative',async()=>{
 let next=0;const root=await directory();const g={next:async()=>next++<13?{kind:'calls',calls:[{id:'read-'+next,name:'read_page',arguments:{documentId:'atlas-a',page:1}}]}:{kind:'final',text:'Complete direct lesson.'}};
 const result=await run({question:'Use thirteen actual reads then answer.',gateway:g,outputRoot:root});assert.equal(result.status,'completed',result.code);assert.equal(result.toolsDispatched,13);assert.equal(result.rounds,14);assert.equal(result.receipt,null);
 const report=await run({question:'A report is explicitly required.',gateway:{next:async()=>({kind:'final',text:'No report saved.'})},requireReport:true,outputRoot:root});assert.equal(report.code,'REPORT_REQUIRED');
 const reader=()=>{let n=0;return {next:async()=>({kind:'calls',calls:[{id:'read-'+(++n),name:'read_page',arguments:{documentId:'atlas-a',page:1}}]})};};
 const round=await run({question:'Respect one round.',gateway:reader(),limits:{maxRounds:1},outputRoot:root});assert.equal(round.code,'ROUND_LIMIT');assert.equal(round.toolsDispatched,1);
 const tool=await run({question:'Respect one tool.',gateway:reader(),limits:{maxTools:1},outputRoot:root});assert.equal(tool.code,'TOOL_LIMIT');assert.equal(tool.toolsDispatched,1);
 const bounded=await run({question:'Respect the explicit shared parent budget.',gateway:reader(),rootBudget:createRootBudget({model:1,tool:1}),outputRoot:root});assert.equal(bounded.code,'ROOT_BUDGET_EXHAUSTED');assert.deepEqual(bounded.rootUsage,{model:1,tool:1});
});
