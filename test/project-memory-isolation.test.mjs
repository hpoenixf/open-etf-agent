import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdir,mkdtemp,readdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {applyProjectMemoryIntent,approveProjectMemoryIntent,createResearchProject,inspectResearchCapacity,inspectResearchTask,submitResearchTask,updateResearchProject,workResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';

const exec=promisify(execFile);
const syntheticPreference='USE_MEMORY_MARKER_FOR_SYNTHETIC_SUMMARY';
const question='Read the source and report its fee using the source as authoritative.';
const config={schemaVersion:'research-project@1',gateway:{mode:'live',provider:'synthetic-http',protocol:'chat-completions',model:'synthetic-gateway',endpoint:'https://example.invalid/v1/chat/completions',apiKeyEnv:'RESEARCH_TEST_KEY'},capabilities:['report','memory']};
const authorization={providerApproved:true,dataApproved:true,costApproved:true};
async function setup(t,overrides={}){
 await mkdir('test-output',{recursive:true});
 const directory=await mkdtemp(resolve('test-output/temporary-memory-'));
 t.after(()=>rm(directory,{force:true,recursive:true}));
 const projectDir=join(directory,'project');
 const project=await createResearchProject({directory:projectDir,config:{...config,...overrides}});
 const file=join(directory,'source.txt'),questionPath=join(directory,'question.txt');
 await writeFile(file,'Public synthetic fund source. Annual fee: 12 units.');
 await writeFile(questionPath,question);
 const {manifestSha256:sourceManifestSha256}=await importProjectSources({projectDir,files:[file]});
 const request={projectDir,question,sourceManifestSha256,authorization};
 return {project,projectDir,directory,questionPath,request};
}
async function processCli(...args){
 const {stdout}=await exec(process.execPath,['src/research-cli.mjs',...args]);
 return JSON.parse(stdout);
}
const toolCall=(id,name,args)=>Response.json({choices:[{finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]});
const final=()=>Response.json({choices:[{finish_reason:'stop',message:{role:'assistant',content:'Report saved.'}}]});
function script({temporary,consumed=0}){
 const requests=[];
 async function send(url,options){
  assert.equal(url.href,'https://example.invalid/v1/chat/completions');
  const payload=JSON.parse(options.body);
  const names=payload.tools.map(x=>x.function.name);
  requests.push(payload);
  const requestNumber=consumed+requests.length;
  const possibleMemory=names.filter(n=>n.startsWith('memory_'));
  assert.deepEqual(possibleMemory,temporary?[]:['memory_read','memory_search','memory_list']);
  const serialized=JSON.stringify(payload.messages);
  const values=payload.messages.filter(x=>x.role==='tool').map(x=>JSON.parse(x.content)).filter(x=>x.status==='succeeded').map(x=>x.value);
  if(temporary)assert.ok(!serialized.includes(syntheticPreference));
  if(!temporary&&requestNumber===1)return toolCall('recall','memory_search',{query:syntheticPreference});
  const offset=temporary?0:1;
  if(!temporary&&requestNumber===2)assert.equal(values.find(x=>x.kind==='memory-search-results')?.entries[0]?.text,syntheticPreference);
  if(requestNumber===1+offset){
   const doc=serialized.match(/text:[a-f0-9]{64}/)?.[0];
   assert.ok(doc,serialized);
   return toolCall('source','read_page',{documentId:doc,page:1});
  }
  if(requestNumber===2+offset){
   const source=values.find(x=>typeof x?.sourceId==='string');
   assert.ok(source,serialized);
   return toolCall('save','save_report',{text:'Annual fee: 12 units [1].',sourceIds:[source.sourceId]});
  }
  if(requestNumber===3+offset)return final();
  assert.fail('unexpected dispatch');
 }
 return {fetchImpl:send,requests};
}
function worker(f,runId,fetchImpl){return {projectDir:f.projectDir,runId,apiKey:'synthetic-not-a-secret',fetchImpl};}

test('ordinary temporary run freezes opt-out, sees no seeded preference, and delivers the same source-backed report after resume',async t=>{
 const f=await setup(t,{allowedTools:['read_page','memory_search','memory_list','memory_read','save_report']});
 await applyProjectMemoryIntent({projectDir:f.projectDir,operation:'save',text:syntheticPreference,intentId:'seed',explicit:true});
 const original=await readFile(join(f.projectDir,'memory','memory-index.json'));
 const normal=script({temporary:false}),isolated=script({temporary:true});
 await submitResearchTask({...f.request,runId:'normal'});
 const normalRun=(await workResearchTask(worker(f,'normal',normal.fetchImpl))).run;
 assert.equal(normalRun.status,'completed',normalRun.snapshot.code);
 assert.equal(normal.requests.length,4);
 const admitted=await processCli('run','submit','--project',f.projectDir,'--run','temporary','--question',f.questionPath,'--manifest',f.request.sourceManifestSha256,'--approve-provider','--approve-data','--approve-cost','--memory-mode','temporary');
 assert.equal(admitted.memoryMode,'temporary');
 const definition=(await inspectResearchTask({projectDir:f.projectDir,runId:'temporary'})).definition;
 assert.equal(definition.memoryMode,'temporary');
 assert.equal(definition.schemaVersion,'research-task@3');
 assert.equal(definition.memoryLibraryId,null);
 assert.deepEqual(definition.memoryIntents,[]);
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:'normal'})).definition.memoryMode,undefined);
 await assert.rejects(submitResearchTask({...f.request,runId:'temporary'}),{code:'PROJECT_TASK_ALREADY_DEFINED'});
 assert.deepEqual(await readFile(join(f.projectDir,'memory','memory-index.json')),original);
 // Preserve the original library but put a regular sentinel file in its place:
 // any Memory owner access would fail before reaching the ordinary Gateway.
 await rename(join(f.projectDir,'memory'),join(f.projectDir,'original-memory'));
 await writeFile(join(f.projectDir,'memory'),'not a usable library');
 const stop=new AbortController();
 const interrupted=await workResearchTask({...worker(f,'temporary',isolated.fetchImpl),hostSignal:stop.signal,onCheckpoint({phase}){if(phase==='result-consumed'&&isolated.requests.length===1)stop.abort();}});
 assert.equal(interrupted.workerStatus,'interrupted');
 assert.equal(isolated.requests.length,1);
 // Reopen in an actual fresh Node process; only the synthetic transport is
 // injected and historical page/result state must be rehydrated from disk.
 const restartCode=`
 import assert from 'node:assert/strict';
 import {workResearchTask} from './src/research-project.mjs';
 const syntheticPreference=${JSON.stringify(syntheticPreference)};
 const toolCall=${toolCall.toString()};
 const final=${final.toString()};
 const fixture=(${script.toString()})({temporary:true,consumed:1});
 const result=await workResearchTask({projectDir:process.argv[1],runId:'temporary',apiKey:'synthetic-not-a-secret',fetchImpl:fixture.fetchImpl});
 if(result.run.status!=='completed')throw new Error(result.run.snapshot.code);
 console.log(JSON.stringify({status:result.run.status,requests:fixture.requests.length}));
 `;
 const reopened=await exec(process.execPath,['--input-type=module','-e',restartCode,f.projectDir]);
 assert.deepEqual(JSON.parse(reopened.stdout),{status:'completed',requests:2});
 const output=await processCli('run','report','--project',f.projectDir,'--run','temporary');
 const normalOutput=await processCli('run','report','--project',f.projectDir,'--run','normal');
 assert.match(output.report.text,/Annual fee: 12 units/);
 assert.equal(output.report.text,normalOutput.report.text);
 assert.deepEqual(output.revision.sources.map(s=>s.sourceId),normalOutput.revision.sources.map(s=>s.sourceId));
 assert.equal((await workResearchTask(worker(f,'temporary',()=>assert.fail('terminal replay must not dispatch')))).run.status,'completed');
 assert.equal(await readFile(join(f.projectDir,'memory'),'utf8'),'not a usable library');
 assert.deepEqual(await readFile(join(f.projectDir,'original-memory','memory-index.json')),original);
});

test('temporary admission never creates a Memory owner, rejects write intents, and its resubmission cannot cross modes',async t=>{
 const f=await setup(t);
 const args={...f.request,runId:'temporary',memoryMode:'temporary'};
 const original=await readdir(f.projectDir);
 assert.ok(!original.includes('memory'));
 await assert.rejects(submitResearchTask({...args,memoryIntents:[{operation:'save'}]}),{code:'PROJECT_TEMPORARY_MEMORY_INTENTS'});
 await assert.rejects(submitResearchTask({...args,memoryMode:'invalid'}),{code:'PROJECT_MEMORY_MODE'});
 assert.ok(!(await readdir(f.projectDir)).includes('memory'));
 assert.deepEqual(await readdir(join(f.projectDir,'tasks')),[]);
 await submitResearchTask(args);
 await submitResearchTask(args);
 assert.ok(!(await readdir(f.projectDir)).includes('memory'));
 await assert.rejects(submitResearchTask({...f.request,runId:'temporary'}),{code:'PROJECT_TASK_ALREADY_DEFINED'});
 assert.ok(!(await readdir(f.projectDir)).includes('memory'));
 const current=await updateResearchProject({projectDir:f.projectDir,config:{...config,allowedTools:['read_page','save_report','memory_read']},expectedConfigSha256:f.project.configSha256});
 assert.notEqual(current.configSha256,f.project.configSha256);
 const isolated=script({temporary:true});
 const completed=(await workResearchTask(worker(f,'temporary',isolated.fetchImpl))).run;
 assert.equal(completed.status,'completed',completed.snapshot.code);
 assert.ok(!(await readdir(f.projectDir)).includes('memory'));
 const intent=await approveProjectMemoryIntent({projectDir:f.projectDir,operation:'save',text:syntheticPreference,intentId:'ordinary-intent',explicit:true});
 await assert.rejects(submitResearchTask({...f.request,runId:'another',memoryMode:'temporary',memoryIntents:[intent]}),{code:'PROJECT_TEMPORARY_MEMORY_INTENTS'});
 assert.ok(!(await readdir(join(f.projectDir,'tasks'))).includes('another.json'));
});

test('temporary selection filters only native Memory names and preserves validation of typos',async t=>{
 const f=await setup(t,{allowedTools:['read_page','save_report','memory_read','memory_typo']});
 await assert.rejects(submitResearchTask({...f.request,runId:'typo',memoryMode:'temporary'}),{code:'PROJECT_UNAVAILABLE_TOOL'});
 assert.ok(!(await readdir(f.projectDir)).includes('memory'));
});

test('temporary scope refuses unsupported composition rather than silently treating it as isolated',async t=>{
 for(const capabilities of [['report'],['report','memory','schedule'],['report','memory','child'],['report','memory','trusted-tools']]){
  const f=await setup(t,{capabilities});
  await assert.rejects(submitResearchTask({...f.request,runId:'excluded',memoryMode:'temporary'}),{code:'PROJECT_TEMPORARY_MEMORY_SCOPE'});
  assert.ok(!(await readdir(f.projectDir)).includes('memory'));
 }
});

test('cold re-admission after the task record was saved but before Session admission uses the frozen temporary config',async t=>{
 const f=await setup(t);
 const args={...f.request,runId:'partial-admission',memoryMode:'temporary',expectedConfigSha256:f.project.configSha256};
 await submitResearchTask(args);
 const taskPath=join(f.projectDir,'tasks','partial-admission.json');
 const oldTask=await readFile(taskPath);
 // Reproduce the durable end-state of a stop between recording the immutable
 // Project Task and admitting its original Session. This is fixture state only.
 await rm(join(f.projectDir,'sessions','partial-admission'),{force:true,recursive:true});
 const updated=await updateResearchProject({projectDir:f.projectDir,config:{...config,capabilities:['report']},expectedConfigSha256:f.project.configSha256});
 assert.notEqual(updated.configSha256,f.project.configSha256);
 await assert.rejects(submitResearchTask({...args,authorization:undefined}),{code:'PROJECT_LIVE_APPROVAL_REQUIRED'});
 await assert.rejects(submitResearchTask({...args,expectedConfigSha256:updated.configSha256}),{code:'PROJECT_CONFIG_CONFLICT'});
 const cli=await processCli('run','submit','--project',f.projectDir,'--run','partial-admission','--question',f.questionPath,'--manifest',f.request.sourceManifestSha256,'--approve-provider','--approve-data','--approve-cost','--memory-mode','temporary');
 assert.equal(cli.memoryMode,'temporary');
 assert.deepEqual(await readFile(taskPath),oldTask);
 assert.ok(!(await readdir(f.projectDir)).includes('memory'));
 const outcome=script({temporary:true});
 const result=(await workResearchTask(worker(f,'partial-admission',outcome.fetchImpl))).run;
 assert.equal(result.status,'completed',result.snapshot.code);
 assert.equal(outcome.requests.length,3);
 assert.match((await processCli('run','report','--project',f.projectDir,'--run','partial-admission')).report.text,/Annual fee: 12 units/);
});

function selectedScript({visible=null,absent=[]}={}){
 const requests=[];
 async function fetchImpl(url,options){
  assert.equal(url.href,'https://example.invalid/v1/chat/completions');
  const payload=JSON.parse(options.body),phase=requests.push(payload);
  assert.deepEqual(payload.tools.map(t=>t.function.name).filter(n=>n.startsWith('memory_')),['memory_read','memory_search','memory_list']);
  const serialized=JSON.stringify(payload.messages);
  for(const marker of absent)assert.ok(!serialized.includes(marker),`unexpected Memory text at request ${phase}`);
  const values=payload.messages.filter(x=>x.role==='tool').map(x=>JSON.parse(x.content)).filter(x=>x.status==='succeeded').map(x=>x.value);
  if(phase===1)return toolCall('selected-recall','memory_search',{query:'synthetic badge'});
  if(phase===2){
   const entries=values.find(x=>x.kind==='memory-search-results')?.entries;
   assert.deepEqual(entries?.map(e=>e.text),visible?[visible]:[]);
   const doc=serialized.match(/text:[a-f0-9]{64}/)?.[0];
   return toolCall('source','read_page',{documentId:doc,page:1});
  }
  if(phase===3)return toolCall('save','save_report',{text:'Annual fee: 12 units [1].',sourceIds:[values.find(x=>typeof x?.sourceId==='string').sourceId]});
  if(phase===4)return final();
  assert.fail('unexpected dispatch');
 }
 return {fetchImpl,requests};
}
const selectedText='synthetic badge SELECTED_R1';
const revisedText='synthetic badge SELECTED_R2';
const unselectedText='synthetic badge UNSELECTED';

async function seed(f,text,intentId){
 return applyProjectMemoryIntent({projectDir:f.projectDir,operation:'save',text,intentId,explicit:true});
}
async function change(f,receipt,operation,extra={}){
 return applyProjectMemoryIntent({projectDir:f.projectDir,operation,entryId:receipt.id,expectedRevision:receipt.revision,intentId:operation+'-'+receipt.revision,explicit:true,...extra});
}
async function inspectMemory(f,receipt){
 return processCli('memory','inspect','--project',f.projectDir,'--entry',receipt.id,'--status');
}
async function runSelection(f,runId,observed){
 const script=selectedScript(observed),result=(await workResearchTask(worker(f,runId,script.fetchImpl))).run;
 assert.equal(result.status,'completed',result.snapshot.code);
 assert.equal(script.requests.length,4);
 return processCli('run','memory','--project',f.projectDir,'--run',runId);
}

test('A26 one library supports consent, exact selected recall, revision, pin, pause, restore and irreversible forget across ordinary tasks',async t=>{
 const f=await setup(t);
 const seed1=await seed(f,selectedText,'selected');
 await seed(f,unselectedText,'other');
 const args={...f.request,memoryMode:'selected',memoryEntryIds:[seed1.id]};
 await submitResearchTask({...args,runId:'positive'});
 await submitResearchTask({...args,runId:'stale'});
 const verdict=await runSelection(f,'positive',{visible:selectedText,absent:[unselectedText]});
 assert.equal(verdict.selection.entries[0].revision,1);
 assert.deepEqual(verdict.observed,verdict.selection.entries.map(e=>({...e,libraryId:seed1.libraryId})));
 assert.doesNotMatch(JSON.stringify(verdict),/SELECTED_R1|UNSELECTED/);
 const evidence=await inspectResearchCapacity({projectDir:f.projectDir,runId:'positive'});
 assert.deepEqual(verdict.uses.map(u=>u.modelOrdinal),[2,3,4]);
 for(const use of verdict.uses){
  const ticket=evidence.requests[use.modelOrdinal-1];
  assert.equal(use.inputHash,ticket.inputHash);
  assert.equal(ticket.state,'completed');
  assert.deepEqual(use.entries,verdict.observed);
 }
 assert.equal((await inspectMemory(f,seed1)).provenance.operation,'save');

 const revised=await change(f,seed1,'revise',{text:revisedText});
 assert.equal(revised.revision,2);
 const stale=await runSelection(f,'stale',{absent:[selectedText,revisedText,unselectedText]});
 assert.deepEqual(stale.observed,[]);
 assert.deepEqual(stale.uses,[]);
 assert.equal(stale.selection.entries[0].revision,1);
 const pinned=await change(f,revised,'pin');
 assert.equal((await inspectMemory(f,pinned)).pinned,true);
 await assert.rejects(change(f,pinned,'pause'),/Pinned Memory/);
 const unpinned=await change(f,pinned,'unpin');
 assert.equal((await inspectMemory(f,unpinned)).pinned,false);
 const paused=await change(f,unpinned,'pause');
 const status=await inspectMemory(f,paused);
 assert.equal(status.status,'paused');
 const inventory=await processCli('memory','inspect','--project',f.projectDir,'--status');
 assert.equal(inventory.entries.find(e=>e.id===paused.id).status,'paused');
 assert.equal(inventory.entries.length,2);
 assert.doesNotMatch(JSON.stringify(inventory),/SELECTED_R1|SELECTED_R2|UNSELECTED/);
 const eligible=await processCli('memory','inspect','--project',f.projectDir);
 assert.ok(eligible.entries.every(e=>e.id!==paused.id));
 assert.equal(status.sha256,null);
 await assert.rejects(submitResearchTask({...args,runId:'cannot-select-paused'}),{code:'PROJECT_MEMORY_SELECTION_UNAVAILABLE'});
 const restored=await change(f,paused,'restore');
 assert.equal(restored.revision,paused.revision+1);
 assert.equal((await inspectMemory(f,restored)).provenance.operation,'restore');
 await submitResearchTask({...args,runId:'restored'});
 await submitResearchTask({...args,runId:'will-be-forgotten'});
 assert.equal((await runSelection(f,'restored',{visible:revisedText,absent:[selectedText,unselectedText]})).observed[0].revision,restored.revision);
 const rep=await processCli('run','report','--project',f.projectDir,'--run','restored');
 assert.match(rep.report.text,/Annual fee: 12 units/);
 const forgotten=await change(f,restored,'forget');
 assert.equal((await inspectMemory(f,forgotten)).status,'forgotten');
 await assert.rejects(change(f,forgotten,'restore'),/forgotten or unavailable/);
 assert.deepEqual((await runSelection(f,'will-be-forgotten',{absent:[selectedText,revisedText,unselectedText]})).observed,[]);
 assert.equal((await processCli('run','report','--project',f.projectDir,'--run','restored')).report.sha256,rep.report.sha256);
});

test('selected Memory changes after projection/reservation cannot escape the final native transport recheck',async t=>{
 const f=await setup(t);
 const entry=await seed(f,selectedText,'race');
 const runId='boundary';
 await submitResearchTask({...f.request,runId,memoryMode:'selected',memoryEntryIds:[entry.id]});
 const s=selectedScript({visible:selectedText,absent:[unselectedText]});
 let changed=false;
 const {run}=await workResearchTask({...worker(f,runId,s.fetchImpl),async onCheckpoint({phase}){
  if(phase==='model-reserved'&&s.requests.length===1&&!changed){changed=true;await change(f,entry,'pause');}
 }});
 assert.equal(changed,true);
 assert.equal(run.status,'failed');
 assert.equal(run.snapshot.code,'PROJECT_SELECTED_MEMORY_CHANGED_BEFORE_SEND');
 assert.equal(s.requests.length,1,'a late-revoked prepared input must never hit the transport');
 assert.equal(run.snapshot.gatewayOutcome,'settled');
 const {requests}=await inspectResearchCapacity({projectDir:f.projectDir,runId});
 assert.deepEqual(requests.map(ticket=>ticket.state),['completed','cancelled']);
 const audit=await processCli('run','memory','--project',f.projectDir,'--run',runId);
 assert.equal(audit.observed.length,1,'the observed tool result remains separately inspectable');
 assert.deepEqual(audit.uses,[],'cancelled ticket must not mint an actual-use receipt');
});

for(const mode of ['selected','default'])test(`A26 ${mode} typed recall revoked while queued gives known local cancellation, no physical dispatch`,async t=>{
 const f=await setup(t);
 const entry=await seed(f,selectedText,'queue');
 const runId='queued';
 await submitResearchTask({...f.request,runId,...(mode==='selected'?{memoryMode:'selected',memoryEntryIds:[entry.id]}:{})});
 await submitResearchTask({...f.request,runId:'competing-blocker'});
 const s=selectedScript({visible:selectedText,absent:[unselectedText]});
 let block,unblock,notifyDispatch;
 const blockerReady=new Promise(res=>{notifyDispatch=res;});
 const blocking=new Promise(res=>{unblock=res;});
 t.after(unblock);
 const pending=workResearchTask({...worker(f,runId,s.fetchImpl),async onCheckpoint({phase}){
  if(phase==='model-reserved'&&s.requests.length===1&&!block){
   block=workResearchTask(worker(f,'competing-blocker',async()=>{notifyDispatch();await blocking;return final();}));
   await blockerReady;
  }
 }});
 try{
  const allowed=Date.now()+5000;
  for(;;){
   const {requests}=await inspectResearchCapacity({projectDir:f.projectDir,runId});
   if(requests[1]?.state==='queued')break;
   if(Date.now()>=allowed)assert.fail('second request never reached the queue');
   await delay(15);
  }
  await change(f,entry,'pause');
 }finally{unblock();}
 const {run}=await pending;
 await block;
 assert.equal(run.status,'failed');
 assert.equal(run.snapshot.code,mode==='selected'?'PROJECT_SELECTED_MEMORY_CHANGED_BEFORE_SEND':'PROJECT_MEMORY_CHANGED_BEFORE_SEND');
 assert.equal(run.snapshot.gatewayOutcome,'settled');
 assert.equal(s.requests.length,1);
 const capacity=await inspectResearchCapacity({projectDir:f.projectDir,runId});
 assert.deepEqual(capacity.requests.map(ticket=>ticket.state),['completed','cancelled']);
 const audit=await processCli('run','memory','--project',f.projectDir,'--run',runId);
 assert.deepEqual(audit.uses,[]);
});
