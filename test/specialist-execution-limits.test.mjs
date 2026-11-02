import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import * as runtime from '../src/runtime.mjs';
const {run,cancelRuntimeCheckpoint,validateGatewayOutcomeCheckpoint}=runtime;
import {openSession} from '../src/session.mjs';
import * as childOwner from '../src/child.mjs';
const {SOURCE_CHECK_METHOD,SOURCE_CHECK_LIMITS,sourceCheckQuestion,sourceCheckExecutionLimits}=childOwner;
import {sourceCheckBinding,createSpecialistChildBinding,readSpecialistHandoff} from '../src/specialist-child.mjs';
const question='Synthetic optional specialist execution budget.',documents=['atlas-a'];
const executionLimits={maxRounds:24,maxTools:2,timeoutMs:3600000};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/specialist-limits-'));}

test('optional specialist execution limits are exact trusted bounded fields; absent question bytes stay legacy',()=>{
 const input={question,documents,localQuestion:'Check page one.',callId:'delegate'};
 const old=SOURCE_CHECK_METHOD.text+'\n'+JSON.stringify({method:{id:SOURCE_CHECK_METHOD.id,version:SOURCE_CHECK_METHOD.version},originalQuestion:question,localQuestion:input.localQuestion,documents,executionBudget:SOURCE_CHECK_LIMITS,budgetInstruction:'Plan within this total read_page allowance across all pages; after acquiring the scoped pages, summarize without additional tool calls. The budget is a limit, not permission to access other documents.',delegationCallId:'delegate'});
 assert.equal(sourceCheckQuestion(input),old);assert.deepEqual(JSON.parse(sourceCheckQuestion({...input,executionLimits}).split('\n').at(-1)).executionBudget,executionLimits);assert.equal(sourceCheckExecutionLimits(),SOURCE_CHECK_LIMITS);
 assert.deepEqual(sourceCheckExecutionLimits(executionLimits),executionLimits);
 assert.notDeepEqual(sourceCheckBinding({question,documents}),sourceCheckBinding({question,documents,executionLimits:SOURCE_CHECK_LIMITS}));
 assert.deepEqual(JSON.parse(sourceCheckQuestion({...input,executionLimits}).split('\n').at(-1)).executionBudget,executionLimits);
 for(const value of [null,[],Object.create(executionLimits),{...executionLimits,extra:1},{...executionLimits,[Symbol('extra')]:1},{maxRounds:24,maxTools:2},{...executionLimits,maxRounds:25},{...executionLimits,maxRounds:0},{...executionLimits,maxRounds:1.5},{...executionLimits,maxTools:3},{...executionLimits,maxTools:1},{...executionLimits,timeoutMs:3600001},{...executionLimits,timeoutMs:0},{...executionLimits,timeoutMs:'3600000'}])assert.throws(()=>sourceCheckBinding({question,documents,executionLimits:value}),{code:'INVALID_SPECIALIST_EXECUTION_LIMITS'});
});

test('explicit specialist budget binds original Child chain, readonly custody, reconcile and parent deadline without new authority',async()=>{
 const dir=await directory(),store=await openSession({directory:dir});let token,mainCalls=0,childCalls=0,reconciled=0,seen;
 const mutable={...executionLimits};const adapter=createSpecialistChildBinding({store,parentClaim:()=>token,question,documents,executionLimits:mutable,outputRoot:join(dir,'runs'),gatewayFactory:()=>({mode:'fixture',next:({messages,tools})=>{childCalls++;assert.deepEqual(tools.map(t=>t.name),['read_page']);assert.deepEqual(JSON.parse(messages[0].content.split('\n').at(-1)).executionBudget,executionLimits);return messages.some(m=>m.role==='tool')?{kind:'final',text:'Original bounded Child source.'}:call('child-page','read_page',{documentId:'atlas-a',page:1});}})});mutable.maxTools=999;
 const originalExecute=adapter.execute;adapter.execute=async(value,context)=>{const result=await originalExecute(value,context);assert.deepEqual(await adapter.reconcile(value,context),result);reconciled++;return result;};
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'bounded-child',version:'1'},plugins:[],adapters:[sourceCheckBinding({question,documents,executionLimits})]};
 try{
 const result=await run({question,gateway:{mode:'fixture',next:({messages})=>{mainCalls++;if(mainCalls===1)return call('delegate','source_check',{question:'Check page one.'});seen=messages.at(-1).result.value;return{kind:'final',text:'Original Main consumed Child.'};}},extensions:[adapter],outputRoot:join(dir,'runs'),allowedTools:['source_check','read_page'],allowedDocuments:documents,requireReport:false,limits:{maxRounds:36,maxTools:72,timeoutMs:3600000},durable:{store,grantId:'synthetic-limits',bindings,deadlineAt:Date.now()+30000,rootLimits:{model:57,tool:72},onClaim:t=>token=t}});
 assert.equal(result.status,'completed',result.code);assert.deepEqual(result.rootUsage,{model:4,tool:2});assert.equal(mainCalls,2);assert.equal(childCalls,2);assert.equal(reconciled,1);
 const parent=store.inspect(result.runId),child=store.findChild(result.runId,'source-check-v1');assert.deepEqual(child.definition.limits,executionLimits);assert.equal(child.definition.deadlineAt,parent.definition.deadlineAt);assert.deepEqual(child.definition.config.allowedTools,['read_page']);assert.equal(child.definition.config.publication,undefined);
 const bytes=await readFile(join(dir,'session.sqlite'));const reader=await openSession({directory:dir,readOnly:true});try{const handoff=await readSpecialistHandoff({store:reader,parentRunId:result.runId,question,documents,executionLimits});assert.deepEqual(handoff,seen);assert.equal(reader.claim,undefined);await assert.rejects(readSpecialistHandoff({store:reader,parentRunId:result.runId,question,documents}),{code:'SPECIALIST_BINDING_MISMATCH'});await assert.rejects(readSpecialistHandoff({store:reader,parentRunId:result.runId,question,documents,executionLimits:{...executionLimits,maxRounds:23}}),{code:'SPECIALIST_BINDING_MISMATCH'});
 for(const mutate of [v=>v.definition.limits.timeoutMs--,v=>v.definition.deadlineAt++,v=>v.definition.config.allowedTools.push('save_report')]){const altered=structuredClone(child);mutate(altered);await assert.rejects(readSpecialistHandoff({store:{...reader,findChild:()=>altered},parentRunId:result.runId,question,documents,executionLimits}),{code:'SPECIALIST_IDENTITY_MISMATCH'});}
 }finally{reader.close();}assert.deepEqual(await readFile(join(dir,'session.sqlite')),bytes);assert.equal(childCalls,2);
 }finally{store.close();}
});

test('optional Gateway outcome codec rejects forged states; cancellation retains one complete effect and uncertain reservation',()=>{
 const dispatch={callId:'original',effective:{id:'original',name:'read_page',arguments:{documentId:'atlas-a',page:1}},requestHash:'synthetic-request'};
 const state={phase:'tool-dispatched',inFlight:dispatch,unknownEffects:[],working:{kept:true},result:{kept:true},gatewayOutcome:'settled'};
 const cancelled=cancelRuntimeCheckpoint(state);assert.equal(cancelled.inFlight,undefined);assert.deepEqual(cancelled.unknownEffects,[{...dispatch,status:'unknown',dispatched:true}]);assert.deepEqual(cancelled.working,state.working);assert.deepEqual(cancelled.result,state.result);assert.equal(state.inFlight,dispatch);assert.deepEqual(cancelRuntimeCheckpoint(cancelled),cancelled);
 assert.equal(cancelRuntimeCheckpoint({phase:'model-reserved',unknownEffects:[],gatewayOutcome:'settled'}).gatewayOutcome,'unknown');validateGatewayOutcomeCheckpoint({});validateGatewayOutcomeCheckpoint({status:'failed',gatewayOutcome:'unknown'});
 assert.throws(()=>validateGatewayOutcomeCheckpoint({gatewayOutcome:'forged'}),{code:'INVALID_GATEWAY_OUTCOME'});assert.throws(()=>validateGatewayOutcomeCheckpoint({status:'completed',gatewayOutcome:'unknown'}),{code:'INVALID_GATEWAY_OUTCOME'});
});

test('one-hour Runtime and Session ceiling does not change defaults or permit +1',async()=>{
 const root=await directory();let calls=0;const gateway={mode:'fixture',next:()=>{calls++;return{kind:'final',text:'Synthetic terminal.'};}};
 await assert.rejects(run({question,gateway,outputRoot:root,limits:{timeoutMs:3600001}}),{code:'INVALID_LIMIT'});assert.equal(calls,0);
 const store=await openSession({directory:root});const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'timeout-owner',version:'1'},plugins:[],adapters:[]};
 try{const out=await run({question,gateway,requireReport:false,outputRoot:join(root,'runs'),durable:{store,grantId:'synthetic-timeout',bindings}});const old=store.inspect(out.runId);assert.deepEqual(old.definition.limits,{maxRounds:24,maxTools:64,timeoutMs:120000});const definition={...old.definition,limits:{...old.definition.limits,timeoutMs:3600001}};assert.throws(()=>store.create({definition,snapshot:old.snapshot,directory:old.directory}),{code:'INVALID_DEFINITION'});}finally{store.close();}
});
