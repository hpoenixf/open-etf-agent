import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {PUBLICATION_BINDING} from '../src/publication.mjs';
import {sourceCheckBinding,createSpecialistChildBinding,readSpecialistHandoff} from '../src/specialist-child.mjs';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
test('Main Publication remains Main-only while original specialist completes under narrower child bindings',async()=>{
 const base=join(import.meta.dirname,'../test-output');await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,'publication-child-'));
 const store=await openSession({directory});let token,mainCalls=0,childCalls=0;
 const question='Check original atlas-a page 1 and save a cited report.',documents=['atlas-a'];
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'publication-child-test',version:'1'},plugins:[],adapters:[sourceCheckBinding({question,documents}),PUBLICATION_BINDING,{id:'synthetic-preserved',version:'1'}]};
 const extension=createSpecialistChildBinding({store,parentClaim:()=>token,question,documents,outputRoot:join(directory,'runs'),gatewayFactory:()=>({mode:'fixture',next:({messages})=>{childCalls++;return messages.some(m=>m.role==='tool')?{kind:'final',text:'Original page inspected.'}:call('child-read','read_page',{documentId:'atlas-a',page:1});}})});
 try{
 const result=await run({question,gateway:{mode:'fixture',next:({messages})=>{mainCalls++;if(mainCalls===1)return call('delegate','source_check',{question:'Inspect physical page 1.'});if(mainCalls===2){const sources=messages.find(m=>m.role==='tool'&&m.callId==='delegate').result.value.sources;return call('save','save_report',{text:'# Synthetic cited report',sourceIds:[sources[0].sourceId]});}return {kind:'final',text:'Original source checked and report saved.'};}},extensions:[extension],publication:true,requireReport:true,allowedTools:['source_check','read_page','save_report'],allowedDocuments:documents,outputRoot:join(directory,'runs'),limits:{maxRounds:4,maxTools:4,timeoutMs:10000},durable:{store,grantId:'synthetic-publication-child',bindings,rootLimits:{model:8,tool:8},onClaim:v=>token=v}});
 assert.equal(result.status,'completed',JSON.stringify({code:result.code,mainCalls,childCalls}));
 assert.equal(childCalls,2);assert.equal(mainCalls,3);assert.ok(result.publication);assert.ok(result.receipt);
 const parent=store.inspect(result.runId),child=store.findChild(result.runId,'source-check-v1');
 assert.deepEqual(parent.definition.bindings,bindings);assert.equal(child.status,'completed');assert.deepEqual(child.definition.bindings,{...bindings,adapters:bindings.adapters.filter(a=>a.id!==PUBLICATION_BINDING.id)});
 assert.equal(child.definition.config.publication,undefined);assert.equal(child.snapshot.outcome.publication,undefined);assert.equal(child.snapshot.outcome.receipt,null);
 const handoff=await readSpecialistHandoff({store,parentRunId:result.runId,question,documents});assert.equal(handoff.child.runId,child.runId);assert.equal(handoff.sources.length,1);
 assert.deepEqual(result.rootUsage,{model:5,tool:3});
 // A reader cannot accept extra Child authority or silently drop unrelated bindings.
 for(const adapters of [bindings.adapters,child.definition.bindings.adapters.filter(a=>a.id!=='synthetic-preserved'),[...child.definition.bindings.adapters,{...PUBLICATION_BINDING,version:'forged'}]]){
  const altered=structuredClone(child);altered.definition.bindings.adapters=adapters;
  const facade={...store,findChild:()=>altered};
  await assert.rejects(readSpecialistHandoff({store:facade,parentRunId:result.runId,question,documents}),{code:'SPECIALIST_IDENTITY_MISMATCH'});
 }
 const before=structuredClone(store.inspect(result.runId)),childBefore=structuredClone(store.inspect(child.runId));
 const restored=createSpecialistChildBinding({store,parentClaim:()=>undefined,parentRunId:result.runId,question,documents,outputRoot:join(directory,'runs'),gatewayFactory:()=>{throw Error('TERMINAL_CHILD_REPLAY');}});
 const again=await run({question,gateway:{mode:'fixture',next(){throw Error('TERMINAL_MAIN_REPLAY');}},extensions:[restored],publication:true,requireReport:true,allowedTools:['source_check','read_page','save_report'],allowedDocuments:documents,limits:{maxRounds:4,maxTools:4,timeoutMs:10000},durable:{store,runId:result.runId,grantId:'synthetic-publication-child',bindings,rootLimits:{model:8,tool:8}}});
 assert.equal(again.status,'completed');assert.deepEqual(again.publication,result.publication);assert.deepEqual(again.receipt,result.receipt);assert.deepEqual(again.rootUsage,result.rootUsage);
 assert.deepEqual(store.inspect(result.runId),before);assert.deepEqual(store.inspect(child.runId),childBefore);assert.equal(mainCalls,3);assert.equal(childCalls,2);
 // The Runtime gate remains intact; only the trusted specialist narrows authority.
 await assert.rejects(run({question,gateway:{mode:'fixture',next(){throw Error('UNEXPECTED_DISPATCH');}},durable:{store,bindings},publication:false}),{code:'PUBLICATION_BINDING_MISMATCH'});
 }finally{store.close();}
});
