import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startLocalGui } from '../src/gui-server.mjs';
import { openOwnerWeb } from '../src/gui-owner-web.mjs';
import { inspectResearchCapacity } from '../src/research-project.mjs';

const config={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',
 model:'synthetic-go-model',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4}};
const env={ETF_GUI_PROVIDER_KEY:'fixture-placeholder'};
const profile={web:true,search:'exa-public-preview'};
const url='https://example.com/gold';
const manifestSha256='a'.repeat(64),originalSha256='b'.repeat(64);
const safeSource={manifestSha256,catalog:{documents:[{pages:['Public static text about a historical gold market date.'],
 web:{requestedUrl:url,finalUrl:url,retrievedAt:'2026-11-21T00:00:00.000Z',originalSha256}}]}};
const spec=(name,args)=>Response.json({choices:[{message:{role:'assistant',tool_calls:[
 {type:'function',id:name,function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]});
async function scratch(t) {
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/owner-web-'));
 t.after(()=>rm(projectDir,{recursive:true,force:true}));
 return projectDir;
}
test('owner can enable explicitly bound search/read on an existing Project; mock search, read, citation, and cold restore',async t=>{
 const projectDir=await scratch(t),instances=[];
 t.after(async()=>{for(const instance of instances)await instance.close();});
 let modelCalls=0,searchCalls=0,pageCalls=0,stored=null;
 const ownerWebTransport={
  async searchFetch(endpoint,opts){
   searchCalls++;
   assert.equal(endpoint,'https://mcp.exa.ai/mcp');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.headers.authorization,undefined);
   const request=JSON.parse(opts.body);
   assert.equal(request.params.name,'web_search_exa');
   assert.deepEqual(request.params.arguments,{query:'gold historical market data',numResults:3,type:'auto',livecrawl:'fallback'});
   return new Response('event: message\ndata: '+JSON.stringify({jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:url}]}})+'\n\n',{headers:{'content-type':'text/event-stream'}});
  },
  async acquire(input){
   pageCalls++;assert.deepEqual(input.urls,[url]);
   assert.equal(input.approvePublicFetch,true);
   assert.equal(input.allowedRedirectUrls,undefined);
   stored=input.acquisitionId;
   return safeSource;
  },
  async inspect(input){assert.equal(input.acquisitionId,stored);return {status:'succeeded',manifestSha256,plan:{urls:[url]}};},
  async load(input){assert.equal(input.manifestSha256,manifestSha256);return safeSource;},
 };
 const fetchImpl=async (_url,options)=>{
  modelCalls++;
  const body=JSON.parse(options.body),toolResults=body.messages.filter(m=>m.role==='tool');
  assert.ok(body.messages[0].content.startsWith('金价下跌的常见原因和近期行情？'));
  assert.doesNotMatch(body.messages[0].content,/Alpha ETF|Beta ETF/);
  assert.deepEqual(body.tools.map(x=>x.function.name),['public_web_read','public_web_search']);
  if(!toolResults.length)return spec('public_web_search',{query:'gold historical market data'});
  if(toolResults.length===1)return spec('public_web_read',{url});
  const result=JSON.parse(toolResults[1].content).value;
  assert.equal(result.url,url);
  assert.equal(result.manifestSha256,manifestSha256);
  assert.equal(result.originalSha256,originalSha256);
  assert.match(result.text,/historical gold/);
  return Response.json({choices:[{message:{role:'assistant',content:'Reference: '+url},finish_reason:'stop'}]});
 };
 async function launch(connectivity){
  const gui=await startLocalGui({projectDir,liveConfig:{...config,...(connectivity?{connectivity}:{})},
   env,fetchImpl,ownerWebTransport});
  instances.push(gui);
  const get=path=>fetch(gui.origin+path);
  const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  return {...gui,get,post};
 }
 const original=await launch(),originalProject=(await original.get('/api/workspace').then(r=>r.json())).projectId;
 await original.close();
 const g=await launch(profile);
 const ws=await g.get('/api/workspace').then(r=>r.json());
 assert.equal(ws.projectId,originalProject);
 assert.deepEqual(ws.liveNotice.connectivity,{web:true,search:true,wind:false});
 assert.deepEqual(ws.sources,[]);
 assert.equal(modelCalls,0);
 const conversation=(await g.post('/api/conversations',{}).then(r=>r.json())).id;
 const path='/api/conversations/'+conversation,input={messageId:'web-turn',question:'金价下跌的常见原因和近期行情？'};
 assert.equal((await g.post(path+'/messages',input)).status,202);
 let result;
 for(let i=0;i<160;i++){
  result=await g.get(path).then(r=>r.json());
  if(result.messages[0]?.status==='completed'||result.messages[0]?.status==='failed')break;
  await delay(25);
 }
 const [turn]=result.messages;
 assert.equal(turn.status,'completed',JSON.stringify(turn));
 assert.equal(turn.output.answer,'Reference: '+url);
 assert.equal(turn.sourceId,null);
 assert.equal((await inspectResearchCapacity({projectDir,runId:turn.runId})).requests.length,3);
 assert.deepEqual([modelCalls,searchCalls,pageCalls],[3,1,1]);
 await g.close();
 const cold=await launch(profile);
 assert.deepEqual(await cold.get(path).then(r=>r.json()),result);
 assert.equal((await cold.post(path+'/messages',input)).status,202);
 assert.deepEqual([modelCalls,searchCalls,pageCalls],[3,1,1]);
});

test('page uses native HTTPS syntax guard, and Exa quota is never retried with same owner call ID',async t=>{
 const projectDir=await scratch(t);
 let requests=0;
 const tools=openOwnerWeb({profile,projectDir,runId:'one-run',transport:{
  searchFetch:async (_url,options)=>{
   requests++;
   const id=JSON.parse(options.body).id;
   return Response.json({jsonrpc:'2.0',id,result:{_meta:{'ai.exa/rateLimited':true},content:[{type:'text',text:'not a result'}]}});
  },
 }});
 const [page,search]=tools;
 assert.throws(()=>page.validate({url:'https://127.0.0.1/a'}),{code:'WEB_URL_INVALID'});
 assert.throws(()=>page.validate({url:'http://example.com/a'}),{code:'WEB_URL_INVALID'});
 const query={query:'gold data'},context={callId:'original-search'};
 await assert.rejects(search.execute(query,context),{code:'WEB_SEARCH_QUOTA'});
 assert.equal(await search.reconcile(query,context),null);
 await assert.rejects(search.execute(query,context),{code:'WEB_SEARCH_ALREADY_HELD'});
 assert.equal(requests,1);
});
