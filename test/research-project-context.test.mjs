import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResearchProject,inspectResearchProject,validateResearchConfig,updateResearchProject,submitResearchTask,inspectResearchTask,workResearchTask,readResearchReport} from '../src/research-project.mjs';
import {importProjectSources,loadProjectSources} from '../src/project-sources.mjs';
import {readTimeline} from '../src/observe.mjs';
const config=()=>({schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'context-contract'},capabilities:['report']});
async function setup(c=config(),input="Synthetic source."){await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/project-context-'));const project=await createResearchProject({directory:root,config:c});await writeFile(join(root,'input.txt'),input);const source=await importProjectSources({projectDir:root,files:[join(root,'input.txt')]});return{root,project,source,close:()=>rm(root,{recursive:true,force:true})};}
test('new project explicitly persists 1MiB context default',async()=>{const f=await setup();try{assert.equal(f.project.config.contextBytes,1048576);assert.equal(JSON.parse(await readFile(join(f.root,'project.json'))).config.contextBytes,1048576);assert.equal((await inspectResearchProject({projectDir:f.root})).configSha256,f.project.configSha256);}finally{await f.close();}});
test('validation accepts bounded bytes and rejects invalid context values without normalizing legacy absent field',()=>{for(const n of [1,32000,1048576])assert.equal(validateResearchConfig({...config(),contextBytes:n}).contextBytes,n);for(const n of [0,-1,1048577,1.5,NaN,Infinity,'1048576',null])assert.throws(()=>validateResearchConfig({...config(),contextBytes:n}),e=>e.code==='PROJECT_CONTEXT_BYTES');assert.equal(Object.hasOwn(validateResearchConfig(config()),'contextBytes'),false);assert.equal(Object.hasOwn(validateResearchConfig({...config(),capabilities:['report','knowledge']}),'contextBytes'),false);});
test('explicit CAS context revision affects new admissions only; omission retains legacy absence',async()=>{const f=await setup();try{await submitResearchTask({projectDir:f.root,runId:'before',question:'q',sourceManifestSha256:f.source.manifestSha256});const before=await readFile(join(f.root,'tasks/before.json'));const revised=await updateResearchProject({projectDir:f.root,config:{...config(),contextBytes:131072},expectedConfigSha256:f.project.configSha256});await submitResearchTask({projectDir:f.root,runId:'after',question:'q',sourceManifestSha256:f.source.manifestSha256});assert.deepEqual(await readFile(join(f.root,'tasks/before.json')),before);assert.equal((await inspectResearchTask({projectDir:f.root,runId:'before'})).definition.config.contextBytes,1048576);assert.equal((await inspectResearchTask({projectDir:f.root,runId:'after'})).definition.config.contextBytes,131072);const legacy=await updateResearchProject({projectDir:f.root,config:config(),expectedConfigSha256:revised.configSha256});assert.equal(Object.hasOwn(legacy.config,'contextBytes'),false);await submitResearchTask({projectDir:f.root,runId:'legacy-after',question:'q',sourceManifestSha256:f.source.manifestSha256});assert.equal(Object.hasOwn((await inspectResearchTask({projectDir:f.root,runId:'legacy-after'})).definition.config,'contextBytes'),false);for(const [runId,bytes]of [['before',1048576],['after',131072],['legacy-after',32000]]){const task=await inspectResearchTask({projectDir:f.root,runId});assert.equal(task.run.definition.config.contextBytes,bytes);assert.equal(task.run.rootUsage.model,0);}await assert.rejects(updateResearchProject({projectDir:f.root,config:{...config(),contextBytes:1},expectedConfigSha256:revised.configSha256}),e=>e.code==='PROJECT_CONFIG_CONFLICT');}finally{await f.close();}});
test('new context does not silently change independently configured compaction threshold',async()=>{const f=await setup({...config(),capabilities:['report','compaction']});try{assert.equal(f.project.config.contextBytes,1048576);assert.equal(f.project.config.compaction.thresholdBytes,16000);}finally{await f.close();}});
test('a tiny explicit context fails before gateway dispatch, not a token-window promise',async()=>{const f=await setup({...config(),contextBytes:1});let calls=0;try{await submitResearchTask({projectDir:f.root,runId:'tiny',question:'q',sourceManifestSha256:f.source.manifestSha256});const result=await workResearchTask({projectDir:f.root,runId:'tiny',gateway:{mode:'fixture',async next(){calls++;throw new Error('must not dispatch');}}});assert.equal(calls,0);assert.equal(result.run.rootUsage.model,0);assert.equal(result.run.definition.config.contextBytes,1);assert.equal(result.run.status,'failed');assert.equal(result.run.snapshot.code,'CONTEXT_CAPACITY_EXCEEDED');}finally{await f.close();}});
test('encoded policy is task-frozen and reaches real Gateway encoder through an injected transport',async()=>{
 const live={...config(),capabilities:['report','compaction'],gateway:{mode:'live',provider:'example',protocol:'chat-completions',model:'context-contract',endpoint:'https://example.invalid/v1/chat/completions',apiKeyEnv:'RESEARCH_TEST_KEY'},limits:{model:3},compaction:{pressureMode:'encoded-request@1',thresholdBytes:1}};
 const f=await setup(live,'Synthetic source. '.repeat(150));
 try{
  const authorization={providerApproved:true,dataApproved:true,costApproved:true};
  await submitResearchTask({projectDir:f.root,runId:'encoded',question:'Read the input and report.',sourceManifestSha256:f.source.manifestSha256,authorization});
  const before=await inspectResearchTask({projectDir:f.root,runId:'encoded'});
  const policy=before.run.definition.config.workingInput.compaction;
  assert.equal(policy.version,'gateway-history-compaction@3');
  assert.equal(policy.encodedMaxBytes,1048576);
  await updateResearchProject({projectDir:f.root,config:{...live,compaction:{thresholdBytes:16000}},expectedConfigSha256:f.project.configSha256});
  const {catalog}=await loadProjectSources({projectDir:f.root,manifestSha256:f.source.manifestSha256});
  let calls=0;
  const response=(message,finish_reason)=>new Response(JSON.stringify({choices:[{message:{role:'assistant',...message},finish_reason}]}),{headers:{'Content-Type':'application/json'}});
  const tool=(id,name,args)=>response({content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
  const done=await workResearchTask({projectDir:f.root,runId:'encoded',apiKey:'synthetic-not-a-secret',fetchImpl:async(_url,options,reservation)=>{
   assert.equal(reservation.role,'main');
   const request=JSON.parse(options.body);assert.equal(request.model,'context-contract');assert.ok(request.tools.length>0);
   calls++;
   if(calls===1)return tool('read','read_page',{documentId:catalog.documents[0].id,page:1});
   if(calls===2){const result=request.messages.find(message=>message.role==='tool');const content=JSON.parse(result.content);assert.match(result.content,/Synthetic source/);return tool('save','save_report',{text:'# Report\nSynthetic source.',sourceIds:[(content.value??content).sourceId]});}
   assert.equal(calls,3);return response({content:'Saved.'},'stop');
  }});
  assert.equal(done.run.status,'completed',JSON.stringify(done.run.snapshot));
  assert.equal(calls,3);
  assert.deepEqual(done.run.definition.config.workingInput.compaction,policy);
  const saved=await readResearchReport({projectDir:f.root,runId:'encoded'});assert.match(saved.report.text,/Synthetic source/);
  const timeline=await readTimeline(saved.directory);assert.ok(timeline.entries.some(e=>e.type==='working_note'&&e.status==='budget-exhausted'));
  const cold=await readResearchReport({projectDir:f.root,runId:'encoded'});assert.deepEqual(cold.report,saved.report);assert.equal(calls,3);
 }finally{await f.close();}
});
test('fixture-injected encoded meter cannot silently rewrite an already frozen Project policy',async()=>{
 const f=await setup({...config(),capabilities:['report','compaction'],compaction:{thresholdBytes:1,pressureMode:'encoded-request@1'}});
 try{
  await submitResearchTask({projectDir:f.root,runId:'fixture-meter',question:'q',sourceManifestSha256:f.source.manifestSha256});
  await assert.rejects(workResearchTask({projectDir:f.root,runId:'fixture-meter',gateway:{mode:'fixture',inputBudget:{maxBytes:64000,measure:()=>0},next(){throw Error('must not dispatch');}}}),{code:'PROJECT_FIXTURE_COMPACTION_METER_UNBOUND'});
  assert.equal((await inspectResearchTask({projectDir:f.root,runId:'fixture-meter'})).run.rootUsage.model,0);
 }finally{await f.close();}
});
