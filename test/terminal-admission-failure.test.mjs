import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {openSession} from '../src/session.mjs';import {run,submitRun,validateRuntimeCheckpoint} from '../src/runtime.mjs';
test('failed Host admission with no receipt remains a readable terminal Run, not a new execution',async()=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/terminal-admission-'));let store;let calls=0;
 try{store=await openSession({directory:join(directory,'session'),leaseMs:5000});
 const options={question:'Synthetic denied document selection.',documentCatalog:{schemaVersion:'document-catalog@1',id:'synthetic',documents:[{id:'available',name:'Synthetic available',version:'1',pages:['Synthetic original data.']}]},allowedDocuments:['not-granted'],allowedTools:['read_page'],outputRoot:join(directory,'runs'),gateway:{mode:'fixture',async next(){calls++;throw Error('MUST_NOT_DISPATCH');}},durable:{store,runId:'failed-host-admission',grantId:'synthetic',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'failure-readback',version:'1'},plugins:[],adapters:[]}}};
 await submitRun(options);assert.equal(calls,0);
 const first=await run(options);assert.equal(first.status,'failed');assert.equal(first.code,'EXECUTION_FAILED');assert.equal(first.receipt,null);assert.equal(calls,0);
 const original=store.inspect(first.runId);assert.equal(original.snapshot.host,null);assert.equal(original.rootUsage.model,0);assert.deepEqual(await run(options),first);assert.equal(calls,0);
 const wrong=structuredClone(original.snapshot);wrong.outcome.receipt={artifactId:'invented'};assert.throws(()=>validateRuntimeCheckpoint(wrong,original.definition),{code:'INVALID_TERMINAL_OUTCOME'});
 const impossible=structuredClone(original.snapshot);impossible.status='completed';impossible.code=null;impossible.outcome.status='completed';impossible.outcome.code=null;assert.throws(()=>validateRuntimeCheckpoint(impossible,original.definition),{code:'INVALID_TERMINAL_OUTCOME'});
 store.close();store=await openSession({directory:join(directory,'session'),readOnly:true});assert.deepEqual(store.inspect(first.runId),original);assert.equal(calls,0);
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});
