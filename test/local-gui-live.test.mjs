import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createChatGateway } from '../src/gateway.mjs';
import { startLocalGui } from '../src/gui-server.mjs';
import { prepareGuiLiveConfig } from '../src/gui-live-config.mjs';
import { inspectResearchCapacity } from '../src/research-project.mjs';
import { importProjectSources } from '../src/project-sources.mjs';
import { submitConversationMessage, workConversationMessage } from '../src/conversation.mjs';

const config={
  gateway:{ provider:'fixture-compatible-adapter', endpoint:'https://api.invalid/v1/chat/completions',
    model:'test-only', apiKeyEnv:'ETF_GUI_PROVIDER_KEY' },
  limits:{ model:4 },
};
const deepSeekConfig={...config,gateway:{...config.gateway,provider:'deepseek-direct',
  endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-flash'}};
const goConfig={...config,gateway:{...config.gateway,provider:'opencode-go-owner',
  endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic-go-model'}};
const fakeCredential='unit-test-placeholder';
const env={ ETF_GUI_PROVIDER_KEY:fakeCredential };
const hash=text=>createHash('sha256').update(text).digest('hex');
const choice=(message, finish_reason='tool_calls')=>Response.json({
  choices:[{message:{role:'assistant',...message},finish_reason}],
});
const call=(name,args)=>choice({tool_calls:[{type:'function',id:name,function:{name,arguments:JSON.stringify(args)}}]});

async function fixture(t,operatorConfig=config) {
  await mkdir('test-output',{recursive:true});
  const dir=await mkdtemp(resolve('test-output/gui-live-')), instances=[];
  const source=await readFile(new URL('../src/gui/etf-fees.md',import.meta.url));
  const requests=[], requestHeaders=[];
  const fetchImpl=async (url,opts) => {
    assert.equal(String(url),operatorConfig.gateway.endpoint);
    assert.equal(opts.headers.authorization,'Bearer '+fakeCredential);
    const body=JSON.parse(opts.body);
    assert.equal(body.model,operatorConfig.gateway.model);
    assert.equal(opts.redirect,'error');
    requests.push(body);
    requestHeaders.push(new Headers(opts.headers));
    if (operatorConfig.gateway.provider==='deepseek-direct') {
      assert.deepEqual(body.thinking,{type:'disabled'});
      assert.equal(Object.hasOwn(body,'n'),false);
      assert.ok(body.messages.every(message=>!Object.hasOwn(message,'reasoning_content')));
    } else {
      assert.equal(Object.hasOwn(body,'thinking'),false);
      assert.equal(body.n,1);
    }
    assert.doesNotMatch(opts.body,new RegExp(fakeCredential));
    if (operatorConfig.gateway.provider==='opencode-go-owner' && body.tools.length===0) {
      assert.match(body.messages[0].content,/No external sources/);
      assert.doesNotMatch(body.messages[0].content,/Alpha ETF|Beta ETF|etf-fees\.md|etf-tracking\.md/);
      return choice({content:'General explanation without market data.'},'stop');
    }
    const tools=body.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
    if (!tools.length) return call('read_page',{documentId:'text:'+hash(source),page:1});
    if (tools.length===1) return call('save_report',{text:'# Synthetic model answer\n\n'+tools[0].text+'\n\n来源：[1]',sourceIds:[tools[0].sourceId]});
    return choice({ content:'Saved synthetic report.' },'stop');
  };
  async function launch(options={}) {
    const gui=await startLocalGui({projectDir:dir,liveConfig:operatorConfig,env,fetchImpl,...options});
    instances.push(gui);
    const get=(path,init)=>fetch(gui.origin+path,init);
    const post=(path,body,origin=gui.origin)=>get(path,{
      method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body),
    });
    return {...gui,get,post};
  }
  t.after(async()=>{await Promise.all(instances.map(gui=>gui.close()));await rm(dir,{recursive:true,force:true});});
  return {dir,launch,requests:()=>requests.length,wire:requests,requestHeaders,fetchImpl};
}

async function settled(gui,path) {
  for (let i=0;i<120;i++) {
    const body=await gui.get(path).then(r=>r.json());
    if (body.messages?.[0]?.status==='completed') return body;
    await delay(25);
  }
  assert.fail('Original live Run did not complete through mocked transport');
}

test('only the exact owner Go endpoint pair is accepted; no inline or unrelated keys',()=>{
  for (const endpoint of ['https://opencode.ai/inference/go/openai/v1/chat/completions',
    'https://opencode.ai./zen/go/v1/chat/completions','https://go.opencode.ai/v1/chat/completions']) {
    assert.throws(()=>prepareGuiLiveConfig({...config,gateway:{...config.gateway,endpoint}},env),
      {code:'GUI_GO_OWNER_PROFILE_REQUIRED'});
  }
  assert.throws(()=>prepareGuiLiveConfig({...config,gateway:{...config.gateway,provider:'opencode-go'}},env),
    {code:'GUI_GO_OWNER_PROFILE_REQUIRED'});
  for(const endpoint of ['https://opencode.ai/zen/go/v1/chat/completions',
    'https://opencode.ai:443/inference/go/openai/v1/chat/completions',
    'https://elsewhere.invalid/inference/go/openai/v1/chat/completions']) {
    assert.throws(()=>prepareGuiLiveConfig({...goConfig,gateway:{...goConfig.gateway,endpoint}},env),
      {code:'GUI_GO_OWNER_PROFILE_INVALID'});
  }
  const approved=prepareGuiLiveConfig(goConfig,env);
  assert.equal(approved.config.gateway.endpoint,goConfig.gateway.endpoint);
  assert.equal(approved.config.gateway.provider,'opencode-go-owner');
  assert.equal(approved.config.gateway.model,goConfig.gateway.model);
  assert.throws(()=>prepareGuiLiveConfig({...config,gateway:{...config.gateway,apiKey:fakeCredential}},env),
    {code:'GUI_LIVE_CONFIG_INVALID'});
  assert.throws(()=>prepareGuiLiveConfig({...config,gateway:{...config.gateway,provider:'invalid name'}},env),
    {code:'GUI_LIVE_CONFIG_INVALID'});
  assert.throws(()=>prepareGuiLiveConfig({...config,gateway:{...config.gateway,apiKeyEnv:'OTHER_PROCESS_TOKEN'}},
    {OTHER_PROCESS_TOKEN:fakeCredential}),{code:'GUI_LIVE_CONFIG_INVALID'});
  assert.throws(()=>prepareGuiLiveConfig(config,{}),{code:'GUI_LIVE_API_KEY_ENV_REQUIRED'});
});

test('the launch flag refuses a missing key and creates no project', async t=>{
  const f=await fixture(t);
  const configFile=resolve(f.dir,'operator.json'), project=resolve(f.dir,'project');
  await writeFile(configFile,JSON.stringify(config),{mode:0o600});
  await assert.rejects(promisify(execFile)(process.execPath,[
    'src/gui-cli.mjs','--project',project,'--live-config',configFile,
  ],{env:{}}), error => error.code===1 && !error.stdout &&
    error.stderr.trim()==='GUI_START_FAILED: GUI_LIVE_API_KEY_ENV_REQUIRED');
  assert.deepEqual(await readdir(f.dir),['operator.json']);
  assert.equal(f.requests(),0);
});

test('live GUI requires exact consent, saves original and reopens without dispatch, scoped to one project configuration',async t=>{
  const f=await fixture(t),g=await f.launch();
  assert.match(g.origin,/^http:\/\/127\.0\.0\.1:/);
  const raw=await g.get('/api/workspace').then(r=>r.text());
  for(const privateField of [fakeCredential,'ETF_GUI_PROVIDER_KEY',config.gateway.endpoint,config.gateway.model]) assert.ok(!raw.includes(privateField));
  const ws=JSON.parse(raw);
  assert.equal(ws.mode,'live-research');
  assert.deepEqual(ws.liveNotice,{maxModelCallsPerRun:4});
  assert.equal(f.requests(),0);
  const {id}=await g.post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  const original={messageId:'same-original',sourceId:ws.sources[0].id,question:'Review the synthetic fee source'};
  for(const body of [original,{...original,approveLive:false}]) {
    const response=await g.post(path+'/messages',body);
    assert.equal(response.status,400);
    assert.equal((await response.json()).error,'GUI_LIVE_APPROVAL_REQUIRED');
  }
  assert.equal((await g.post(path+'/messages',{...original,approveLive:true,endpoint:'https://other.invalid'})).status,400);
  assert.equal((await g.post(path+'/messages',{...original,approveLive:true},'https://other.invalid')).status,403);
  assert.equal(f.requests(),0);
  assert.equal((await readdir(resolve(f.dir,'tasks'))).length,0);
  const consent={...original,approveLive:true};
  const accepted=await g.post(path+'/messages',consent);
  assert.equal(accepted.status,202);
  const first=await settled(g,path),[m]=first.messages;
  assert.equal(m.runId,(await accepted.json()).runId);
  assert.equal(m.output.publicationStatus,'published');
  const wantedReport=m.output.report.text;
  assert.match(wantedReport,/0\.20%/);
  assert.equal(m.output.report.sha256,hash(wantedReport));
  assert.equal(m.output.sources[0].sha256,hash(m.output.sources[0].text));
  assert.equal(await g.get(path+'/messages/'+original.messageId+'/report.md').then(r=>r.text()),wantedReport);
  assert.equal(f.requests(),3);
  assert.equal((await inspectResearchCapacity({projectDir:f.dir,runId:m.runId})).requests.length,3);
  await g.close();
  await assert.rejects(startLocalGui({projectDir:f.dir}),{message:'GUI_DEMO_PROJECT_REQUIRED'});
  await assert.rejects(f.launch({liveConfig:{...config,limits:{model:8}}}),{message:'GUI_LIVE_PROJECT_REQUIRED'});
  const cold=await f.launch();
  assert.deepEqual(await cold.get(path).then(r=>r.json()),first);
  assert.equal((await cold.post(path+'/messages',{...consent,question:'different'})).status,409);
  const replay=await cold.post(path+'/messages',consent);
  assert.equal(replay.status,202);
  assert.equal((await replay.json()).runId,m.runId);
  assert.equal(f.requests(),3);
});

test('existing accepted live turn requires an explicit resume action and cannot dispatch from reads or retry',async t=>{
  const f=await fixture(t),g=await f.launch();
  const ws=await g.get('/api/workspace').then(r=>r.json());
  const {id}=await g.post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  const input={messageId:'manually-admitted',sourceId:ws.sources[0].id,question:'Review the synthetic fee source'};
  const admitted=await submitConversationMessage({projectDir:f.dir,conversationId:id,messageId:input.messageId,
    text:input.question,sourceManifestSha256:input.sourceId,authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
  const get=await g.get(path).then(r=>r.json());
  assert.equal(get.messages[0].status,'active');
  assert.equal(get.messages[0].working,false);
  assert.equal(f.requests(),0);
  const reply=await g.post(path+'/messages',{...input,approveLive:true});
  assert.equal(reply.status,202);
  assert.equal((await reply.json()).runId,admitted.runId);
  const resume=path+'/messages/'+input.messageId+'/work';
  assert.equal((await g.post(resume,{})).status,400);
  assert.equal(f.requests(),0);
  assert.equal((await g.post(resume,{approveLive:true})).status,202);
  const result=await settled(g,path);
  assert.equal(result.messages[0].runId,admitted.runId);
  assert.equal(f.requests(),3);
});

test('DeepSeek direct Flash profile fails closed on near-match endpoint or model',()=>{
  for (const patch of [{endpoint:'https://api.deepseek.com/v1/chat/completions'},
    {endpoint:'https://api.deepseek.com.example.invalid/chat/completions'},
    {endpoint:'https://api.deepseek.com:443/chat/completions'},
    {model:'deepseek-v4-pro'}]) {
    assert.throws(()=>prepareGuiLiveConfig({...deepSeekConfig,gateway:{...deepSeekConfig.gateway,...patch}},env),
      {code:'DEEPSEEK_DIRECT_PROFILE_INVALID'});
  }
});

test('DeepSeek direct Flash wire preserves native tool round trips and cold History through mock transport',async t=>{
  const f=await fixture(t,deepSeekConfig),g=await f.launch();
  const ws=await g.get('/api/workspace').then(r=>r.json());
  const {id}=await g.post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  assert.equal(f.requests(),0);
  const input={messageId:'deepseek-exact',sourceId:ws.sources[0].id,question:'Verify the synthetic ETF fees',approveLive:true};
  const accepted=await g.post(path+'/messages',input);
  assert.equal(accepted.status,202);
  const result=await settled(g,path),[message]=result.messages;
  assert.equal(message.runId,(await accepted.json()).runId);
  assert.equal(message.output.publicationStatus,'published');
  assert.match(message.output.report.text,/0\.20%/);
  assert.equal(message.output.report.sha256,hash(message.output.report.text));
  assert.equal(message.output.sources[0].sha256,hash(message.output.sources[0].text));
  assert.equal(f.requests(),3);
  const onWire=f.wire.map(body=>body.messages.filter(m=>m.role==='tool').map(m=>m.tool_call_id));
  assert.deepEqual(onWire,[[],['read_page'],['read_page','save_report']]);
  assert.ok(f.wire[1].messages.some(m=>m.tool_calls?.some(call=>call.id==='read_page')));
  assert.ok(f.wire[2].messages.some(m=>m.tool_calls?.some(call=>call.id==='save_report')));
  assert.equal((await inspectResearchCapacity({projectDir:f.dir,runId:message.runId})).requests.length,3);
  await g.close();
  const reopened=await f.launch();
  assert.deepEqual(await reopened.get(path).then(r=>r.json()),result);
  assert.equal((await reopened.post(path+'/messages',input)).status,202);
  assert.equal(f.requests(),3);
});

test('DeepSeek direct 429 preserves the provider status with one attempt and no fallback',async()=>{
  let attempts=0;
  const gateway=createChatGateway({...deepSeekConfig.gateway,apiKey:fakeCredential,
    authorization:{providerApproved:true,dataApproved:true,costApproved:true},
    fetchImpl:async (url,options)=>{
      attempts++;
      assert.equal(String(url),deepSeekConfig.gateway.endpoint);
      const body=JSON.parse(options.body);
      assert.equal(body.model,'deepseek-flash');
      assert.deepEqual(body.thinking,{type:'disabled'});
      return new Response('synthetic error body must not be exposed',{status:429});
    }});
  await assert.rejects(gateway.next({messages:[{role:'user',content:'Synthetic fixture'}],tools:[]}),
    {code:'PROVIDER_HTTP_429',message:'PROVIDER_HTTP_429'});
  assert.equal(attempts,1);
});

test('owner Go answers freeform with no source picker, fixtures, tools or per-turn approval',async t=>{
  const f=await fixture(t,goConfig),g=await f.launch();
  const ws=await g.get('/api/workspace').then(r=>r.json());
  assert.deepEqual(ws.sources,[]);
  assert.equal(ws.liveNotice.freeform,true);
  const {id}=await g.post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  const original='金价下跌通常有哪些原因？请区分一般解释和近期行情。';
  const input={messageId:'go-original',question:original};
  assert.equal(f.requests(),0);
  assert.equal((await g.post(path+'/messages',{...input,sourceId:'not-admitted'})).status,400);
  assert.equal(f.requests(),0);
  const accepted=await g.post(path+'/messages',input);
  assert.equal(accepted.status,202);
  const result=await settled(g,path),[message]=result.messages;
  const idHeader='open-etf-agent-'+hash(message.runId);
  assert.equal(message.question,original);
  assert.equal(message.sourceId,null);
  assert.equal(message.output.report,null);
  assert.deepEqual(message.output.sources,[]);
  assert.equal(message.output.publicationStatus,'published');
  assert.equal(message.output.answer,'General explanation without market data.');
  assert.equal(f.requests(),1);
  assert.ok(f.wire[0].messages[0].content.startsWith(original));
  assert.deepEqual(f.wire[0].tools,[]);
  assert.ok(f.requestHeaders.every(h=>h.get('user-agent')==='open-etf-agent/0.27'
    && h.get('x-opencode-session')===idHeader));
  assert.equal((await inspectResearchCapacity({projectDir:f.dir,runId:message.runId})).requests.length,1);
  await g.close();
  const reopened=await f.launch();
  assert.deepEqual(await reopened.get(path).then(r=>r.json()),result);
  assert.equal((await reopened.post(path+'/messages',input)).status,202);
  assert.equal(f.requests(),1);
});

test('historical sourced Go conversation remains readable but its pending run does not resume in freeform',async t=>{
  const f=await fixture(t,goConfig),g=await f.launch();
  const ws=await g.get('/api/workspace').then(r=>r.json());
  assert.deepEqual(ws.sources,[]);
  const {id}=await g.post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  const bundle=await importProjectSources({projectDir:f.dir,files:[resolve('src/gui/etf-fees.md')]});
  const authorization={providerApproved:true,dataApproved:true,costApproved:true};
  for(const messageId of ['historical-report','historical-pending']){
    await submitConversationMessage({projectDir:f.dir,conversationId:id,messageId,text:'Historical fees question',
      sourceManifestSha256:bundle.manifestSha256,authorization});
  }
  const old=await workConversationMessage({projectDir:f.dir,conversationId:id,messageId:'historical-report',
    apiKey:fakeCredential,fetchImpl:f.fetchImpl});
  assert.equal(old.run.status,'completed');
  const result=await g.get(path).then(r=>r.json());
  const history=result.messages.find(m=>m.id==='historical-report');
  assert.equal(history.status,'completed');
  assert.match(history.output.report.text,/0\.20%/);
  assert.equal((await g.get(path+'/messages/historical-report/report.md')).status,200);
  const blocked=await g.post(path+'/messages/historical-pending/work',{});
  assert.equal(blocked.status,409);
  assert.equal((await blocked.json()).error,'GUI_LIVE_LEGACY_RETRY_DISABLED');
  assert.equal(f.requests(),3);
});

for (const status of [403,429]) test('owner Go HTTP '+status+' is visible and retains an unknown receipt without replay',async t=>{
  const f=await fixture(t,goConfig);
  let attempts=0;
  const fetchImpl=async(url,opts,context)=>{
    attempts++;
    assert.equal(String(url),goConfig.gateway.endpoint);
    assert.equal(opts.redirect,'error');
    const headers=new Headers(opts.headers);
    assert.equal(headers.get('x-opencode-session'),'open-etf-agent-'+hash(context.rootId));
    assert.equal(headers.get('user-agent'),'open-etf-agent/0.27');
    return new Response('synthetic provider detail to omit '+fakeCredential,{status});
  };
  const g=await f.launch({fetchImpl});
  const ws=await g.get('/api/workspace').then(r=>r.json());
  const {id}=await g.post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  const input={messageId:'provider-refusal',question:'Synthetic refusal fixture'};
  assert.equal((await g.post(path+'/messages',input)).status,202);
  let view;
  for (let i=0;i<120;i++) {
    view=await g.get(path).then(r=>r.json());
    if(view.messages[0]?.status==='failed') break;
    await delay(25);
  }
  const [failed]=view.messages;
  assert.equal(failed.status,'failed');
  assert.equal(failed.code,'PROVIDER_HTTP_'+status);
  assert.doesNotMatch(JSON.stringify(view),/synthetic provider detail|unit-test-placeholder/);
  const readUsage=()=>inspectResearchCapacity({projectDir:f.dir,runId:failed.runId});
  const original=await readUsage();
  assert.equal(original.requests.length,1);
  assert.equal(original.requests[0].state,'unknown');
  assert.equal(original.requests[0].localRelease,undefined);
  assert.equal(attempts,1);
  await g.close();
  const reopened=await f.launch({fetchImpl});
  assert.deepEqual(await reopened.get(path).then(r=>r.json()),view);
  assert.equal((await reopened.post(path+'/messages',input)).status,202);
  assert.equal((await reopened.post(path+'/messages/'+input.messageId+'/work',{})).status,409);
  assert.equal(attempts,1);
  assert.deepEqual(await readUsage(),original);
});

test('explicit owner five-lane mode dispatches independent conversations and preserves exact replay',async t=>{
  const f=await fixture(t,goConfig),pending=[];
  let peak=0,active=0,calls=0;
  const options={env:{...env,ETF_GUI_CONCURRENT_ADMISSION:'1'},fetchImpl:async(_,o)=>{
    calls++;active++;peak=Math.max(peak,active);
    return new Promise((resolve,reject)=>{
      const abort=()=>{active--;reject(o.signal.reason);};
      o.signal.addEventListener('abort',abort,{once:true});
      pending.push(()=>{o.signal.removeEventListener('abort',abort);active--;resolve(choice({content:'synthetic answer'},'stop'));});
    });
  }};
  const gui=await f.launch(options),secondHost=await f.launch(options);
  const ids=[];
  for(let i=0;i<6;i++)ids.push((await gui.post('/api/conversations',{}).then(r=>r.json())).id);
  const path=i=>'/api/conversations/'+ids[i];
  const send=(i,messageId='one')=>gui.post(path(i)+'/messages',{messageId,question:'Synthetic query.'});
  const first=await Promise.all(ids.slice(0,5).map((_,i)=>send(i)));
  assert.deepEqual(first.map(r=>r.status),[202,202,202,202,202]);
  for(let i=0;i<120&&pending.length!==5;i++)await delay(20);
  assert.equal(pending.length,5);
  assert.equal(peak,5);
  const over=await send(5);assert.equal(over.status,409);assert.equal((await over.json()).error,'GUI_WORKER_BUSY');
  const same=await send(0,'another');assert.equal(same.status,409);
  assert.equal((await send(0)).status,202);
  assert.equal(calls,5);
  // A second GUI instance has no process-local knowledge of the first five.
  // The original SQLite admission ledger must independently queue its dispatch.
  const sixth=await secondHost.post(path(5)+'/messages',{messageId:'one',question:'Synthetic query.'});
  assert.equal(sixth.status,202);
  const {runId}=await sixth.json();
  let sixthQueued=false;
  for(let i=0;i<120&&!sixthQueued;i++){
    sixthQueued=(await inspectResearchCapacity({projectDir:f.dir,runId})).requests.some(r=>r?.state==='queued');
    if(!sixthQueued)await delay(20);
  }
  assert.equal(sixthQueued,true);assert.equal(calls,5);
  pending.shift()();
  for(let i=0;i<120&&calls!==6;i++)await delay(20);
  assert.equal(calls,6);assert.equal(peak,5);assert.equal(pending.length,5);
  pending.splice(0).forEach(release=>release());
  await Promise.all(ids.map((_,i)=>settled(gui,path(i))));
});

test('owner five-lane startup releases a mature legacy unknown without dispatch or changing the original run',async t=>{
  const f=await fixture(t,goConfig);let calls=0;
  const base=await f.launch({fetchImpl:async()=>{calls++;throw new Error('Synthetic connection loss');}});
  const id=(await base.post('/api/conversations',{}).then(r=>r.json())).id,path='/api/conversations/'+id;
  const input={messageId:'one',question:'Synthetic old question.'};
  const response=await base.post(path+'/messages',input);
  assert.equal(response.status,202);
  const {runId}=await response.json();
  let before;
  for(let i=0;i<120;i++){
    before=(await base.get(path).then(r=>r.json())).messages[0];
    if(before.status==='failed')break;
    await delay(20);
  }
  assert.equal(before.status,'failed');
  await base.close();
  const original=(await inspectResearchCapacity({projectDir:f.dir,runId})).requests[0];
  assert.equal(original.state,'unknown');assert.equal(original.localRelease,undefined);
  t.mock.timers.enable({apis:['Date'],now:original.updatedAt+180000});
  const reopened=await f.launch({env:{...env,ETF_GUI_CONCURRENT_ADMISSION:'1'},fetchImpl:async()=>{calls++;return choice({content:'not used'},'stop');}});
  const projected=(await inspectResearchCapacity({projectDir:f.dir,runId})).requests[0];
  assert.equal(projected.state,'unknown');
  assert.equal(projected.localRelease.remoteOutcome,'unknown');assert.equal(projected.localRelease.billingOutcome,'unknown');
  assert.equal(projected.ticketSha256,original.ticketSha256);
  assert.deepEqual((await reopened.get(path).then(r=>r.json())).messages[0],before);
  assert.equal((await reopened.post(path+'/messages',input)).status,202);assert.equal(calls,1);
});
