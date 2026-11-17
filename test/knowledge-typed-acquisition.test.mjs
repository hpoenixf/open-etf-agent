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
test('typed noncooperative tokenizer times out unknown; late work cannot encode or publish',async t=>{const a=await setup(t);let finish,calls=0;const b=backend();b.tokenize=()=>new Promise(r=>{finish=r;});b.encodeDocument=async()=>{calls++;};await assert.rejects(acquireKnowledgeVectors({...a,timeoutMs:30,backend:b}),{code:'EMBEDDING_ACQUISITION_INCOMPLETE'});assert.equal((await inspectKnowledgeAcquisition(a)).status,'unknown');finish({tokenIds:[1],truncated:false});await new Promise(r=>setTimeout(r,20));assert.equal(calls,0);await assert.rejects(readFile(join(a.projectDir,'knowledge-acquisitions','typed','encoding.json')),{code:'ENOENT'});});
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
