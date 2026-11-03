import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {openMemoryLibrary} from '../src/memory.mjs';
import {openMemoryConsumer} from '../src/memory-consumer.mjs';
import {openSession} from '../src/session.mjs';
import {submitRun} from '../src/runtime.mjs';
import {workRun} from '../src/worker.mjs';
import {sha256} from '../src/source.mjs';
test('Worker composes read-only Memory, Context and Publication with original binding and stop/resume',async()=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/worker-composition-'));let writer,consumer,store;
 try{
 writer=await openMemoryLibrary({directory:join(dir,'memory'),writable:true});const text='SYNTHETIC preference: retain original source identities.';
 const saved=await writer.save({text},{intent:{explicit:true,libraryId:writer.libraryId,operation:'save',intentId:'v19-seed',origin:'synthetic-test',approvedTextHash:sha256(text)}});await writer.close();writer=null;
 consumer=await openMemoryConsumer({directory:join(dir,'memory')});store=await openSession({directory:join(dir,'session'),leaseMs:5000});
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'composition',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'},{id:'memory-consumer',version:'1'}]};let calls=0;const stop=new AbortController();
 const options={question:'Synthetic current preference',outputRoot:join(dir,'runs'),publication:true,contextBytes:32000,extensions:consumer.extensions,workingInput:consumer.workingInput,
 gateway:{mode:'fixture',async next({messages}){calls++;if(calls===1)return {kind:'calls',calls:[{id:'memory-read',name:'memory_read',arguments:{id:saved.id}}],usage:null};assert.match(JSON.stringify(messages),/retain original source identities/);return {kind:'final',text:'Synthetic preference consumed, not financial advice.',usage:null};}},
 durable:{store,runId:'composition-run',grantId:'composition-grant',bindings,onCheckpoint(value){if(value.phase==='proposal-sealed')stop.abort();}}};
 const admitted=await submitRun(options);assert.equal(calls,0);assert.equal(admitted.definition.config.workingInput.memoryLibraryId,consumer.libraryId);
 const interrupted=await workRun({...options,hostSignal:stop.signal});assert.equal(interrupted.workerStatus,'interrupted');assert.equal(calls,1);
 await assert.rejects(workRun({...options,workingInput:{memoryLibrary:{...consumer.workingInput.memoryLibrary,libraryId:'wrong-library'}}}),/RUN_BINDINGS_MISMATCH/);assert.equal(calls,1);
 const resumed=await workRun({...options,durable:{...options.durable,onCheckpoint:undefined}});assert.equal(resumed.run.status,'completed');assert.equal(calls,2);assert.ok(resumed.publication);assert.equal(resumed.run.rootUsage.model,2);
 const repeated=await workRun({...options,durable:{...options.durable,onCheckpoint:undefined}});assert.equal(repeated.run.runId,resumed.run.runId);assert.equal(calls,2);
 }finally{store?.close();await consumer?.close();await writer?.close();await rm(dir,{recursive:true,force:true});}
});
test('Worker plugin admission checks original bytes without activation, then original owner activates/releases',async()=>{
 const {readFile}=await import('node:fs/promises');const {inspectTrustedPlugins}=await import('../src/plugins.mjs');
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/worker-plugin-'));let store;let activated=0,released=0,calls=0;
 try{store=await openSession({directory:join(dir,'session'),leaseMs:5000});const plugin={id:'worker-plugin',version:'1.0.0',schemaVersion:'trusted-plugin@1',sourceUrl:import.meta.url,contentSha256:sha256(await readFile(new URL(import.meta.url))),tools:[{name:'composition_echo',description:'Synthetic local echo',parameters:{type:'object',properties:{},additionalProperties:false},validate(args){assert.deepEqual(args,{});},async execute(){return {text:'original plugin tool'};}}],activate({deferRelease}){activated++;deferRelease(()=>{released++;});}};
 const inspection=await inspectTrustedPlugins({plugins:[plugin]});assert.equal(activated,0);
 const options={question:'Use trusted local synthetic echo',outputRoot:join(dir,'runs'),publication:true,plugins:[plugin],gateway:{mode:'fixture',async next(){calls++;return calls===1?{kind:'calls',calls:[{id:'echo',name:'composition_echo',arguments:{}}],usage:null}:{kind:'final',text:'Synthetic tool complete.',usage:null};}},durable:{store,runId:'plugin-run',grantId:'plugin-grant',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'composition',version:'1'},plugins:inspection.bindings,adapters:[{id:'publication',version:'publication@1'}]}}};
 await submitRun(options);assert.equal(activated,0);assert.equal(calls,0);
 await assert.rejects(workRun({...options,plugins:[{...plugin,contentSha256:'0'.repeat(64)}]}),/PLUGIN_/);assert.equal(activated,0);assert.equal(calls,0);
 await assert.rejects(workRun({...options,question:'Changed original question'}),/RUN_BINDINGS_MISMATCH/);assert.equal(activated,0);assert.equal(calls,0);
 const done=await workRun(options);assert.equal(done.run.status,'completed');assert.equal(activated,1);assert.equal(released,1);assert.equal(calls,2);
 const repeated=await workRun(options);assert.equal(repeated.run.runId,done.run.runId);assert.equal(activated,1);assert.equal(released,1);assert.equal(calls,2);
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
