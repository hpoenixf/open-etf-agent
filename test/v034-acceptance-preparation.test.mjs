import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkInputs,validateContract} from '../scripts/acceptance/check-v034-inputs.mjs';
import {validateResearchConfig,createResearchProject,submitResearchTask,inspectResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
const base='openspec/changes/v034-context-fitting';
async function inputs() {
 const c=JSON.parse(await readFile(join(base,'acceptance-inputs.json')));
 const source=await readFile(join(base,'acceptance-source.txt'));
 return {c,source};
}
function frozenRuntime(c) {
 const code={};
 for(const path of Object.keys(c.runtimeSha256)){
  code[path]=execFileSync('git',['show',`${c.candidateCommit}:${path}`],{env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1'}});
 }
 return code;
}
test('frozen A14 package attests the original Runtime and rejects a different checkout',async()=>{
 const {c,source}=await inputs(),code=frozenRuntime(c);
 const r=validateContract(c,source,code);
 assert.equal(r.tasks,10);assert.equal(r.dispatchAuthorized,false);assert.equal(r.realAcceptance,'not-started');assert.equal(r.priorUnknownRequests,2);
 const matches=await Promise.all(Object.entries(code).map(async ([path,bytes])=>(await readFile(path)).equals(bytes)));
 if(matches.every(Boolean))assert.deepEqual(await checkInputs(),r);
 else await assert.rejects(checkInputs(),{message:'A14_INPUT_CONTRACT_INVALID'});
});
test('reject altered source, missing/duplicate tasks, traversal, schema, hashes, grants and profile',async()=>{const {c,source}=await inputs(),code=frozenRuntime(c);assert.throws(()=>validateContract(c,source,{...code,'src/runtime.mjs':Buffer.from('different Runtime')}));assert.throws(()=>validateContract(c,Buffer.concat([source,Buffer.from('x')]),code));for(const change of [x=>x.tasks.pop(),x=>x.tasks[1].id=x.tasks[0].id,x=>x.sourceFile='../secret',x=>x.schemaVersion='other',x=>x.sourceSha256='0'.repeat(64),x=>x.dispatchAuthorized=true,x=>x.profile.allowedTools.push('fetch'),x=>x.extra=true,x=>x.requiredSuccesses=8,x=>x.tasks[0].expectedOutcome='failed']){const x=structuredClone(c);change(x);assert.throws(()=>validateContract(x,source,code));}});
test('all ten fixed inputs submit through original project APIs without work or provider',async()=>{const {c,source}=await inputs();await mkdir('test-output',{recursive:true});for(const t of c.tasks){const dir=await mkdtemp(resolve('test-output/a14-prep-'));const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'offline-test',protocol:'fixture@1',model:'a14-preparation'},...c.profile,...(t.contextWorkingSetBytes===null?{}:{contextWorkingSetBytes:t.contextWorkingSetBytes})};validateResearchConfig(config);await createResearchProject({directory:dir,config});const path=join(dir,'source.txt');await writeFile(path,source);const imported=await importProjectSources({projectDir:dir,files:[path]});await submitResearchTask({projectDir:dir,runId:t.id,question:t.question,sourceManifestSha256:imported.manifestSha256,reportDelivery:'artifact-required@1'});const saved=await inspectResearchTask({projectDir:dir,runId:t.id});assert.equal(saved.run.runId,t.id);assert.equal(saved.definition.question,t.question);assert.equal(saved.run.rootUsage.model,0);}});
