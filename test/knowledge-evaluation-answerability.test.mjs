import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../src/source.mjs';
import {evaluateKnowledgeRetrieval} from '../src/knowledge-evaluation.mjs';
const text='Management charge is 0.15 percent. Subscription charge is not specified.';
const catalog={schemaVersion:'document-catalog@1',id:'answerability',documents:[{id:'fees',name:'Fees',version:'1',pages:[text]}]};
const vectorEvidence={schemaVersion:'knowledge-vector-evidence@1',provider:{id:'synthetic',model:'test',revision:'1'},dimensions:1,pages:[{sourceId:'fees@1:p1',sha256:sha256(text),vector:[1]}],queries:[{querySha256:sha256('cake'),vector:[1]}]};
const cases=()=>[
 {query:'Management charge',relevantSourceIds:['fees@1:p1'],answerability:'direct-answer'},
 {query:'Subscription charge',relevantSourceIds:['fees@1:p1'],answerability:'explicitly-unspecified'},
 {query:'cake',relevantSourceIds:[],answerability:'insufficient'}
];
const evaluate=evaluation=>evaluateKnowledgeRetrieval({catalog,allowedDocuments:['fees'],vectorEvidence,evaluation});
const run=c=>evaluate({schemaVersion:'knowledge-retrieval-evaluation@3',provenance:'synthetic',k:1,cases:c});
test('candidate retrieval, labelled support and final answer quality stay separate',()=>{
 const r=run(cases());assert.equal(r.schemaVersion,'knowledge-retrieval-evaluation-result@3');
 assert.equal(r.finalAnswerQuality,'not-evaluated');assert.equal(r.qualification,'not-certified');
 assert.deepEqual(r.answerabilityCounts,{'direct-answer':1,'explicitly-unspecified':1,insufficient:1});
 const n=r.cases[2].profiles.hybrid;assert.equal(n.candidateReturned,true);assert.equal(n.labelledSupportRetrieved,null);
 assert.equal(Object.hasOwn(n,'falsePositive'),false);assert.equal(Object.hasOwn(r.metrics.hybrid,'falsePositiveRate'),false);
 assert.equal(r.metrics.hybrid.candidateReturnRateOnInsufficient,1);
 assert.equal(r.cases[1].profiles.hybrid.labelledSupportRetrieved,true);
 assert.equal(r.metrics.lexical.labelledSupportHitRate,1);
 assert.deepEqual(run(cases()),r);
});
test('answerability is explicit supplied annotation with strict label consistency and identity',()=>{
 for(const mutate of [c=>delete c[0].answerability,c=>c[0].answerability='verified',c=>c[0].relevantSourceIds=[],c=>c[2].relevantSourceIds=['fees@1:p1'],c=>c[0].relevantSourceIds=['outside'],c=>c[0].relevantSourceIds=[,],c=>delete c[0]]){
  const c=cases();mutate(c);assert.throws(()=>run(c),{code:'KNOWLEDGE_EVALUATION_INPUT'});
 }
 const a=run(cases()),c=cases();c[1].answerability='direct-answer';assert.notEqual(a.evaluationSha256,run(c).evaluationSha256);
});
test('equivalent v3 property order preserves full output identity',()=>{
 const reordered={cases:cases().map(c=>({answerability:c.answerability,relevantSourceIds:c.relevantSourceIds,query:c.query})),k:1,provenance:'synthetic',schemaVersion:'knowledge-retrieval-evaluation@3'};
 assert.deepEqual(evaluate(reordered),run(cases()));
});
