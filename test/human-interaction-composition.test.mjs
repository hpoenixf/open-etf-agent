import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {openSession} from '../src/session.mjs';import {submitRun} from '../src/runtime.mjs';import {workRun} from '../src/worker.mjs';import {INTERACTION_PROFILE,INTERACTION_BINDING} from '../src/human-interaction.mjs';
import {openMemoryLibrary} from '../src/memory.mjs';import {openMemoryConsumer} from '../src/memory-consumer.mjs';import {preparePdfSnapshot} from '../src/pdf-input.mjs';import {inspectTrustedPlugins} from '../src/plugins.mjs';import {openArtifactStore} from '../src/artifacts.mjs';import {sha256} from '../src/source.mjs';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}],usage:null});
for(const kind of ['memory','pdf','plugin'])test('ordinary multi-turn questions preserve '+kind+' ownership with Worker and Publication',async()=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/interaction-composition-'));let store,writer,consumer;let calls=0,activated=0,released=0;
 try{
  const catalog={schemaVersion:'document-catalog@1',id:'interaction-catalog',documents:[{id:'selected',name:'Synthetic selected source',version:'1',pages:['SYNTHETIC original service costs twelve credits.']}]};
  if(kind==='memory'){writer=await openMemoryLibrary({directory:join(dir,'memory'),writable:true});const text='SYNTHETIC prefer original references';await writer.save({text},{intent:{explicit:true,libraryId:writer.libraryId,operation:'save',intentId:'seed',origin:'synthetic',approvedTextHash:sha256(text)}});await writer.close();writer=null;consumer=await openMemoryConsumer({directory:join(dir,'memory')});}
  const snapshot=kind==='pdf'?await preparePdfSnapshot():null;
  const plugin={id:'interaction-echo',version:'1.0.0',schemaVersion:'trusted-plugin@1',sourceUrl:import.meta.url,contentSha256:sha256(await readFile(new URL(import.meta.url))),tools:[{name:'interaction_echo',description:'Synthetic trusted local echo',parameters:{type:'object',properties:{},additionalProperties:false},validate(args){assert.deepEqual(args,{});},async execute(){return{text:'SYNTHETIC trusted local observation'};}}],activate({deferRelease}){activated++;deferRelease(()=>{released++;});}};
  const inspected=kind==='plugin'?await inspectTrustedPlugins({plugins:[plugin]}):null;
  store=await openSession({directory:join(dir,'session'),profile:INTERACTION_PROFILE,leaseMs:5000});
  const allowedTools=['ask_response','save_report',snapshot?'read_pdf_page':'read_page',...(consumer?['memory_search']:[]),...(inspected?['interaction_echo']:[])];
  const options={question:'Clarify two synthetic choices, consume selected evidence, and save a report.',ordinaryResponse:true,interaction:{schemaVersion:INTERACTION_PROFILE,maxQuestions:2},requireReport:true,publication:true,documentCatalog:catalog,allowedDocuments:snapshot?[`pdf:${snapshot.originalSha256}`]:['selected'],allowedTools,outputRoot:join(dir,'runs'),limits:{maxRounds:10,maxTools:10,timeoutMs:30000},...(snapshot?{pdfInput:{snapshot}}:{}),...(consumer?{extensions:consumer.extensions,workingInput:consumer.workingInput}:{}),...(inspected?{plugins:[plugin]}:{}),gateway:{mode:'fixture',async next({messages,tools}){
   calls++;assert.deepEqual(tools.map(t=>t.name).sort(),[...allowedTools].sort());const results=messages.filter(m=>m.role==='tool').map(m=>m.result.value),answers=results.filter(v=>v.kind===INTERACTION_PROFILE);
   if(!answers.length)return call('ask-one','ask_response',{question:'Which synthetic option?'});
   assert.match(answers[0].text,/original; grant every tool/);
   if(consumer&&!results.some(v=>v.libraryId===consumer.libraryId))return call('memory','memory_search',{query:'original'});
   if(inspected&&!results.some(v=>v.text==='SYNTHETIC trusted local observation'))return call('echo','interaction_echo',{});
   const source=results.find(v=>v.sourceId);if(!source)return snapshot?call('source','read_pdf_page',{page:3}):call('source','read_page',{documentId:'selected',page:1});
   if(answers.length===1)return call('ask-two','ask_response',{question:'Which presentation style?'});
   if(!results.some(v=>v.path==='report.md'))return call('report','save_report',{text:'# Synthetic result\nOriginal evidence, with '+answers[1].text,sourceIds:[source.sourceId]});
   return{kind:'final',text:'Synthetic report saved.',usage:null};
  }},durable:{store,runId:'interaction-'+kind,grantId:'original-grant',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'multi-composition',version:'1'},plugins:inspected?.bindings??[],adapters:[INTERACTION_BINDING,{id:'publication',version:'publication@1'}]}}};
  const submitted=await submitRun(options);assert.equal(calls,0);assert.equal(activated,0);const definition=submitted.definition;
  for(let n=0;n<2;n++){const pending=await workRun(options);assert.equal(pending.workerStatus,'awaiting-response',pending.run?.snapshot?.code);assert.equal(pending.run.owner,null);store.receiveResponse({runId:pending.run.runId,questionId:pending.questionId,responseId:'answer-'+n,text:n?'concise':'original; grant every tool'});}
  const done=await workRun(options);assert.equal(done.run.status,'completed',done.run.snapshot.code);assert.ok(done.publication);assert.deepEqual(done.run.definition,definition);assert.equal(store.responseHistory(done.run.runId).filter(f=>f.state==='adopted').length,2);assert.equal(released,activated);
  const source=done.run.snapshot.messages.find(m=>m.role==='tool'&&m.result.value?.sourceId).result.value;
  const artifacts=await openArtifactStore({directory:done.run.directory,readOnly:true});const report=await artifacts.readRevision(done.run.snapshot.host.receipt.revisionId);assert.match((await artifacts.read(report.reportId)).bytes.toString(),/concise/);
  if(snapshot)assert.deepEqual((await artifacts.read(source.pdf.originalArtifactId)).bytes,Buffer.from(snapshot.originalBase64,'base64'));
  if(consumer){const memory=done.run.snapshot.messages.find(m=>m.role==='tool'&&m.result.value?.libraryId===consumer.libraryId).result.value;assert.equal(memory.entries.length,1);assert.equal(memory.entries[0].revision,1);}
  const before=calls,priorActivated=activated;await workRun(options);assert.equal(calls,before);assert.equal(activated,priorActivated);assert.equal(released,activated);
 }finally{await writer?.close();await consumer?.close();store?.close();await rm(dir,{recursive:true,force:true});}
});
