import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {runSpecialistDemo,readSpecialistRun} from '../src/specialist-demo.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/specialist-'));}
test('15.1 original specialist result and page bytes reach the next encoded Main request and readback',async()=>{
 const dir=await directory(),requests=[];
 const result=await runSpecialistDemo({directory:dir,summarySuffix:'SYNTHETIC_VARIANT_15',onRequest:(role,body)=>requests.push({role,body})});
 assert.equal(result.status,'completed');assert.equal(result.semanticStatus,'unreviewed');
 const childRequests=requests.filter(x=>x.role==='child');assert.equal(childRequests.length,3);
 assert.ok(childRequests.every(x=>!JSON.stringify(x.body).includes('MAIN_PRIVATE_SENTINEL')));
 const next=requests.find(x=>x.role==='main'&&x.body.messages.some(m=>m.role==='tool'&&JSON.parse(m.content).value?.child));
 assert.ok(next);const imported=JSON.parse(next.body.messages.find(m=>m.role==='tool'&&JSON.parse(m.content).value?.child).content).value;
 assert.equal(imported.child.status,'completed');assert.match(imported.child.summary,/SYNTHETIC_VARIANT_15/);assert.equal(imported.sources.length,2);
 for(const source of imported.sources){assert.match(source.resultRef,/^result:sha256:/);assert.ok(source.text.length>10);assert.ok(source.sourceId);}
 const report=await readFile(join(result.directory,'report.md'),'utf8');assert.match(report,/SYNTHETIC_VARIANT_15/);
 const count=requests.length;const read=await readSpecialistRun({directory:dir,runId:result.runId});assert.equal(requests.length,count);
 assert.equal(read.child.runId,imported.child.runId);assert.equal(read.child.summary,imported.child.summary);assert.equal(read.report.text,report);
 assert.deepEqual(result.rootUsage,{model:6,tool:4});
});

import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {sourceCheckBinding,createSpecialistChildBinding,readSpecialistHandoff} from '../src/specialist-child.mjs';
const question='Original bounded synthetic question.',documents=['atlas-a','atlas-b'];
const call=(id,name,arguments_={})=>({kind:'calls',calls:[{id,name,arguments:arguments_}]});
async function harness({main,child,rootLimits={model:16,tool:12},signal,extra=[]}={}){
 const dir=await directory(),store=await openSession({directory:dir});let token;
 const binding=createSpecialistChildBinding({store,parentClaim:()=>token,outputRoot:join(dir,'runs'),question,documents,gatewayFactory:()=>({mode:'fixture',next:child})});
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'specialist-tests',version:'1'},plugins:[],adapters:[sourceCheckBinding({question,documents})]};
 const result=await run({question,gateway:{mode:'fixture',next:main},extensions:[binding,...extra],outputRoot:join(dir,'runs'),signal,allowedTools:['source_check','read_page',...extra.map(x=>x.name)],allowedDocuments:documents,requireReport:false,limits:{maxRounds:8,maxTools:6,timeoutMs:10000},durable:{store,grantId:'synthetic-specialist-test',bindings,rootLimits,onClaim:t=>token=t}});
 return {dir,store,binding,result};
}
const oneReadChild=({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Derived original one-page observation.'}:call('c-read','read_page',{documentId:'atlas-a',page:1});
const delegate=()=>call('delegate','source_check',{question:'Check the original page.'});
test('15.2 Child omits Main tool history and advertises only original scoped reader',async()=>{
 let step=0,childRequests=0;const h=await harness({extra:[{name:'private_note',description:'Synthetic unrelated Main history.',parameters:{type:'object',properties:{},additionalProperties:false},validate(){},execute:async()=>({text:'MAIN_PRIVATE_SENTINEL'})}],main:()=>step++===0?call('private','private_note'):step===2?delegate():{kind:'final',text:'Main consumed result.'},child:input=>{childRequests++;assert.doesNotMatch(JSON.stringify(input.messages),/MAIN_PRIVATE_SENTINEL/);assert.deepEqual(input.tools.map(t=>t.name),['read_page']);const original=input.messages[0].content;const prompt=JSON.parse(original.slice(original.indexOf('\n')+1));assert.deepEqual(prompt.executionBudget,{maxRounds:4,maxTools:2,timeoutMs:30000});return oneReadChild(input);}});
 try{assert.equal(h.result.status,'completed');assert.equal(childRequests,2);}finally{h.store.close();}
});
test('15.3 another call ID cannot allocate a second specialist',async()=>{
 let step=0,count=0;const h=await harness({main:()=>step++===0?delegate():call('different-id','source_check',{question:'Again.'}),child:input=>{count++;return oneReadChild(input);}});
 try{assert.equal(h.result.status,'failed');assert.equal(h.result.code,'TOOL_REJECTED');assert.equal(count,2);assert.ok(h.store.findChild(h.result.runId,'source-check-v1'));}finally{h.store.close();}
});
test('15.4 mixed batch is rejected before Child dispatch',async()=>{
 let count=0;const h=await harness({main:()=>({kind:'calls',calls:[...delegate().calls,{id:'other',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]}),child:input=>{count++;return oneReadChild(input);}});
 try{assert.equal(h.result.code,'TOOL_REJECTED');assert.equal(count,0);assert.equal(h.store.findChild(h.result.runId,'source-check-v1'),null);}finally{h.store.close();}
});
test('15.5 known failed Child preserves original sources and explicit failure',async()=>{
 let step=0,seen;const h=await harness({main:({messages})=>{if(step++===0)return delegate();seen=messages.at(-1).result.value;return{kind:'final',text:'The original partial source is usable; the Child failed.'};},child:({messages})=>messages.some(m=>m.role==='tool')?call('bad-page','read_page',{documentId:'atlas-a',page:99}):call('good-page','read_page',{documentId:'atlas-a',page:1})});
 try{assert.equal(h.result.status,'completed');assert.equal(seen.child.status,'failed');assert.equal(seen.child.code,'TOOL_REJECTED');assert.equal(seen.sources.length,1);assert.match(seen.child.limitations[0],/failed/);}finally{h.store.close();}
});
test('15.6 unresolved model outcome is not consumed as a settled successful Child',async()=>{
 let mainCalls=0;const h=await harness({main:()=>{mainCalls++;return delegate();},child:async()=>{throw new Error('SYNTHETIC_TRANSPORT_OUTCOME_UNCERTAIN');}});
 try{assert.equal(h.result.status,'failed');assert.equal(mainCalls,1);const root=h.store.inspect(h.result.runId);assert.equal(root.snapshot.messages.at(-1).result.error,'SPECIALIST_EFFECT_UNKNOWN');assert.deepEqual(h.result.rootUsage,{model:2,tool:1});}finally{h.store.close();}
});
test('15.7 original root model budget bounds Child without granting a fresh allowance',async()=>{
 let mainCalls=0,childCalls=0;const h=await harness({rootLimits:{model:2,tool:12},main:()=>{mainCalls++;return delegate();},child:input=>{childCalls++;return oneReadChild(input);}});
 try{assert.equal(h.result.status,'failed');assert.equal(mainCalls,1);assert.equal(childCalls,1);assert.equal(h.result.rootUsage.model,2);}finally{h.store.close();}
});
test('15.8 original handoff rejects altered summary and foreign source bytes',async()=>{
 let step=0;const h=await harness({main:()=>step++===0?delegate():{kind:'final',text:'Consumed.'},child:oneReadChild});
 try{const value=await readSpecialistHandoff({store:h.store,parentRunId:h.result.runId,question,documents});await h.binding.verifyResult(value);await assert.rejects(h.binding.verifyResult({...value,child:{...value.child,summary:'forged'}}),/HANDOFF_CHANGED/);const altered=structuredClone(value);altered.sources[0].text+='forged';await assert.rejects(h.binding.verifyResult(altered),/HANDOFF_CHANGED/);}finally{h.store.close();}
});
test('15.9 cancellation reaches the Child and prevents a new Main request',async()=>{
 const controller=new AbortController();let mainCalls=0;const h=await harness({signal:controller.signal,main:()=>{mainCalls++;return delegate();},child:async()=>{controller.abort();return{kind:'final',text:'Late synthetic response must not resume Main.'};}});
 try{assert.equal(h.result.status,'cancelled');assert.equal(mainCalls,1);}finally{h.store.close();}
});

test('15.15 method, original ref and foreign Child identity cannot be forged',async()=>{
 let step=0;const h=await harness({main:()=>step++===0?delegate():{kind:'final',text:'Consumed.'},child:oneReadChild});
 try{const value=await readSpecialistHandoff({store:h.store,parentRunId:h.result.runId,question,documents});for(const mutate of [v=>{v.child.method.version='forged';},v=>{v.sources[0].resultRef='result:sha256:'+'0'.repeat(64);},v=>{v.child.runId='foreign-run';}]){const altered=structuredClone(value);mutate(altered);await assert.rejects(h.binding.verifyResult(altered));}await assert.rejects(readSpecialistHandoff({store:h.store,parentRunId:h.result.runId,question,documents:['atlas-b']}),/BINDING_MISMATCH/);assert.throws(()=>sourceCheckBinding({question,documents:['private-ungranted']}),/INVALID_SPECIALIST_SCOPE/);}finally{h.store.close();}
});

test('15.18 Main issues no request while the sole Child request remains pending',async()=>{
 let release,started,mainCalls=0,childCalls=0;const pending=new Promise(r=>release=r),entered=new Promise(r=>started=r);
 const running=harness({main:()=>++mainCalls===1?delegate():{kind:'final',text:'Consumed only after Child settlement.'},child:async input=>{childCalls++;if(childCalls===1){started();await pending;}return oneReadChild(input);}});
 try{await entered;await new Promise(r=>setImmediate(r));assert.equal(mainCalls,1);assert.equal(childCalls,1);}finally{release();}
 const h=await running;try{assert.equal(h.result.status,'completed');assert.equal(mainCalls,2);assert.equal(childCalls,2);}finally{h.store.close();}
});
