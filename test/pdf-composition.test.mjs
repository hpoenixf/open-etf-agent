import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {preparePdfSnapshot,pdfSnapshotBinding} from '../src/pdf-input.mjs';import {openSession} from '../src/session.mjs';import {submitRun} from '../src/runtime.mjs';import {workRun} from '../src/worker.mjs';import {openArtifactStore} from '../src/artifacts.mjs';
test('prepared original PDF composes durable Worker and Publication across host stop without parsing replacement input',async()=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/pdf-composition-'));let store;let calls=0;
 try{const snapshot=await preparePdfSnapshot();store=await openSession({directory:join(dir,'session'),leaseMs:5000});const stop=new AbortController();let original;
 const options={question:'Read original synthetic PDF physical page three.',pdfInput:{snapshot},publication:true,allowedTools:['read_pdf_page','read_result'],outputRoot:join(dir,'runs'),gateway:{mode:'fixture',async next({messages}){calls++;if(calls===1)return {kind:'calls',calls:[{id:'pdf',name:'read_pdf_page',arguments:{page:3}}],usage:null};original=messages.at(-1).result.value;assert.equal(original.page,3);assert.match(original.text,/Physical page three/);return {kind:'final',text:'Original synthetic PDF consumed.',usage:null};}},durable:{store,runId:'pdf-composition',grantId:'pdf-grant',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'pdf-composition',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]},onCheckpoint(value){if(value.phase==='result-consumed')stop.abort();}}};
 const before=await submitRun(options);assert.deepEqual(before.definition.config.pdfSnapshot,pdfSnapshotBinding(snapshot));assert.equal(calls,0);
 const interrupted=await workRun({...options,hostSignal:stop.signal});assert.equal(interrupted.workerStatus,'interrupted');assert.equal(calls,1);
 await assert.rejects(workRun({...options,pdfInput:{path:'replacement.pdf'}}),/PDF_ACTIVE_RECOVERY_UNSUPPORTED/);assert.equal(calls,1);
 const changed=structuredClone(snapshot);changed.pages[2]='changed extraction';await assert.rejects(workRun({...options,pdfInput:{snapshot:changed}}),/RUN_BINDINGS_MISMATCH/);assert.equal(calls,1);
 const done=await workRun({...options,durable:{...options.durable,onCheckpoint:undefined}});assert.equal(done.run.status,'completed');assert.equal(calls,2);assert.ok(done.publication);
 const artifacts=await openArtifactStore({directory:done.run.directory,readOnly:true});assert.deepEqual((await artifacts.read(original.pdf.originalArtifactId)).bytes,Buffer.from(snapshot.originalBase64,'base64'));
 await workRun({...options,durable:{...options.durable,onCheckpoint:undefined}});assert.equal(calls,2);
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
