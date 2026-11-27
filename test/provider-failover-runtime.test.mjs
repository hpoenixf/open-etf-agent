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
