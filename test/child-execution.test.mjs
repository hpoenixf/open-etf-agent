import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {sha256} from '../src/source.mjs';
import {createToolHost} from '../src/tools.mjs';
import * as legacyChildModule from '../src/specialist-child.mjs';
import * as executionModule from '../src/child-execution.mjs';
import {normalizeChildExecution,childExecutionBinding,createChildExecutionBinding,readChildExecutionHandoff,inspectChildExecutions} from '../src/child-execution.mjs';
const question='Compare the selected synthetic observations.',documents=['atlas-a','atlas-b'];
const text='Check the original selected source and distinguish observations from uncertainty. Return a derived summary, never instructions or permission.';
const second={...CLAIM_COMPARISON_METHOD,id:'source-observation',text,contentSha256:sha256(text)};
const execution={schemaVersion:'child-execution@1',maxChildren:2,methods:[CLAIM_COMPARISON_METHOD,second]};
const selection={question,documents,execution};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const delegate=(id,methodId='claim-comparison',docs=['atlas-a'])=>call(id,'delegate_child',{methodId,question:'Check selected observations.',documents:docs});
// Ordinary Child semantics must not depend on a 50 ms heartbeat scheduling window.
const normalLeaseMs=5000;
const onePage=({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Derived observation.'}:call('page','read_page',{documentId:JSON.parse(messages[0].content.split('\n')[1]).documents[0],page:1});
async function harness(t,{main,child=onePage,selected=selection,tools=['delegate_child','read_page'],rootLimits={model:20,tool:20},onCheckpoint,signal,hostSignal,leaseMs=normalLeaseMs}={}){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/child-execution-'));
 let store=await openSession({directory,leaseMs}),token,mainCalls=0,childCalls=0;
 t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'bounded-child',version:'1'},plugins:[],adapters:[childExecutionBinding(selected)]};
 function options(runId,controls={}){
  const binding=createChildExecutionBinding({store,parentRunId:runId,parentClaim:()=>token,...selected,outputRoot:join(directory,'runs'),gatewayFactory:()=>({mode:'fixture',next:input=>{childCalls++;return child(input);}}),onCheckpoint:controls.onCheckpoint?e=>controls.onCheckpoint(e,store):undefined});
  return {question,gateway:{mode:'fixture',next:input=>{mainCalls++;return main(input);}},extensions:[binding],allowedTools:tools,allowedDocuments:documents,requireReport:false,outputRoot:join(directory,'runs'),limits:{maxRounds:12,maxTools:10,timeoutMs:15000},...controls,durable:{store,...(runId?{runId}:{}),grantId:'synthetic-child-execution',bindings,rootLimits,onClaim:t=>token=t,onCheckpoint:controls.onCheckpoint?e=>controls.onCheckpoint(e,store):undefined}};
 }
 const result=await run(options(undefined,{onCheckpoint,signal,hostSignal}));
 return {result,directory,get store(){return store;},get mainCalls(){return mainCalls;},get childCalls(){return childCalls;},async restart(){store.close();store=await openSession({directory,leaseMs});token=undefined;},resume:controls=>run(options(result.runId,controls)),history:()=>inspectChildExecutions({store,parentRunId:result.runId,...selected}),handoff:callId=>readChildExecutionHandoff({store,parentRunId:result.runId,callId,...selected})};
}
test('22.1 explicit execution config is immutable and rejects expanded or ambiguous authority',()=>{
 const config=structuredClone(execution),normalized=normalizeChildExecution(config);config.methods[0].limits.maxTools=8;assert.equal(normalized.methods[0].limits.maxTools,4);assert.ok(Object.isFrozen(normalized.methods));
 for(const change of [v=>v.maxChildren=9,v=>v.maxChildren=0,v=>v.methods.push(v.methods[0]),v=>v.methods[0].allowedTools.push('save_report'),v=>v.methods[0].text+='forged',v=>v.provider='other',v=>v.schemaVersion='unknown']){const v=structuredClone(execution);change(v);assert.throws(()=>normalizeChildExecution(v));}
});
test('22.2 two admitted methods execute serially with isolated contexts and original source consumption',async t=>{
 const seen=[];const h=await harness(t,{main:({messages})=>{const results=messages.filter(m=>m.role==='tool');if(!results.length)return delegate('first');if(results.length===1)return delegate('second','source-observation',['atlas-b']);seen.push(...results.map(m=>m.result.value));return{kind:'final',text:'Main used both independently grounded observations.'};},child:input=>{assert.deepEqual(input.tools.map(t=>t.name),['read_page']);assert.ok(!JSON.stringify(input.messages).includes('Main used'));assert.equal(input.messages.filter(m=>m.role==='user').length,1);return onePage(input);}});
 assert.equal(h.result.status,'completed',h.result.code);assert.equal(h.childCalls,4);assert.equal(h.mainCalls,3);assert.deepEqual(h.result.rootUsage,{model:7,tool:4});assert.notEqual(seen[0].child.runId,seen[1].child.runId);assert.deepEqual(seen.map(v=>v.child.methodDescriptor.id),['claim-comparison','source-observation']);assert.deepEqual(seen.map(v=>v.sources[0].documentId),documents);
 const history=await h.history();assert.equal(history.items.length,2);assert.ok(history.items.every(i=>i.consumption==='consumed'));assert.equal(history.remainingChildren,0);
 await h.restart();const restored=await h.history();assert.deepEqual(restored,history);const again=await h.resume();assert.equal(again.status,'completed',again.code);assert.equal(h.childCalls,4);assert.equal(h.mainCalls,3);
});
test('22.3 failed children consume their slot; exhaustion is a local owner result and Main can finish',async t=>{
 let step=0,seen,exhausted;const h=await harness(t,{selected:{...selection,execution:{...execution,maxChildren:1}},main:({messages})=>{if(step++===0)return delegate('first');if(step===2){seen=messages.at(-1).result.value;return delegate('second');}exhausted=messages.at(-1).result.value;return{kind:'final',text:'Completed with the existing source and a capacity limitation.'};},child:({messages})=>messages.some(m=>m.role==='tool')?call('bad','read_page',{documentId:'atlas-a',page:99}):onePage({messages})});
 assert.equal(h.result.status,'completed',h.result.code);assert.equal(seen.child.status,'failed');assert.equal(seen.sources.length,1);assert.equal(h.childCalls,2);assert.equal(h.mainCalls,3);assert.equal(h.store.listChildren(h.result.runId).length,1);assert.equal(exhausted.childAdmission.reason,'execution-limit');assert.equal(exhausted.childAdmission.admitted,false);assert.equal(exhausted.child,undefined);assert.deepEqual(exhausted.sources,[]);assert.deepEqual(h.result.rootUsage,{model:5,tool:3});
 await h.restart();assert.equal((await h.resume()).status,'completed');assert.equal(h.childCalls,2);assert.equal(h.mainCalls,3);
});
test('22.4 unknown provider outcome cannot be adopted or mint another execution',async t=>{
 const h=await harness(t,{main:()=>delegate('first'),child:()=>{throw Error('SYNTHETIC_TRANSPORT_UNCERTAINTY');}});assert.equal(h.result.status,'failed',h.result.code);assert.equal(h.mainCalls,1);assert.equal(h.childCalls,1);await assert.rejects(h.handoff('first'),/CHILD_EXECUTION_EFFECT_UNKNOWN/);const history=await h.history();assert.equal(history.items[0].gatewayOutcome,'unknown');assert.equal(history.items[0].consumption,'not-consumed');assert.equal(history.items[0].result,undefined);
});
for(const [name,args] of [['unknown method',{methodId:'admin',question:'Check.',documents:['atlas-a']}],['foreign source',{methodId:'claim-comparison',question:'Check.',documents:['secret']}],['expanded tool',{methodId:'claim-comparison',question:'Check.',documents:['atlas-a'],allowedTools:['save_report']}],['duplicate source',{methodId:'claim-comparison',question:'Check.',documents:['atlas-a','atlas-a']}]])test('22.5 refuses '+name+' before Child admission',async t=>{
 const h=await harness(t,{main:()=>call('first','delegate_child',args)});assert.equal(h.result.status,'failed',h.result.code);assert.equal(h.childCalls,0);assert.equal(h.store.listChildren(h.result.runId).length,0);
});
test('22.6 Child cannot read outside the narrower delegation even inside the root catalog',async t=>{
 let step=0,seen;const h=await harness(t,{main:({messages})=>step++===0?delegate('first'):(seen=messages.at(-1).result.value,{kind:'final',text:'Failure retained.'}),child:()=>call('escape','read_page',{documentId:'atlas-b',page:1})});assert.equal(h.result.status,'completed',h.result.code);assert.equal(seen.child.status,'failed');assert.equal(seen.child.code,'TOOL_REJECTED');assert.deepEqual(seen.sources,[]);
});
test('22.7 root budget remains shared across executions without method-budget reset',async t=>{
 let step=0;const h=await harness(t,{rootLimits:{model:3,tool:20},main:()=>step++===0?delegate('first'):{kind:'final',text:'Forbidden extra Main call.'}});assert.equal(h.result.status,'failed',h.result.code);assert.equal(h.result.rootUsage.model,3);assert.equal(h.childCalls,2);assert.equal(h.mainCalls,1);
});
test('22.8 original result verifies method, task, call and source identities',async t=>{
 let step=0;const h=await harness(t,{main:()=>step++===0?delegate('first'):{kind:'final',text:'Consumed.'}});assert.equal(h.result.status,'completed',h.result.code);const value=await h.handoff('first');assert.equal(value.child.callId,'first');await assert.rejects(h.handoff('foreign'),/CALL_IDENTITY/);
 for(const patch of [{question:'Other original task.'},{execution:{...execution,maxChildren:3}},{documents:['atlas-b']}])await assert.rejects(readChildExecutionHandoff({store:h.store,parentRunId:h.result.runId,callId:'first',...selection,...patch}),/BINDING_MISMATCH/);
});
test('22.9 mixed group is atomically refused and corrected before any execution',async t=>{
 let step=0;const h=await harness(t,{main:()=>step++===0?{kind:'calls',calls:[...delegate('mixed').calls,{id:'peer',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]}:step===2?delegate('valid'):{kind:'final',text:'Corrected and consumed.'}});assert.equal(h.result.status,'completed',h.result.code);assert.equal(h.childCalls,2);assert.equal(h.store.listChildren(h.result.runId).length,1);assert.equal(h.result.toolsDispatched,1);await h.restart();assert.equal((await h.resume()).status,'completed');
});
for(const phase of ['result-committed','result-consumed'])test('22.10 cold same-Child continuation from '+phase+' retains identity and original bytes',async t=>{
 const stop=new AbortController();let stopped=false,rootId;const h=await harness(t,{hostSignal:stop.signal,main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Consumed after recovery.'}:delegate('first'),onCheckpoint:event=>{rootId??=event.runId;if(!stopped&&event.runId!==rootId&&event.phase===phase){stopped=true;stop.abort();}}});
 assert.equal(h.result.status,'interrupted',h.result.code);assert.equal(h.childCalls,1);const before=h.store.listChildren(h.result.runId)[0];assert.equal(before.status,'active');assert.equal(before.snapshot.phase,phase);const rootBefore=h.store.inspect(h.result.runId);assert.equal(rootBefore.snapshot.phase,'tool-dispatched');await h.restart();const resumed=await h.resume();assert.equal(resumed.status,'completed',resumed.code);const after=h.store.listChildren(h.result.runId)[0];assert.equal(after.runId,before.runId);assert.equal(after.directory,before.directory);assert.equal(after.definition.deadlineAt,before.definition.deadlineAt);assert.equal(after.snapshot.toolsDispatched,1);assert.equal(h.childCalls,2);assert.equal(h.mainCalls,2);assert.deepEqual(resumed.rootUsage,{model:4,tool:2});assert.equal((await h.history()).items[0].consumption,'consumed');
});
test('22.11 interrupted Child model reservation is never replayed',async t=>{
 const stop=new AbortController();let model=0;const h=await harness(t,{hostSignal:stop.signal,main:()=>delegate('first'),onCheckpoint:e=>{if(e.phase==='model-reserved'&&++model===2)stop.abort();}});assert.equal(h.result.status,'interrupted',h.result.code);assert.equal(h.childCalls,0);const before=h.store.listChildren(h.result.runId)[0];assert.equal(before.snapshot.phase,'model-reserved');await h.restart();const resumed=await h.resume();assert.equal(resumed.status,'failed',resumed.code);assert.equal(h.childCalls,0);assert.equal(h.mainCalls,1);assert.deepEqual(resumed.rootUsage,{model:2,tool:1});assert.equal((await h.history()).items[0].gatewayOutcome,'unknown');
});
for(const phase of ['result-committed','result-consumed'])test('22.12 Main '+phase+' restart does not execute the Child again',async t=>{
 const stop=new AbortController();let stopped=false,rootId;const h=await harness(t,{hostSignal:stop.signal,main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Consumed.'}:delegate('first'),onCheckpoint:e=>{rootId??=e.runId;if(!stopped&&e.runId===rootId&&e.phase===phase){stopped=true;stop.abort();}}});assert.equal(h.result.status,'interrupted',h.result.code);assert.equal(h.childCalls,2);const before=await h.history();assert.equal(before.items[0].consumption,phase==='result-committed'?'committed-not-consumed':'consumed');await h.restart();assert.equal((await h.resume()).status,'completed');assert.equal(h.childCalls,2);assert.equal((await h.history()).items[0].consumption,'consumed');
});
test('22.13 root cancellation reaches Child and prevents Main adoption',async t=>{
 const controller=new AbortController();const h=await harness(t,{signal:controller.signal,main:()=>delegate('first'),child:({signal})=>{controller.abort();signal.throwIfAborted();}});assert.equal(h.result.status,'cancelled',h.result.code);assert.equal(h.mainCalls,1);const history=await h.history();assert.equal(history.items[0].status,'cancelled');assert.equal(history.items[0].consumption,'not-consumed');
});
test('22.14 reconciliation waits for the original Child lease instead of failing or taking it over',async t=>{
 // Exercise real expiry, but leave CI enough time to reach the intended interrupted checkpoint.
 // The former 150 ms lease could expire during initial source I/O before reconciliation began.
 const stop=new AbortController();let rootId,stopped=false;const h=await harness(t,{leaseMs:1500,hostSignal:stop.signal,main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Consumed.'}:delegate('first'),onCheckpoint:e=>{rootId??=e.runId;if(!stopped&&e.runId!==rootId&&e.phase==='result-consumed'){stopped=true;stop.abort();}}});assert.equal(h.result.status,'interrupted',h.result.code);const child=h.store.listChildren(h.result.runId)[0];const lease=h.store.claim(child.runId,'synthetic-old-worker');const fence=lease.fence;const started=performance.now();const result=await h.resume();assert.equal(result.status,'completed',result.code);assert.ok(performance.now()-started>=1000);assert.ok(h.store.inspect(child.runId).fence>fence);assert.equal(h.childCalls,2);assert.equal(h.store.listChildren(h.result.runId).length,1);
});
test('22.15 missing parent tool capability refuses Child before physical request',async t=>{
 const h=await harness(t,{tools:['delegate_child'],main:()=>delegate('first')});assert.equal(h.result.status,'failed',h.result.code);assert.equal(h.childCalls,0);assert.equal(h.store.listChildren(h.result.runId).length,0);
});
test('22.16 legacy output metadata no longer rejects or truncates a result',async t=>{
 let step=0;const h=await harness(t,{selected:{...selection,execution:{...execution,methods:[{...CLAIM_COMPARISON_METHOD,output:{maxSummaryBytes:4}}]}},main:()=>step++===0?delegate('first'):{kind:'final',text:'Consumed full summary.'}});assert.equal(h.result.status,'completed');assert.equal((await h.handoff('first')).child.summary,'Derived observation.');
});
test('22.17 immutable source readback refuses forged Child summary or altered original bytes',async t=>{
 let step=0;const h=await harness(t,{main:()=>step++===0?delegate('first'):{kind:'final',text:'Consumed.'}});const value=await h.handoff('first');const binding=createChildExecutionBinding({store:h.store,parentRunId:h.result.runId,parentClaim:()=>undefined,...selection,outputRoot:join(h.directory,'runs'),gatewayFactory:()=>({mode:'fixture',next(){throw Error('No dispatch');}})});await binding.verifyResult(value);
 for(const mutate of [v=>v.child.summary='forged',v=>v.child.methodDescriptor.id='forged',v=>v.child.runId='foreign-run',v=>v.sources[0].text+='forged',v=>v.sources[0].resultRef='result:sha256:'+'0'.repeat(64)]){const changed=structuredClone(value);mutate(changed);await assert.rejects(binding.verifyResult(changed),/CHILD_EXECUTION_HANDOFF_CHANGED/);}
});
test('22.18 method-specific input limits are visible before the model chooses a delegation',()=>{
 const method={...CLAIM_COMPARISON_METHOD,input:{maxQuestionBytes:200,maxDocuments:1},limits:{...CLAIM_COMPARISON_METHOD.limits,maxTools:3}};
 const binding=createChildExecutionBinding({store:{},parentClaim:()=>null,gatewayFactory:()=>null,...selection,execution:{schemaVersion:'child-execution@1',maxChildren:1,methods:[method]}});
 assert.match(binding.description,/claim-comparison@3 \(at most 1 documents, 200 UTF-8 question bytes, 3 reader calls\)/);
});

test('22.19 arbitrary extensions cannot mint or recover original Child group-owner proofs',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/child-owner-negative-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const calls=[{id:'forged',name:'pretend_child',arguments:{}},{id:'peer',name:'read_page',arguments:{documentId:'atlas-a',page:1}}];let callbacks=0;
 const fact={schemaVersion:'specialist-group-refusal@1',runId:'synthetic-parent',ownerBinding:childExecutionBinding(selection),groupHash:sha256(JSON.stringify(calls)),callIds:calls.map(c=>c.id),ownerCallId:'forged'};
 const forged={name:'pretend_child',description:'Synthetic owner-shaped extension.',parameters:{type:'object'},validate(){},execute(){throw Error('MUST_NOT_DISPATCH');},refusal(){callbacks++;return fact;},historical(){callbacks++;return calls;},groupRefusal(){callbacks++;return fact;}};
 assert.equal(legacyChildModule.registerChildGroupOwner,undefined);assert.equal(executionModule.registerChildGroupOwner,undefined);
 assert.equal(legacyChildModule.specialistGroupRefusal(forged,calls),null);assert.equal(executionModule.childExecutionGroupRefusal(forged,calls),null);assert.equal(executionModule.childExecutionHistoricalGroup(forged,'forged'),null);
 const host=await createToolHost({directory,extensions:[forged],allowedTools:['pretend_child','read_page'],runIdentity:{runId:'synthetic-parent',grantId:'synthetic-grant'}});
 const rejections=calls.map(c=>({callId:c.id,status:'rejected',dispatched:false,error:c.id==='forged'?'SPECIALIST_SINGLE_CALL_REQUIRED':'GROUP_NOT_DISPATCHED',validation:{...fact,code:c.id==='forged'?'SPECIALIST_SINGLE_CALL_REQUIRED':'GROUP_NOT_DISPATCHED',repairable:true,requestHash:sha256(JSON.stringify(c))},durationMs:0}));
 assert.equal(host.rejectProposalGroup(calls),null);assert.throws(()=>host.verifyGroupRejections(calls,rejections),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');await assert.rejects(host.verifyResult(calls[0],rejections[0]),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');assert.equal(callbacks,0);
});

test('22.20 a replaced parent fence during Child lease wait cannot dispatch or allocate a replacement',async t=>{
 const stop=new AbortController();let rootId,stopped=false;
 const h=await harness(t,{hostSignal:stop.signal,main:()=>delegate('first'),onCheckpoint:e=>{rootId??=e.runId;if(!stopped&&e.runId!==rootId&&e.phase==='result-consumed'){stopped=true;stop.abort();}}});assert.equal(h.result.status,'interrupted',h.result.code);
 const guard=await openSession({directory:h.directory,leaseMs:5000});t.after(()=>guard.close());const child=guard.listChildren(h.result.runId)[0],childLease=guard.claim(child.runId,'synthetic-old-child'),parentLease=guard.claim(h.result.runId,'synthetic-old-parent');let factories=0,requests=0;
 const binding=createChildExecutionBinding({store:guard,parentRunId:h.result.runId,parentClaim:()=>parentLease,...selection,outputRoot:join(h.directory,'runs'),gatewayFactory:()=>{factories++;return{mode:'fixture',next(){requests++;return{kind:'final',text:'Forbidden stale dispatch.'};}};}});
 const call=delegate('first').calls[0],pending=binding.reconcile(call.arguments,{callId:call.id,signal:new AbortController().signal});
 // reconcile has entered its first lease wait before returning this promise.
 parentLease.release();const replacement=guard.claim(h.result.runId,'synthetic-replacement-parent');childLease.release();
 try{await assert.rejects(pending,e=>e.code==='STALE_WRITER');assert.equal(factories,0);assert.equal(requests,0);assert.equal(h.childCalls,1);assert.equal(h.store.listChildren(h.result.runId).length,1);assert.equal(h.store.inspect(child.runId).fence,childLease.fence);assert.equal(h.store.inspect(child.runId).snapshot.phase,'result-consumed');}finally{replacement.release();}
});

for(const phase of ['result-committed','result-consumed'])test('22.21 exhausted admission survives original '+phase+' recovery without another Child',async t=>{
 const stop=new AbortController();let rootId,stopped=false,mainStep=0;const selected={...selection,execution:{...execution,maxChildren:1}};
 const h=await harness(t,{selected,hostSignal:stop.signal,main:()=>mainStep++===0?delegate('first'):mainStep===2?delegate('exhausted'):{kind:'final',text:'Use the existing evidence.'},onCheckpoint:e=>{rootId??=e.runId;if(!stopped&&e.runId===rootId&&e.phase===phase&&mainStep===2){stopped=true;stop.abort();}}});
 assert.equal(h.result.status,'interrupted',h.result.code);assert.equal(h.childCalls,2);assert.equal(h.mainCalls,2);const original=h.store.listChildren(h.result.runId)[0];await h.restart();const result=await h.resume();assert.equal(result.status,'completed',result.code);assert.equal(h.childCalls,2);assert.equal(h.mainCalls,3);assert.equal(h.store.listChildren(h.result.runId)[0].runId,original.runId);assert.deepEqual(h.store.listChildren(h.result.runId)[0].snapshot,original.snapshot);assert.deepEqual(result.rootUsage,{model:5,tool:3});
});
test('22.22 capacity proof binds exact original call, slots, scope and method without source laundering',async t=>{
 let step=0;const selected={...selection,execution:{...execution,maxChildren:1}};const h=await harness(t,{selected,main:()=>step++===0?delegate('first'):step===2?delegate('exhausted'):{kind:'final',text:'Completed with capacity limitation.'}});
 const state=h.store.inspect(h.result.runId),message=state.snapshot.messages.find(m=>m.callId==='exhausted'),originalCall=state.snapshot.messages.flatMap(m=>m.calls??[]).find(c=>c.id==='exhausted');assert.equal(message.result.status,'succeeded');assert.equal(message.result.dispatched,true);
 const binding=createChildExecutionBinding({store:h.store,parentRunId:h.result.runId,parentClaim:()=>undefined,...selected,outputRoot:join(h.directory,'runs'),gatewayFactory(){assert.fail('capacity verification must not request a gateway');}});
 await binding.verifyResult(message.result.value,{call:originalCall});
 for(const alter of [v=>v.childAdmission.callId='first',v=>v.childAdmission.parentRunId='other',v=>v.childAdmission.requestHash='0'.repeat(64),v=>v.childAdmission.currentChildren=[],v=>v.childAdmission.maxChildren=2,v=>v.childAdmission.binding.version='other',v=>v.sources=[{sourceId:'fake'}],v=>v.child={runId:'fake'}]){const value=structuredClone(message.result.value);alter(value);await assert.rejects(binding.verifyResult(value,{call:originalCall}),/ADMISSION_CHANGED/);}
 await assert.rejects(binding.verifyResult(message.result.value,{call:{...originalCall,id:'first'}}));await assert.rejects(binding.verifyResult(message.result.value));
 const first=await h.handoff('first');await assert.rejects(binding.verifyResult(first,{call:originalCall}),/HANDOFF_CHANGED/);
 const host=await createToolHost({directory:state.directory,restore:state.snapshot.host,readOnly:true,extensions:[binding],allowedTools:['delegate_child','read_page'],allowedDocuments:documents,runIdentity:{runId:state.runId,grantId:state.definition.grantId}});try{await assert.rejects(host.verifyResult(originalCall,{...message.result,value:first}),/HANDOFF_CHANGED/);}finally{await host.close();}
 assert.equal(h.childCalls,2);
});
test('22.23 a dispatched capacity observation reconciles only already exhausted settled slots',async t=>{
 const stop=new AbortController();let step=0,rootId;const selected={...selection,execution:{...execution,maxChildren:1}};
 const h=await harness(t,{selected,hostSignal:stop.signal,main:()=>step++===0?delegate('first'):delegate('exhausted'),onCheckpoint:e=>{rootId??=e.runId;if(e.runId===rootId&&e.phase==='proposal-sealed'&&e.callId==='exhausted')stop.abort();}});assert.equal(h.result.status,'interrupted',h.result.code);
 const claim=h.store.claim(h.result.runId,'capacity-recovery'),before=claim.read(),call=before.snapshot.proposal.calls[0];
 const dispatch={callId:call.id,name:call.name,effective:call};const state={...before.snapshot,phase:'tool-dispatched',toolsDispatched:before.snapshot.toolsDispatched+1,usedIds:[...before.snapshot.usedIds,call.id],inFlight:dispatch};claim.reserve('tool',state);
 let factories=0;const binding=createChildExecutionBinding({store:h.store,parentRunId:h.result.runId,parentClaim:()=>claim,...selected,outputRoot:join(h.directory,'runs'),gatewayFactory(){factories++;assert.fail('no new Child for capacity observation');}});
 try{const value=await binding.reconcile(call.arguments,{callId:call.id,signal:new AbortController().signal});assert.equal(value.childAdmission.reason,'execution-limit');assert.deepEqual(value.sources,[]);assert.equal(factories,0);assert.equal(h.childCalls,2);assert.equal(h.store.listChildren(h.result.runId).length,1);assert.equal(h.store.inspect(h.result.runId).rootUsage.tool,3);}finally{claim.release();}
});


for(const [label,output] of [['legacy4000',{maxSummaryBytes:4000}],['legacy8000',{maxSummaryBytes:8000}],['legacy16000',{maxSummaryBytes:16000}],['new',{}]])test('summary delivery without byte ceiling '+label,async t=>{
 const selected={...selection,execution:{...execution,methods:[{...CLAIM_COMPARISON_METHOD,output}]}};
 const answer='中'.repeat(6000);let step=0;
 const h=await harness(t,{selected,main:()=>step++===0?delegate('first'):{kind:'final',text:'Consumed.'},child:input=>input.messages.some(m=>m.role==='tool')?{kind:'final',text:answer}:onePage(input)});
 assert.equal(Buffer.byteLength(answer),18000);assert.equal(h.result.status,'completed');
 const before=h.store.inspect(h.result.runId),history=await h.history();assert.equal(history.items[0].consumption,'consumed');assert.equal(history.items[0].result.child.summary,answer);assert.deepEqual(history.items[0].result.child.methodDescriptor.output,output);
 await h.restart();assert.deepEqual(await h.history(),history);assert.deepEqual(h.store.inspect(h.result.runId),before);
});
test('malformed terminal answer fails original checkpoint validation',async t=>{
 let step=0;const h=await harness(t,{main:()=>step++===0?delegate('first'):{kind:'final',text:'Consumed.'}});
 const original=h.store.listChildren(h.result.runId)[0];
 for(const answer of [null,3,{},[]]){
  const child=structuredClone(original);child.snapshot.outcome.answer=answer;
  const proxy=new Proxy({},{get(_,key){if(key==='listChildren')return()=>[child];const value=h.store[key];return typeof value==='function'?value.bind(h.store):value;}});
  await assert.rejects(inspectChildExecutions({store:proxy,parentRunId:h.result.runId,...selection}),{code:'INVALID_TERMINAL_OUTCOME'});
 }
});

for(const phase of ['result-consumed','model-reserved'])test('30.1 explicit Child cancellation isolates parent and preserves '+phase,async t=>{
 const stop=new AbortController();let rootId,stopped=false;
 const h=await harness(t,{hostSignal:stop.signal,main:({messages})=>{
  const results=messages.filter(m=>m.role==='tool');
  return !results.length?delegate('first'):results.length===1?delegate('second','source-observation',['atlas-b']):{kind:'final',text:'Original cancellation retained; sibling used.'};
 },onCheckpoint:e=>{rootId??=e.runId;if(!stopped&&e.runId!==rootId&&e.phase===phase){stopped=true;stop.abort();}}});
 assert.equal(h.result.status,'interrupted',h.result.code);
 const child=h.store.listChildren(h.result.runId)[0],usage=h.store.inspect(h.result.runId).rootUsage;
 const stale=h.store.claim(child.runId,'synthetic-cancelled-worker');
 assert.throws(()=>h.store.cancelChild(child.runId,h.result.runId),/SCOPE_MISMATCH/);
 const cancelled=h.store.cancelChild(h.result.runId,child.runId);
 assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.rootStatus,'active');
 assert.deepEqual(cancelled.rootUsage,usage);assert.throws(()=>h.store.readClaim(stale),/RUN_CANCELLED/);
 assert.deepEqual(h.store.cancelChild(h.result.runId,child.runId),cancelled);
 const receipt=await h.handoff('first');assert.deepEqual(receipt.sources,[]);assert.equal(receipt.child.summary,'');assert.equal(receipt.child.controlOnly,true);
 assert.equal(receipt.child.gatewayOutcome,phase==='model-reserved'?'unknown':'settled');
 await h.restart();const result=await h.resume();assert.equal(result.status,'completed',result.code);
 const children=h.store.listChildren(h.result.runId);assert.equal(children.length,2);assert.equal(children.find(c=>c.runId===child.runId).status,'cancelled');
 assert.equal(children.find(c=>c.runId!==child.runId).status,'completed');
 assert.deepEqual(await h.handoff('first'),receipt);assert.equal((await h.history()).items.find(c=>c.runId===child.runId).consumption,'consumed');
 assert.equal(h.childCalls,phase==='model-reserved'?2:3);
 await h.restart();assert.equal((await h.resume()).status,'completed');assert.equal(h.childCalls,phase==='model-reserved'?2:3);
});

test('30.2 cancellation at the reservation boundary prevents dispatch without refunding it',async t=>{
 let rootId,cancelled=false;
 const h=await harness(t,{main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Cancellation observed.'}:delegate('first'),onCheckpoint:(e,store)=>{
  rootId??=e.runId;if(!cancelled&&e.runId!==rootId&&e.phase==='model-reserved'){cancelled=true;store.cancelChild(rootId,e.runId);}
 }});
 assert.equal(h.result.status,'completed',h.result.code);assert.equal(h.childCalls,0);assert.equal(h.mainCalls,2);
 assert.deepEqual(h.result.rootUsage,{model:3,tool:1});const child=(await h.history()).items[0];
 assert.equal(child.status,'cancelled');assert.equal(child.gatewayOutcome,'unknown');assert.equal(child.consumption,'consumed');assert.deepEqual(child.result.sources,[]);
});
test('30.3 a late Child answer cannot overwrite independent cancellation or become evidence',async t=>{
 let rootId,childId,store;
 const h=await harness(t,{main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Uncertain cancellation retained.'}:delegate('first'),onCheckpoint:(e,s)=>{store=s;rootId??=e.runId;if(e.runId!==rootId)childId=e.runId;},child:()=>{store.cancelChild(rootId,childId);return{kind:'final',text:'LATE ANSWER MUST NOT BE ADOPTED'};}});
 assert.equal(h.result.status,'completed',h.result.code);assert.equal(h.childCalls,1);
 const child=h.store.inspect(childId);assert.equal(child.status,'cancelled');assert.equal(child.snapshot.gatewayOutcome,'unknown');
 const handoff=await h.handoff('first');assert.equal(handoff.child.summary,'');assert.deepEqual(handoff.sources,[]);assert.equal(JSON.stringify(handoff).includes('LATE ANSWER'),false);
 await h.restart();assert.equal((await h.resume()).status,'completed');assert.equal(h.childCalls,1);
});
test('30.4 cancelling a completed Child is an immutable no-op',async t=>{
 const h=await harness(t,{main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Complete.'}:delegate('first')});
 const before=h.store.listChildren(h.result.runId)[0],receipt=await h.handoff('first');
 assert.deepEqual(h.store.cancelChild(h.result.runId,before.runId),before);assert.deepEqual(await h.handoff('first'),receipt);
});
test('30.5 cancelled unknown Child does not refund exhausted Root budget',async t=>{
 let rootId,cancelled=false;
 const h=await harness(t,{rootLimits:{model:2,tool:20},main:()=>delegate('first'),onCheckpoint:(e,store)=>{rootId??=e.runId;if(!cancelled&&e.runId!==rootId&&e.phase==='model-reserved'){cancelled=true;store.cancelChild(rootId,e.runId);}}});
 assert.equal(h.result.status,'failed');assert.equal(h.mainCalls,1);assert.equal(h.childCalls,0);assert.deepEqual(h.result.rootUsage,{model:2,tool:1});
 assert.equal(h.store.listChildren(h.result.runId)[0].snapshot.gatewayOutcome,'unknown');
});
for(const phase of ['result-committed','result-consumed'])test('30.6 cancelled control survives parent '+phase+' cold restart',async t=>{
 const stop=new AbortController();let rootId,cancelled=false,stopped=false;
 const h=await harness(t,{hostSignal:stop.signal,main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Cancelled control recovered.'}:delegate('first'),onCheckpoint:(e,store)=>{
  rootId??=e.runId;if(!cancelled&&e.runId!==rootId&&e.phase==='model-reserved'){cancelled=true;store.cancelChild(rootId,e.runId);}
  if(cancelled&&!stopped&&e.runId===rootId&&e.phase===phase){stopped=true;stop.abort();}
 }});
 assert.equal(h.result.status,'interrupted');const receipt=await h.handoff('first');
 await h.restart();assert.equal((await h.resume()).status,'completed');assert.equal(h.childCalls,0);assert.equal(h.mainCalls,2);assert.deepEqual(await h.handoff('first'),receipt);
});
