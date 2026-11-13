import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeIndex,queryKnowledge,createKnowledgeTool,verifyKnowledgeResult} from '../src/knowledge.mjs';
const catalog={schemaVersion:'document-catalog@1',id:'scoped',documents:[
 {id:'preferred',name:'Selected fund',version:'1',pages:['fund liquidity']},
 {id:'second',name:'Other fund',version:'1',pages:['fund liquidity redemption']},
 {id:'hidden',name:'Not admitted',version:'1',pages:['fund liquidity liquidity liquidity']}
]};
const index=()=>createKnowledgeIndex({catalog,allowedDocuments:['preferred','second'],config:{algorithm:'bm25'}});
test('BM25 query scope narrows admitted originals and no-match never widens only',()=>{
 const i=index();const r=queryKnowledge(i,{query:'liquidity',documentIds:['preferred']});
 assert.deepEqual(r.sources.map(s=>s.documentId),['preferred']);assert.equal(r.selection.mode,'only');assert.equal(r.selection.widening,'only');assert.equal(r.coverage.documents,1);assert.equal(r.coverage.pages,1);
 assert.equal(r.coverage.scope,'admitted-document-subset');assert.equal(r.coverage.completeWithinCollection,false);assert.equal(r.coverage.completeWithinQueryScope,true);
 const changed=structuredClone(catalog);changed.documents[1].pages=['liquidity '.repeat(1000)];
 const alternate=createKnowledgeIndex({catalog:changed,allowedDocuments:['preferred','second'],config:{algorithm:'bm25'}});
 assert.deepEqual(queryKnowledge(alternate,{query:'liquidity',documentIds:['preferred']}).hits,r.hits);
 const none=queryKnowledge(i,{query:'redemption',documentIds:['preferred']});assert.equal(none.status,'no-evidence');assert.deepEqual(none.sources,[]);
});
test('prefer widens explicitly only for insufficient preferred matches and retains preferred order',()=>{
 const i=index();const args={query:'liquidity',documentIds:['preferred'],documentMode:'prefer'};
 const r=queryKnowledge(i,args);assert.deepEqual(r.sources.map(s=>s.documentId),['preferred','second']);assert.equal(r.selection.widening,'expanded');assert.equal(r.selection.preferredMatched,1);
 const narrow=queryKnowledge(i,{...args,limit:1});assert.equal(narrow.selection.widening,'not-needed');assert.deepEqual(narrow.sources.map(s=>s.documentId),['preferred']);
 const fallback=queryKnowledge(i,{...args,query:'redemption'});assert.equal(fallback.selection.widening,'expanded');assert.deepEqual(fallback.sources.map(s=>s.documentId),['second']);
 const all=queryKnowledge(i,{...args,query:'redemption',documentIds:['preferred','second']});assert.equal(all.selection.widening,'not-needed');
});
test('query selection cannot broaden grants and is bound to recovery verification',()=>{
 const i=index();for(const args of [{documentIds:['hidden']},{documentIds:['unknown']},{documentIds:[]},{documentIds:['preferred','preferred']},{documentMode:'prefer'},{documentIds:['preferred'],documentMode:'global'}])assert.throws(()=>queryKnowledge(i,{query:'fund',...args}),{code:'KNOWLEDGE_QUERY'});
 const old=createKnowledgeIndex({catalog,allowedDocuments:['preferred']});assert.throws(()=>queryKnowledge(old,{query:'fund',documentIds:['preferred']}),{code:'KNOWLEDGE_QUERY'});
 const tool=createKnowledgeTool(i),call={name:'knowledge_query',arguments:{query:'fund',documentIds:['preferred']}};
 const r=queryKnowledge(i,call.arguments);verifyKnowledgeResult(tool,call,r);
 const corrupt=structuredClone(r);corrupt.selection.requested=['second'];assert.throws(()=>verifyKnowledgeResult(tool,call,corrupt),{code:'KNOWLEDGE_RESULT_MISMATCH'});
 assert.deepEqual(tool.parameters.properties.documentIds.items.enum,['preferred','second']);
 assert.throws(()=>tool.validate({query:'fund',documentIds:['hidden']}),{code:'KNOWLEDGE_QUERY'});
});
