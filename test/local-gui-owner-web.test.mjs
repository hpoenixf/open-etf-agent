import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startLocalGui } from '../src/gui-server.mjs';
import { openOwnerWeb, prepareOwnerSearch } from '../src/gui-owner-web.mjs';
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
test('owner can enable explicitly bound search/read on an existing Project; fragment reads one original document and cold restores',async t=>{
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
  assert.deepEqual(body.tools.map(x=>x.function.name),['public_web_read','public_web_continue','public_web_search']);
  if(!toolResults.length)return spec('public_web_search',{query:'gold historical market data'});
  if(toolResults.length===1)return spec('public_web_read',{url:url+'#market-history'});
  const result=JSON.parse(toolResults[1].content).value;
  assert.equal(result.url,url);
  assert.doesNotMatch(JSON.stringify(result),/market-history/);
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
 assert.deepEqual(ws.liveNotice.connectivity,{web:true,search:true,searchProvider:'exa-public-preview',wind:false});
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
 for(const rejected of [
  'http://example.com/a#section',
  'https://127.0.0.1/a#section',
  'https://user:pass@example.com/a#section',
  'https://example.com./a#section',
  'https://example.com:9999/a#section',
  'https://example.com/a#invalid\n',
  'https://example.com/a#invalid\\suffix',
  'https://example.com/a#'+'a'.repeat(2048),
 ])assert.throws(()=>page.validate({url:rejected}),{code:'WEB_URL_INVALID'});
 const query={query:'gold data'},context={callId:'original-search'};
 const unavailable=await search.execute(query,context);
 assert.equal(unavailable.reason,'WEB_SEARCH_QUOTA');
 assert.equal(unavailable.requestOutcome,'response-observed');
 assert.deepEqual(await search.reconcile(query,context),unavailable);
 await assert.rejects(search.execute(query,context),{code:'WEB_SEARCH_ALREADY_HELD'});
 assert.equal(requests,1);
});

test('DeepSeek is server opt-in and discloses provider; never sends full question or inference credential',async t=>{
 const projectDir=await scratch(t);
 const connectivity={web:true,search:'deepseek-search'};
 await assert.rejects(startLocalGui({projectDir,liveConfig:{...config,connectivity},env}),{code:'GUI_DEEPSEEK_SEARCH_API_KEY_REQUIRED'});
 let searchCalls=0;
 const key='synthetic-search-placeholder';
 const fetchImpl=async (_endpoint,opts)=>{
  assert.equal(opts.headers.authorization,'Bearer fixture-placeholder');
  const body=JSON.parse(opts.body);
  const tools=body.messages.filter(m=>m.role==='tool');
  if(!tools.length)return spec('public_web_search',{query:'gold prices yesterday'});
  const result=JSON.parse(tools[0].content).value;
  assert.deepEqual(result,{kind:'public-web-search@1',provider:'deepseek-search',
   hits:[{title:'Gold paper',url,summary:'public excerpt',publishedDate:'2026-11-21'}]});
  return Response.json({choices:[{message:{role:'assistant',content:'Discovery result: '+url},finish_reason:'stop'}]});
 };
 const gui=await startLocalGui({projectDir,liveConfig:{...config,connectivity},env:{...env,WEB_RESEARCH_DEEPSEEK_API_KEY:key},fetchImpl,
  ownerWebTransport:{async searchFetch(endpoint,opts){
   searchCalls++;
   assert.equal(endpoint,'https://api.deepseek.com/v1/tools/search');
   assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');
   assert.equal(opts.headers.authorization,'Bearer '+key);
   assert.deepEqual(JSON.parse(opts.body),{query:'gold prices yesterday',count:3,need_content:false});
   return Response.json({results:[{title:'Gold paper',url,snippet:'public excerpt',date:'2026-11-21',content:'must not reach model',authority:'not evidence'},
    {title:'HTTP',url:'http://example.com/unsafe'}]});
  }}});
 t.after(()=>gui.close());
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const ws=await get('/api/workspace');
 assert.deepEqual(ws.liveNotice.connectivity,{web:true,search:true,searchProvider:'deepseek-search',wind:false});
 assert.doesNotMatch(JSON.stringify(ws),/synthetic-search-placeholder|WEB_RESEARCH_DEEPSEEK_API_KEY/);
 assert.equal(searchCalls,0);
 const conversation=(await post('/api/conversations',{}).then(r=>r.json())).id;
 const path='/api/conversations/'+conversation;
 assert.equal((await post(path+'/messages',{messageId:'deepseek-search-turn',question:'Private conversation detail, public gold prices yesterday?'})).status,202);
 let thread;
 for(let i=0;i<160;i++){
  thread=await get(path);
  if(['completed','failed'].includes(thread.messages[0]?.status))break;
  await delay(25);
 }
 assert.equal(thread.messages[0].status,'completed',JSON.stringify(thread));
 assert.equal(thread.messages[0].output.answer,'Discovery result: '+url);
 assert.equal(searchCalls,1);
});

test('DeepSeek errors are explicit, no retry/fallback or response leakage, Unicode count is vendor bound',async t=>{
 const projectDir=await scratch(t);
 const expected=new Map([[401,'WEB_SEARCH_AUTH'],[402,'WEB_SEARCH_PAYMENT_REQUIRED'],[403,'WEB_SEARCH_FORBIDDEN'],[429,'WEB_SEARCH_QUOTA']]);
 const settings=prepareOwnerSearch('deepseek-search',{WEB_RESEARCH_DEEPSEEK_API_KEY:'synthetic-search-placeholder'});
 let calls=0;
 for(const [status,code] of expected){
  const [,search]=openOwnerWeb({profile:{web:true,search:'deepseek-search'},projectDir,runId:'run-'+status,searchSettings:settings,
   transport:{searchFetch:async endpoint=>{
    assert.equal(endpoint,'https://api.deepseek.com/v1/tools/search');calls++;
    return new Response('must not leak proprietary error detail',{status});
   }}});
  assert.doesNotThrow(()=>search.validate({query:'中'.repeat(128)}));
  assert.throws(()=>search.validate({query:'中'.repeat(129)}),{code:'WEB_SEARCH_QUERY_INVALID'});
  const input={query:'gold'},context={callId:'one'};
  const unavailable=await search.execute(input,context);
  assert.equal(unavailable.reason,code);
  assert.doesNotMatch(JSON.stringify(unavailable),/proprietary/);
  assert.deepEqual(await search.reconcile(input,context),unavailable);
  await assert.rejects(search.execute(input,context),{code:'WEB_SEARCH_ALREADY_HELD'});
 }
 assert.equal(calls,4);
});

test('Yuanbao sends Query only, projects safe Pages evidence and honors HTTP-200 business errors',async t=>{
 const projectDir=await scratch(t);
 const connectivity={web:true,search:'yuanbao-search'};
 await assert.rejects(startLocalGui({projectDir,liveConfig:{...config,connectivity},env}),{code:'GUI_YUANBAO_SEARCH_API_KEY_REQUIRED'});
 const searchSettings=prepareOwnerSearch('yuanbao-search',{WEB_RESEARCH_YUANBAO_API_KEY:'synthetic-wsa-placeholder'});
 let calls=0;
 const [,tool]=openOwnerWeb({profile:connectivity,projectDir,runId:'test-yuanbao',searchSettings,transport:{async searchFetch(endpoint,opts){
  calls++;
  assert.equal(endpoint,'https://api.wsa.cloud.tencent.com/SearchPro');
  assert.equal(opts.headers.authorization,'Bearer synthetic-wsa-placeholder');
  assert.equal(opts.redirect,'error');
  assert.deepEqual(JSON.parse(opts.body),{Query:'gold data'});
  return Response.json(calls===1?{Response:{Pages:[JSON.stringify({url,title:'Gold index',passage:'Historical close',date:'2026-11-21',score:100}),JSON.stringify({url:'http://example.com/private',title:'skip'})]}}:
   {Response:{Error:{Code:'RequestLimitExceeded',Message:'private upstream diagnostic'}}});
 }}});
 const input={query:'gold data'}, first={callId:'yuanbao-first'}, second={callId:'yuanbao-second'};
 const value=await tool.execute(input,first);
 assert.deepEqual(value,{kind:'public-web-search@1',provider:'yuanbao-search',hits:[{url,title:'Gold index',summary:'Historical close',publishedDate:'2026-11-21'}]});
 assert.deepEqual(await tool.reconcile(input,first),value);
 assert.equal((await tool.execute(input,second)).reason,'WEB_SEARCH_QUOTA');
 await assert.rejects(tool.execute(input,second),{code:'WEB_SEARCH_ALREADY_HELD'});
 assert.equal(calls,2);
});

test('multi-provider profile advertises deliberate alternatives and gates paid search behind successful Exa for this Worker',async t=>{
 const projectDir=await scratch(t);
 const profile={web:true,search:'exa-public-preview',searchAlternates:['deepseek-search','yuanbao-search']};
 const configured={...env,WEB_RESEARCH_DEEPSEEK_API_KEY:'synthetic-deepseek',WEB_RESEARCH_YUANBAO_API_KEY:'synthetic-yuanbao'};
 await assert.rejects(startLocalGui({projectDir,liveConfig:{...config,connectivity:profile},env}),{code:'GUI_DEEPSEEK_SEARCH_API_KEY_REQUIRED'});
 await assert.rejects(startLocalGui({projectDir,liveConfig:{...config,connectivity:{...profile,searchAlternates:['deepseek-search','deepseek-search']}},env:configured}),{code:'PROJECT_OWNER_CONNECTIVITY'});
 const gui=await startLocalGui({projectDir,liveConfig:{...config,connectivity:profile},env:configured});
 t.after(()=>gui.close());
 const ws=await fetch(gui.origin+'/api/workspace').then(r=>r.json());
 assert.deepEqual(ws.liveNotice.connectivity.searchAlternates,profile.searchAlternates);
 assert.doesNotMatch(JSON.stringify(ws),/synthetic-deepseek|synthetic-yuanbao/);
 const settings=Object.fromEntries(profile.searchAlternates.map(p=>[p,prepareOwnerSearch(p,configured)]));
 let failFree=false; const endpoints=[];
 const args={profile,projectDir,runId:'combined-providers',searchSettings:settings,transport:{async searchFetch(endpoint,opts){
  endpoints.push(endpoint);
  const body=JSON.parse(opts.body);
  if(endpoint==='https://mcp.exa.ai/mcp')return failFree?new Response(null,{status:429}):Response.json({jsonrpc:'2.0',id:body.id,result:{content:[{type:'text',text:'Free search did not cover the narrow gap.'}]}});
  if(endpoint==='https://api.deepseek.com/v1/tools/search')return Response.json({results:[]});
  assert.equal(endpoint,'https://api.wsa.cloud.tencent.com/SearchPro');
  return Response.json({Response:{Pages:[]}});
 }}};
 const [,free,deepSeek,yuanbao]=openOwnerWeb(args);
 assert.deepEqual([free.name,deepSeek.name,yuanbao.name],['public_web_search','public_web_search_deepseek','public_web_search_yuanbao']);
 const input={query:'gold'};
 assert.equal((await deepSeek.execute(input,{callId:'too-early'})).requestOutcome,'not-dispatched');
 await free.execute(input,{callId:'first-free'});
 assert.equal((await deepSeek.execute(input,{callId:'paid-deepseek'})).provider,'deepseek-search');
 assert.equal((await yuanbao.execute(input,{callId:'paid-yuanbao'})).provider,'yuanbao-search');
 failFree=true;
 assert.equal((await free.execute(input,{callId:'quota-free'})).reason,'WEB_SEARCH_QUOTA');
 assert.equal((await deepSeek.execute(input,{callId:'after-quota'})).reason,'WEB_SEARCH_ALTERNATE_REQUIRES_FREE_RESULT');
 const reopened=openOwnerWeb(args)[2];
 assert.equal((await reopened.execute(input,{callId:'after-restart'})).reason,'WEB_SEARCH_ALTERNATE_REQUIRES_FREE_RESULT');
 assert.equal((await reopened.reconcile(input,{callId:'paid-deepseek'})).provider,'deepseek-search');
 assert.equal(endpoints.length,4);
});

test('successful Exa plus expected native page refusal still reaches a final answer and cold History',async t=>{
 const projectDir=await scratch(t),instances=[];
 t.after(async()=>{for(const item of instances)await item.close();});
 const held=new Map();let searchCalls=0,pageCalls=0,modelCalls=0;
 const ownerWebTransport={async searchFetch(_endpoint,options){
  searchCalls++;
  return Response.json({jsonrpc:'2.0',id:JSON.parse(options.body).id,result:{content:[{type:'text',text:url}]}});
 },async acquire({acquisitionId,urls}){
  pageCalls++;held.set(acquisitionId,{status:'failed',code:'WEB_ROBOTS_DELAY_UNSUPPORTED',plan:{urls},dispatchOutcomeKnown:true,unknownRequests:0});
  throw Object.assign(new Error('Sensitive raw upstream response'),{code:'WEB_ROBOTS_DELAY_UNSUPPORTED'});
 },async inspect({acquisitionId}){return held.get(acquisitionId);}};
 const fetchImpl=async (_endpoint,options)=>{
  modelCalls++;
  const body=JSON.parse(options.body),results=body.messages.filter(m=>m.role==='tool');
  if(!results.length)return spec('public_web_search',{query:'gold history'});
  assert.equal(JSON.parse(results[0].content).value.provider,'exa-public-preview');
  if(results.length===1)return spec('public_web_read',{url});
  const failed=JSON.parse(results[1].content).value;
  assert.equal(failed.status,'unavailable');
  assert.equal(failed.reason,'WEB_ROBOTS_DELAY_UNSUPPORTED');
  assert.equal(failed.requestOutcome,'no-unobserved-dispatch');
  assert.equal(failed.automaticReplayAllowed,false);
  assert.match(failed.observedAt,/^\d{4}-\d\d-\d\dT/);
  assert.doesNotMatch(JSON.stringify(failed),/Sensitive/);
  return Response.json({choices:[{message:{role:'assistant',content:'I could not verify the page; here is the general explanation.'},finish_reason:'stop'}]});
 };
 const launch=async()=>{const gui=await startLocalGui({projectDir,liveConfig:{...config,connectivity:profile},env,ownerWebTransport,fetchImpl});instances.push(gui);return gui;};
 const gui=await launch(),get=path=>fetch(gui.origin+path).then(r=>r.json());
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const conversation=(await post('/api/conversations',{}).then(r=>r.json())).id,path='/api/conversations/'+conversation;
 assert.equal((await post(path+'/messages',{messageId:'mixed-evidence',question:'Why do gold prices change?'})).status,202);
 let thread;
 for(let i=0;i<160;i++){
  thread=await get(path);
  if(['completed','failed'].includes(thread.messages[0]?.status))break;
  await delay(25);
 }
 assert.equal(thread.messages[0].status,'completed',JSON.stringify(thread));
 assert.match(thread.messages[0].output.answer,/could not verify/);
 assert.deepEqual([modelCalls,searchCalls,pageCalls],[3,1,1]);
 await gui.close();
 const cold=await launch();
 assert.deepEqual(await fetch(cold.origin+path).then(r=>r.json()),thread);
 assert.deepEqual([modelCalls,searchCalls,pageCalls],[3,1,1]);
});

test('Yuanbao MCP uses bounded HTTPS handshake and only SearchPro; SSE results reconcile without replay',async t=>{
 const projectDir=await scratch(t),connectivity={web:true,search:'yuanbao-mcp'};
 await assert.rejects(startLocalGui({projectDir,liveConfig:{...config,connectivity},env}),{code:'GUI_YUANBAO_SEARCH_API_KEY_REQUIRED'});
 const settings=prepareOwnerSearch('yuanbao-mcp',{WEB_RESEARCH_YUANBAO_API_KEY:'fixture-wsa'});
 const methods=[];let cancelled=false;
 const [,tool]=openOwnerWeb({profile:connectivity,projectDir,runId:'test-yuanbao-mcp',searchSettings:settings,
  transport:{async searchFetch(endpoint,opts){
   assert.equal(endpoint,'https://api.wsa.cloud.tencent.com/Mcp');
   assert.equal(opts.redirect,'error');
   assert.equal(opts.headers.authorization,'Bearer fixture-wsa');
   if(opts.method==='DELETE'){assert.equal(opts.headers['mcp-session-id'],'ymcp-1');methods.push('DELETE');return new Response(null,{status:405});}
   const req=JSON.parse(opts.body);
   methods.push(req.method);
   if(req.method==='initialize'){
    assert.equal(req.params.protocolVersion,'2025-06-18');
    assert.equal(opts.headers['mcp-session-id'],undefined);
    return Response.json({jsonrpc:'2.0',id:req.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}}}},
     {headers:{'mcp-session-id':'ymcp-1'}});
   }
   assert.equal(opts.headers['mcp-session-id'],'ymcp-1');
   assert.equal(opts.headers['mcp-protocol-version'],'2025-06-18');
   if(req.method==='notifications/initialized'){
    assert.ok(!Object.hasOwn(req,'id'));
    return new Response(null,{status:202});
   }
   assert.equal(req.method,'tools/call');
   assert.deepEqual(req.params,{name:'SearchPro',arguments:{Query:'基金指数编制公告',Mode:0,Cnt:10}});
   const result={jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:JSON.stringify({Response:{Pages:[
    JSON.stringify({url,title:'公开公告',passage:'摘要',date:'2026-11-21',score:1}),
    JSON.stringify({url:'http://example.com/http-only',title:'不可读'}),JSON.stringify({url:'https://127.0.0.1/internal',title:'私网'}),
   ]}})}]}};
   const encoder=new TextEncoder();
   const bytes=encoder.encode('event: message\r\ndata: {"jsonrpc":"2.0","method":"notifications/message"}\r\n\r\ndata: '+JSON.stringify(result)+'\r\n\r\n');
   const split=bytes.indexOf(0xe5)+1;
   return new Response(new ReadableStream({start(c){c.enqueue(bytes.subarray(0,split));c.enqueue(bytes.subarray(split));},cancel(){cancelled=true;}}),
    {headers:{'content-type':'text/event-stream'}});
  }}});
 assert.throws(()=>tool.validate({query:'中'.repeat(501)}),{code:'WEB_SEARCH_QUERY_INVALID'});
 assert.doesNotThrow(()=>tool.validate({query:'中'.repeat(500)}));
 const args={query:'基金指数编制公告'},ctx={callId:'mcp-1'};
 const value=await tool.execute(args,ctx);
 assert.deepEqual(value,{kind:'public-web-search@1',provider:'yuanbao-mcp',hits:[{url,title:'公开公告',summary:'摘要',publishedDate:'2026-11-21'}]});
 assert.ok(cancelled);
 assert.deepEqual(await tool.reconcile(args,ctx),value);
 await assert.rejects(tool.execute(args,ctx),{code:'WEB_SEARCH_ALREADY_HELD'});
 assert.deepEqual(methods,['initialize','notifications/initialized','tools/call','DELETE']);
});

test('Yuanbao MCP fails closed on session/auth and reports tool quota without leaking diagnostics',async t=>{
 const projectDir=await scratch(t),connectivity={web:true,search:'exa-public-preview',searchAlternates:['yuanbao-search','yuanbao-mcp']};
 const settings=Object.fromEntries(connectivity.searchAlternates.map(p=>[p,prepareOwnerSearch(p,{WEB_RESEARCH_YUANBAO_API_KEY:'fixture-wsa'})]));
 let scenario='permission',calls=0;
 const [,free,rest,mcp]=openOwnerWeb({profile:connectivity,projectDir,runId:'yuanbao-failures',searchSettings:settings,
  transport:{async searchFetch(endpoint,opts){
   calls++;
   const req=JSON.parse(opts.body);
   if(endpoint==='https://mcp.exa.ai/mcp')return Response.json({jsonrpc:'2.0',id:req.id,result:{content:[{type:'text',text:'Exa result'}]}});
   if(scenario==='permission')return new Response('do not disclose auth failure detail',{status:401});
   if(req.method==='initialize')return Response.json({jsonrpc:'2.0',id:req.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}}}});
   if(req.method==='notifications/initialized')return new Response(null,{status:202});
   if(scenario==='oversize')return new Response('X'.repeat(2*1024*1024+1),{headers:{'content-type':'application/json'}});
   if(scenario==='wrong-id')return Response.json({jsonrpc:'2.0',id:'not-the-request',result:{structuredContent:{Pages:[]}}});
   return Response.json({jsonrpc:'2.0',id:req.id,result:{isError:true,structuredContent:{Error:{Code:'RequestLimitExceeded',Message:'private provider detail'}}}});
  }}});
 assert.equal(rest.name,'public_web_search_yuanbao');
 assert.equal(mcp.name,'public_web_search_yuanbao_mcp');
 const input={query:'公开指数公告'};
 assert.equal((await mcp.execute(input,{callId:'blocked'})).requestOutcome,'not-dispatched');
 assert.equal(calls,0);
 const cases=[['permission','WEB_SEARCH_AUTH'],['quota','WEB_SEARCH_QUOTA'],['oversize','WEB_SEARCH_BODY_LIMIT'],['wrong-id','WEB_SEARCH_RESPONSE_INVALID']];
 for(const [kind,expected] of cases){
  scenario=kind;
  await free.execute(input,{callId:'exa-'+kind});
  const result=await mcp.execute(input,{callId:kind});
  assert.equal(result.reason,expected);
  assert.doesNotMatch(JSON.stringify(result),/private provider detail|fixture-wsa|disclose auth/);
 }
 assert.equal(calls,14);
});

test('Yuanbao MCP owner GUI sends public keywords only and reads original evidence before citation',async t=>{
 const projectDir=await scratch(t),connectivity={web:true,search:'yuanbao-mcp'};
 let requests=0,pages=0,acquisitionId;
 const gui=await startLocalGui({projectDir,liveConfig:{...config,connectivity},
  env:{...env,WEB_RESEARCH_YUANBAO_API_KEY:'isolated-wsa-key'},
  fetchImpl:async(_endpoint,opts)=>{
   assert.equal(opts.headers.authorization,'Bearer fixture-placeholder');
   const tools=JSON.parse(opts.body).messages.filter(m=>m.role==='tool');
   if(!tools.length)return spec('public_web_search',{query:'public gold index methodology'});
   const first=JSON.parse(tools[0].content).value;
   assert.equal(first.provider,'yuanbao-mcp');
   assert.equal(first.hits[0].url,url);
   assert.ok(!first.hits[0].sourceRef);
   if(tools.length===1)return spec('public_web_read',{url});
   const original=JSON.parse(tools[1].content).value;
   assert.match(original.text,/Public static text/);
   return Response.json({choices:[{message:{role:'assistant',content:'Read original '+url},finish_reason:'stop'}]});
  },
  ownerWebTransport:{
   async searchFetch(endpoint,opts){
    requests++;
    assert.equal(endpoint,'https://api.wsa.cloud.tencent.com/Mcp');
    assert.equal(opts.headers.authorization,'Bearer isolated-wsa-key');
    assert.doesNotMatch(opts.body,/Never-forward-test-marker|fixture-placeholder/);
    const req=JSON.parse(opts.body);
    if(req.method==='initialize')return Response.json({jsonrpc:'2.0',id:req.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}}}});
    if(req.method==='notifications/initialized')return new Response(null,{status:202});
    assert.deepEqual(req.params.arguments,{Query:'public gold index methodology',Mode:0,Cnt:10});
    return Response.json({jsonrpc:'2.0',id:req.id,result:{structuredContent:{Pages:[{title:'Gold index',url,passage:'Unverified search summary',content:'X'.repeat(700*1024)}]}}});
   },
   async acquire(input){pages++;assert.deepEqual(input.urls,[url]);acquisitionId=input.acquisitionId;return safeSource;},
   async inspect(input){assert.equal(input.acquisitionId,acquisitionId);return {status:'succeeded',manifestSha256,plan:{urls:[url]}};},
   async load(input){assert.equal(input.manifestSha256,manifestSha256);return safeSource;},
  }});
 t.after(()=>gui.close());
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const workspace=await get('/api/workspace');
 assert.equal(workspace.liveNotice.connectivity.searchProvider,'yuanbao-mcp');
 assert.doesNotMatch(JSON.stringify(workspace),/isolated-wsa-key|WEB_RESEARCH_YUANBAO_API_KEY/);
 assert.equal(requests,0);
 const conversation=(await post('/api/conversations',{}).then(r=>r.json())).id;
 const path='/api/conversations/'+conversation;
 assert.equal((await post(path+'/messages',{messageId:'yuanbao-gui',question:'Never-forward-test-marker: find public gold index methodology'})).status,202);
 let thread;
 for(let i=0;i<160;i++){
  thread=await get(path);
  if(['completed','failed'].includes(thread.messages[0]?.status))break;
  await delay(25);
 }
 assert.equal(thread.messages[0].status,'completed',JSON.stringify(thread));
 const body=await get(path+'/messages/yuanbao-gui/body');
 assert.equal(body.body.text,'Read original '+url);
 assert.equal(requests,3);
 assert.equal(pages,1);
});
