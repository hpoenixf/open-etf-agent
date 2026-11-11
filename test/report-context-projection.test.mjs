import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createToolHost} from '../src/tools.mjs';
import {projectContext} from '../src/context.mjs';
async function setup(policy='host-results@3'){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/report-view-'));
 const options={directory,hostProjection:policy,projectionOwner:{runId:'main',rootId:'main'},confirmDerivedConsumption:async()=>false};
 const host=await createToolHost(options);
 const read={id:'read',name:'read_page',arguments:{documentId:'atlas-a',page:1}},source=await host.execute(read);assert.equal(source.status,'succeeded',source.error);
 const call={id:'save',name:'save_report',arguments:{text:'原文🙂'.repeat(1500)+' [1]',sourceIds:[source.value.sourceId]}};
 const result=await host.execute(call);assert.equal(result.status,'succeeded',result.error);
 const messages=[{role:'user',content:'Review original evidence and save report.'},{role:'assistant',calls:[read]},{role:'tool',callId:read.id,result:source},{role:'assistant',calls:[call]},{role:'tool',callId:call.id,result}];
 return {host,options,call,result,messages};
}
test('completed saved report has exact reversible view without changing original pair or task status',async()=>{
 const {host,options,call,result,messages}=await setup(),before=JSON.stringify(messages);
 const view=await projectContext({messages,maxBytes:6000,lookupSource:host.lookupContextSource,projectOwnedResult:host.projectOwnedResult,projectOwnedCall:host.projectOwnedCall});
 assert.equal(JSON.stringify(messages),before);assert.equal(view[3].calls[0].arguments.text.kind,'persisted-report-text-ref');assert.deepEqual(view[4],messages[4]);assert.deepEqual(view[3].calls[0].arguments.sourceIds,call.arguments.sourceIds);
 assert.ok(Buffer.byteLength(JSON.stringify(view))<=6000);await host.verifyWorkingInput({messages:view},messages);
 const cold=await createToolHost({...options,restore:host.snapshot(),readOnly:true});await cold.verifyWorkingInput({messages:view},messages);
 for(const mutate of [v=>delete v[3].calls[0].arguments.text.kind,v=>v[3].calls[0].arguments.text.kind='fake',v=>v[3].calls[0].arguments.text='tampered',v=>v[3].calls[0].arguments.text.textSha256='0'.repeat(64),v=>v[4].result.value.bytes++,v=>v[3].calls[0].id='other']){const bad=structuredClone(view);mutate(bad);await assert.rejects(cold.verifyWorkingInput({messages:bad},messages));}
 await assert.rejects(host.projectOwnedCall({...call,arguments:{...call.arguments,text:call.arguments.text+'tamper'}},result));
 assert.equal(await host.projectOwnedCall(call,{...result,status:'failed'}),null);
 await assert.rejects(cold.verifyWorkingInput({messages:view}));
});
test('legacy policy leaves saved call unchanged and fails capacity rather than truncating',async()=>{
 for(const policy of ['host-results@1','host-results@2']){const {host,messages,call,result}=await setup(policy);assert.equal(await host.projectOwnedCall(call,result),null);await assert.rejects(projectContext({messages,maxBytes:6000,lookupSource:host.lookupContextSource,projectOwnedResult:host.projectOwnedResult,projectOwnedCall:host.projectOwnedCall}),{code:'CONTEXT_CAPACITY_EXCEEDED'});}
});
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,inspectResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
test('real runtime saves oversized report then resumes projected working input without replay or false completion',async()=>{
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/report-runtime-'));
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'report-context'},capabilities:['report'],contextBytes:16384}});
 const file=join(projectDir,'source.txt');await writeFile(file,'Synthetic: approval does not prove retest completion.');const sources=await importProjectSources({projectDir,files:[file]});const request={projectDir,runId:'report-context',question:'Review the approval condition.',sourceManifestSha256:sources.manifestSha256};await submitResearchTask(request);
 const text='保留报告完整正文🙂'.repeat(900)+' [1]';let calls=0,saves=0;const stop=new AbortController();let paused=false;
 const gateway={mode:'fixture',inputBudget:{maxBytes:16384,measure:v=>Buffer.byteLength(JSON.stringify(v))},async next({messages,tools}){
  assert.ok(Buffer.byteLength(JSON.stringify({messages,tools}))<=16384);calls++;
  const results=messages.filter(m=>m.role==='tool');if(!results.length)return {kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:sources.catalog.documents[0].id,page:1}}]};
  if(!results.some(m=>m.result.value?.path==='report.md')){saves++;return {kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text,sourceIds:[results[0].result.value.sourceId]}}]};}
  assert.equal(messages.find(m=>m.calls?.[0].name==='save_report').calls[0].arguments.text.kind,'persisted-report-text-ref');return {kind:'final',text:'Report saved; semantic review remains separate.'};
 }};
 await workResearchTask({...request,gateway,hostSignal:stop.signal,onCheckpoint(info){if(info.phase==='working-input'&&saves===1){paused=true;stop.abort();}}});assert.equal(paused,true);const before=await inspectResearchTask(request);assert.notEqual(before.run.status,'completed');assert.equal(before.run.snapshot.messages.find(m=>m.calls?.[0].name==='save_report').calls[0].arguments.text,text);
 const done=await workResearchTask({...request,gateway});assert.equal(done.run.status,'completed',done.run.snapshot.code);assert.equal(saves,1);assert.equal(calls,3);
 const reopened=await workResearchTask({...request,gateway:{...gateway,next(){throw Error('terminal replay')}}});assert.equal(reopened.run.status,'completed');
});

test('saved effect-time basis survives later calculations without rewriting report',async()=>{
 const {host,options,call,result,messages}=await setup();
 const calc=await host.execute({id:'later',name:'calculate_change',arguments:{baseline:2,current:3,baselineUnit:'rows',currentUnit:'rows'}});assert.equal(calc.status,'succeeded',calc.error);
 const view=await host.projectOwnedCall(call,result);assert.equal(view.arguments.text.kind,'persisted-report-text-ref');
 const cold=await createToolHost({...options,restore:host.snapshot(),readOnly:true});assert.deepEqual(await cold.projectOwnedCall(call,result),view);
});
import {projectControlProofs} from '../src/context.mjs';
test('reference correction proof retains its legitimate projection across cold working view verification',async()=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/report-repair-view-'));
 const options={directory,hostProjection:'host-results@3',projectionOwner:{runId:'main',rootId:'main'},runIdentity:{runId:'main',rootId:'main'},canOfferReferenceCorrection:()=>true,confirmDerivedConsumption:async()=>false};
 const host=await createToolHost(options),read={id:'read',name:'read_page',arguments:{documentId:'atlas-a',page:1}},source=await host.execute(read);
 const bad={id:'bad',name:'save_report',arguments:{text:'Fact [C1]',sourceIds:[source.value.sourceId]}},result=await host.execute(bad);assert.equal(result.status,'rejected');assert.equal(result.validation.code,'REPORT_CITATION_OUT_OF_RANGE');
 const messages=[{role:'user',content:'Review'},{role:'assistant',calls:[read]},{role:'tool',callId:'read',result:source},{role:'assistant',calls:[bad]},{role:'tool',callId:'bad',result}];const view=projectControlProofs(messages);assert.equal(view.at(-1).result.validation.basis,undefined);assert.ok(view.at(-1).result.repairAdvice);
 const cold=await createToolHost({...options,restore:host.snapshot()});await cold.verifyWorkingInput({messages:view},messages);
 const corrected={id:'corrected',name:'save_report',arguments:{text:'Fact [1]',sourceIds:[source.value.sourceId]}};const saved=await cold.execute(corrected);assert.equal(saved.status,'succeeded',saved.error);
});
