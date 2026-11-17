import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {openSession} from '../src/session.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {acquireKnowledgeVectors,inspectKnowledgeAcquisition} from '../src/knowledge-acquisition.mjs';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'atomic-gap',version:'1'},plugins:[],adapters:[]};
// Characterization of a missing integration contract, not a desired authority API.
for(const invalidate of ['takeover','cancel'])test(`standalone acquisition success is not Run authorization after ${invalidate}`,async t=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/query-atomic-gap-'));let now=100;
 const sessionDir=join(root,'session');await mkdir(sessionDir);const store=await openSession({directory:sessionDir,clock:()=>now,leaseMs:100});t.after(()=>{store.close();return rm(root,{recursive:true,force:true});});
 const definition={question:'Atomicity characterization.',grantId:'synthetic-grant',bindings,limits:{maxRounds:4,maxTools:4,timeoutMs:10000},rootLimits:{model:4,tool:4},deadlineAt:10000,config:{}};
 const call={id:'query-1',name:'future_dynamic_query',arguments:{query:'cash'}},state={schemaVersion:'runtime-checkpoint@1',phase:'tool-dispatched',inFlight:{callId:call.id,name:call.name,effective:call}};
 const created=store.create({directory:sessionDir,definition,snapshot:{schemaVersion:'runtime-checkpoint@1',phase:'ready'}}),old=store.claim(created.runId,'old');old.reserve('tool',state);
 const source=join(root,'source.md');await writeFile(source,'Synthetic cash.');const projectDir=join(root,'project'),{manifestSha256}=await importProjectSources({projectDir,files:[source]});
 let ready,release;const started=new Promise(r=>{ready=r;}),gate=new Promise(r=>{release=r;});let first=true;
 const backend={maxTokens:8,tokenize:async()=>{if(first){first=false;ready();await gate;}return{tokenIds:[1],truncated:false};},encodeDocument:async r=>({vector:[1,0],tokenIdsSha256:r.tokenIdsSha256,truncated:false}),encodeQuery:async r=>({vector:[1,0],tokenIdsSha256:r.tokenIdsSha256,truncated:false})};
 // No Session-to-acquisition fence bridge exists. Do not invent one in this test.
 const task={projectDir,manifestSha256,acquisitionId:'independent',provider:{id:'synthetic',model:'test',revision:'1'},dimensions:2,queries:['cash'],backend,approveSelectedText:true};
 const pending=acquireKnowledgeVectors(task);await started;let current;
 if(invalidate==='takeover'){now=201;current=store.claim(created.runId,'new');}else store.cancel(created.runId);
 release();await pending;assert.equal((await inspectKnowledgeAcquisition(task)).status,'succeeded');
 assert.throws(()=>old.checkpoint({...state,phase:'result-committed'}),e=>['STALE_WRITER','RUN_CANCELLED'].includes(e.code));
 const saved=store.inspect(created.runId);assert.equal(saved.rootUsage.tool,1);assert.notEqual(saved.snapshot.phase,'result-committed');
 if(current)current.release();
});
