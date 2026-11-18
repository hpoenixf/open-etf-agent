import test from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {importProjectSources} from '../src/project-sources.mjs';
import {acquireKnowledgeVectors,inspectKnowledgeAcquisition} from '../src/knowledge-acquisition.mjs';
async function setup(t){await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/typed-acquisition-'));t.after(()=>rm(root,{recursive:true,force:true}));const file=join(root,'source.md');await writeFile(file,'Original cash reserve.');const projectDir=join(root,'project');const {manifestSha256}=await importProjectSources({projectDir,files:[file]});return {projectDir,manifestSha256,acquisitionId:'typed',provider:{id:'synthetic',model:'test',revision:'1'},dimensions:2,queries:['cash'],approveSelectedText:true};}
function backend(events=[]){return {maxTokens:4,tokenize:async r=>{events.push(r.kind);return {tokenIds:[1,2],truncated:false};},encodeDocument:async r=>({vector:[1,0],truncated:false,tokenIdsSha256:r.tokenIdsSha256}),encodeQuery:async r=>({vector:[0,1],truncated:false,tokenIdsSha256:r.tokenIdsSha256})};}
test('typed acquisition freezes role-specific receipt and recovers without backend',async t=>{const a=await setup(t),events=[];const r=await acquireKnowledgeVectors({...a,backend:backend(events)});assert.deepEqual(events,['document','query']);assert.deepEqual(r.vectorEvidence.queries[0].vector,[0,1]);const dir=join(a.projectDir,'knowledge-acquisitions','typed');assert.equal(JSON.parse(await readFile(join(dir,'plan.json'))).schemaVersion,'knowledge-acquisition-plan@2');const receipt=JSON.parse(await readFile(join(dir,'encoding.json')));assert.deepEqual(receipt.results.map(r=>r.kind),['document','query']);assert.equal((await inspectKnowledgeAcquisition(a)).status,'succeeded');const cold=spawnSync(process.execPath,['--input-type=module','-e',`import {inspectKnowledgeAcquisition} from './src/knowledge-acquisition.mjs'; console.log((await inspectKnowledgeAcquisition(${JSON.stringify(a)})).status)`],{encoding:'utf8'});assert.equal(cold.status,0,cold.stderr);assert.equal(cold.stdout.trim(),'succeeded');await assert.rejects(acquireKnowledgeVectors({...a,backend:backend(events)}),{code:'EEXIST'});assert.equal(events.length,2);});
test('typed receipt corruption cannot masquerade as recovered success',async t=>{const a=await setup(t);await acquireKnowledgeVectors({...a,backend:backend()});const p=join(a.projectDir,'knowledge-acquisitions','typed','encoding.json');const receipt=JSON.parse(await readFile(p));receipt.results[0].kind='query';await writeFile(p,JSON.stringify(receipt));await assert.rejects(inspectKnowledgeAcquisition(a),{code:'EMBEDDING_RECORD_CHANGED'});});
test('typed noncooperative tokenizer times out unknown; late work cannot encode or publish',async t=>{
 const a=await setup(t);let finish,calls=0,tokenizerCalls=0,entered;
 const started=new Promise(r=>{entered=r;}),b=backend();
 b.tokenize=()=>{tokenizerCalls++;entered();return new Promise(r=>{finish=r;});};
 b.encodeDocument=async()=>{calls++;};
 t.mock.timers.enable({apis:['setTimeout']});
 const pending=acquireKnowledgeVectors({...a,timeoutMs:30,backend:b});
 const rejected=assert.rejects(pending,{code:'EMBEDDING_ACQUISITION_INCOMPLETE'});
 // Advance the owner deadline only after the side effect actually entered.
 // Wall-clock storage latency before dispatch is a different terminal state.
 await started;t.mock.timers.tick(30);await rejected;
 const observed=await inspectKnowledgeAcquisition(a);
 assert.equal(tokenizerCalls,1);assert.equal(observed.status,'unknown');
 assert.equal(observed.adapterInvocations,1);assert.equal(observed.responseObserved,false);
 assert.equal(observed.automaticReplayAllowed,false);
 finish({tokenIds:[1],truncated:false});await new Promise(r=>setImmediate(r));
 assert.equal(calls,0);
 await assert.rejects(readFile(join(a.projectDir,'knowledge-acquisitions','typed','encoding.json')),{code:'ENOENT'});
});
test('owner timeout before typed dispatch records failure with zero adapter calls',async t=>{
 const a=await setup(t),fs=await import('node:fs/promises');
 const {syncBuiltinESMExports}=await import('node:module');
 let calls=0,intercepted=false;const b=backend(),original=fs.default.link;
 b.tokenize=async()=>{calls++;return {tokenIds:[1],truncated:false};};
 t.mock.timers.enable({apis:['setTimeout']});
 fs.default.link=async(source,destination)=>{
  if(destination.endsWith('/attempt.json')){intercepted=true;t.mock.timers.tick(30);}
  return original(source,destination);
 };
 syncBuiltinESMExports();
 try{
  await assert.rejects(acquireKnowledgeVectors({...a,timeoutMs:30,backend:b}),{code:'EMBEDDING_ACQUISITION_INCOMPLETE'});
  const observed=await inspectKnowledgeAcquisition(a);
  assert.equal(intercepted,true);assert.equal(calls,0);assert.equal(observed.status,'failed');
  assert.equal(observed.adapterInvocations,0);assert.equal(observed.responseObserved,false);
  assert.equal(observed.automaticReplayAllowed,false);
  await assert.rejects(readFile(join(a.projectDir,'knowledge-acquisitions','typed','encoding.json')),{code:'ENOENT'});
 }finally{fs.default.link=original;syncBuiltinESMExports();}
});
test('typed oversize preflight never encodes and mixed protocols never dispatch',async t=>{const a=await setup(t);let calls=0;const b=backend();b.tokenize=async()=>({tokenIds:[1,2,3,4,5],truncated:false});b.encodeDocument=async()=>{calls++;};await assert.rejects(acquireKnowledgeVectors({...a,backend:b,embed:async()=>{calls++;}}),{code:'EMBEDDING_ADMISSION_INVALID'});await assert.rejects(acquireKnowledgeVectors({...a,backend:b}),{code:'EMBEDDING_ACQUISITION_INCOMPLETE'});assert.equal(calls,0);});
test('typed missing receipt cannot recover or replay successful acquisition',async t=>{const a=await setup(t);await acquireKnowledgeVectors({...a,backend:backend()});await rm(join(a.projectDir,'knowledge-acquisitions','typed','encoding.json'));await assert.rejects(inspectKnowledgeAcquisition(a),{code:'ENOENT'});const events=[];await assert.rejects(acquireKnowledgeVectors({...a,backend:backend(events)}),{code:'EEXIST'});assert.deepEqual(events,[]);});
test('durable commit is non-cancellable after final backend validation',async t=>{
 const fs=await import('node:fs/promises'),{syncBuiltinESMExports}=await import('node:module');
 const a=await setup(t),controller=new AbortController();let backendSignal,intercepted=false;
 const b=backend();b.tokenize=async r=>{backendSignal=r.signal;return {tokenIds:[1],truncated:false};};
 const original=fs.default.link;
 fs.default.link=async(source,destination)=>{
  if(destination.endsWith('/encoding.json')){intercepted=true;controller.abort();await new Promise(r=>setTimeout(r,550));assert.equal(backendSignal.aborted,false,'backend cancellation is detached during durable commit');}
  return original(source,destination);
 };
 syncBuiltinESMExports();
 try{await acquireKnowledgeVectors({...a,backend:b,timeoutMs:500,signal:controller.signal});assert.equal(intercepted,true);assert.equal(controller.signal.aborted,true);assert.equal((await inspectKnowledgeAcquisition(a)).status,'succeeded');}
 finally{fs.default.link=original;syncBuiltinESMExports();}
});
test('abort before commit writes no typed receipt and cannot recover success',async t=>{
 const a=await setup(t),controller=new AbortController(),b=backend();
 b.encodeQuery=async r=>{controller.abort();return {vector:[1,0],truncated:false,tokenIdsSha256:r.tokenIdsSha256};};
 await assert.rejects(acquireKnowledgeVectors({...a,backend:b,signal:controller.signal}),{code:'EMBEDDING_ACQUISITION_INCOMPLETE'});
 assert.notEqual((await inspectKnowledgeAcquisition(a)).status,'succeeded');await assert.rejects(readFile(join(a.projectDir,'knowledge-acquisitions','typed','encoding.json')),{code:'ENOENT'});
});
test('local backend weight identity is captured in immutable plan',async t=>{const a=await setup(t),b=backend();b.identity={model:'local-test',manifestSha256:'b'.repeat(64)};await acquireKnowledgeVectors({...a,backend:b});const plan=JSON.parse(await readFile(join(a.projectDir,'knowledge-acquisitions','typed','plan.json')));assert.deepEqual(plan.encoding.backendIdentity,b.identity);b.identity.manifestSha256='c'.repeat(64);assert.equal((await inspectKnowledgeAcquisition(a)).status,'succeeded');});
