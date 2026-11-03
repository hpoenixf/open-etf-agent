import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openSession} from '../src/session.mjs';
import {submitRun,confirmScheduledRun,materializeScheduledRun} from '../src/runtime.mjs';
import {workRun} from '../src/worker.mjs';
import {openMemoryLibrary} from '../src/memory.mjs';
import {openMemoryConsumer} from '../src/memory-consumer.mjs';
import {openDurableMemory} from '../src/durable-memory.mjs';
import {prepareSkillMcpExtensions} from '../src/extensions.mjs';
import {connectFixtureMcp} from '../src/mcp.mjs';
import {SCHEDULE_PROFILE,SCHEDULE_COMPOSITION_BINDING} from '../src/schedule.mjs';
import {sha256} from '../src/source.mjs';
const publication={id:'publication',version:'publication@1'};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}],usage:null});
const final=()=>({kind:'final',text:'Synthetic combination complete.',usage:null});
const bindings=adapters=>({gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'additional-composition',version:'1'},plugins:[],adapters:[publication,...adapters]});
async function root(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/additional-composition-'));}
test('durable Memory effect composes Worker stop/resume and Publication without replaying consumed intent',async()=>{
 const dir=await root();let store,seed;const text='SYNTHETIC approved preference';let calls=0;
 try{
  seed=await openMemoryLibrary({directory:join(dir,'memory'),writable:true});const libraryId=seed.libraryId;await seed.close();seed=null;
  const intent={explicit:true,libraryId,operation:'save',intentId:'additional-save',origin:'synthetic-test',approvedTextHash:sha256(text)};
  const memory=await openDurableMemory({directory:join(dir,'memory'),intents:[intent]});store=await openSession({directory:join(dir,'session'),leaseMs:5000});const stop=new AbortController();
  const options={question:'Save exactly the synthetic approved preference.',publication:true,allowedTools:['memory_save'],extensions:memory.extensions,workingInput:{memoryLibrary:memory},outputRoot:join(dir,'runs'),gateway:{mode:'fixture',async next({messages}){calls++;if(calls===1)return call('save','memory_save',{text});assert.equal(messages.at(-1).result.value.operation,'saved');return final();}},durable:{store,runId:'memory-effect',grantId:'synthetic',bindings:bindings([{id:'durable-memory',version:'1',contentSha256:memory.intentDigest}]),onCheckpoint(e){if(e.phase==='result-consumed')stop.abort();}}};
  await submitRun(options);assert.equal(calls,0);const paused=await workRun({...options,hostSignal:stop.signal});assert.equal(paused.workerStatus,'interrupted');assert.equal(calls,1);
  const done=await workRun({...options,durable:{...options.durable,onCheckpoint:undefined}});assert.equal(done.run.status,'completed');assert.ok(done.publication);assert.equal(calls,2);
  const receipt=done.run.snapshot.messages.find(m=>m.role==='tool').result.value;assert.equal((await memory.verifyReceipt(receipt)).intentId,intent.intentId);assert.equal((await memory.state(receipt.id)).revision,1);
  await workRun({...options,durable:{...options.durable,onCheckpoint:undefined}});assert.equal(calls,2);assert.equal((await memory.state(receipt.id)).revision,1);
 }finally{await seed?.close();store?.close();await rm(dir,{recursive:true,force:true});}
});
async function scheduleCombination(kind){
 const dir=await root();let store,writer,consumer;let calls=0;try{
  const due=Date.now()-100;let clock=due-10;store=await openSession({directory:join(dir,'session'),profile:SCHEDULE_PROFILE,clock:()=>clock,leaseMs:5000});
  if(kind==='memory'){writer=await openMemoryLibrary({directory:join(dir,'memory'),writable:true});const text='SYNTHETIC select original references';await writer.save({text},{intent:{explicit:true,libraryId:writer.libraryId,operation:'save',intentId:'seed',origin:'synthetic',approvedTextHash:sha256(text)}});await writer.close();writer=null;consumer=await openMemoryConsumer({directory:join(dir,'memory')});}
  const options={question:'Use selected synthetic data and save the original report.',requireReport:true,publication:true,allowedDocuments:['atlas-a'],allowedTools:['read_page','save_report',kind==='memory'?'memory_search':'calculate_change'],...(consumer?{extensions:consumer.extensions,workingInput:consumer.workingInput}:{}),outputRoot:join(dir,'runs'),gateway:{mode:'fixture',async next({messages}){calls++;if(calls===1)return call('prepare',kind==='memory'?'memory_search':'calculate_change',kind==='memory'?{query:'original'}:{baseline:100,current:125,baselineUnit:'rows',currentUnit:'rows'});if(calls===2){assert.equal(messages.at(-1).result.status,'succeeded');return call('read','read_page',{documentId:'atlas-a',page:1});}if(calls===3)return call('report','save_report',{text:'# Synthetic scheduled combination',sourceIds:[messages.at(-1).result.value.sourceId]});return final();}},durable:{store,grantId:'schedule-additional',bindings:bindings([SCHEDULE_COMPOSITION_BINDING])}};
  const schedule={scheduleId:'schedule-'+kind,definitionRevision:1,scheduledInstant:new Date(due).toISOString(),timeZone:'UTC',maxLatenessMs:60000};const confirmed=await confirmScheduledRun(options,schedule);assert.equal(calls,0);assert.equal((await materializeScheduledRun(options,confirmed.reference)).state,'not-due');clock=due;
  const materialized=await materializeScheduledRun(options,confirmed.reference);assert.equal(calls,0);const execution={...options,durable:{...options.durable,runId:materialized.runId}};const done=await workRun(execution);assert.equal(done.run.status,'completed');assert.ok(done.publication);assert.equal(calls,4);
  const value=done.run.snapshot.messages.find(m=>m.role==='tool').result.value;
  if(kind==='memory'){assert.equal(value.libraryId,consumer.libraryId);assert.equal(value.entries.length,1);}else{assert.equal(value.inputs.baseline,100);assert.equal(value.inputs.current,125);assert.equal(value.difference,25);assert.equal(value.binding,undefined);}
  await workRun(execution);assert.equal(calls,4);assert.equal((await materializeScheduledRun(options,confirmed.reference)).runId,materialized.runId);
 }finally{await writer?.close();await consumer?.close();store?.close();await rm(dir,{recursive:true,force:true});}
}
test('Schedule composes original read-only Memory and same occurrence Publication',()=>scheduleCombination('memory'));
test('Schedule composes original Calculation and source report without new scheduling authority',()=>scheduleCombination('calculation'));
test('Skill and actual stdio MCP compose Worker reconnect after safe stop with owned child cleanup',async()=>{
 const dir=await root();let store,prepared;let calls=0;const pids=[];try{
  const connect=async()=>{const session=await connectFixtureMcp();pids.push(session.pid);return session;};
  const assemble=()=>prepareSkillMcpExtensions({skillRoot:fileURLToPath(new URL('../fixtures/skills',import.meta.url)),connect});
  prepared=await assemble();store=await openSession({directory:join(dir,'session'),leaseMs:5000});const stop=new AbortController();
  const options={question:'Read the enabled Skill then acquire the original MCP page.',publication:true,allowedTools:['list_skills','read_skill','mcp_read_page'],extensions:prepared.extensions,outputRoot:join(dir,'runs'),gateway:{mode:'fixture',async next({messages}){calls++;if(calls===1)return call('list','list_skills',{});if(calls===2)return call('skill','read_skill',{skillId:messages.at(-1).result.value.skills[0].id});if(calls===3){assert.match(messages.at(-1).result.value.version,/^sha256:/);return call('page','mcp_read_page',{documentId:'atlas-a',page:1});}assert.equal(messages.at(-1).result.value.documentId,'atlas-a');return final();}},durable:{store,runId:'skill-mcp-worker',grantId:'synthetic',bindings:bindings([{id:'skill-mcp',version:'1'}]),onCheckpoint(e){if(e.phase==='proposal-sealed')stop.abort();}}};
  await submitRun(options);assert.equal(calls,0);const paused=await workRun({...options,hostSignal:stop.signal});assert.equal(paused.workerStatus,'interrupted');assert.equal(calls,1);await prepared.close();assert.throws(()=>process.kill(pids[0],0),{code:'ESRCH'});
  prepared=await assemble();const resumed={...options,extensions:prepared.extensions,durable:{...options.durable,onCheckpoint:undefined}};const done=await workRun(resumed);assert.equal(done.run.status,'completed');assert.ok(done.publication);assert.equal(calls,4);await workRun(resumed);assert.equal(calls,4);
 }finally{await prepared?.close();store?.close();for(const pid of pids)assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});await rm(dir,{recursive:true,force:true});}
});
async function schedulePdfOrPlugin(kind){
 const dir=await root();let store;let calls=0,activated=0,released=0;try{
  const due=Date.now()-100;let clock=due-10;store=await openSession({directory:join(dir,'session'),profile:SCHEDULE_PROFILE,clock:()=>clock,leaseMs:5000});
  const {preparePdfSnapshot}=await import('../src/pdf-input.mjs');const {inspectTrustedPlugins}=await import('../src/plugins.mjs');const {readFile}=await import('node:fs/promises');
  const snapshot=kind==='pdf'?await preparePdfSnapshot():null;
  const plugin={id:'scheduled-echo',version:'1.0.0',schemaVersion:'trusted-plugin@1',sourceUrl:import.meta.url,contentSha256:sha256(await readFile(new URL(import.meta.url))),tools:[{name:'scheduled_echo',description:'Synthetic local scheduled echo',parameters:{type:'object',properties:{},additionalProperties:false},validate(args){assert.deepEqual(args,{});},async execute(){return {text:'Scheduled original plugin tool'};}}],activate({deferRelease}){activated++;deferRelease(()=>{released++;});}};
  const inspected=kind==='plugin'?await inspectTrustedPlugins({plugins:[plugin]}):null;
  const selectedBindings=bindings([SCHEDULE_COMPOSITION_BINDING]);if(inspected)selectedBindings.plugins=inspected.bindings;
  const options={question:'Consume the explicitly selected synthetic scheduled source and save a report.',requireReport:true,publication:true,allowedDocuments:snapshot?[`pdf:${snapshot.originalSha256}`]:['atlas-a'],allowedTools:kind==='pdf'?['read_pdf_page','save_report']:['scheduled_echo','read_page','save_report'],...(snapshot?{pdfInput:{snapshot},documentCatalog:{schemaVersion:'document-catalog@1',id:'unselected-text-catalog',documents:[{id:'unselected-text',name:'Not selected',version:'1',pages:['This text is outside the PDF-only scope.']}]}}:{plugins:[plugin]}),outputRoot:join(dir,'runs'),gateway:{mode:'fixture',async next({messages}){calls++;if(kind==='plugin'&&calls===1)return call('echo','scheduled_echo',{});if(calls===(kind==='plugin'?2:1))return kind==='pdf'?call('read','read_pdf_page',{page:3}):call('read','read_page',{documentId:'atlas-a',page:1});if(calls===(kind==='plugin'?3:2)){const source=messages.at(-1).result.value;if(kind==='pdf')assert.match(source.text,/Physical page three/);return call('report','save_report',{text:'# Scheduled synthetic '+kind,sourceIds:[source.sourceId]});}return final();}},durable:{store,grantId:'schedule-'+kind,bindings:selectedBindings}};
  const schedule={scheduleId:'additional-'+kind,definitionRevision:1,scheduledInstant:new Date(due).toISOString(),timeZone:'UTC',maxLatenessMs:60000};
  if(kind==='pdf'){const {createToolHost}=await import('../src/tools.mjs');await assert.rejects(createToolHost({directory:dir,pdfInput:{snapshot},allowedDocuments:['pdf:'+'0'.repeat(64)],allowedTools:['read_pdf_page']}),/Invalid document allowlist/);assert.equal(calls,0);assert.equal(activated,0);}
  const confirmed=await confirmScheduledRun(options,schedule);assert.equal(calls,0);assert.equal(activated,0);assert.equal((await materializeScheduledRun(options,confirmed.reference)).state,'not-due');assert.equal(activated,0);clock=due;
  const m=await materializeScheduledRun(options,confirmed.reference);assert.equal(calls,0);assert.equal(activated,0);const execution={...options,durable:{...options.durable,runId:m.runId}};
  if(kind==='pdf'){const changed=structuredClone(snapshot);changed.pages[2]='Replacement';await assert.rejects(workRun({...execution,pdfInput:{snapshot:changed}}),/RUN_BINDINGS_MISMATCH/);}else await assert.rejects(workRun({...execution,plugins:[{...plugin,contentSha256:'0'.repeat(64)}]}),/PLUGIN_/);
  assert.equal(calls,0);assert.equal(activated,0);
  const done=await workRun(execution);assert.equal(done.run.status,'completed',JSON.stringify({code:done.run.snapshot.code,results:done.run.snapshot.messages.filter(m=>m.role==='tool').map(m=>({status:m.result.status,error:m.result.error}))}));assert.ok(done.publication);assert.equal(calls,kind==='pdf'?3:4);assert.equal(activated,kind==='pdf'?0:1);assert.equal(released,activated);
  if(kind==='pdf'){const {openArtifactStore}=await import('../src/artifacts.mjs');const source=done.run.snapshot.messages.find(m=>m.role==='tool').result.value;const artifacts=await openArtifactStore({directory:done.run.directory,readOnly:true});assert.deepEqual((await artifacts.read(source.pdf.originalArtifactId)).bytes,Buffer.from(snapshot.originalBase64,'base64'));}
  await workRun(execution);assert.equal(calls,kind==='pdf'?3:4);assert.equal(activated,kind==='pdf'?0:1);assert.equal(released,activated);
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
}
test('Schedule prepared PDF keeps original snapshot, source Artifact and report through zero-dispatch admission',()=>schedulePdfOrPlugin('pdf'));
test('Schedule trusted plugin inspects before due and activates/releases only its original Worker',()=>schedulePdfOrPlugin('plugin'));
