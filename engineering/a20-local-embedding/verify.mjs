// Explicit real-model integration diagnostic. No default test-suite or fake backend.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,lstat,realpath} from 'node:fs/promises';
import {resolve,join,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha256} from '../../src/source.mjs';
import {importProjectSources} from '../../src/project-sources.mjs';
import {createLocalEmbeddingBackend} from '../../src/local-embedding-process.mjs';
import {encodeTypedInputs} from '../../src/embedding-protocol.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){assert.ok(['--python','--model-dir','--model-manifest','--output'].includes(args[i])&&!options[args[i]]&&args[i+1]);options[args[i]]=args[i+1];}
assert.equal(Object.keys(options).length,4);
for(const path of Object.values(options))assert.ok(isAbsolute(path));
const root=options['--output'],python=options['--python'],modelDir=options['--model-dir'],manifestPath=options['--model-manifest'];
const manifestBytes=await readFile(manifestPath),model=JSON.parse(manifestBytes),modelSha=sha256(manifestBytes);
assert.equal(model.model,'intfloat/multilingual-e5-small');assert.equal(model.revision,'614241f622f53c4eeff9890bdc4f31cfecc418b3');assert.equal(model.dimensions,384);assert.equal(model.maxTokens,512);assert.deepEqual(model.prompts,{document:'passage: ',query:'query: '});
const corpusBytes=await readFile(join(repo,'engineering/a20-local-embedding/cohort.json')),cohort=JSON.parse(corpusBytes),review=JSON.parse(await readFile(join(repo,'engineering/a20-local-embedding/label-review.json')));
assert.equal(review.verdict,'pass');assert.equal(review.cohortSha256,sha256(corpusBytes));
await mkdir(root,{mode:0o700});assert.equal(await realpath(root),root);
const save=async(name,value)=>writeFile(join(root,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
const cli=(name,command)=>{const p=spawnSync(process.execPath,[join(repo,'scripts/prepared-knowledge.mjs'),...command],{cwd:repo,encoding:'utf8',timeout:180000,maxBuffer:4*1024**2});assert.equal(p.status,0,`${name}: ${p.error?.message??p.stderr}`);return JSON.parse(p.stdout);};
const projectDir=join(root,'project');await mkdir(join(root,'sources'));const files=[];
for(const d of cohort.documents){const p=join(root,'sources',d.id+'.txt');await writeFile(p,d.text,{flag:'wx'});files.push(p);}
const {manifestSha256,catalog}=await importProjectSources({projectDir,files});
const ids=Object.fromEntries(cohort.documents.map(d=>{const found=catalog.documents.find(x=>x.pages[0]===d.text);assert.ok(found);return[d.id,`${found.id}@${found.version}:p1`];}));
const labels={schemaVersion:'knowledge-retrieval-evaluation@2',provenance:'externally-supplied',k:4,cases:cohort.cases.map(c=>({query:c.query,relevantSourceIds:c.relevantDocuments.map(d=>ids[d])}))};
await save('labels.json',labels);await save('queries.json',cohort.cases.map(c=>c.query));
// Freeze labels and identities before any embeddings or ranking observation.
await save('binding.json',{manifestSha256,sourceIds:ids,cohortSha256:sha256(corpusBytes),labelsSha256:sha256(await readFile(join(root,'labels.json'))),modelSha});
const backend=()=>createLocalEmbeddingBackend({command:python,args:[join(repo,'scripts/local-embedding-worker.py'),'--model-dir',modelDir,'--manifest',manifestPath,'--manifest-sha256',modelSha],identity:{model:model.model,manifestSha256:modelSha},maxTokens:512,timeoutMs:120000});
const probeInputs=[{kind:'document',id:'same',text:'Cash covers redemptions.'},{kind:'query',id:'same',text:'Cash covers redemptions.'},{kind:'document',id:'zh',text:'本产品不做外汇对冲。'},{kind:'query',id:'zh',text:'本产品不做外汇对冲。'}];
const b=backend();let encoded;
try{encoded=await encodeTypedInputs({inputs:probeInputs,dimensions:384,backend:b});}finally{b.close();}
assert.notDeepEqual(encoded[0].vector,encoded[1].vector);await save('probe-inputs.json',probeInputs);
const ref=spawnSync(python,[join(repo,'engineering/a20-local-embedding/reference.py'),'--model-dir',modelDir,'--inputs',join(root,'probe-inputs.json'),'--output',join(root,'reference.json')],{cwd:repo,encoding:'utf8',timeout:120000,maxBuffer:2*1024**2,env:{PATH:'/usr/bin:/bin',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false'}});
assert.equal(ref.status,0,ref.stderr);const reference=JSON.parse(await readFile(join(root,'reference.json')));
const maxDifferences=encoded.map((r,i)=>{assert.equal(r.tokenIdsSha256,sha256(JSON.stringify(reference.rows[i].tokenIds)));assert.equal(r.tokenCount,reference.rows[i].tokenIds.length);const delta=Math.max(...r.vector.map((v,j)=>Math.abs(v-reference.rows[i].vector[j])));assert.ok(delta<=1e-5,`independent reference delta ${delta}`);return delta;});
const overflow=backend();let overflowCode;
try{await overflow.tokenize({kind:'document',text:'hello '.repeat(600),truncation:false});assert.fail('overflow was silently accepted');}catch(e){assert.ok(e.code?.startsWith('EMBEDDING_PROCESS_'));overflowCode=e.code;}finally{overflow.close();}
const prepare=(acquisition,queries,extra=[])=>cli(acquisition,['prepare','--project',projectDir,'--manifest',manifestSha256,'--acquisition',acquisition,'--model-dir',modelDir,'--model-manifest',manifestPath,'--model-sha',modelSha,'--python',python,'--queries',queries,'--approve-selected-text','--timeout-ms','120000',...extra]);
await save('preparation.json',prepare('reviewed-cohort',join(root,'queries.json')));
await save('reuse-queries.json',['liquidity buffer']);await save('reuse-preparation.json',prepare('query-only',join(root,'reuse-queries.json'),['--reuse','reviewed-cohort']));
const acquisitionDir=join(projectDir,'knowledge-acquisitions');
const original=JSON.parse(await readFile(join(acquisitionDir,'reviewed-cohort/evidence.json'))),reused=JSON.parse(await readFile(join(acquisitionDir,'query-only/evidence.json'))),reuseEncoding=JSON.parse(await readFile(join(acquisitionDir,'query-only/encoding.json')));
assert.deepEqual(original.pages,reused.pages);assert.equal(reuseEncoding.results.length,1);assert.equal(reuseEncoding.results[0].kind,'query');
const snapshot=async()=>{const rows=[];async function walk(dir){for(const n of (await readdir(dir)).sort()){const p=join(dir,n),stat=await lstat(p);assert.ok(!stat.isSymbolicLink());if(stat.isDirectory())await walk(p);else rows.push([p.slice(projectDir.length),sha256(await readFile(p))]);}}await walk(projectDir);return sha256(JSON.stringify(rows));};
const before=await snapshot(),inspection=cli('cold inspect',['inspect','--project',projectDir,'--acquisition','reviewed-cohort']);assert.equal(inspection.status,'succeeded');await save('cold-inspection.json',inspection);
const evaluate=()=>cli('cold evaluate',['evaluate','--project',projectDir,'--manifest',manifestSha256,'--acquisition','reviewed-cohort','--labels',join(root,'labels.json')]);
const evaluation=evaluate();assert.deepEqual(evaluate(),evaluation);await save('evaluation.json',evaluation);
const cold=await import('../../scripts/prepared-knowledge.mjs');
const noBackend={backendFactory:()=>assert.fail('cold readback started a backend'),write:()=>{}};
assert.deepEqual(await cold.main(['evaluate','--project',projectDir,'--manifest',manifestSha256,'--acquisition','reviewed-cohort','--labels',join(root,'labels.json')],noBackend),evaluation);
await writeFile(join(root,'query.txt'),cohort.cases[0].query,{flag:'wx'});
const query=cli('cold query',['query','--project',projectDir,'--manifest',manifestSha256,'--acquisition','reviewed-cohort','--query',join(root,'query.txt')]);assert.equal(query.result.retrieval.channels.vector.status,'available');for(const s of query.result.sources)assert.ok(cohort.documents.some(d=>d.text===s.text));await save('cold-query.json',query);
await writeFile(join(root,'fallback.txt'),'unprepared withdrawals',{flag:'wx'});
const fallback=await cold.main(['query','--project',projectDir,'--manifest',manifestSha256,'--acquisition','reviewed-cohort','--query',join(root,'fallback.txt')],noBackend);assert.equal(fallback.result.retrieval.channels.vector.reason,'query-not-in-snapshot');assert.equal(fallback.result.ranking.algorithm,'bm25');await save('fallback.json',fallback);
const exported=cli('cold export',['export','--project',projectDir,'--acquisition','reviewed-cohort','--output',join(root,'exported-vectors.json')]);assert.deepEqual(JSON.parse(await readFile(join(root,'exported-vectors.json'))),original);assert.equal(await snapshot(),before);
await save('receipt.json',{schemaVersion:'a20-real-local-diagnostic@1',status:'passed-runtime-diagnostic',qualification:'not-certified',modelSha,manifestSha256,cohortSha256:sha256(corpusBytes),probeTokenCounts:encoded.map(r=>r.tokenCount),referenceMaxAbsDifferences:maxDifferences,overflow:{tokenCount:reference.overflowTokenCount,error:overflowCode},pageVectors:original.pages.length,queryVectors:original.queries.length,queryOnlyReuse:{documentVectorsUnchanged:true,encodedQueries:1},coldReadback:{separateNodeProcesses:true,backendFactoryForbidden:true,projectBytesUnchanged:true,exportMatches:true},evaluationSha256:sha256(await readFile(join(root,'evaluation.json'))),exported,billableRequests:0,newBillableUnknowns:0,boundary:'Real CPU weights and tokenizer; small authored relevance diagnostic, not a chat/Run release cohort or dynamic-query qualification.'});
console.log(JSON.stringify({status:'passed-runtime-diagnostic',output:root,metrics:evaluation.result.metrics,vectorCoveredQueries:evaluation.result.vectorCoveredQueries,totalQueries:evaluation.result.totalQueries}));
