import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,inspectResearchKnowledge,readResearchReport,updateResearchProject,inspectResearchProject} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {createKnowledgeIndex, queryKnowledge, createKnowledgeTool, verifyKnowledgeResult, BM25_KNOWLEDGE_VERSION, BM25_HEALTH_KNOWLEDGE_VERSION, KNOWLEDGE_VERSION} from '../src/knowledge.mjs';

const catalog = {schemaVersion:'document-catalog@1',id:'rank',documents:[
  {id:'spam',name:'Long repeated term',version:'1',pages:['fund '.repeat(200)+'unrelated '.repeat(400)]},
  {id:'precise',name:'Specific answer',version:'1',pages:['fund liquidity redemption window']},
  {id:'other',name:'Unrelated',version:'1',pages:['fund portfolio holdings']}
]};
const build = (options={}) => createKnowledgeIndex({catalog,allowedDocuments:catalog.documents.map(d=>d.id),version:BM25_KNOWLEDGE_VERSION,...options});
test('BM25 weights rare terms and document length rather than repetition alone',()=>{
  const current=build(), query={query:'fund liquidity',limit:1};
  assert.equal(queryKnowledge(current,query).hits[0].documentId,'precise');
  assert.equal(queryKnowledge(build({version:KNOWLEDGE_VERSION}),query).hits[0].documentId,'spam');
  assert.equal(queryKnowledge(current,query).ranking.algorithm,'bm25');
  assert.deepEqual(queryKnowledge(current,query),queryKnowledge(build(),query));
});
test('BM25 statistics use only admitted pages and preserve original source identity',()=>{
  const allowed=['precise','other'], a=build({allowedDocuments:allowed});
  const changed=structuredClone(catalog);changed.documents[0].pages=['liquidity '.repeat(1000)];
  const b=build({catalog:changed,allowedDocuments:allowed});
  assert.deepEqual(queryKnowledge(a,{query:'liquidity'}).hits,queryKnowledge(b,{query:'liquidity'}).hits);
  const result=queryKnowledge(a,{query:'liquidity'});
  assert.equal(result.sources[0].text,catalog.documents[1].pages[0]);
  const tool=createKnowledgeTool(a),call={name:'knowledge_query',arguments:{query:'liquidity'}};
  verifyKnowledgeResult(tool,call,result);
  const corrupt=structuredClone(result);corrupt.ranking.k1=9;
  assert.throws(()=>verifyKnowledgeResult(tool,call,corrupt),{code:'KNOWLEDGE_RESULT_MISMATCH'});
});
test('BM25 cancellation and empty matches keep the original failure/coverage contract',()=>{
  const i=build();assert.equal(queryKnowledge(i,{query:'unseenword'}).status,'no-evidence');
  const signal=AbortSignal.abort();assert.throws(()=>queryKnowledge(i,{query:'fund'},{signal}),{code:'KNOWLEDGE_CANCELLED'});
  assert.throws(()=>build({config:{algorithm:'unknown'}}),{code:'KNOWLEDGE_CONFIG'});
  assert.throws(()=>build({config:{algorithm:'bm25'},version:KNOWLEDGE_VERSION}),{code:'KNOWLEDGE_VERSION'});
  assert.throws(()=>build({version:null}),{code:'KNOWLEDGE_VERSION'});
  const equal={...catalog,documents:catalog.documents.map(d=>({...d,pages:['same same']}))};
  assert.deepEqual(queryKnowledge(build({catalog:equal}),{query:'same'}).hits.map(h=>h.documentId),['other','precise','spam']);
  const empty={...catalog,documents:catalog.documents.map(d=>({...d,pages:['---']}))};
  assert.equal(queryKnowledge(build({catalog:empty}),{query:'same'}).status,'no-evidence');
});
for(const mode of ['only','prefer'])test('opt-in BM25 '+mode+' reaches original project Host/report and survives config changes and terminal replay',async()=>{
  await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/bm25-project-'));
  const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'bm25'},capabilities:['report','knowledge'],knowledge:{algorithm:'bm25',maxResults:mode==='prefer'?2:1}};
  await createResearchProject({directory:root,config});
  const files=[];for(const doc of catalog.documents){const path=join(root,doc.id+'.md');await writeFile(path,doc.pages[0]);files.push(path);}
  const bundle=await importProjectSources({projectDir:root,files});
  const task={projectDir:root,runId:'bm25'};
  const preciseId=bundle.catalog.documents.find(d=>d.name==='precise.md').id;
  await submitResearchTask({...task,question:'Find liquidity evidence and cite it.',sourceManifestSha256:bundle.manifestSha256});
  const binding=await inspectResearchKnowledge(task);assert.equal(binding.binding.version,BM25_HEALTH_KNOWLEDGE_VERSION);
  const project=await inspectResearchProject({projectDir:root});await updateResearchProject({projectDir:root,expectedConfigSha256:project.configSha256,config:{...config,knowledge:{maxResults:1}}});
  assert.deepEqual(await inspectResearchKnowledge(task),binding);
  const outcome=await workResearchTask({...task,gateway:{mode:'fixture',async next({messages}){
    const results=messages.filter(m=>m.role==='tool').map(m=>m.result);
    const found=results.find(r=>r.value?.kind==='knowledge-evidence');
    if(!found)return{kind:'calls',calls:[{id:'query',name:'knowledge_query',arguments:{query:'fund liquidity',documentIds:[preciseId],documentMode:mode}}]};
    assert.equal(found.value.ranking.algorithm,'bm25');assert.equal(found.value.retrieval.channels.lexical.status,'available');assert.equal(found.value.retrieval.channels.vector.status,'not-configured');assert.equal(found.value.retrieval.recovery,'deterministic-original-query');assert.equal(found.value.selection.mode,mode);assert.equal(found.value.selection.widening,mode==='prefer'?'expanded':'only');assert.equal(found.value.sources[0].text,catalog.documents[1].pages[0]);assert.match(found.value.sources[0].resultRef,/^result:sha256:/);
    if(!results.some(r=>r.value?.path==='report.md'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'# Liquidity\nThe source mentions a redemption window [1].'+(mode==='prefer'?' Another fund source [2].':''),sourceIds:found.value.sources.map(s=>s.sourceId)}}]};
    return{kind:'final',text:'Saved.'};
  }}});
  assert.equal(outcome.run.status,'completed');
  assert.equal((await readResearchReport(task)).revision.sources[0].text,catalog.documents[1].pages[0]);
  let calls=0;const replay=await workResearchTask({...task,gateway:{mode:'fixture',next(){calls++;throw Error('unexpected dispatch');}}});assert.equal(replay.run.status,'completed');assert.equal(calls,0);
});
