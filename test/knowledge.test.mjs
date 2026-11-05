import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createKnowledgeIndex,queryKnowledge,knowledgeBinding,createKnowledgeTool,normalizeKnowledgeConfig} from '../src/knowledge.mjs';
import {createToolHost} from '../src/tools.mjs';
import {sha256} from '../src/source.mjs';
import {validateResearchConfig} from '../src/research-project.mjs';

const catalog = {schemaVersion:'document-catalog@1',id:'collection-a',documents:[
  {id:'a',name:'Product A',version:'1',pages:['Original A exports CSV. Offline editing is allowed.','中文资料支持离线编辑，导出需要联网。']},
  {id:'b',name:'Product B',version:'2',pages:['Original B exports CSV and Markdown. Exports require online access.']}
]};
const index = (extra={}) => createKnowledgeIndex({catalog,allowedDocuments:['a','b'],...extra});
test('Knowledge ranks actual admitted text and returns original page identities',()=>{
  const i=index(), result=queryKnowledge(i,{query:'Markdown'});
  assert.equal(result.status,'complete');assert.equal(result.sources.length,1);
  assert.equal(result.sources[0].sourceId,'b@2:p1');assert.equal(result.sources[0].text,catalog.documents[1].pages[0]);
  assert.equal(result.sources[0].sha256,sha256(result.sources[0].text));assert.equal(result.sources[0].resultRef,undefined);
  assert.equal(result.coverage.completeWithinCollection,true);
  assert.equal(queryKnowledge(i,{query:'离线编辑'}).sources[0].page,2);
  assert.equal(queryKnowledge(i,{query:'ＭＡＲＫＤＯＷＮ'}).sources[0].documentId,'b');
  assert.deepEqual(queryKnowledge(i,{query:'CSV'}),queryKnowledge(i,{query:'CSV'}));
  assert.deepEqual(queryKnowledge(i,{query:'CSV'}).sources.map(s=>s.documentId),['a','b']);
});
test('Knowledge has explicit no-evidence and bounded partial coverage without clipping sources',()=>{
  const i=index({config:{maxResults:1}}), r=queryKnowledge(i,{query:'CSV'});
  assert.equal(r.status,'partial');assert.equal(r.coverage.matched,2);assert.equal(r.coverage.returned,1);assert.equal(r.coverage.limitReached,true);
  const none=queryKnowledge(i,{query:'unmatchedunicorn'});assert.equal(none.status,'no-evidence');assert.deepEqual(none.sources,[]);assert.equal(none.coverage.completeWithinCollection,true);
  const large={schemaVersion:'document-catalog@1',id:'large',documents:[{id:'a',name:'A',version:'1',pages:['match '+ 'x'.repeat(63994),'match '+ 'y'.repeat(63994)]}]};
  const bounded=createKnowledgeIndex({catalog:large,allowedDocuments:['a'],config:{maxSourceBytes:64000}}), value=queryKnowledge(bounded,{query:'match'});
  assert.equal(value.status,'partial');assert.equal(value.coverage.byteLimited,true);assert.equal(value.sources[0].text.length,64000);assert.equal(value.sources[0].sha256,sha256(large.documents[0].pages[0]));
});
test('Knowledge grant filtering precedes ranking and cannot be widened by a query',()=>{
  const i=index({allowedDocuments:['a']});assert.deepEqual(queryKnowledge(i,{query:'Markdown'}).sources,[]);
  assert.throws(()=>queryKnowledge(i,{query:'Markdown',documents:['b']}),e=>e.code==='KNOWLEDGE_QUERY');
  assert.throws(()=>createKnowledgeIndex({catalog,allowedDocuments:['hidden']}),e=>e.code==='KNOWLEDGE_DOCUMENT_SCOPE');
  assert.throws(()=>createKnowledgeIndex({catalog,allowedDocuments:['a','a']}),e=>e.code==='KNOWLEDGE_DOCUMENT_SCOPE');
  assert.throws(()=>queryKnowledge({...i},{query:'CSV'}),e=>e.code==='KNOWLEDGE_INDEX_REQUIRED');
  assert.throws(()=>i.allowedDocuments.push('b'));assert.throws(()=>{i.catalog.sha256='a'.repeat(64);});
});
test('Knowledge refuses invalid inputs, unsupported limits and cancellation',()=>{
  const i=index();for(const args of [{query:''},{query:'a'.repeat(513)},{query:'中文'.repeat(100)},{query:'x',limit:0},{query:'x',limit:5},{query:'x',limit:1.2},{query:'x',path:'/hidden'},{query:'x\0y'}])assert.throws(()=>queryKnowledge(i,args),e=>e.code==='KNOWLEDGE_QUERY');
  for(const c of [{maxResults:0},{maxResults:9},{maxSourceBytes:63999},{maxSourceBytes:512001},{provider:'external'}])assert.throws(()=>normalizeKnowledgeConfig(c),e=>e.code==='KNOWLEDGE_CONFIG');
  const controller=new AbortController();controller.abort();assert.throws(()=>queryKnowledge(i,{query:'CSV'},{signal:controller.signal}),e=>e.code==='KNOWLEDGE_CANCELLED');
  assert.throws(()=>index({signal:controller.signal}),e=>e.code==='KNOWLEDGE_CANCELLED');
  assert.throws(()=>index({catalog:{...catalog,documents:[]}}),e=>e.code==='INVALID_DOCUMENT_CATALOG');
});
test('Knowledge project capability refuses unsupported Schedule composition before admission',()=>{
  const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'knowledge'},capabilities:['report','knowledge','schedule']};
  assert.throws(()=>validateResearchConfig(config),e=>e.code==='PROJECT_KNOWLEDGE_SCHEDULE_UNSUPPORTED');
  assert.throws(()=>validateResearchConfig({...config,capabilities:['report'],knowledge:{maxResults:2}}),e=>e.code==='PROJECT_KNOWLEDGE_NOT_ENABLED');
});
test('Knowledge index identity freezes catalog bytes, scope and limits',()=>{
  const i=index(), changed=structuredClone(catalog);changed.documents[0].pages[0]='Changed CSV.';
  assert.notEqual(index({catalog:changed}).indexSha256,i.indexSha256);assert.notEqual(index({allowedDocuments:['a']}).indexSha256,i.indexSha256);assert.notEqual(index({config:{maxResults:2}}).indexSha256,i.indexSha256);
  assert.deepEqual(knowledgeBinding(index()),knowledgeBinding(i));
  const copied=structuredClone(catalog), frozen=index({catalog:copied});copied.documents[0].pages[0]='Mutated';assert.equal(queryKnowledge(frozen,{query:'CSV'}).sources[0].text,catalog.documents[0].pages[0]);
});
test('Knowledge Host registers exact original ResultRefs and rejects tampered query recovery',async()=>{
  await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/knowledge-host-'));
  try{
    const selected=index(), options={directory,documentCatalog:catalog,allowedDocuments:['a','b'],extensions:[createKnowledgeTool(selected)],allowedTools:['knowledge_query','read_result','save_report'],enableNotes:true};
    const host=await createToolHost(options), call={id:'query-one',name:'knowledge_query',arguments:{query:'CSV'}};
    const result=await host.execute(call);assert.equal(result.status,'succeeded');assert.equal(result.value.sources.length,2);
    for(const source of result.value.sources){assert.match(source.resultRef,/^result:sha256:/);const read=await host.execute({id:'reread-'+source.documentId,name:'read_result',arguments:{resultRef:source.resultRef}});assert.deepEqual(read.value,source);}
    await host.verifyResult(call,result);
    const resumed=await createToolHost({...options,extensions:[createKnowledgeTool(index())],restore:host.snapshot()});await resumed.verifyResult(call,result);
    for(const mutate of [v=>{v.indexSha256='0'.repeat(64);},v=>{v.hits[0].score++;},v=>{v.coverage.matched++;},v=>{v.sources.pop();},v=>{v.sources[0].text+=' forged';},v=>{v.hits.reverse();}]){
      const bad=structuredClone(result);mutate(bad.value);await assert.rejects(resumed.verifyResult(call,bad));
    }
    await assert.rejects(resumed.verifyResult({...call,arguments:{query:'Markdown'}},result));
    const saved=await resumed.execute({id:'save',name:'save_report',arguments:{text:'# Original evidence\nBoth products export CSV [1][2].',sourceIds:result.value.sources.map(s=>s.sourceId)}});assert.equal(saved.status,'succeeded');
  }finally{await rm(directory,{recursive:true,force:true});}
});
