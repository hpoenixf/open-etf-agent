import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeIndex,queryKnowledge,createKnowledgeTool,verifyKnowledgeResult,BM25_KNOWLEDGE_VERSION} from '../src/knowledge.mjs';
const catalog={schemaVersion:'document-catalog@1',id:'health',documents:[{id:'fund',name:'Fund',version:'1',pages:['fund liquidity','fund risk']}]};
const build=config=>createKnowledgeIndex({catalog,allowedDocuments:['fund'],config});
test('channel execution health is distinct from relevance and bounded evidence coverage',()=>{
 const i=build({algorithm:'bm25'});
 for(const [query,status,matched] of [['unmatched','no-evidence',0],['liquidity','complete',1],['fund','partial',2]]){
  const r=queryKnowledge(i,{query,limit:1});assert.equal(r.status,status);
  assert.deepEqual(r.retrieval,{profile:'local-lexical-only',channels:{lexical:{status:'available',algorithm:'bm25',matched},vector:{status:'not-configured'}},reranker:{status:'not-configured'},recovery:'deterministic-original-query'});
 }
 assert.equal(queryKnowledge(build(),{query:'fund'}).retrieval,undefined);
 const tool=createKnowledgeTool(i);assert.match(tool.description,/not-configured is not a transient outage/);
});
test('diagnostics are recomputed from the original query on recovery and cancellation never fabricates availability',()=>{
 const i=build({algorithm:'bm25'}),tool=createKnowledgeTool(i),call={name:tool.name,arguments:{query:'fund'}};
 const value=queryKnowledge(i,call.arguments);verifyKnowledgeResult(tool,call,value);
 for(const mutate of [r=>r.retrieval.channels.vector.status='available',r=>r.retrieval.channels.lexical.matched=0,r=>delete r.retrieval]){
  const changed=structuredClone(value);mutate(changed);assert.throws(()=>verifyKnowledgeResult(tool,call,changed),{code:'KNOWLEDGE_RESULT_MISMATCH'});
 }
 assert.throws(()=>queryKnowledge(i,call.arguments,{signal:AbortSignal.abort()}),{code:'KNOWLEDGE_CANCELLED'});
 assert.equal(queryKnowledge(i,call.arguments).retrieval.channels.vector.status,'not-configured');
});

test('pre-health BM25 adapter retains persisted response and tool schema on upgrade',()=>{
 const old=createKnowledgeIndex({catalog,allowedDocuments:['fund'],config:{algorithm:'bm25'},version:BM25_KNOWLEDGE_VERSION});
 const tool=createKnowledgeTool(old),call={name:tool.name,arguments:{query:'fund'}};
 const original=queryKnowledge(old,call.arguments);assert.equal(original.retrieval,undefined);
 assert.doesNotMatch(tool.description,/Retrieval diagnostics/);verifyKnowledgeResult(tool,call,original);
 assert.notEqual(old.indexSha256,build({algorithm:'bm25'}).indexSha256);
});
