import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openSession} from '../src/session.mjs';
import {sha256} from '../src/source.mjs';
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const config={schemaVersion:'local-knowledge-query@1',model:'synthetic-local',manifestSha256:'a'.repeat(64),catalogSha256:'b'.repeat(64),sourceManifestSha256:'d'.repeat(64),pageEvidenceSha256:'c'.repeat(64),dimensions:2,maxTokens:8,maxQueries:1};
const call={id:'q1',name:'knowledge_query',arguments:{query:'liquidity',limit:1}};
const cp=(phase='ready',extra={})=>({schemaVersion:'runtime-checkpoint@1',phase,...extra});
const def=()=>({question:'Synthetic query',grantId:'test-grant',bindings:{gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'synthetic',version:'1'},plugins:[],adapters:[{id:'knowledge-query-effect',version:'local-knowledge-query@1',contentSha256:sha256(canonical(config))}]},limits:{maxRounds:8,maxTools:8,timeoutMs:10000},rootLimits:{model:8,tool:8},deadlineAt:10000,config:{documentCatalog:{schemaVersion:'document-catalog@1',id:'query-test',sha256:config.catalogSha256},allowedTools:['knowledge_query'],allowedDocuments:['cash'],knowledgeQueryEffects:config}});
async function setup(t){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/knowledge-session-'));t.after(()=>rm(directory,{recursive:true,force:true}));let time=100;const store=await openSession({directory,clock:()=>time,leaseMs:100,profile:'local-knowledge-query@1'});t.after(()=>store.close());const run=store.create({directory,definition:def(),snapshot:cp()});const claim=store.claim(run.runId,'first');return{store,directory,run,claim,tick:()=>{time+=101;}};}
function dispatch(a,c=call){a.claim.reserve('tool',cp('tool-dispatched',{proposal:{kind:'calls',calls:[c]},cursor:0,inFlight:{original:c,effective:c}}));}
const encoded=()=>({kind:'query',id:sha256(call.arguments.query),inputSha256:sha256(JSON.stringify({kind:'query',id:sha256(call.arguments.query),text:call.arguments.query})),tokenIdsSha256:sha256('[1]'),tokenCount:1,vector:[1,0]});
test('Session reserves local query work once, commits typed receipt and cold reads without a writer',async t=>{
 const a=await setup(t);assert.equal(a.store.schemaVersion,7);dispatch(a);const claim=a.store.knowledgeQueryEffect(a.run.runId,call.id);
 assert.equal(claim.status,'reserved');assert.deepEqual(a.store.knowledgeQueryBudget(a.run.runId),{maxQueries:1,reservedQueries:1,reservedPhysicalOperations:2,dispatchedPhysicalOperations:0,completedQueries:0,unsettledQueries:1});
 assert.throws(()=>dispatch(a),{code:'KNOWLEDGE_QUERY_ALREADY_CLAIMED'});
 a.claim.dispatchKnowledgeQuery(call.id,'tokenize');a.claim.dispatchKnowledgeQuery(call.id,'encode');
 const completed=a.claim.completeKnowledgeQuery(call.id,encoded());assert.equal(completed.status,'completed');
 assert.deepEqual(a.store.knowledgeQueryEffect(a.run.runId,call.id),completed);
 a.claim.release();a.store.close();const cold=await openSession({directory:a.directory,readOnly:true});t.after(()=>cold.close());assert.deepEqual(cold.knowledgeQueryEffect(a.run.runId,call.id),completed);
 assert.equal(cold.knowledgeQueryBudget(a.run.runId).dispatchedPhysicalOperations,2);
});
test('dynamic profile requires explicit Session admission and excludes Child or downgraded roots',async t=>{
 const a=await setup(t);const legacyDir=await mkdtemp(resolve('test-output/knowledge-legacy-'));t.after(()=>rm(legacyDir,{recursive:true,force:true}));const legacy=await openSession({directory:legacyDir,clock:()=>100});t.after(()=>legacy.close());
 assert.throws(()=>legacy.create({directory:legacyDir,definition:def(),snapshot:cp()}),{code:'KNOWLEDGE_QUERY_SCOPE'});
 assert.throws(()=>a.store.create({directory:a.directory,parentRunId:a.run.runId,parentClaim:{owner:a.claim.owner,fence:a.claim.fence},definition:def(),snapshot:cp()}),{code:'KNOWLEDGE_QUERY_SCOPE'});
 for(const type of ['plugins','adapters']){const bad=def();bad.bindings[type].push(type==='plugins'?{id:'extra',version:'1',schemaVersion:'trusted-plugin@1',contentSha256:'f'.repeat(64)}:{id:'extra',version:'1'});assert.throws(()=>a.store.create({directory:a.directory,definition:bad,snapshot:cp()}),{code:'KNOWLEDGE_QUERY_SCOPE'});}
});
test('dispatch ownership, stage order, root exhaustion and unknown reservations cannot be bypassed by a new call',async t=>{
 const a=await setup(t);assert.throws(()=>a.claim.dispatchKnowledgeQuery(call.id,'tokenize'),{code:'KNOWLEDGE_QUERY_DISPATCH_REQUIRED'});dispatch(a);
 assert.throws(()=>a.claim.dispatchKnowledgeQuery(call.id,'encode'),{code:'KNOWLEDGE_QUERY_STAGE'});
 a.claim.dispatchKnowledgeQuery(call.id,'tokenize');assert.throws(()=>a.claim.dispatchKnowledgeQuery(call.id,'tokenize'),{code:'KNOWLEDGE_QUERY_STAGE'});
 a.tick();const next=a.store.claim(a.run.runId,'next');assert.throws(()=>a.claim.dispatchKnowledgeQuery(call.id,'encode'),{code:'STALE_WRITER'});
 assert.throws(()=>next.dispatchKnowledgeQuery(call.id,'encode'),{code:'KNOWLEDGE_QUERY_OUTCOME_UNKNOWN'});
 assert.equal(a.store.knowledgeQueryEffect(a.run.runId,call.id).status,'reserved');
 const other={...call,id:'q2'};assert.throws(()=>next.reserve('tool',cp('tool-dispatched',{messages:[{role:'assistant',calls:[call]}],proposal:{kind:'calls',calls:[other]},cursor:0,inFlight:{original:other,effective:other}})),{code:'KNOWLEDGE_QUERY_BUDGET_EXHAUSTED'});assert.equal(next.read().rootUsage.tool,1);assert.equal(a.store.knowledgeQueryBudget(a.run.runId).reservedQueries,1);
});
test('a fabricated dispatch checkpoint without the original tool reservation cannot reserve encoding',async t=>{
 const a=await setup(t);a.claim.checkpoint(cp('tool-dispatched',{proposal:{kind:'calls',calls:[call]},cursor:0,inFlight:{effective:call}}));
 assert.throws(()=>a.claim.dispatchKnowledgeQuery(call.id,'tokenize'),{code:'KNOWLEDGE_QUERY_DISPATCH_REQUIRED'});
});
test('cancellation fences late encoding completion and retains the original reservation',async t=>{
 const a=await setup(t);dispatch(a);a.claim.dispatchKnowledgeQuery(call.id,'tokenize');a.claim.dispatchKnowledgeQuery(call.id,'encode');a.store.cancel(a.run.runId);
 assert.throws(()=>a.claim.completeKnowledgeQuery(call.id,encoded()),{code:'RUN_CANCELLED'});assert.equal(a.store.knowledgeQueryBudget(a.run.runId).reservedQueries,1);assert.equal(a.store.knowledgeQueryEffect(a.run.runId,call.id).status,'reserved');
});
test('deleted effect rows are detected against the original atomic usage counter on reopen',async t=>{
 const a=await setup(t);dispatch(a);a.claim.release();a.store.close();
 const db=new DatabaseSync(join(a.directory,'session.sqlite'));db.exec('DELETE FROM knowledge_query_effects');db.close();
 await assert.rejects(openSession({directory:a.directory,readOnly:true}),{code:'KNOWLEDGE_QUERY_RECORD_CHANGED'});
});
test('corrupted query vectors are rejected before recovery can return source candidates',async t=>{
 const a=await setup(t);dispatch(a);a.claim.dispatchKnowledgeQuery(call.id,'tokenize');a.claim.dispatchKnowledgeQuery(call.id,'encode');a.claim.completeKnowledgeQuery(call.id,encoded());a.claim.release();a.store.close();
 const db=new DatabaseSync(join(a.directory,'session.sqlite'));const f=JSON.parse(db.prepare('SELECT fact FROM knowledge_query_effects').get().fact);f.encoded.vector=[0,1];db.prepare('UPDATE knowledge_query_effects SET fact=?').run(JSON.stringify(f));db.close();
 await assert.rejects(openSession({directory:a.directory,readOnly:true}),{code:'KNOWLEDGE_QUERY_RECORD_CHANGED'});
});
