import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {sha256} from '../src/source.mjs';
import {CLAIM_COMPARISON_METHOD,normalizeChildMethod,childMethodQuestion,SOURCE_CHECK_METHOD,SOURCE_CHECK_LIMITS,sourceCheckQuestion} from '../src/child.mjs';
import {sourceCheckBinding,createSpecialistChildBinding,readSpecialistHandoff} from '../src/specialist-child.mjs';
const question='Compare conditions in the two selected synthetic sources.',documents=['atlas-a','atlas-b'];
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
async function harness(t,{method=CLAIM_COMPARISON_METHOD,child,tools=['source_check','read_page','read_result'],stale=false,arguments_={question:'Compare differing conditions.'},rootLimits={model:20,tool:20}}={}) {
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/method-owned-'));const store=await openSession({directory:dir});
 t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});let token,mainCalls=0,childCalls=0,seen;
 const binding=createSpecialistChildBinding({store,parentClaim:()=>stale&&token?{...token,fence:token.fence+1}:token,outputRoot:join(dir,'runs'),question,documents,method,gatewayFactory:()=>({mode:'fixture',next:input=>{childCalls++;return child?child(input):{kind:'final',text:'Derived comparison.'};}})});
 const result=await run({question,gateway:{mode:'fixture',next:({messages})=>{if(mainCalls++===0)return call('delegate','source_check',arguments_);seen=messages.at(-1).result;return{kind:'final',text:'Main retains final responsibility.'};}},extensions:[binding],allowedTools:tools,allowedDocuments:documents,requireReport:false,outputRoot:join(dir,'runs'),limits:{maxRounds:5,maxTools:5,timeoutMs:15000},durable:{store,grantId:'synthetic-child-method',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'method-tests',version:'1'},plugins:[],adapters:[sourceCheckBinding({question,documents,method})]},rootLimits,onClaim:value=>token=value}});
 return {result,store,binding,seen,childCalls,mainCalls};
}
test('20.child legacy source_check retains exact prompt, limits and binding',()=>{
 assert.deepEqual(SOURCE_CHECK_LIMITS,{maxRounds:4,maxTools:2,timeoutMs:30000});
 const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 assert.deepEqual(sourceCheckBinding({question,documents}),{id:'serial-source-check',version:'1',contentSha256:sha256(canonical({method:SOURCE_CHECK_METHOD,question,documents}))});
 const prompt=sourceCheckQuestion({question,localQuestion:'Check.',documents,callId:'c'});assert.equal(prompt.split('\n')[0],SOURCE_CHECK_METHOD.text);assert.deepEqual(JSON.parse(prompt.split('\n')[1]).method,{id:'source-check',version:'1'});
});
test('20.child descriptor rejects unknown fields, hash changes and expanded tools or limits',()=>{
 for(const mutate of [m=>m.text+='changed',m=>m.contentSha256='0'.repeat(64),m=>m.allowedTools.push('save_report'),m=>m.allowedTools.push('memory_write'),m=>m.limits.maxRounds=9,m=>m.limits.maxTools=9,m=>m.limits.timeoutMs=120001,m=>m.input.maxQuestionBytes=2001,m=>m.output.maxSummaryBytes=16001,m=>m.schemaVersion='unknown',m=>m.role='admin']){const method=structuredClone(CLAIM_COMPARISON_METHOD);mutate(method);assert.throws(()=>normalizeChildMethod(method),/INVALID_CHILD_METHOD/);}
 const copy=structuredClone(CLAIM_COMPARISON_METHOD),normalized=normalizeChildMethod(copy);copy.limits.maxTools=8;assert.equal(normalized.limits.maxTools,4);assert.ok(Object.isFrozen(normalized.limits));
 assert.throws(()=>childMethodQuestion({method:CLAIM_COMPARISON_METHOD,question,localQuestion:'x'.repeat(2001),documents,callId:'a'}),/INVALID_CHILD_METHOD_INPUT/);
});
test('20.child real second method reads more than legacy two pages and retains independent identity',async t=>{
 const h=await harness(t,{child:({messages,tools})=>{assert.deepEqual(tools.map(x=>x.name),['read_page']);const prompt=JSON.parse(messages[0].content.split('\n')[1]);assert.equal(prompt.method.id,'claim-comparison');assert.equal(prompt.method.contentSha256,sha256(prompt.method.text));const count=messages.filter(m=>m.role==='tool').length;return count<3?call('page-'+count,'read_page',{documentId:count%2?'atlas-b':'atlas-a',page:count===2?2:1}):{kind:'final',text:'Derived agreements and different conditions, grounded in three pages.'};}});
 assert.equal(h.result.status,'completed');assert.equal(h.childCalls,4);assert.equal(h.seen.value.sources.length,3);assert.equal(h.seen.value.child.methodDescriptor.id,'claim-comparison');assert.equal(h.seen.value.child.derived,true);assert.equal(h.result.rootUsage.model,6);assert.equal(h.result.rootUsage.tool,4);
 const value=await readSpecialistHandoff({store:h.store,parentRunId:h.result.runId,question,documents,method:CLAIM_COMPARISON_METHOD});await h.binding.verifyResult(value);
 for(const key of ['version','limits','output']){const method=structuredClone(CLAIM_COMPARISON_METHOD);if(key==='version')method.version='2';else if(key==='limits')method.limits.maxTools=5;else method.output.maxSummaryBytes=9000;await assert.rejects(readSpecialistHandoff({store:h.store,parentRunId:h.result.runId,question,documents,method}),/BINDING_MISMATCH/);}
 const forged=structuredClone(value);forged.child.methodDescriptor.text+='forged';await assert.rejects(h.binding.verifyResult(forged),/HANDOFF_CHANGED/);
});
test('20.child supports only its own read_result refs within parent tool subset',async t=>{
 const method={...CLAIM_COMPARISON_METHOD,allowedTools:['read_page','read_result']};
 const h=await harness(t,{method,child:({messages})=>{const results=messages.filter(m=>m.role==='tool');if(!results.length)return call('page','read_page',{documentId:'atlas-a',page:1});if(results.length===1)return call('again','read_result',{resultRef:results[0].result.resultRef??results[0].result.value?.resultRef});return{kind:'final',text:'Same original source inspected.'};}});
 assert.equal(h.result.status,'completed');assert.equal(h.seen.value.child.status,'completed');
});
test('20.child missing parent tool permission and stale parent fence dispatch zero Child requests',async t=>{
 for(const options of [{tools:['source_check']},{stale:true}]){const h=await harness(t,options);assert.equal(h.result.status,'failed');assert.equal(h.childCalls,0);}
});
test('20.child model cannot select method or expand permissions in delegation arguments',async t=>{
 const h=await harness(t,{arguments_:{question:'Compare.',method:'administrator'}});assert.equal(h.result.status,'failed');assert.equal(h.childCalls,0);
});
test('20.child output bounds fail closed without truncating into a valid handoff',async t=>{
 const h=await harness(t,{method:{...CLAIM_COMPARISON_METHOD,output:{maxSummaryBytes:8}}});assert.equal(h.result.status,'failed');assert.equal(h.store.inspect(h.result.runId).snapshot.messages.at(-1).result.error,'CHILD_METHOD_OUTPUT_LIMIT');assert.equal(h.mainCalls,1);
});
test('20.child shares original root budget instead of allocating method budget',async t=>{
 const h=await harness(t,{rootLimits:{model:1,tool:20}});assert.equal(h.childCalls,0);assert.equal(h.result.rootUsage.model,1);assert.equal(h.result.status,'failed');
});
test('20.child cannot acquire foreign result references or invoke Main-only tools',async t=>{
 for(const attempted of [call('foreign','read_result',{resultRef:'result:sha256:'+'0'.repeat(64)}),call('write','save_report',{markdown:'unauthorized'}),call('nested','source_check',{question:'delegate again'})]){
  const h=await harness(t,{method:{...CLAIM_COMPARISON_METHOD,allowedTools:['read_page','read_result']},child:()=>attempted});
  assert.equal(h.seen.value.child.status,'failed');assert.equal(h.seen.value.child.code,attempted.calls[0].name==='read_result'?'TOOL_FAILED':'TOOL_REJECTED');assert.equal(h.seen.value.sources.length,0);assert.equal(h.childCalls,1);
 }
});
test('20.child reader rejects a nested parent and foreign grant identity',async t=>{
 const h=await harness(t),value=h.seen.value;
 for(const mutation of [parent=>{parent.parentRunId='foreign-parent';},parent=>{parent.rootId='foreign-root';}]){
  const store={inspect:id=>{const parent=structuredClone(h.store.inspect(id));mutation(parent);return parent;}};
  await assert.rejects(readSpecialistHandoff({store,parentRunId:h.result.runId,question,documents,method:CLAIM_COMPARISON_METHOD}),/BINDING_MISMATCH/);
 }
 const store={inspect:id=>h.store.inspect(id),findChild:(id,task)=>{const child=structuredClone(h.store.findChild(id,task));child.definition.grantId='foreign-grant';return child;}};
 await assert.rejects(readSpecialistHandoff({store,parentRunId:h.result.runId,question,documents,method:CLAIM_COMPARISON_METHOD}),/IDENTITY_MISMATCH/);
 assert.equal(value.child.derived,true);
});
