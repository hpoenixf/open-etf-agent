import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { prepareOwnerLangfuse } from '../src/gui-langfuse.mjs';
import { startLocalGui } from '../src/gui-server.mjs';
const keys={
  ETF_LANGFUSE_ENABLED:'1',ETF_LANGFUSE_REGION:'us',
  ETF_LANGFUSE_PUBLIC_KEY:'pk-lf-synthetic-for-test',ETF_LANGFUSE_SECRET_KEY:'sk-lf-synthetic-for-test',
  ETF_LANGFUSE_TRACE_SALT:'trace-synthetic-identifier-salt-only-do-not-use',
  ETF_GUI_PROVIDER_KEY:'model-test-synthetic-key',
};
async function project(t){
  await mkdir('test-output',{recursive:true});
  const dir=await mkdtemp(resolve('test-output/gui-tel-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  return dir;
}
const captures=x=>JSON.parse(x.body).resourceSpans[0].scopeSpans[0].spans;
const value=(span,key)=>span.attributes.find(a=>a.key===key)?.value.stringValue;
test('disabled or missing opt-in secrets has no observer and sends nothing',()=>{
  assert.equal(prepareOwnerLangfuse({}),null);
  assert.equal(prepareOwnerLangfuse({...keys,ETF_LANGFUSE_TRACE_SALT:''}),null);
});
test('original gateway facts, publication and failed terminal are separate, no duplicated network request',async t=>{
  const dir=await project(t); const sent=[];
  const opts={send:async(url,request)=>{sent.push({url,...request});return Response.json({partialSuccess:{rejectedSpans:'1'}});}};
  const exporter=prepareOwnerLangfuse(keys,opts), trace=exporter.start();
  trace.observe({type:'model-transport',ordinal:1,model:'test-provider',status:'unknown',at:Date.now(),end:Date.now(),code:'NOT_A_REASON',usage:null,token:'secret-prompt'});
  trace.observe({type:'model-transport',ordinal:1,status:'responded'}); // replay same attempt
  trace.observe({type:'tool-result',toolId:'provider-private-call-identity',name:'read_page',status:'succeeded',dispatched:true,at:Date.now(),duration:45,raw:'private-url'});
  trace.finish(dir,{runId:'private-conversation-id',status:'failed',code:'ROOT_BUDGET_EXHAUSTED',delivery:'publication',modelUsed:1});
  await exporter.drain();
  const reopened=prepareOwnerLangfuse(keys,opts), observer=reopened.start();
  observer.observe({type:'model-transport',ordinal:1,status:'unknown'});
  observer.finish(dir,{runId:'private-conversation-id',status:'failed',delivery:'not-created'});
  await reopened.drain();
  for(let i=0;i<90;i++){
    let files=[];try{files=await readdir(join(dir,'langfuse-export'));}catch{}
    if(files.some(x=>x.endsWith('.settled.json')))break;
    await delay(20);
  }
  assert.equal(sent.length,1);
  assert.equal(sent[0].url,'https://us.cloud.langfuse.com/api/public/otel/v1/traces');
  assert.equal(sent[0].headers['x-langfuse-ingestion-version'],'4');
  assert.doesNotMatch(sent[0].body,/secret-prompt|private-url|private-conversation-id|provider-private-call-identity|sk-lf-/);
  const spans=captures(sent[0]);assert.equal(spans.length,4);
  assert.equal(value(spans[0],'langfuse.observation.metadata.runtime_status'),'failed');
  assert.equal(value(spans[0],'langfuse.observation.metadata.delivery_status'),'published');
  assert.equal(value(spans[1],'langfuse.observation.metadata.dispatch_status'),'unknown');
  assert.equal(value(spans[1],'langfuse.observation.usage_details'),undefined);
  assert.ok(spans.slice(1).every(s=>s.parentSpanId===spans[0].spanId&&s.traceId===spans[0].traceId));
  const file=(await readdir(join(dir,'langfuse-export'))).find(x=>x.endsWith('.settled.json'));
  assert.equal(JSON.parse(await readFile(join(dir,'langfuse-export',file),'utf8')).state,'partial');
});
test('GUI-native Admission and Publication work once even when metadata sink rejects',async t=>{
  const dir=await project(t); let model=0;const logs=[];
  const gui=await startLocalGui({projectDir:dir,env:keys,liveConfig:{
    gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'fixture-real-gateway',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
    limits:{model:2},
  },fetchImpl:async()=>{model++;return Response.json({choices:[{message:{role:'assistant',content:'Synthetic protected answer'},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:8,total_tokens:20,raw:'secret'}});},
  langfuseOptions:{send:async(url,request)=>{logs.push({url,...request});throw Error('unavailable');}}});
  t.after(()=>gui.close());
  const post=(p,b)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(b)});
  const {id}=await post('/api/conversations',{}).then(r=>r.json());const path='/api/conversations/'+id;
  assert.ok((await post(path+'/messages',{messageId:'mail-debug',question:'Synthetic private prompt'})).ok);
  let body;for(let i=0;i<120;i++){body=await fetch(gui.origin+path).then(r=>r.json());if(logs.length&&body.messages[0]?.status==='completed')break;await delay(25);}
  assert.equal(model,1);assert.equal(logs.length,1);
  assert.equal(body.messages[0].output.answer,'Synthetic protected answer');
  assert.doesNotMatch(logs[0].body,/Synthetic|model-test|secret|mail-debug/);
  const spans=captures(logs[0]);
  assert.equal(value(spans[1],'langfuse.observation.usage_details'),'{"input":12,"output":8,"total":20}');
  assert.equal(value(spans[0],'langfuse.observation.metadata.delivery_status'),'published');
  await fetch(gui.origin+path);await delay(20);
  assert.equal(model,1);assert.equal(logs.length,1);
});
test('normal GUI keeps exact saved body available while telemetry hangs; model, tool and delivery remain distinct',async t=>{
  const dir=await project(t); const sent=[]; let requests=0, release;
  const pending=new Promise(resolve=>{release=resolve;});
  t.after(()=>release(new Response(null,{status:204})));
  const gui=await startLocalGui({projectDir:dir,env:keys, liveConfig:{
    gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'fixture-real-gateway',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
    limits:{model:4},connectivity:{web:true},
  },fetchImpl:async()=>{
    requests++;
    if(requests===1)return Response.json({choices:[{message:{role:'assistant',tool_calls:[{id:'raw-tool-identity',type:'function',function:{name:'public_web_continue',arguments:'{"cursor":"private-cursor"}'}}]},finish_reason:'tool_calls'}]});
    return Response.json({choices:[{message:{role:'assistant',content:'Persisted even while export is pending'},finish_reason:'stop'}]});
  },langfuseOptions:{send:async(url,request)=>{sent.push({url,...request});return pending;}}});
  t.after(()=>gui.close());
  const post=(p,b)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(b)});
  const {id}=await post('/api/conversations',{}).then(r=>r.json());const path='/api/conversations/'+id;
  const input={messageId:'unexported-message-id',question:'Synthetic private prompt'};
  assert.equal((await post(path+'/messages',input)).status,202);
  // A telemetry attempt and the public body may become visible on different
  // ticks. Wait for both while the exporter is still deliberately blocked.
  let exact;
  for(let i=0;i<120;i++){
    exact=await fetch(gui.origin+path+'/messages/'+input.messageId+'/body').then(r=>r.json());
    if(sent.length&&exact.body?.text!==undefined)break;
    await delay(25);
  }
  assert.equal(exact?.body?.text,'Persisted even while export is pending');
  assert.equal(requests,2);assert.equal(sent.length,1);
  const spans=captures(sent[0]), byType=type=>spans.filter(s=>value(s,'langfuse.observation.type')===type);
  assert.equal(byType('generation').length,2);
  assert.equal(byType('tool').length,1);
  assert.equal(byType('event').length,1);
  assert.equal(value(byType('tool')[0],'langfuse.observation.metadata.tool_name'),'public_web_continue');
  assert.equal(value(byType('agent')[0],'langfuse.observation.metadata.delivery_status'),'published');
  assert.doesNotMatch(sent[0].body,/private-cursor|raw-tool-identity|unexported-message-id|Synthetic private prompt|Persisted even/);
  assert.equal((await post(path+'/messages',input)).status,202);
  release(new Response(null,{status:204}));
  assert.equal(requests,2);assert.equal(sent.length,1);
});
