import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeIndex,queryKnowledge,KNOWLEDGE_RESPONSE_BYTES} from '../src/knowledge.mjs';
import {sha256} from '../src/source.mjs';
const queryAcquisition={schemaVersion:'local-knowledge-query@1',requestSha256:'a'.repeat(64),receiptSha256:'b'.repeat(64),reservedPhysicalOperations:2,dispatchedPhysicalOperations:2};
const size=value=>{const hosted={...value,sources:value.sources.map(s=>({...s,resultRef:'result:sha256:'+'0'.repeat(64)}))};return Math.max(Buffer.byteLength(JSON.stringify(hosted)),Buffer.byteLength(JSON.stringify(JSON.stringify(hosted))));};
function run(n,options){const docs=[64000,64000,n].map((n,i)=>({id:'d'+i,name:'D'+i,version:'1',pages:['"'.repeat(n)]})),catalog={schemaVersion:'document-catalog@1',id:'envelope',documents:docs};const vectors={schemaVersion:'knowledge-vector-evidence@1',provider:{id:'synthetic',model:'test',revision:'1'},dimensions:1,pages:docs.map(d=>({sourceId:d.id+'@1:p1',sha256:sha256(d.pages[0]),vector:[1]})),queries:[{querySha256:sha256('query'),vector:[1]}]};return queryKnowledge(createKnowledgeIndex({catalog,allowedDocuments:docs.map(d=>d.id),config:{algorithm:'hybrid',maxResults:3,maxSourceBytes:512000},vectorEvidence:vectors}),{query:'query',limit:3},options);}
test('dynamic receipt metadata is included before whole-page response and double-encoding byte admission',()=>{
 let low=1,high=64000;while(low<high){const mid=Math.ceil((low+high)/2),r=run(mid);if(r.sources.length===3&&size(r)<=KNOWLEDGE_RESPONSE_BYTES)low=mid;else high=mid-1;}
 const old=run(low);assert.equal(old.sources.length,3);assert.ok(KNOWLEDGE_RESPONSE_BYTES-size(old)<16);
 const dynamic=run(low,{queryAcquisition});assert.deepEqual(dynamic.queryAcquisition,queryAcquisition);assert.ok(size(dynamic)<=KNOWLEDGE_RESPONSE_BYTES);assert.equal(dynamic.sources.length,2);assert.equal(dynamic.coverage.encodingLimited,true);assert.ok(dynamic.sources.every(s=>s.text.length===64000));
});
