import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,readCatalogPage} from '../src/source.mjs';
import {createKnowledgeIndex,queryKnowledge,createKnowledgeTool,verifyKnowledgeResult} from '../src/knowledge.mjs';
const catalog={schemaVersion:'document-catalog@1',id:'vectors',documents:[{id:'a',name:'A',version:'1',pages:['cash reserves']},{id:'b',name:'B',version:'1',pages:['liquidity ratio']}]};
const evidence=()=>({schemaVersion:'knowledge-vector-evidence@1',provider:{id:'synthetic',model:'hand-authored-test-vectors',revision:'1'},dimensions:2,pages:catalog.documents.map((d,i)=>{const s=readCatalogPage(catalog,{documentId:d.id,page:1});return{sourceId:s.sourceId,sha256:s.sha256,vector:i?[0,1]:[1,0]};}),queries:[{querySha256:sha256('liquidity'),vector:[1,0]}]});
const build=vectorEvidence=>createKnowledgeIndex({catalog,allowedDocuments:['a','b'],config:{algorithm:'hybrid'},vectorEvidence});
test('frozen vector cosine channel and BM25 fuse actual candidates with bounded RRF scores',()=>{
 const i=build(evidence()),r=queryKnowledge(i,{query:'liquidity'});
 assert.equal(r.ranking.algorithm,'rrf');assert.deepEqual(r.sources.map(s=>s.documentId),['a','b']);assert.equal(r.hits[0].score,1/61);assert.equal(r.hits[1].score,1/61);
 assert.equal(r.retrieval.channels.vector.status,'available');assert.equal(r.retrieval.channels.vector.matched,1);assert.equal(r.retrieval.channels.lexical.matched,1);
 assert.equal(r.sources[0].text,'cash reserves');assert.equal(r.retrieval.recovery,'frozen-provider-evidence');
 const scoped=queryKnowledge(i,{query:'liquidity',documentIds:['b']});assert.deepEqual(scoped.sources.map(s=>s.documentId),['b']);assert.equal(scoped.retrieval.channels.vector.matched,0);
 const none=queryKnowledge(i,{query:'missing'});assert.equal(none.status,'no-evidence');assert.equal(none.retrieval.channels.vector.reason,'query-not-in-snapshot');assert.equal(none.ranking.algorithm,'bm25');
});
test('snapshot copies inputs, binds identity, fails closed for corrupt provider/page/query vectors',()=>{
 const e=evidence(),i=build(e);e.pages[0].vector[0]=0;assert.equal(queryKnowledge(i,{query:'liquidity'}).sources[0].documentId,'a');
 for(const change of [e=>e.pages.pop(),e=>e.pages[0].sha256='0'.repeat(64),e=>e.pages[0].sourceId='outside',e=>e.pages[0].vector=[0,0],e=>e.pages[0].vector=[Infinity,1],e=>e.pages[0].vector=[1],e=>e.pages[0].vector=[1,,],e=>delete e.pages[0],e=>delete e.queries[0],e=>e.queries.push(e.queries[0]),e=>e.provider.secret='not allowed',e=>e.dimensions=1025]){const bad=evidence();change(bad);assert.throws(()=>build(bad),{code:'KNOWLEDGE_VECTOR_EVIDENCE'});}
 const altered=evidence();altered.provider.revision='2';assert.notEqual(build(altered).indexSha256,i.indexSha256);
 const tool=createKnowledgeTool(i),call={name:tool.name,arguments:{query:'liquidity'}};const r=queryKnowledge(i,call.arguments);verifyKnowledgeResult(tool,call,r);r.retrieval.provider.model='fake';assert.throws(()=>verifyKnowledgeResult(tool,call,r),{code:'KNOWLEDGE_RESULT_MISMATCH'});
 assert.throws(()=>queryKnowledge(i,call.arguments,{signal:AbortSignal.abort()}),{code:'KNOWLEDGE_CANCELLED'});
});
test('fusion rewards agreement, excludes nonpositive cosine, and prefer remains within grant',()=>{
 const e=evidence();e.pages[1].vector=[1,0];const i=build(e);
 const r=queryKnowledge(i,{query:'liquidity'});assert.deepEqual(r.sources.map(s=>s.documentId),['b','a']);assert.equal(r.hits[0].score,1/61+1/62);
 e.pages[1].vector=[-1,0];const negative=build(e);const scoped=queryKnowledge(negative,{query:'liquidity',documentIds:['b']});assert.equal(scoped.retrieval.channels.vector.matched,0);assert.equal(scoped.hits[0].score,1/61);
 const prefer=queryKnowledge(negative,{query:'liquidity',documentIds:['b'],documentMode:'prefer'});assert.equal(prefer.selection.widening,'expanded');assert.deepEqual(prefer.sources.map(s=>s.documentId),['b','a']);
 assert.throws(()=>createKnowledgeIndex({catalog,allowedDocuments:['a'],config:{algorithm:'hybrid'},vectorEvidence:e}),{code:'KNOWLEDGE_VECTOR_EVIDENCE'});
});

test('finite tiny and subnormal embeddings retain cosine matches without norm underflow',()=>{
 for(const tiny of [1e-200,Number.MIN_VALUE]){const e=evidence();e.pages[0].vector=[tiny,0];e.queries[0].vector=[tiny,0];const r=queryKnowledge(build(e),{query:'liquidity'});assert.equal(r.retrieval.channels.vector.matched,1);assert.equal(r.sources[0].documentId,'a');assert.ok(r.hits.every(h=>Number.isFinite(h.score)));}
});

test('existing 1024-dimensional embedding shape is accepted under the unchanged total byte bound',()=>{
 const e=evidence();e.dimensions=1024;for(const p of e.pages)p.vector=Array.from({length:1024},(_,i)=>i===0?1:0);e.queries[0].vector=[...e.pages[0].vector];const r=queryKnowledge(build(e),{query:'liquidity'});assert.equal(r.retrieval.channels.vector.matched,2);
});
