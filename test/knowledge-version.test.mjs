import test from 'node:test';
import assert from 'node:assert/strict';
import {createKnowledgeIndex,queryKnowledge,knowledgeBinding,createKnowledgeTool,verifyKnowledgeResult,KNOWLEDGE_VERSION,LEGACY_KNOWLEDGE_VERSION} from '../src/knowledge.mjs';
const catalog={schemaVersion:'document-catalog@1',id:'versions',documents:[{id:'noise',name:'noise',version:'1',pages:['S S S P P P']},{id:'fund',name:'fund',version:'1',pages:['S&P 500 fund']}]};
const index=version=>createKnowledgeIndex({catalog,allowedDocuments:['noise','fund'],version});
test('legacy Knowledge keeps original rank, identity and result verifier while default is v2',()=>{
 const old=index(LEGACY_KNOWLEDGE_VERSION),current=index(KNOWLEDGE_VERSION),query={query:'S&P',limit:1};
 assert.equal(queryKnowledge(old,query).hits[0].documentId,'noise');
 assert.equal(queryKnowledge(current,query).hits[0].documentId,'fund');
 assert.equal(queryKnowledge(old,query).version,LEGACY_KNOWLEDGE_VERSION);
 assert.equal(knowledgeBinding(old).version,LEGACY_KNOWLEDGE_VERSION);
 assert.notEqual(old.indexSha256,current.indexSha256);
 assert.deepEqual(knowledgeBinding(index(LEGACY_KNOWLEDGE_VERSION)),knowledgeBinding(old));
 const tool=createKnowledgeTool(old),call={name:'knowledge_query',arguments:query};
 verifyKnowledgeResult(tool,call,queryKnowledge(old,query));
 assert.throws(()=>verifyKnowledgeResult(tool,call,queryKnowledge(current,query)),{code:'KNOWLEDGE_RESULT_MISMATCH'});
 assert.equal(index(undefined).version,KNOWLEDGE_VERSION);
 assert.throws(()=>index('admitted-lexical-pages@999'),{code:'KNOWLEDGE_VERSION'});
});

import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResearchProject,submitResearchTask,inspectResearchKnowledge,inspectResearchTask,workResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {createHash} from 'node:crypto';
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
test('new project tasks freeze v2; resubmit preserves bytes and unsupported versions dispatch nothing',async()=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/knowledge-version-'));
 await createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'versions'},capabilities:['report','knowledge']}});
 const path=join(root,'source.md');await writeFile(path,'S&P 500 fund.');const sources=await importProjectSources({projectDir:root,files:[path]});
 const input={projectDir:root,runId:'version',question:'Find evidence.',sourceManifestSha256:sources.manifestSha256};
 await submitResearchTask(input);const file=join(root,'tasks/version.json'),before=await readFile(file,'utf8');
 assert.equal((await inspectResearchTask(input)).definition.knowledgeVersion,KNOWLEDGE_VERSION);
 assert.equal((await inspectResearchKnowledge(input)).binding.version,KNOWLEDGE_VERSION);
 await submitResearchTask(input);assert.equal(await readFile(file,'utf8'),before);
 for(const version of ['admitted-lexical-pages@999',null]){const record=JSON.parse(before);record.definition.knowledgeVersion=version;record.definitionSha256=createHash('sha256').update(canonical(record.definition)).digest('hex');await writeFile(file,JSON.stringify(record));let calls=0;await assert.rejects(workResearchTask({...input,gateway:{mode:'fixture',next(){calls++;throw Error('dispatch');}}}),{code:'PROJECT_KNOWLEDGE_VERSION'});assert.equal(calls,0);await assert.rejects(inspectResearchKnowledge(input),{code:'PROJECT_KNOWLEDGE_VERSION'});}
 await writeFile(file,before);
});
