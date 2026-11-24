import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { mkdir, mkdtemp, rm, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startLocalGui } from '../src/gui-server.mjs';
import { createResearchProject, inspectResearchTask, submitResearchTask, workResearchTask } from '../src/research-project.mjs';
import { readDeepResearchProgress, researchProfileFor, DEEP_EVIDENCE_REVISION } from '../src/research-intent.mjs';
import { prepareGuiLiveConfig } from '../src/gui-live-config.mjs';
import { openOwnerWeb, OWNER_WEB_EXCERPTS, OWNER_WEB_EXCERPTS_LOCAL_MISS } from '../src/gui-owner-web.mjs';
import { mockWebNetwork } from './fixtures/web-network.mjs';
import { paginateWebText, WEB_TEXT_PAGE_BYTES, webTextPageSizes } from '../src/web-text-pages.mjs';

const url='https://example.com/official';
const manifestSha256='a'.repeat(64), originalSha256='b'.repeat(64);
const marker='仅第二段：2025 年累计赎回 19.4 万份。';
const text='甲🪴"\\\n'.repeat(10000)+marker;
const pages=paginateWebText(text);
const acquired={manifestSha256,catalog:{documents:[{pages,web:{
 requestedUrl:url,finalUrl:url,retrievedAt:'2026-11-20T00:00:00.000Z',originalSha256,
}}]}};
const binding={projectId:'original-project',profile:{web:true},excerptRevision:OWNER_WEB_EXCERPTS};
const call=(id,name,args)=>({id,name,arguments:args});
const group=(c,value)=>[{role:'assistant',calls:[c]},{role:'tool',callId:c.id,result:{callId:c.id,status:'succeeded',dispatched:true,value}}];
const proposal=c=>Response.json({choices:[{message:{role:'assistant',tool_calls:[{type:'function',id:c.id,function:{name:c.name,arguments:JSON.stringify(c.arguments)}}]},finish_reason:'tool_calls'}]});

function fixture(){
 const acquiredIds=new Set(), counts={acquire:0,inspect:0,load:0};
 const transport={
  async acquire({acquisitionId,urls}){counts.acquire++;assert.deepEqual(urls,[url]);acquiredIds.add(acquisitionId);return acquired;},
  async inspect({acquisitionId}){counts.inspect++;if(!acquiredIds.has(acquisitionId))throw Object.assign(Error('missing'),{code:'ENOENT'});
   return {status:'succeeded',manifestSha256,plan:{urls:[url]}};},
  async load({manifestSha256:sha}){counts.load++;assert.equal(sha,manifestSha256);return acquired;},
 };
 return {transport,counts,acquiredIds};
}
async function scratch(t){
 await mkdir('test-output',{recursive:true});
 const path=await mkdtemp(resolve('test-output/owner-web-excerpts-'));
 t.after(()=>rm(path,{recursive:true,force:true}));
 return path;
}

const invalidCursor='not-the-issued-cursor';
const cursorMiss={
 kind:'public-web-continuation-unavailable@1',status:'unavailable',reason:'WEB_CONTINUATION_CURSOR_INVALID',
 networkAttempted:false,automaticReplayAllowed:false,
};
const honestAnswer='已读取第一个摘录，但没有核实后续摘录；不能确认其中的数字。';
for(const scenario of ['normal','malformed-then-honest-answer','malformed-then-exact-correction']){
 test('normal GUI retained excerpt and cold History: '+scenario,async t=>{
 const projectDir=await scratch(t);
 const firstCall=call('initial','public_web_read',{url:url+'#not-an-extraction-anchor'});
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://example.com/robots.txt':{body:'User-agent: *\nAllow: /\n'},[url]:{body:text},
 }});
 const requested=()=>network.calls.map(value=>value.url);
 let modelRequests=0,gui,first,second;
 t.after(async()=>await gui?.close());
 assert.equal(pages.length,2);
 assert.ok(!pages[0].includes(marker));
 const options={projectDir,liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
  limits:{model:5},connectivity:{web:true},
 },env:{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder'},async fetchImpl(_url,{body}){
  modelRequests++;
  const request=JSON.parse(body), prior=request.messages.filter(m=>m.role==='tool');
  assert.deepEqual(request.tools.map(t=>t.function.name),['public_web_read','public_web_continue']);
  if(!prior.length)return proposal(firstCall);
  first=JSON.parse(prior[0].content).value;
  assert.equal(first.kind,'public-web-page@2');assert.equal(first.page,1);
  assert.match(first.nextCursor,/^[a-f0-9]{64}$/);
  assert.ok(!first.text.includes(marker));assert.equal(first.url,url);
  if(prior.length===1)return proposal(scenario==='normal'
   ?call('next','public_web_continue',{cursor:first.nextCursor})
   :call('bad','public_web_continue',{cursor:invalidCursor}));
  if(scenario!=='normal'){
   const packet=JSON.parse(prior[1].content);
   assert.deepEqual(packet.value,cursorMiss);
   assert.ok(!prior[1].content.includes(invalidCursor),'typed result does not echo malformed token');
   if(prior.length===2){
    if(scenario==='malformed-then-honest-answer')return Response.json({choices:[{message:{role:'assistant',content:honestAnswer},finish_reason:'stop'}]});
    return proposal(call('next','public_web_continue',{cursor:first.nextCursor}));
   }
  }
  second=JSON.parse(prior.at(-1).content).value;
  assert.ok(second.text.includes(marker));assert.equal(second.page,2);assert.equal(second.nextCursor,null);
  assert.equal(second.originalSha256,first.originalSha256);assert.equal(second.manifestSha256,first.manifestSha256);
  assert.equal(first.text+second.text,text);
  for(const page of [first,second])assert.ok(page.text.isWellFormed()&&webTextPageSizes(page.text).every(n=>n<=WEB_TEXT_PAGE_BYTES));
  return Response.json({choices:[{message:{role:'assistant',content:marker},finish_reason:'stop'}]});
 }};
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 gui=await startLocalGui(options);
 const workspace=await get('/api/workspace');
 assert.ok(workspace.capabilities.includes('read-web-sources'));
 const {id}=await post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
 const input={messageId:'reading',question:'请依据网页后段给出累计赎回数据。'};
 assert.equal((await post(path+'/messages',input)).status,202);
 let result;
 for(let i=0;i<100;i++){
  result=await get(path);
  if(['completed','failed'].includes(result.messages[0]?.status)&&!result.messages[0]?.working)break;
  await delay(30);
 }
 assert.equal(result.messages[0].status,'completed',JSON.stringify(result.messages[0]));
 assert.equal(result.messages[0].output.answer,scenario==='malformed-then-honest-answer'?honestAnswer:marker);
 const {definition,run}=await inspectResearchTask({projectDir,runId:result.messages[0].runId});
 assert.equal(definition.ownerWebExcerptRevision,OWNER_WEB_EXCERPTS_LOCAL_MISS);
 assert.equal(readDeepResearchProgress(researchProfileFor("deep",DEEP_EVIDENCE_REVISION),run.snapshot).originalsRead,1);
 const expectedModelRequests=scenario==='malformed-then-exact-correction'?4:3;
 assert.equal(modelRequests,expectedModelRequests);assert.deepEqual(requested(),['https://example.com/robots.txt',url]);
 const exactBody=path+'/messages/reading/body', exactSources=path+'/messages/reading/sources';
 const bodyBefore=await get(exactBody);
 assert.ok(!Object.hasOwn(bodyBefore,'readSources'));
 const readSources=async(unavailable='available')=>{
  const res=await fetch(gui.origin+exactSources);
  assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
  const raw=await res.text(),parsed=JSON.parse(raw);
  assert.ok(!raw.includes('not-an-extraction-anchor')&&!raw.includes(first.nextCursor)&&!raw.includes(invalidCursor));
  assert.deepEqual(Object.keys(parsed).sort(),['availability','conversationId','messageId','projectId','readSources']);
  assert.equal(parsed.projectId,workspace.projectId);
  assert.equal(parsed.conversationId,id);assert.equal(parsed.messageId,'reading');assert.equal(parsed.availability,unavailable);
  return parsed;
 };
 const readback=await readSources();
 assert.deepEqual(readback.readSources.map(row=>row.page),scenario==='malformed-then-honest-answer'?[1]:[1,2]);
 for(const row of readback.readSources){
  assert.deepEqual(Object.keys(row).sort(),['id','kind','page','pages','retrievedAt','sha256','text','url']);
  assert.match(row.id,/^source-[a-f0-9]{64}$/);
  assert.equal(row.kind,'web-original-excerpt');assert.equal(row.url,url);assert.equal(row.pages,2);
  assert.equal(row.text,pages[row.page-1]);
  assert.equal(row.sha256,createHash('sha256').update(row.text).digest('hex'));
 }
 const other=await post('/api/conversations',{}).then(r=>r.json());
 assert.equal((await fetch(gui.origin+'/api/conversations/'+other.id+'/messages/reading/sources')).status,404);
 assert.equal((await fetch(gui.origin+exactSources+'?runId='+run.runId)).status,404);
 assert.equal((await fetch(gui.origin+exactSources,{headers:{origin:'https://elsewhere.invalid'}})).status,403);
 await gui.close();gui=await startLocalGui(options);
 assert.deepEqual(await readSources(),readback);
 assert.deepEqual(await get(path),result);
 const broken=join(projectDir,'conversations',id,'messages','other-turn.json');
 await writeFile(broken,'not a valid separate message');
 assert.equal((await fetch(gui.origin+path)).status,500);
 assert.deepEqual(await readSources(),readback);
 const acquisitionId='page-'+createHash('sha256').update(JSON.stringify([run.runId,firstCall.id])).digest('hex').slice(0,40);
 const receipt=join(projectDir,'web-acquisitions',acquisitionId,'terminal.json');
 await rename(receipt,receipt+'.hidden-fixture');
 assert.deepEqual((await readSources('unavailable')).readSources,[]);
 assert.deepEqual(await get(exactBody),bodyBefore);
 assert.equal(modelRequests,expectedModelRequests);assert.deepEqual(requested(),['https://example.com/robots.txt',url]);
 await rename(receipt+'.hidden-fixture',receipt);
 await rm(broken);

 assert.equal((await post(path+'/messages',input)).status,202);
 assert.equal(modelRequests,expectedModelRequests);assert.deepEqual(requested(),['https://example.com/robots.txt',url]);
 });
}

test('v2 wrong format settles locally without authority or storage access; v1 frozen tool stays strict',async t=>{
 const f=fixture(),projectDir=await scratch(t),runId='local-invalid';
 let readRunCalls=0;
 const options={...binding,projectDir,runId,transport:f.transport,readRun:()=>{
  readRunCalls++;return {runId,snapshot:{messages:[]}};
 }};
 const [,legacy]=openOwnerWeb(options);
 const [,active]=openOwnerWeb({...options,excerptRevision:OWNER_WEB_EXCERPTS_LOCAL_MISS});
 assert.equal(legacy.recoveryVersion,'owner-public-continuation@1');
 assert.throws(()=>legacy.validate({cursor:invalidCursor}),{code:'WEB_CONTINUATION_CURSOR_INVALID'});
 assert.equal(active.recoveryVersion,'owner-public-continuation@2');
 const malformed=call('wrong','public_web_continue',{cursor:invalidCursor});
 assert.deepEqual(await active.execute(malformed.arguments,{callId:malformed.id}),cursorMiss);
 assert.deepEqual(await active.reconcile(malformed.arguments,{callId:malformed.id}),cursorMiss);
 await active.verifyResult(cursorMiss,{call:malformed});
 await assert.rejects(active.verifyResult({...cursorMiss,reason:'other'},{call:malformed}),{code:'WEB_PAGE_EVIDENCE_CHANGED'});
 const signal=AbortSignal.abort();
 await assert.rejects(active.reconcile(malformed.arguments,{callId:malformed.id,signal}),{name:'AbortError'});
 assert.equal(readRunCalls,0);
 for(const args of [{},{cursor:null},{cursor:'' ,url},{cursor:'f'.repeat(129)},{cursor:'f\n'}])
  assert.throws(()=>active.validate(args),{code:'WEB_CONTINUATION_CURSOR_INVALID'});
 // A type-correct forgery reaches only same-Run receipt lookup, not storage.
 const forged=await active.execute({cursor:'f'.repeat(64)},{callId:'forged'});
 assert.equal(forged.reason,'WEB_CONTINUATION_NOT_AVAILABLE');
 assert.equal(readRunCalls,1);
 assert.deepEqual(f.counts,{acquire:0,inspect:0,load:0});
});

test('only a prior committed cursor authorizes the same run; missing or changed artifacts and cancellation never re-fetch',async t=>{
 const f=fixture(), projectDir=await scratch(t), runId='original-run';
 const firstCall=call('first','public_web_read',{url});
 const messages=[];
 const options={...binding,projectDir,runId,transport:f.transport,readRun:()=>({runId,snapshot:{messages}})};
 const [firstTool,nextTool]=openOwnerWeb(options);
 const first=await firstTool.execute(firstCall.arguments,{callId:firstCall.id});
 const continuation=call('next','public_web_continue',{cursor:first.nextCursor});
 const read=()=>nextTool.execute(continuation.arguments,{callId:continuation.id});
 assert.equal((await read()).status,'unavailable');
 assert.throws(()=>nextTool.validate({cursor:first.nextCursor,url}),{code:'WEB_CONTINUATION_CURSOR_INVALID'});
 messages.push({role:'assistant',calls:[continuation]},...group(firstCall,first));
 assert.equal((await read()).status,'unavailable');
 messages.splice(0,1);
 const [,other]=openOwnerWeb({...options,runId:'other-run',readRun:()=>({runId:'other-run',snapshot:{messages:[]}})});
 assert.equal((await other.execute(continuation.arguments,{callId:continuation.id})).status,'unavailable');
 assert.deepEqual(f.counts,{acquire:1,inspect:0,load:0});
 const actual=await read();assert.equal(actual.page,2);
 const [,recreated]=openOwnerWeb(options);
 assert.deepEqual(await recreated.reconcile(continuation.arguments,{callId:continuation.id}),actual);
 await recreated.verifyResult(actual,{call:continuation});
 await assert.rejects(recreated.verifyResult({...actual,text:'changed'},{call:continuation}),{code:'WEB_PAGE_EVIDENCE_CHANGED'});
 const signal=AbortSignal.abort();
 await assert.rejects(recreated.reconcile(continuation.arguments,{callId:continuation.id,signal}),{name:'AbortError'});
 f.acquiredIds.clear();
 await assert.rejects(read(),{code:'WEB_PAGE_EVIDENCE_MISSING'});
 assert.equal(f.counts.acquire,1);
});

for(const phase of ['tool-dispatched','result-committed']){
 test('interrupted retained continuation resumes the original '+phase+' checkpoint with no re-acquisition or repeated model request',async t=>{
  const f=fixture(),directory=await scratch(t),projectDir=join(directory,'project'),runId='resume-local';
  const {config,apiKey}=prepareGuiLiveConfig({
   gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
   limits:{model:5},connectivity:{web:true},
  },{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder'});
  await createResearchProject({directory:projectDir,config});
  await submitResearchTask({projectDir,runId,question:'Read the exact statement after the original first excerpt.',
   sourceManifestSha256:null,authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
  const stop=new AbortController();
  let modelRequests=0,stopped=false;
  const inspect=f.transport.inspect;
  f.transport.inspect=async value=>{
   if(phase==='tool-dispatched'&&modelRequests===2&&!stopped){stopped=true;stop.abort();}
   return inspect(value);
  };
  const options={projectDir,runId,apiKey,ownerWebTransport:f.transport,async fetchImpl(_url,{body}){
   modelRequests++;
   const results=JSON.parse(body).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
   if(!results.length)return proposal(call('parent','public_web_read',{url}));
   if(results.length===1)return proposal(call('retained','public_web_continue',{cursor:results[0].nextCursor}));
   assert.equal(results.length,2);assert.equal(results[1].page,2);assert.ok(results[1].text.includes(marker));
   return Response.json({choices:[{message:{role:'assistant',content:marker},finish_reason:'stop'}]});
  }};
  const paused=await workResearchTask({...options,hostSignal:stop.signal,onCheckpoint(event){
   if(event.phase===phase&&event.callId==='retained')stop.abort();
  }});
  assert.equal(paused.workerStatus,'interrupted');assert.equal(paused.run.snapshot.phase,phase);
  assert.deepEqual([modelRequests,f.counts.acquire],[2,1]);
  const resumed=await workResearchTask(options);
  assert.equal(resumed.run.status,'completed',resumed.run.snapshot.code);
  assert.deepEqual([modelRequests,f.counts.acquire],[3,1]);
 });
}

test('legacy frozen page tool keeps its exact v1 value and replay with no model-visible continuation',async t=>{
 const f=fixture(), projectDir=await scratch(t);
 const [legacy,...other]=openOwnerWeb({profile:{web:true},projectDir,runId:'older-run',transport:f.transport});
 assert.deepEqual(other,[]);assert.equal(legacy.recoveryVersion,'owner-public-page@1');
 const c=call('old','public_web_read',{url:url+'#section'});
 const value=await legacy.execute(c.arguments,{callId:c.id});
 assert.equal(value.kind,'public-web-page@1');assert.equal(value.page,1);assert.equal(value.pages,2);
 assert.ok(!Object.hasOwn(value,'nextCursor'));assert.ok(!Object.hasOwn(value,'firstCallId'));
 assert.deepEqual(await legacy.reconcile(c.arguments,{callId:c.id}),value);
 await legacy.verifyResult(value,{call:c});assert.equal(f.counts.acquire,1);
});

test('only original accepted reads are projected: search preview ignored, query-bearing URL withheld as unavailable or partial',async t=>{
 const projectDir=await scratch(t);
 const publicUrl='https://example.com/public-evidence';
 const queryUrl='https://example.com/another-document?token=synthetic-secret-sentinel';
 const previewText='SYNTHETIC_PREVIEW_NOT_ORIGINAL';
 const publicText='Synthetic first-party public text; plain output.';
 const queryText='Underlying excerpt must not be exposed with withheld query URL.';
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://example.com/robots.txt':{body:'User-agent: *\nAllow: /\n'},
  [publicUrl]:{body:publicText},[queryUrl]:{body:queryText},
 }});
 let modelRequests=0,searchRequests=0;
 const gui=await startLocalGui({projectDir,liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
  limits:{model:5},connectivity:{web:true,search:'exa-public-preview'},
 },env:{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder'},
 ownerWebTransport:{async searchFetch(_url,{body}){
  searchRequests++;
  const {id}=JSON.parse(body);
  return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:previewText}]}});
 }},
 async fetchImpl(_url,{body}){
  modelRequests++;
  const request=JSON.parse(body), prior=request.messages.filter(message=>message.role==='tool');
  const question=request.messages[0].content;
  if(!prior.length)return proposal(call('preview','public_web_search',{query:'synthetic preview query'}));
  assert.ok(prior[0].content.includes(previewText));
  if(prior.length===1&&!question.includes('preview-only'))return proposal(call('protected-link','public_web_read',{url:queryUrl}));
  if(prior.length===2&&question.includes('mixed'))return proposal(call('original','public_web_read',{url:publicUrl}));
  return Response.json({choices:[{message:{role:'assistant',content:'The answer mentions a fake source https://elsewhere.invalid/fake.'},finish_reason:'stop'}]});
 }});
 t.after(async()=>await gui.close());
 const post=(path,input)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(input)});
 const get=path=>fetch(gui.origin+path);
 for(const [turn,availability,rows] of [['preview-only','none',0],['query-only','unavailable',0],['mixed','partial',1]]){
  const {id}=await post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  assert.equal((await post(path+'/messages',{messageId:'turn',question:'Synthetic '+turn})).status,202);
  let body;
  for(let i=0;i<100;i++){
   const got=await get(path+'/messages/turn/body');
   if(got.status===200){body=await got.json();break;}
   await delay(25);
  }
  assert.match(body.body.text,/fake source/u);
  const counts=[modelRequests,searchRequests,network.calls.length];
  const response=await get(path+'/messages/turn/sources');
  assert.equal(response.status,200);
  const raw=await response.text(),projected=JSON.parse(raw);
  for(const hidden of [previewText,queryUrl,queryText,'synthetic-secret-sentinel','elsewhere.invalid'])
   assert.ok(!raw.includes(hidden));
  assert.equal(projected.availability,availability);
  assert.equal(projected.readSources.length,rows);
  if(rows)assert.equal(projected.readSources[0].text,publicText);
  assert.deepEqual([modelRequests,searchRequests,network.calls.length],counts);
 }
});
