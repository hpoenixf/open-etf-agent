import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createResearchProject,readResearchReport,workResearchTask,inspectResearchRequests} from '../../../../src/research-project.mjs';
import {confirmScheduledTask,inspectScheduledTask,cancelScheduledTask,runDueScheduledTasks} from '../../../../src/scheduled-tasks.mjs';
import {importProjectSources} from '../../../../src/project-sources.mjs';
import {scheduleRunId} from '../../../../src/schedule.mjs';
import {createTaskTime,taskTimeMessage} from '../../../../src/temporal.mjs';
import {normalizeChatCompletion} from '../../../../src/gateway.mjs';
import {createBridge,ENDPOINT,MODEL} from '../bridge.mjs';
import {createStubSink} from './sink.mjs';
const here=dirname(fileURLToPath(import.meta.url)),planRoot=resolve(here,'..'),product=resolve(here,'../../../..');
const hash=b=>createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms)),exec=promisify(execFile);
const save=async(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
async function cold(operation,projectDir,runId){const {stdout}=await exec(process.execPath,[join(here,'cold.mjs'),operation,projectDir,runId??''],{timeout:12000,maxBuffer:4*1048576});return JSON.parse(stdout);}
export async function runStub({directory,onlyCase,stopShape='multi'}){
 const raw=await readFile(join(planRoot,'cases.json'));assert.equal(hash(raw),'06ef865d1781ca82caca60ed74b4a4c018446ceb53e574ce3511391c36048977');
 assert.equal(hash(await readFile(join(planRoot,'plan.md'))),'8605b154aa6bc2862adbc36878efeea3a6f7c0c14628d3f5a8e420f422d528b3');
 const plan=JSON.parse(raw),authority=JSON.parse(await readFile(join(planRoot,'synthetic-authority.json')));
 async function sourcePins(){const pins={};for(const[p,expected]of Object.entries(plan.contractReadbackSha256)){pins[p]=hash(await readFile(join(product,p)));assert.equal(pins[p],expected,p);}return pins;}
 const before=await sourcePins();await mkdir(directory,{recursive:false,mode:0o700});const batchId='stub-'+randomUUID().replaceAll('-','').slice(0,16),cases=onlyCase?plan.cases.filter(c=>c.id===onlyCase):plan.cases;assert.ok(cases.length);
 const summaries=[];
 await save(join(directory,'INPUT.safe.json'),{mode:'SYNTHETIC_STUB_NO_REAL_CALLS',batchId,planSha256:hash(raw),sourcePins:before,onlyCase:onlyCase??null,stopShape,historicalSummary:authority.historicalSummary});
 const sink=await createStubSink({directory:join(directory,'sink'),batchId,caseCaps:Object.fromEntries(cases.map(c=>[c.id,c.modelAttemptCap])),taskCaps:{},bindings:{},authority,verifyReservation:async(context,binding)=>{
  assert.equal(context.role,'main');assert.equal(context.purpose,'main');const read=await inspectScheduledTask({projectDir:binding.projectDir,runId:binding.runId});const state=read.run;assert.equal(state.runId,context.runId);assert.equal(state.rootId,context.rootId);assert.equal(state.parentRunId,null);assert.equal(state.snapshot.phase,'model-reserved');assert.equal(state.snapshot.purpose,undefined);assert.equal(state.snapshot.working.hash,context.inputHash);
  const [ticket]=await inspectResearchRequests({projectDir:binding.projectDir,runId:binding.runId,reservations:[{rootId:context.rootId,modelOrdinal:context.modelOrdinal}]});assert.ok(ticket);for(const k of ['rootId','runId','modelOrdinal','inputHash'])assert.equal(ticket[k],context[k]);assert.equal(ticket.state,'dispatched');assert.equal(ticket.fence,state.fence);assert.equal(ticket.owner,state.owner);return{scope:'original-admission-and-session-readback',ticket,role:'main',purpose:'main',purposeBasis:'original main root with no compaction purpose',snapshotSha256:hash(JSON.stringify(state.snapshot))};
 }});
 try{for(const c of cases){
  const caseRoot=join(directory,c.id);await mkdir(caseRoot);const projectDir=join(caseRoot,'project');
  await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'live',provider:'opencode-go',protocol:'chat-completions',model:MODEL,endpoint:ENDPOINT,apiKeyEnv:'UNUSED_SYNTHETIC_ONLY'},capabilities:c.capabilities,limits:{maxRounds:10,maxTools:20,timeoutMs:180000,model:c.modelAttemptCap,tool:24}}});
  const files=[];for(const source of c.sources){const file=join(caseRoot,source.file);await writeFile(file,source.text,{flag:'wx'});files.push(file);}const bundle=await importProjectSources({projectDir,files});
  const number=Number(c.id.slice(-2)),aliases=number===5?['a-first','b-second']:number===6?['a-cancelled','b-survivor']:number===7?['a-expired','b-survivor']:['once'];
  const due=Date.now()+800,bindings={},taskCaps={},definitions=[];
  for(const alias of aliases){const runId=batchId+'-'+alias;const scheduledInstant=new Date(number===7&&alias==='b-survivor'?due+450:due).toISOString(),schedule={scheduleId:batchId+'-'+c.id+'-'+alias,definitionRevision:1,scheduledInstant,timeZone:c.timeZone,maxLatenessMs:number===7&&alias==='a-expired'?120:60000};const runtimeId=scheduleRunId(schedule);bindings[runtimeId]={caseId:c.id,alias,runId,projectDir,documents:bundle.catalog.documents.map(d=>d.id),facts:c.semanticExpectedFacts,taskTime:createTaskTime({anchorInstant:scheduledInstant,timeZone:c.timeZone})};taskCaps[runtimeId]=number===5?5:c.modelAttemptCap;const question=number===5?c.questionVariants[alias]:c.question;assert.equal(typeof question,'string');definitions.push({runId,schedule,runtimeId,question,questionSha256:hash(question)});}
  await save(join(caseRoot,'INSTANTIATION.safe.json'),{batchId,sourceManifest:bundle.manifestSha256,definitions,bindings,windowPolicy:'frozen-before-confirmation-no-after-start-changes'});
  await sink.register({bindings,taskCaps});
  const caseCount=()=>sink.snapshot().attempts.filter(a=>a.caseId===c.id).length;
  let bridge,stopUsed=false;const stop=new AbortController(),observations=[];
  const fetchStub=async(_url,init)=>{
   const body=JSON.parse(init.body);const messages=body.messages,tool=messages.filter(m=>m.role==='tool').map(m=>({id:m.tool_call_id,result:JSON.parse(m.content)}));
   const current=sink.snapshot().attempts.at(-1),binding=bindings[current.runId];const actualDefinition=(await inspectScheduledTask({projectDir,runId:binding.runId})).definition;assert.deepEqual(actualDefinition.taskTime,binding.taskTime);assert.equal(actualDefinition.taskTime.anchorInstant,actualDefinition.schedule.scheduledInstant);assert.equal(actualDefinition.taskTime.timeZone,c.timeZone);assert.ok(messages.some(m=>m.role==='system'&&m.content===taskTimeMessage(createTaskTime(actualDefinition.taskTime)).content),'actual native trusted task-time projection');const read=tool.filter(t=>t.result.status==='succeeded'&&t.result.value?.sourceId),names=new Set(body.tools.map(t=>t.function.name));let message,finish;
   const remaining=binding.documents.filter(d=>!read.some(t=>t.result.value.documentId===d));
   if(remaining.length){assert.ok(names.has('read_page'));const selected=stopShape==='last'&&number===10?remaining.slice(0,1):remaining;message={role:'assistant',content:null,tool_calls:selected.map((d,i)=>({id:'read-'+current.ticket.ordinal+'-'+i,type:'function',function:{name:'read_page',arguments:JSON.stringify({documentId:d,page:1})}}))};finish='tool_calls';}
   else if(!tool.some(t=>t.result.value?.path==='report.md')){assert.ok(names.has('save_report'));const times=number===8?'\nTrusted taskDate '+binding.taskTime.taskDate+'; yesterday '+binding.taskTime.yesterday+'; tomorrow '+binding.taskTime.tomorrow+'.':'';message={role:'assistant',content:null,tool_calls:[{id:'save-'+current.ticket.ordinal,type:'function',function:{name:'save_report',arguments:JSON.stringify({text:'# Synthetic report\n'+binding.facts.map((f,i)=>f+' ['+read[i].result.value.sourceId+']').join('\n')+times,sourceIds:read.map(t=>t.result.value.sourceId)})}}]};finish='tool_calls';}
   else{message={role:'assistant',content:'Synthetic report saved.',tool_calls:null};finish='stop';}
   return Response.json({choices:[{finish_reason:finish,message}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2,cost:0,opencode:{billing_source:'go',estimated:false}}});
  };
  bridge=createBridge({sink,sessionId:batchId+'-'+c.id,fetchImpl:fetchStub});
  const checkpoint=runId=>async event=>{
   if(!['proposal-sealed','result-consumed'].includes(event.phase))return;
   const read=await inspectScheduledTask({projectDir,runId}),state=read.run;assert.equal(state.runId,event.runId);assert.equal(state.fence,event.fence);
   if(event.phase==='proposal-sealed'){const pending=bridge.state().pending;assert.ok(pending);const bytes=await sink.readBody(pending.ticket);assert.equal(hash(bytes),pending.bodySha256);const normalized=normalizeChatCompletion(JSON.parse(bytes));assert.deepEqual(state.snapshot.proposal,normalized);await bridge.adopt({ticketId:pending.ticket.id,bodySha256:pending.bodySha256,evidence:{phase:event.phase,runId:state.runId,fence:state.fence,snapshotSha256:hash(JSON.stringify(state.snapshot)),proposalSha256:hash(JSON.stringify(state.snapshot.proposal))}});}
   if(number===10&&!stopUsed&&event.phase==='result-consumed'){
    const snapshot=state.snapshot,last=snapshot.messages.at(-1),call=snapshot.proposal?.calls?.[snapshot.cursor-1];
    if(Number.isSafeInteger(snapshot.cursor)&&snapshot.cursor>=1&&last?.role==='tool'&&call?.name==='read_page'&&last.callId===call.id&&last.result?.status==='succeeded'&&last.result.value?.sourceId){assert.equal(snapshot.gatewayOutcome,'settled');assert.deepEqual(snapshot.unknownEffects,[]);assert.ok(Object.hasOwn(snapshot,'inFlight'));assert.equal(snapshot.inFlight,null);assert.equal(bridge.state().stopped,false);assert.equal(bridge.state().active,false);assert.equal(bridge.state().pending,null);assert.ok(sink.snapshot().attempts.every(a=>a.go&&a.adopted));stopUsed=true;observations.push({kind:'safe-consumed-stop',runId:state.runId,fence:state.fence,cursor:snapshot.cursor,consumedCallId:call.id,callbackCallId:event.callId??null,lastTool:last,snapshotSha256:hash(JSON.stringify(snapshot))});stop.abort();}
   }
  };
  const controls=d=>({apiKey:'synthetic-key-not-real',fetchImpl:bridge.fetchImpl,onCheckpoint:checkpoint(d.runId)});
  const observe=async label=>{const states=[];for(const d of definitions)states.push(await inspectScheduledTask({projectDir,runId:d.runId}));const o={label,at:new Date().toISOString(),attempts:caseCount(),states};observations.push(o);return o;};
  try{
   for(const d of definitions)await confirmScheduledTask({projectDir,runId:d.runId,question:d.question,sourceManifestSha256:bundle.manifestSha256,confirmOnce:true,schedule:d.schedule,authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
   for(const d of definitions){const actual=await inspectScheduledTask({projectDir,runId:d.runId});assert.equal(actual.definition.question,d.question);assert.equal(hash(actual.definition.question),d.questionSha256);}
   await observe('confirmed');assert.equal(caseCount(),0);
   if(number===2){assert.equal((await runDueScheduledTasks({projectDir,resolveControls:controls})).attempted,0);assert.equal((await observe('early')).attempts,0);}
   if(number===4){const opened=await cold('inspect',projectDir,definitions[0].runId);assert.equal(opened.schedule.state,'confirmed');assert.equal(opened.schedule.reference.confirmationHash,(await inspectScheduledTask({projectDir,runId:definitions[0].runId})).schedule.reference.confirmationHash);observations.push({kind:'cold-confirmed',opened});}
   if(number===6){await cancelScheduledTask({projectDir,runId:definitions[0].runId});const opened=await cold('inspect',projectDir,definitions[0].runId);assert.equal(opened.schedule.state,'cancelled');assert.equal(opened.run,null);}
   await sleep(Math.max(0,(number===7?due+450:due)-Date.now()+5));
   const first=await runDueScheduledTasks({projectDir,limit:1,resolveControls:controls,...(number===10?{hostSignal:stop.signal}:{})});observations.push({kind:'first-sweep',result:first});
   if(number===5){const b=await inspectScheduledTask({projectDir,runId:definitions[1].runId});assert.equal(b.run,null);assert.equal(sink.snapshot().attempts.filter(a=>a.runId===definitions[1].runtimeId).length,0);observations.push({kind:'second-sweep',result:await runDueScheduledTasks({projectDir,limit:1,resolveControls:controls})});}
   if(number===6||number===7){const excluded=await inspectScheduledTask({projectDir,runId:definitions[0].runId});assert.equal(excluded.schedule.state,number===6?'cancelled':'missed');assert.equal(excluded.run,null);}
   if(number===10){assert.equal(stopUsed,true,'safe consumed checkpoint must actually exercise');const beforeResume=await cold('inspect',projectDir,definitions[0].runId);assert.equal(beforeResume.run.status,'active');assert.equal(beforeResume.run.snapshot.phase,'result-consumed');assert.equal(beforeResume.run.snapshot.gatewayOutcome,'settled');assert.deepEqual(beforeResume.run.snapshot.unknownEffects,[]);assert.ok(Object.hasOwn(beforeResume.run.snapshot,'inFlight'));assert.equal(beforeResume.run.snapshot.inFlight,null);assert.equal(bridge.state().stopped,false);const count=caseCount();const wake=await cold('sweep',projectDir);assert.equal(wake.attempted,0);assert.equal(caseCount(),count);const resumed=await workResearchTask({projectDir,runId:definitions[0].runId,...controls(beforeResume.definition)});assert.equal(resumed.run.runId,beforeResume.run.runId);observations.push({kind:'explicit-resume',beforeResume,result:resumed});}
   const final=await observe('final');const count=final.attempts;assert.equal((await runDueScheduledTasks({projectDir,resolveControls:controls})).attempted,0);
   if(number===3||number===9){const wake=await cold('sweep',projectDir);assert.equal(wake.attempted,0);}assert.equal(caseCount(),count);
   const reports=[];for(const state of final.states){if(!state.run)continue;if(state.run.status!=='completed')throw new Error('STUB_TASK_NOT_COMPLETED:'+JSON.stringify(state.run.snapshot));const report=await readResearchReport({projectDir,runId:state.definition.runId});assert.equal(report.revision.sources.length,2);reports.push(report);if(number===9){const http=await cold('http',projectDir,state.definition.runId);observations.push({kind:'cold-http',result:http});}}
   const legalMiss=number===5&&final.states[1].schedule.state==='missed';assert.equal(reports.length,legalMiss?1:c.expectedReportCount);
   await save(join(caseRoot,'RESULT.safe.json'),{mode:'SYNTHETIC_STUB_NOT_LIVE_QUALIFICATION',caseId:c.id,observations,reports,threeAxes:{runtime:'stub-mechanisms-pass',modelSemantic:'synthetic-controlled-output-not-model-quality',finalTask:legalMiss?'incomplete-legal-window-expiry':'stub-reports-complete'},sink:sink.snapshot()});summaries.push({caseId:c.id,reports:reports.length,attempts:count,stopUsed,legalMiss});
  }catch(error){await bridge.reject('BRIDGE_NATIVE_REJECTED').catch(()=>{});await save(join(caseRoot,'FAILURE.safe.json'),{code:error.code??'STUB_ASSERTION',message:String(error.message).slice(0,2000),stack:String(error.stack).slice(0,5000),sink:sink.snapshot(),observations});throw error;}
 }
 }finally{await sink.close();}
 const after=await sourcePins();assert.deepEqual(after,before);const attempts=summaries.reduce((n,c)=>n+c.attempts,0);assert.ok(attempts<=108);const result={mode:'SYNTHETIC_STUB_NO_LIVE_QUALIFICATION',scope:'synthetic-stub',actualBudgetReservation:false,actualModelCalls:0,batchId,cases:summaries,attempts,externalProviderNetworkCalls:0,realReservations:0,productPins:after};await save(join(directory,'RESULT.safe.json'),result);return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv[2]!=='--synthetic-stub-only'||!process.argv[3])throw new Error('EXPLICIT_STUB_MODE_REQUIRED_NO_LIVE_ENTRY');
 console.log(JSON.stringify(await runStub({directory:resolve(process.argv[3]),onlyCase:process.argv[4],stopShape:process.argv[5]??'multi'})));
}
