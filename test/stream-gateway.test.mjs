import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatGateway } from '../src/gateway.mjs';
const configured = (text, capture) => createChatGateway({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'synthetic', apiKey: 'synthetic-placeholder', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, stream: true, fetchImpl: async (_url, options) => { capture(JSON.parse(options.body)); return new Response(text, { headers: { 'content-type': 'text/event-stream' } }); } });
test('2.2 streaming mode connects the complete SSE decoder to the same Gateway contract', async () => {
  let sent;
  const gateway = configured('data: {"choices":[{"index":0,"delta":{"content":"streamed"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', request => { sent = request; });
  const result = await gateway.next({ messages: [{ role: 'user', content: 'exact' }], tools: [] });
  assert.equal(sent.stream, true); assert.equal(result.kind, 'final'); assert.equal(result.text, 'streamed');
});

const idleOwner = async (fetchImpl, stream = true) => {
  const {OPENCODE_GO_OWNER_PROVIDER:provider, OPENCODE_GO_CURRENT_ENDPOINT:endpoint} = await import('../src/gateway.mjs');
  return createChatGateway({provider,endpoint,model:'synthetic',apiKey:'synthetic-placeholder',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},observeTransport:()=>{},stream,fetchImpl,ownerIdleTimeout:true});
};
const input = {messages:[{role:'user',content:'synthetic'}],tools:[]};
const flush = () => new Promise(resolve => setImmediate(resolve));

test('owner idle watchdog stops a silent local fetch at exactly three minutes',async t=>{
  const {isProviderIdleTransport} = await import('../src/gateway.mjs');
  t.mock.timers.enable({apis:['setTimeout']});
  const observed=[]; let localSignal,settled=false;
  const gateway=await idleOwner(async (_,{signal})=>{localSignal=signal;return new Promise(()=>{});},false);
  const next=gateway.next(input).finally(()=>{settled=true;});next.catch(()=>{});
  await flush();
  t.mock.timers.tick(179999); await flush(); assert.equal(settled,false);
  t.mock.timers.tick(1);
  await assert.rejects(next,e=>{observed.push(e.code);return isProviderIdleTransport(e);});
  assert.equal(localSignal.aborted,true);assert.deepEqual(observed,['PROVIDER_IDLE_LOCAL']);
});

test('real SSE progress refreshes idle, keepalive and role-only frames do not',async t=>{
  const {isProviderIdleTransport} = await import('../src/gateway.mjs');
  t.mock.timers.enable({apis:['setTimeout']});
  let controller,cancelled=false,settled=false;
  const body=new ReadableStream({start(c){controller=c;},cancel(){cancelled=true;}});
  const push=string=>controller.enqueue(Buffer.from(string));
  const gateway=await idleOwner(async ()=>new Response(body,{headers:{'content-type':'text/event-stream'}}));
  const next=gateway.next(input).finally(()=>{settled=true;});next.catch(()=>{});
  await flush();await flush();
  t.mock.timers.tick(170000);
  push('data: {"choices":[{"index":0,"delta":{"content":"a real finding"}}]}\n\n');
  await flush();
  t.mock.timers.tick(170000);assert.equal(settled,false);
  push(': heartbeat\n\ndata: {"choices":[{"index":0,"delta":{"role":"assistant"}}]}\n\n'); await flush();
  t.mock.timers.tick(9999); await flush(); assert.equal(settled,false);
  t.mock.timers.tick(1); await assert.rejects(next,isProviderIdleTransport);assert.equal(cancelled,true);
});

test('only a branded idle timeout releases the exact durable unknown slot on project exit',async t=>{
  const {mkdtemp,rm}=await import('node:fs/promises'), {join}=await import('node:path'), {tmpdir}=await import('node:os');
  const project=await import('../src/research-project.mjs');
  const {OPENCODE_GO_OWNER_PROVIDER:provider,OPENCODE_GO_CURRENT_ENDPOINT:endpoint}=await import('../src/gateway.mjs');
  const projectDir=await mkdtemp(join(tmpdir(),'owner-idle-proof-')); t.after(()=>rm(projectDir,{recursive:true,force:true}));
  await project.createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'live',provider,endpoint,model:'synthetic',protocol:'chat-completions',apiKeyEnv:'SYNTHETIC_KEY'},capabilities:['report'],limits:{timeoutMs:600000}}});
  for(const runId of ['unbranded','truly-silent']) await project.submitResearchTask({projectDir,runId,question:'Synthetic input',sourceManifestSha256:null,authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
  let dispatches=0;
  const mockError=()=>Object.assign(new Error('synthetic arbitrary code'),{code:'PROVIDER_IDLE_LOCAL'});
  const cfg={projectDir,ownerAdmission:true,apiKey:'synthetic-placeholder'};
  await project.workResearchTask({...cfg,runId:'unbranded',fetchImpl:async()=>{dispatches++;throw mockError();}});
  const original=(await project.inspectResearchCapacity({projectDir,runId:'unbranded'})).requests[0];
  assert.equal(original.state,'unknown');assert.equal(original.localRelease,undefined);
  t.mock.timers.enable({apis:['setTimeout']});
  let markDispatched;
  const dispatched=new Promise(resolve=>{markDispatched=resolve;});
  const run=project.workResearchTask({...cfg,runId:'truly-silent',fetchImpl:async()=>{dispatches++;markDispatched();return new Promise(()=>{});}});
  await dispatched;
  t.mock.timers.tick(180000);
  const result=await run;
  assert.equal(result.run.snapshot.outcome.code,'PROVIDER_IDLE_LOCAL',JSON.stringify(result));assert.equal(result.run.snapshot.outcome.gatewayOutcome,'unknown');
  const [ticket]=(await project.inspectResearchCapacity({projectDir,runId:'truly-silent'})).requests;
  assert.equal(ticket.state,'unknown');assert.equal(ticket.localRelease.billingOutcome,'unknown');
  assert.equal(ticket.localRelease.replay,false);assert.equal(dispatches,2);
  assert.equal((await project.inspectResearchCapacity({projectDir,runId:'unbranded'})).requests[0].localRelease,undefined);
});
