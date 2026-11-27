import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createResearchProject, submitResearchTask, workResearchTask, inspectResearchRequests} from '../src/research-project.mjs';
import {prepareGuiLiveConfig} from '../src/gui-live-config.mjs';
import {OPENCODE_GO_CURRENT_ENDPOINT, OPENCODE_GO_OWNER_PROVIDER, GO_DEEPSEEK_MODEL, GO_MIMO_MODEL} from '../src/gateway.mjs';

const fakeKey='placeholder-not-a-real-key';
const answer=()=>Response.json({choices:[{message:{role:'assistant',content:'Synthetic answer.'},finish_reason:'stop'}]});
const missing=()=>Response.json({error:{code:'model_not_found',message:'Catalog lookup rejected model.'}},{status:404});
async function fixture(t,{budget=3,enabled=true,first=missing,second=answer}={}){
  await mkdir('test-output',{recursive:true});
  const directory=await mkdtemp(resolve('test-output/failover-runtime-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const {config}=prepareGuiLiveConfig({gateway:{provider:OPENCODE_GO_OWNER_PROVIDER,endpoint:OPENCODE_GO_CURRENT_ENDPOINT,
    model:GO_DEEPSEEK_MODEL,apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:budget},
    ...(enabled?{goMimoFallback:'exact-go-model-not-found@1'}:{})},{ETF_GUI_PROVIDER_KEY:fakeKey});
  const project=await createResearchProject({directory,config});
  const runId='failure-test';
  await submitResearchTask({projectDir:directory,runId,question:'Synthetic question',expectedConfigSha256:project.configSha256,
    sourceManifestSha256:null,authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
  const requests=[];
  const challenge=()=>workResearchTask({projectDir:directory,runId,apiKey:fakeKey,fetchImpl:async(url,options,reservation)=>{
    assert.equal(url.href,OPENCODE_GO_CURRENT_ENDPOINT);
    assert.equal(options.headers.authorization,`Bearer ${fakeKey}`);
    requests.push({payload:JSON.parse(options.body),session:options.headers['x-opencode-session'],reservation});
    return requests.length===1?first():second();
  }});
  const done=await challenge();
  const tickets=await inspectResearchRequests({projectDir:directory,runId,reservations:requests.map((_,i)=>({rootId:runId,modelOrdinal:i+1}))});
  return {requests,done,tickets,challenge};
}

test('Project → Runtime → Admission sends MiMo only on settled DeepSeek model denial, via new durable ticket',async t=>{
  const {requests,done,tickets,challenge}=await fixture(t);
  assert.equal(done.run.status,'completed',JSON.stringify(done.run.snapshot));
  assert.equal(done.run.snapshot.answer,'Synthetic answer.');
  assert.equal(done.run.rootUsage.model,2);
  assert.deepEqual(requests.map(x=>x.payload.model),[GO_DEEPSEEK_MODEL,GO_MIMO_MODEL]);
  assert.deepEqual(requests.map(x=>x.reservation.modelOrdinal),[1,2]);
  assert.equal(requests[0].session,requests[1].session);
  assert.deepEqual(requests[0].payload.messages,requests[1].payload.messages);
  assert.deepEqual(tickets.map(x=>x.state),['completed','completed']);
  assert.equal(tickets[0].inputHash,tickets[1].inputHash);
  assert.notEqual(tickets[0].ticketId,tickets[1].ticketId);
  assert.equal(tickets[1].fallbackModel,GO_MIMO_MODEL);
  await challenge();
  assert.equal(requests.length,2);
});
test('primary success does not consume fallback reservation',async t=>{
  const {requests,done}=await fixture(t,{first:answer});
  assert.equal(done.run.status,'completed');
  assert.equal(requests.length,1);
});
test('429, unrelated 404, 503, thrown network failure, and spoofed error code do not replay',async t=>{
 for(const first of [
   ()=>Response.json({error:{code:'rate_limit_exceeded',message:'limited'}},{status:429}),
   ()=>Response.json({error:{code:'wrong_path',message:'no route'}},{status:404}),
   ()=>Response.json({error:{code:'model_not_found',message:'unavailable'}},{status:503}),
   ()=>{throw new TypeError('network');},
   ()=>{throw Object.assign(new Error('spoof'),{code:'PROVIDER_HTTP_404'});}
 ]){
   const {done,requests,tickets}=await fixture(t,{first});
   assert.equal(requests.length,1);
   assert.equal(tickets[0].state,'unknown');
   assert.equal(done.run.snapshot.gatewayOutcome,'unknown');
 }
});
test('disabled feature and exhausted model budget cannot send fallback',async t=>{
  const disabled=await fixture(t,{enabled:false});
  assert.equal(disabled.requests.length,1);
  assert.equal(disabled.tickets[0].state,'unknown');
  const exhausted=await fixture(t,{budget:1});
  assert.equal(exhausted.requests.length,1);
  assert.equal(exhausted.tickets[0].state,'completed');
  assert.equal(exhausted.done.run.snapshot.gatewayOutcome,'settled');
});

test('independent OpenAI route sends only after both Go denials, preserves tool continuation over a paused worker',async t=>{
 const {OPENAI_RESPONSES_MODEL,OPENAI_RESPONSES_ENDPOINT}=await import('../src/openai-responses-gateway.mjs');
 const directory=await mkdtemp(resolve('test-output/failover-openai-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const {config}=prepareGuiLiveConfig({gateway:{provider:OPENCODE_GO_OWNER_PROVIDER,endpoint:OPENCODE_GO_CURRENT_ENDPOINT,
   model:GO_DEEPSEEK_MODEL,apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:7},connectivity:{web:true},
   goMimoFallback:'exact-go-model-not-found@1'},{ETF_GUI_PROVIDER_KEY:fakeKey});
 config.ownerOpenAIResponses={profile:'owner-gpt-6-1-terra@1',maxOutputTokens:4096,maxAttempts:5};
 const project=await createResearchProject({directory,config});
 const runId='openai-failure-test';
 await submitResearchTask({projectDir:directory,runId,question:'Synthetic tool test.',expectedConfigSha256:project.configSha256,
   sourceManifestSha256:null,authorization:{providerApproved:true,dataApproved:true,costApproved:true,openAIApproved:true}});
 const ids=[],stop=new AbortController(),openAIKey='synthetic-alternate-not-a-key';
 const reasoning={type:'reasoning',id:'rs_synthetic',summary:[],encrypted_content:'XQ_-=='};
 const ok=(output)=>Response.json({object:'response',model:OPENAI_RESPONSES_MODEL,status:'completed',output});
 const options={projectDir:directory,runId,apiKey:fakeKey,openAIKey,fetchImpl:async(url,options,r)=>{
   const body=JSON.parse(options.body);ids.push(body.model);
   if(url.href===OPENCODE_GO_CURRENT_ENDPOINT){
     assert.equal(options.headers.authorization,'Bearer '+fakeKey);
     assert.ok(!JSON.stringify(body).includes(reasoning.encrypted_content));
     return missing();
   }
   assert.equal(url.href,OPENAI_RESPONSES_ENDPOINT);
   assert.equal(options.headers.authorization,'Bearer '+openAIKey);
   assert.equal(body.store,false);assert.equal(body.max_output_tokens,4096);
   if(ids.length===3){
     assert.equal(r.modelOrdinal,3);assert.ok(body.tools.some(x=>x.name==='public_web_read'));
     return ok([reasoning,{type:'function_call',status:'completed',call_id:'call_refusal',name:'public_web_read',arguments:'{"url":"https://127.0.0.1/synthetic"}'}]);
   }
   assert.equal(r.modelOrdinal,4);
   assert.ok(body.input.some(x=>x.type==='function_call_output'&&x.call_id==='call_refusal'));
   assert.deepEqual(body.input.find(x=>x.type==='reasoning'),reasoning);
   return ok([{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'Synthetic tool answer.'}]}]);
 }};
 const first=await workResearchTask({...options,hostSignal:stop.signal,onCheckpoint(event){
   if(event.phase==='result-committed')stop.abort();
 }});
 assert.equal(first.workerStatus,'interrupted',JSON.stringify(first.run.snapshot));
 assert.equal(first.run.snapshot.openAISelected,true);
 assert.deepEqual(ids,[GO_DEEPSEEK_MODEL,GO_MIMO_MODEL,OPENAI_RESPONSES_MODEL]);
 const done=await workResearchTask(options);
 assert.equal(done.run.status,'completed',JSON.stringify(done.run.snapshot));
 assert.equal(done.run.snapshot.answer,'Synthetic tool answer.');
 assert.equal(done.run.rootUsage.model,4);
 const tickets=await inspectResearchRequests({projectDir:directory,runId,reservations:ids.map((_,i)=>({rootId:runId,modelOrdinal:i+1}))});
 assert.deepEqual(tickets.map(x=>x.fallbackModel??null),[null,GO_MIMO_MODEL,OPENAI_RESPONSES_MODEL,OPENAI_RESPONSES_MODEL]);
 assert.deepEqual(tickets.map(x=>x.state),['completed','completed','completed','completed']);
 assert.equal(tickets[0].inputHash,tickets[2].inputHash);
 assert.equal(new Set(tickets.map(x=>x.ticketId)).size,4);
 await workResearchTask(options);
 assert.equal(ids.length,4);
});

test('OpenAI requires explicit per-run consent, shares no Go key, and honors durable attempt cap',async t=>{
 const {OPENAI_RESPONSES_MODEL,OPENAI_RESPONSES_ENDPOINT}=await import('../src/openai-responses-gateway.mjs');
 const directory=await mkdtemp(resolve('test-output/failover-openai-cap-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const {config}=prepareGuiLiveConfig({gateway:{provider:OPENCODE_GO_OWNER_PROVIDER,endpoint:OPENCODE_GO_CURRENT_ENDPOINT,
   model:GO_DEEPSEEK_MODEL,apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},goMimoFallback:'exact-go-model-not-found@1'},{ETF_GUI_PROVIDER_KEY:fakeKey});
 config.ownerOpenAIResponses={profile:'owner-gpt-6-1-terra@1',maxOutputTokens:4096,maxAttempts:1};
 const same=await createResearchProject({directory:resolve(directory,'cap'),config});
 let directCalls=0;
 async function exercise(runId,{approved,unknown=false,openAIKey='synthetic-alternate-key',cap=false}={}){
  const project=cap?same:await createResearchProject({directory:resolve(directory,runId),config});
  const projectDir=resolve(directory,cap?"cap":runId);
  await submitResearchTask({projectDir,runId,question:'Synthetic only.',expectedConfigSha256:project.configSha256,
    sourceManifestSha256:null,authorization:{providerApproved:true,dataApproved:true,costApproved:true,...(approved?{openAIApproved:true}:{})}});
  let attempts=0;
  return await workResearchTask({projectDir,runId,apiKey:fakeKey,openAIKey,fetchImpl:async(url)=>{
    attempts++;
    if(url.href===OPENAI_RESPONSES_ENDPOINT){
      directCalls++;
      return Response.json({object:'response',model:OPENAI_RESPONSES_MODEL,status:'completed',
        output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'Synthetic bounded answer.'}]}]});
    }
    return attempts===2&&unknown?Response.json({error:{code:'rate_limit_exceeded',message:'Limited'}},{status:429}):missing();
  }});
 }
 assert.equal((await exercise('no-scope')).run.status,'failed');
 assert.equal(directCalls,0);
 assert.equal((await exercise('no-key',{approved:true,openAIKey:null})).run.status,'failed');
 assert.equal(directCalls,0);
 assert.equal((await exercise('unknown-secondary',{approved:true,unknown:true})).run.snapshot.gatewayOutcome,'unknown');
 assert.equal(directCalls,0);
 assert.equal((await exercise('bounded-first',{approved:true,cap:true})).run.status,'completed');
 assert.equal(directCalls,1);
 const exhausted=await exercise('bounded-second',{approved:true,cap:true});
 assert.equal(exhausted.run.status,'failed');
 assert.equal(exhausted.run.snapshot.gatewayOutcome,'settled');
 assert.equal(directCalls,1);
});

test('an unfit Responses continuation does not strip opaque reasoning or reserve a second model',async t=>{
 const {OPENAI_RESPONSES_MODEL,OPENAI_RESPONSES_ENDPOINT}=await import('../src/openai-responses-gateway.mjs');
 const directory=await mkdtemp(resolve('test-output/failover-openai-context-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const openAIKey='synthetic-context-alternate';
 const {config}=prepareGuiLiveConfig({gateway:{provider:OPENCODE_GO_OWNER_PROVIDER,endpoint:OPENCODE_GO_CURRENT_ENDPOINT,
   model:'glm-5.3-flash',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{web:true},
   openAIBackup:{profile:'owner-gpt-6-1-terra@1',maxOutputTokens:4096,maxAttempts:5}},
   {ETF_GUI_PROVIDER_KEY:fakeKey,ETF_OPENAI_API_KEY:openAIKey});
 const {configSha256}=await createResearchProject({directory,config});
 const runId='large-reasoning-context';
 await submitResearchTask({projectDir:directory,runId,question:'Synthetic context budget check.',sourceManifestSha256:null,expectedConfigSha256:configSha256,
   authorization:{providerApproved:true,dataApproved:true,costApproved:true,openAIApproved:true}});
 let calls=0;
 const result=await workResearchTask({projectDir:directory,runId,apiKey:fakeKey,openAIKey,goHealth:{async outage(){return true;},observe(){}},
   fetchImpl:async url=>{
     assert.equal(url.href,OPENAI_RESPONSES_ENDPOINT);calls++;
     return Response.json({object:'response',model:OPENAI_RESPONSES_MODEL,status:'completed',output:[
       {type:'reasoning',id:'rs_pressure',summary:[],encrypted_content:'A'.repeat(71000)},
       {type:'function_call',status:'completed',call_id:'call_pressure',name:'public_web_read',arguments:'{"url":"https://127.0.0.1/synthetic"}'}]});
   }});
 assert.equal(result.run.status,'failed');assert.equal(result.run.snapshot.code,'CONTEXT_CAPACITY_EXCEEDED');
 assert.equal(result.run.rootUsage.model,1);assert.equal(calls,1);
 const tool=result.run.snapshot.messages.find(m=>m.role==='assistant'&&m.openAIReasoning);
 assert.equal(tool.openAIReasoning[0].encrypted_content.length,71000);
});
