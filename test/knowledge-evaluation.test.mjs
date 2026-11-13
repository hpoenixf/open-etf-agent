import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../src/source.mjs';
import {evaluateKnowledgeRetrieval} from '../src/knowledge-evaluation.mjs';
const catalog={schemaVersion:'document-catalog@1',id:'evaluation',documents:[{id:'a',name:'A',version:'1',pages:['cash reserves']}]};
const vectorEvidence={schemaVersion:'knowledge-vector-evidence@1',provider:{id:'synthetic',model:'hand-authored',revision:'1'},dimensions:1,pages:[{sourceId:'a@1:p1',sha256:sha256('cash reserves'),vector:[1]}],queries:[{querySha256:sha256('liquidity'),vector:[1]}]};
const evaluation=()=>({schemaVersion:'knowledge-retrieval-evaluation@1',provenance:'synthetic',k:1,cases:[{query:'liquidity',relevantSourceIds:['a@1:p1']},{query:'cash',relevantSourceIds:['a@1:p1']}]});
const run=e=>evaluateKnowledgeRetrieval({catalog,allowedDocuments:['a'],vectorEvidence,evaluation:e});
test('same-corpus metrics expose vector coverage and cannot certify synthetic semantic quality',()=>{
 const r=run(evaluation());assert.equal(r.qualification,'not-certified');assert.equal(r.metrics.lexical.recallAtK,0.5);assert.equal(r.metrics.bm25.mrrAtK,0.5);assert.equal(r.metrics.hybrid.recallAtK,1);assert.equal(r.metrics.hybrid.mrrAtK,1);assert.equal(r.vectorCoveredQueries,1);assert.equal(r.totalQueries,2);assert.equal(r.cases[1].profiles.hybrid.vectorAvailable,false);assert.match(r.boundary,/not semantic quality acceptance/);
 const ext=evaluation();ext.provenance='externally-supplied';const x=run(ext);assert.equal(x.qualification,'not-certified');assert.notEqual(x.evaluationSha256,r.evaluationSha256);
 assert.deepEqual(run(evaluation()),r);
});
test('labels cannot cite outside grants, duplicate queries or silently skip sparse cases',()=>{
 for(const mutate of [e=>e.cases[0].relevantSourceIds=['outside'],e=>e.cases.push(e.cases[0]),e=>delete e.cases[0],e=>e.cases[0].relevantSourceIds=[,],e=>e.k=9,e=>e.provenance='certified',e=>e.cases[0].query='']){const e=evaluation();mutate(e);assert.throws(()=>run(e),{code:'KNOWLEDGE_EVALUATION_INPUT'});}
 assert.throws(()=>evaluateKnowledgeRetrieval({catalog,allowedDocuments:['a'],vectorEvidence,evaluation:evaluation(),signal:AbortSignal.abort()}),{code:'KNOWLEDGE_CANCELLED'});
});
test('multi-label recall and rank-two reciprocal rank retain fractional precision',()=>{
 const texts=['foo other','foo foo','none word'];const c={schemaVersion:'document-catalog@1',id:'fractional',documents:texts.map((text,i)=>({id:'d'+i,name:'D'+i,version:'1',pages:[text]}))};
 const v={...vectorEvidence,pages:texts.map((text,i)=>({sourceId:`d${i}@1:p1`,sha256:sha256(text),vector:[1]}))};
 const r=evaluateKnowledgeRetrieval({catalog:c,allowedDocuments:['d0','d1','d2'],vectorEvidence:v,evaluation:{schemaVersion:'knowledge-retrieval-evaluation@1',provenance:'synthetic',k:2,cases:[{query:'foo',relevantSourceIds:['d0@1:p1','d2@1:p1']}]}});
 for(const profile of ['lexical','bm25','hybrid']){assert.deepEqual(r.cases[0].profiles[profile].sourceIds,['d1@1:p1','d0@1:p1']);assert.equal(r.metrics[profile].recallAtK,0.5);assert.equal(r.metrics[profile].mrrAtK,0.5);}
});
