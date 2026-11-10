import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,inspectResearchTask,readResearchReport} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {createToolHost} from '../src/tools.mjs';
import {projectContext} from '../src/context.mjs';
import {compactWorkingView} from '../src/compaction.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
import {createChatGateway} from '../src/gateway.mjs';
import {readFixturePage} from '../src/source.mjs';
import {spawnSync} from 'node:child_process';
import {noteRef} from '../src/working-note.mjs';

test('opt-in compaction preserves the frozen Host report projection before cold continuation',async()=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/report-compaction-'));
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'report-compaction'},capabilities:['report','compaction'],contextBytes:16384,compaction:{thresholdBytes:1}}});
 const file=join(projectDir,'source.txt');await writeFile(file,'Synthetic: approval does not prove retest completion.');
 const sources=await importProjectSources({projectDir,files:[file]});
 const request={projectDir,runId:'report-compaction',question:'Review the approval condition.',sourceManifestSha256:sources.manifestSha256};
 await submitResearchTask(request);
 const text='保留报告完整正文🙂'.repeat(900)+' [1]';let calls=0,saves=0,summaries=0,paused=false;
 const stop=new AbortController();
 const gateway={mode:'fixture',inputBudget:{maxBytes:16384,measure:v=>Buffer.byteLength(JSON.stringify(v))},async next({messages,tools}){
  assert.ok(Buffer.byteLength(JSON.stringify({messages,tools}))<=16384);
  if(!tools.length){summaries++;return {kind:'final',text:'Derived source observation.'};}
  calls++;const results=messages.filter(m=>m.role==='tool');
  if(!results.length)return {kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:sources.catalog.documents[0].id,page:1}}]};
  if(!results.some(m=>m.result.value?.path==='report.md')){saves++;return {kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text,sourceIds:[results[0].result.value.sourceId]}}]};}
  assert.equal(messages.find(m=>m.calls?.[0].name==='save_report').calls[0].arguments.text.kind,'persisted-report-text-ref');
  return {kind:'final',text:'Report saved; semantic review remains separate.'};
 }};
 await workResearchTask({...request,gateway,hostSignal:stop.signal,onCheckpoint(info){if(info.phase==='working-input'&&saves===1){paused=true;stop.abort();}}});
 const before=await inspectResearchTask(request);
 assert.equal(paused,true,`Expected a resumable post-save view, got ${before.run.status}/${before.run.snapshot.code}`);
 assert.notEqual(before.run.status,'completed');
 assert.equal(before.run.snapshot.messages.find(m=>m.calls?.[0].name==='save_report').calls[0].arguments.text,text);
 assert.equal(before.run.snapshot.working.messages.find(m=>m.calls?.[0].name==='save_report').calls[0].arguments.text.kind,'persisted-report-text-ref');
 const script=`import assert from 'node:assert/strict';import {workResearchTask} from ${JSON.stringify(new URL('../src/research-project.mjs',import.meta.url).href)};let calls=0;const done=await workResearchTask({...${JSON.stringify(request)},gateway:{mode:'fixture',inputBudget:{maxBytes:16384,measure:v=>Buffer.byteLength(JSON.stringify(v))},async next({messages,tools}){calls++;assert.ok(Buffer.byteLength(JSON.stringify({messages,tools}))<=16384);assert.equal(messages.find(m=>m.calls?.[0].name==='save_report').calls[0].arguments.text.kind,'persisted-report-text-ref');return {kind:'final',text:'Report saved; semantic review remains separate.'};}}});console.log(JSON.stringify({pid:process.pid,status:done.run.status,code:done.run.snapshot.code,calls}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000});assert.equal(child.status,0,child.stderr);
 const done=JSON.parse(child.stdout);assert.notEqual(done.pid,process.pid);assert.equal(done.status,'completed',done.code);assert.equal(done.calls,1);assert.equal(saves,1);assert.equal(calls,2);assert.equal(summaries,0);
 const report=await readResearchReport(request);assert.ok(report.report.text.includes(text));
 const reopened=await workResearchTask({...request,gateway:{...gateway,next(){throw Error('terminal replay');}}});assert.equal(reopened.run.status,'completed');
});

test('compaction keeps derived projection and the latest requested page under the same Host policy',async()=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/derived-compaction-'));
 const record={runId:'main',rootId:'main',call:{id:'delegate',name:'delegate_child',arguments:{}},value:{sources:[],child:{schemaVersion:'child-execution-handoff@1',parentRunId:'main',rootId:'main',runId:'child',callId:'delegate',methodDescriptor:{id:'method',version:'1'},derived:true,summary:'中🙂é'.repeat(5000)}}};
 let consumed=false;const binding={name:'delegate_child',description:'Synthetic original producer',parameters:{type:'object'},sourceResults:true,validate(){},execute:async()=>structuredClone(record.value),verifyResult:async(value,{call})=>{assert.deepEqual(value,record.value);assert.deepEqual(call,record.call);}};
 const options={directory,enableNotes:true,extensions:[binding],allowedTools:['delegate_child','read_result','read_note','save_report'],hostProjection:'host-results@3',projectionOwner:{runId:'main',rootId:'main'},confirmDerivedConsumption:async r=>consumed&&JSON.stringify(r)===JSON.stringify(record)};
 const host=await createToolHost(options),result=await host.execute(record.call);assert.equal(result.status,'succeeded',result.error);consumed=true;
 const ref=host.snapshot().results.find(r=>r.kind==='derived').resultRef,read={id:'page',name:'read_result',arguments:{resultRef:ref,selection:{offset:0,limit:137}}},page=await host.execute(read);assert.equal(page.status,'succeeded',page.error);
 const messages=[{role:'user',content:'Read the complete derived analysis in pages.'},{role:'assistant',calls:[record.call]},{role:'tool',callId:record.call.id,result},{role:'assistant',calls:[read]},{role:'tool',callId:read.id,result:page}];
 const context={maxBytes:3500,lookupSource:host.lookupContextSource,projectOwnedResult:host.projectOwnedResult,projectOwnedCall:host.projectOwnedCall};
 const compacted=await compactWorkingView({messages,...context,canCompactHistory:host.canCompactHistory,rootBudget:createRootBudget({model:1,tool:1}),summarize:()=>assert.fail('no eligible group'),saveNote:()=>assert.fail('no note')});
 assert.equal(compacted.observation.status,'no-eligible-group');assert.equal(compacted.messages[2].result.value.child.kind,'stored-derived-ref');assert.deepEqual(compacted.messages.at(-1),messages.at(-1));assert.equal(messages[2].result.value.child.summary,record.value.child.summary);
 const cold=await createToolHost({...options,restore:host.snapshot(),readOnly:true});await cold.verifyWorkingInput(compacted,messages);
 await assert.rejects(compactWorkingView({messages,...context,maxBytes:100,canCompactHistory:host.canCompactHistory,rootBudget:createRootBudget({model:1,tool:1}),summarize:()=>assert.fail('capacity is not summary authority'),saveNote:()=>assert.fail('no note')}),{code:'CONTEXT_CAPACITY_EXCEEDED'});
});

for(const summary of ['failure','encoded-overflow'])test(`compaction ${summary} retains verified Host projection without publishing a note`,async()=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/report-compaction-fallback-'));
 const binding={name:'trusted_read',historyCompaction:'read-only@1',description:'Synthetic read-only source adapter.',parameters:{type:'object'},validate(){},sourceResult:true,execute:()=>readFixturePage({documentId:'atlas-a',page:1})};
 const options={directory,enableNotes:true,extensions:[binding],hostProjection:'host-results@3',projectionOwner:{runId:'main',rootId:'main'},confirmDerivedConsumption:async()=>false};
 const host=await createToolHost(options);
 const read={id:'read',name:'trusted_read',arguments:{query:'q'.repeat(6000)}},source=await host.execute(read);
 const save={id:'save',name:'save_report',arguments:{text:'完整正文🙂'.repeat(1800)+' [1]',sourceIds:[source.value.sourceId]}},receipt=await host.execute(save);assert.equal(receipt.status,'succeeded',receipt.error);
 const messages=[{role:'user',content:'Preserve the original report.'},{role:'assistant',calls:[read]},{role:'tool',callId:read.id,result:source},{role:'assistant',calls:[save]},{role:'tool',callId:save.id,result:receipt}];
 const context={maxBytes:12000,lookupSource:host.lookupContextSource,projectOwnedResult:host.projectOwnedResult,projectOwnedCall:host.projectOwnedCall};
 const baseline=await projectContext({messages,...context});
 const gateway=createChatGateway({endpoint:'https://example.invalid/chat/completions',model:'synthetic',apiKey:'synthetic',authorization:{providerApproved:true,dataApproved:true,costApproved:true},fetchImpl:()=>assert.fail('no provider dispatch')});
 const measure=messages=>gateway.inputBudget.measure({messages,tools:host.definitions});
 const additionalBudget={maxBytes:measure(baseline)+128,measure};let summaries=0,saves=0;
 const result=await compactWorkingView({messages,...context,additionalBudget,canCompactHistory:host.canCompactHistory,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=>{summaries++;if(summary==='failure')throw Error('synthetic summary failure');return '"'.repeat(2000);},saveNote:async()=>{saves++;assert.fail('unusable summary must not persist');}});
 assert.equal(summaries,1);assert.equal(saves,0);assert.equal(result.observation.status,summary==='failure'?'summary-failed':'no-net-saving');
 assert.deepEqual(result.messages,baseline);assert.equal(result.noteRef,null);assert.ok(measure(result.messages)<=additionalBudget.maxBytes);
 assert.equal(messages[3].calls[0].arguments.text,save.arguments.text);assert.deepEqual(result.messages[4],messages[4]);
 const cold=await createToolHost({...options,restore:host.snapshot(),readOnly:true});await cold.verifyWorkingInput(result,messages);
 if(summary==='encoded-overflow'){
  // Counterfactual control: raw bytes alone would accept this exact summary.
  // Compute a synthetic receipt without persisting the unusable note.
  const rawOnly=await compactWorkingView({messages,...context,canCompactHistory:host.canCompactHistory,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=>'"'.repeat(2000),saveNote:async note=>({resultRef:noteRef(note)})});
  assert.equal(rawOnly.observation.status,'applied');assert.ok(rawOnly.observation.afterBytes<rawOnly.observation.beforeBytes);assert.ok(measure(rawOnly.messages)>additionalBudget.maxBytes);
 }
});
