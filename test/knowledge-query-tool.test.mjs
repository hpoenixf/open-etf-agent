import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openSession} from '../src/session.mjs';
import {sha256} from '../src/source.mjs';
import {createDynamicKnowledgeTool} from '../src/knowledge-query-tool.mjs';
const catalog={schemaVersion:'document-catalog@1',id:'dynamic-test',documents:[{id:'cash',name:'Cash',version:'1',pages:['Cash reserves cover redemptions.']}]};
const vectors={schemaVersion:'knowledge-vector-evidence@1',provider:{id:'local-sentence-transformers',model:'synthetic-local',revision:'a'.repeat(64)},dimensions:2,pages:[{sourceId:'cash@1:p1',sha256:sha256(catalog.documents[0].pages[0]),vector:[1,0]}],queries:[{querySha256:sha256('seed-not-queried'),vector:[1,0]}]};
async function setup(t){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/knowledge-query-tool-'));t.after(()=>rm(directory,{recursive:true,force:true}));const store=await openSession({directory,profile:'local-knowledge-query@1',clock:()=>100});t.after(()=>store.close());let claim,backendCreates=0;const stages=[];
 const options={sourceManifestSha256:'d'.repeat(64),catalog,allowedDocuments:['cash'],config:{algorithm:'hybrid',maxResults:1},vectorEvidence:vectors,queryConfig:{modelManifestSha256:'a'.repeat(64),maxTokens:8,maxQueries:2},store,runId:'test',getClaim:()=>({runId:'test',owner:claim.owner,fence:claim.fence}),backendFactory:()=>{backendCreates++;return {identity:{model:'synthetic-local',manifestSha256:'a'.repeat(64)},maxTokens:8,tokenize:async()=>{stages.push('tokenize');return{tokenIds:[1],truncated:false};},encodeDocument:()=>assert.fail('cached pages re-encoded'),encodeQuery:async r=>{stages.push('encode');return{vector:[1,0],tokenIdsSha256:r.tokenIdsSha256,truncated:false};}};}};
 const made=createDynamicKnowledgeTool(options);const run=store.create({runId:'test',directory,definition:{question:'Find arbitrary evidence',grantId:'test-grant',bindings:{gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'test',version:'1'},plugins:[],adapters:[made.binding]},limits:{maxRounds:8,maxTools:8,timeoutMs:10000},rootLimits:{model:8,tool:8},deadlineAt:10000,config:{allowedTools:['knowledge_query'],allowedDocuments:['cash'],documentCatalog:made.catalogBinding,knowledgeQueryEffects:made.profile}},snapshot:{schemaVersion:'runtime-checkpoint@1',phase:'ready'}});claim=store.claim(run.runId,'writer');return {store,claim,options,made,stages,creates:()=>backendCreates};
}
const call={id:'q',name:'knowledge_query',arguments:{query:'liquidity',limit:1}};
function dispatch(a){a.claim.reserve('tool',{schemaVersion:'runtime-checkpoint@1',phase:'tool-dispatched',proposal:{kind:'calls',calls:[call]},cursor:0,inFlight:{callId:call.id,name:call.name,effective:call}});}
test('new arbitrary query encodes only the query, commits before returning sources, then verifies without backend',async t=>{
 const a=await setup(t);assert.doesNotMatch(a.made.tool.description,/missing exact query embeddings fall back/);await a.made.tool.validate(call.arguments);dispatch(a);const value=await a.made.tool.execute(call.arguments,{callId:call.id});
 assert.deepEqual(a.stages,['tokenize','encode']);assert.equal(value.sources[0].text,catalog.documents[0].pages[0]);assert.equal(a.store.knowledgeQueryEffect('test','q').status,'completed');
 const cold=createDynamicKnowledgeTool({...a.options,backendFactory:()=>assert.fail('verification started backend')});const hosted={...value,sources:value.sources.map(s=>({...s,resultRef:'result:sha256:'+'d'.repeat(64)}))};
 await cold.tool.verifyResult(hosted,{call});assert.deepEqual(await cold.tool.reconcile(call.arguments,{callId:call.id}),value);assert.equal(a.creates(),1);
 const changed=structuredClone(hosted);changed.sources[0].text='different';await assert.rejects(cold.tool.verifyResult(changed,{call}),{code:'KNOWLEDGE_RESULT_MISMATCH'});
 await assert.rejects(a.made.tool.execute(call.arguments,{callId:call.id}),{code:'KNOWLEDGE_QUERY_OUTCOME_UNKNOWN'});assert.deepEqual(a.stages,['tokenize','encode']);
});
test('crash after atomic dispatch but before backend execution stays unknown and never creates a backend on reconcile',async t=>{
 const a=await setup(t);dispatch(a);const recovered=createDynamicKnowledgeTool({...a.options,backendFactory:()=>assert.fail('unknown recovery started backend')});assert.equal(await recovered.tool.reconcile(call.arguments,{callId:call.id}),null);assert.equal(a.creates(),0);assert.equal(a.store.knowledgeQueryBudget('test').reservedQueries,1);
});
test('another Run token cannot execute a reserved query effect',async t=>{
 const a=await setup(t);dispatch(a);const foreign=createDynamicKnowledgeTool({...a.options,getClaim:()=>({runId:'other',owner:a.claim.owner,fence:a.claim.fence})});
 await assert.rejects(foreign.tool.execute(call.arguments,{callId:call.id}),{code:'KNOWLEDGE_QUERY_SCOPE'});assert.deepEqual(a.stages,[]);
});
