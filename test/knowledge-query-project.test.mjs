import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResearchProject,updateResearchProject,submitResearchTask,workResearchTask,inspectResearchKnowledge,inspectResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {acquireKnowledgeVectors} from '../src/knowledge-acquisition.mjs';
import {pageVectorIdentity} from '../src/knowledge-query-tool.mjs';
import {parseResearchArguments} from '../src/research-cli.mjs';
const identity={model:'synthetic-local',manifestSha256:'a'.repeat(64)};
async function setup(t){await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/dynamic-project-'));t.after(()=>rm(root,{recursive:true,force:true}));const projectDir=join(root,'project');const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'test'},capabilities:['report','knowledge'],knowledge:{algorithm:'hybrid'}};const project=await createResearchProject({directory:projectDir,config});const file=join(root,'cash.txt');await writeFile(file,'Cash and overnight deposits cover redemptions.');const sources=await importProjectSources({projectDir,files:[file]});let encodes=0;const backend={identity,maxTokens:8,tokenize:async()=>({tokenIds:[1],truncated:false}),encodeDocument:async r=>({vector:[1,0],truncated:false,tokenIdsSha256:r.tokenIdsSha256}),encodeQuery:async r=>{encodes++;return{vector:[1,0],truncated:false,tokenIdsSha256:r.tokenIdsSha256};}};const prepared=await acquireKnowledgeVectors({projectDir,manifestSha256:sources.manifestSha256,acquisitionId:'pages',provider:{id:'local-sentence-transformers',model:identity.model,revision:identity.manifestSha256},dimensions:2,queries:['seed-not-the-business-query'],backend,approveSelectedText:true});const queryConfig={schemaVersion:'local-knowledge-query@1',sourceManifestSha256:sources.manifestSha256,modelManifestSha256:identity.manifestSha256,pageEvidenceSha256:pageVectorIdentity(prepared.vectorEvidence),maxTokens:8,maxQueries:2};await updateResearchProject({projectDir,expectedConfigSha256:project.configSha256,config:{...config,knowledgeQuery:queryConfig}});return{projectDir,config,project,queryConfig,backend,vectorEvidence:prepared.vectorEvidence,sourceManifestSha256:sources.manifestSha256,encodes:()=>encodes};}
const query='liquidity';
test('new dynamic tasks freeze returned-evidence guidance and preserve it on duplicate admission and cold work',async t=>{
 const a=await setup(t),options={projectDir:a.projectDir,runId:'scope',question:'Find liquidity evidence',sourceManifestSha256:a.sourceManifestSha256,knowledgeVectorEvidence:a.vectorEvidence};
 await submitResearchTask(options);const before=await inspectResearchTask(options);
 assert.equal(before.definition.reportGuidance,'source-faithful-local-query@1');
 assert.match(before.run.definition.question,/Returned pages are not the entire admitted collection/);
 assert.match(before.run.definition.question,/partial.*absence/i);
 assert.match(before.run.definition.question,/report body and final answer/);
 assert.ok(before.run.definition.question.endsWith(options.question));
 await submitResearchTask(options);assert.deepEqual((await inspectResearchTask(options)).definition,before.definition);
 const done=await workResearchTask({...options,embeddingBackend:a.backend,gateway:{mode:'fixture',async next({messages}){
  assert.ok(messages.some(m=>typeof m.content==='string'&&m.content.includes('Returned pages are not the entire admitted collection')));
  return {kind:'final',text:'The task has not acquired evidence to answer the question.'};
 }}});assert.equal(done.run.status,'completed');
 assert.equal((await inspectResearchTask(options)).run.definition.question,before.run.definition.question);
});
test('Project admits a new dynamic task, uses original Runtime and cold-reads a query never prepared before admission',async t=>{
 const a=await setup(t);const options={projectDir:a.projectDir,runId:'dynamic',question:'Find liquidity evidence',sourceManifestSha256:a.sourceManifestSha256,knowledgeVectorEvidence:a.vectorEvidence};await submitResearchTask(options);const before=a.encodes();
 const gateway={mode:'fixture',async next({messages}){const results=messages.filter(m=>m.role==='tool').map(m=>m.result);const evidence=results.find(r=>r.value?.kind==='knowledge-evidence')?.value;if(!evidence)return{kind:'calls',calls:[{id:'q',name:'knowledge_query',arguments:{query}}]};if(!results.some(r=>r.value?.path==='report.md'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'Cash covers redemptions [1].',sourceIds:evidence.sources.map(s=>s.sourceId)}}]};return{kind:'final',text:'Saved.'};}};
 const done=await workResearchTask({...options,gateway,embeddingBackend:a.backend});assert.equal(done.run.status,'completed');assert.equal(a.encodes(),before+1);
 const inspection=await inspectResearchKnowledge(options);assert.equal(inspection.binding.id,'knowledge-query-effect');assert.equal(inspection.dynamicQueries.budget.reservedQueries,1);assert.equal(inspection.dynamicQueries.budget.dispatchedPhysicalOperations,2);
 await workResearchTask({...options,gateway:{mode:'fixture',next:()=>assert.fail('terminal read called model')},embeddingBackend:{...a.backend,tokenize:()=>assert.fail('terminal read encoded')}});assert.equal(a.encodes(),before+1);
});
test('CLI selects an explicit local embedding runtime only for work',()=>{
 assert.equal(parseResearchArguments(['run','work','--project','/project','--run','query','--embedding-runtime','/runtime.json']).options['embedding-runtime'],'/runtime.json');
 assert.throws(()=>parseResearchArguments(['run','inspect','--project','/project','--run','query','--embedding-runtime','/runtime.json']),{code:'CLI_UNKNOWN_OPTION'});
});
test('new profile rejects capabilities and source/vector rebinding before dispatch',async t=>{
 const a=await setup(t);const bad={...a.vectorEvidence,pages:a.vectorEvidence.pages.map(p=>({...p,vector:[0,1]}))};
 await assert.rejects(submitResearchTask({projectDir:a.projectDir,runId:'changed',question:'Query',sourceManifestSha256:a.sourceManifestSha256,knowledgeVectorEvidence:bad}),{code:'PROJECT_KNOWLEDGE_QUERY_BINDING'});
 const project=await createResearchProject({directory:join(a.projectDir,'other'),config:a.config});
 await assert.rejects(updateResearchProject({projectDir:join(a.projectDir,'other'),expectedConfigSha256:project.configSha256,config:{...a.config,capabilities:['report','knowledge','child'],knowledgeQuery:a.queryConfig}}),{code:'PROJECT_KNOWLEDGE_QUERY_SCOPE'});
});
