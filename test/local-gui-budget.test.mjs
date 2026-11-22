import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {inspectResearchProject,inspectResearchTask,inspectResearchCapacity,updateResearchProject} from '../src/research-project.mjs';

const pilot={model:4,maxRounds:20,maxTools:32,tool:40,timeoutMs:120000};
const normal={model:36,maxRounds:36,maxTools:72,tool:72,timeoutMs:3600000};
const launchConfig=limits=>({gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'fake',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},connectivity:{web:true,search:'exa-public-preview'},limits});
const origin='https://example.com/';
const proposed=(name,args,n)=>Response.json({choices:[{message:{role:'assistant',tool_calls:[{id:'model-tool-'+n,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]});
const finished=()=>Response.json({choices:[{message:{role:'assistant',content:'Answer with original evidence and visible gaps.'},finish_reason:'stop'}]});
const terminal=new Set(['completed','failed','cancelled']);
async function setup(t,{providerStatus}={}){
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/gui-budget-')), servers=[],seen=[];
 let searches=0,reads=0;
 t.after(async()=>{await Promise.all(servers.map(s=>s.close()));await rm(projectDir,{recursive:true,force:true});});
 const plans=new Map();
 const transport={async searchFetch(_endpoint,opts){
  searches++;
  return Response.json({jsonrpc:'2.0',id:JSON.parse(opts.body).id,result:{content:[{type:'text',text:origin+'primary'}]}});
 },async acquire({acquisitionId,urls}){
  reads++;const requestedUrl=urls[0],digest=String(reads).padStart(64,'0');
  const result={manifestSha256:digest,catalog:{documents:[{pages:['Evidence from approved original '+requestedUrl],web:{requestedUrl,finalUrl:requestedUrl,retrievedAt:'2026-11-22T00:00:00Z',originalSha256:digest}}]}};
  plans.set(acquisitionId,{urls,result});
  return result;
 },async inspect({acquisitionId}){
  const entry=plans.get(acquisitionId);
  assert.ok(entry,'mock original acquisition should exist');
  return {status:'succeeded',manifestSha256:entry.result.manifestSha256,plan:{urls:entry.urls}};
 },async load({manifestSha256}){
  const entry=Array.from(plans.values()).find(x=>x.result.manifestSha256===manifestSha256);
  assert.ok(entry);return entry.result;
 }};
 const token='synthetic-provider-only';
 const launch=async limits=>{
  const gui=await startLocalGui({projectDir,liveConfig:launchConfig(limits),env:{ETF_GUI_PROVIDER_KEY:token},ownerWebTransport:transport,async fetchImpl(_endpoint,opts,context){
   const body=JSON.parse(opts.body), n=context.modelOrdinal;
   seen.push({runId:context.runId,n,tools:body.tools.map(t=>t.function.name)});
   assert.deepEqual(seen.at(-1).tools,['public_web_read','public_web_search']);
   assert.doesNotMatch(JSON.stringify(body),/final available model round/);
   if(providerStatus)return Response.json({error:'synthetic provider detail must never be read back'},{status:providerStatus});
   if(n===1)return proposed('public_web_search',{query:'public market facts'},n);
   if(n<=4)return proposed('public_web_read',{url:origin+'report-'+n},n);
   return finished();
  }});
  servers.push(gui);
  const get=path=>fetch(gui.origin+path).then(r=>r.json());
  const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  return {...gui,get,post,async submit(question){
   const {id}=await post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
   assert.equal((await post(path+'/messages',{messageId:'original',question})).status,202);
   for(let i=0;i<200;i++){
    const {messages}=await get(path);
    if(terminal.has(messages[0]?.status))return {path,turn:messages[0]};
    await delay(20);
   }throw Error('mock turn did not terminate');
  }};
 };
 return {projectDir,launch,seen,counts:()=>({searches,reads}),token};
}

test('pilot stops at 4 original requests; operator CAS grants normal new Run without rewriting old receipt or suppressing tools',async t=>{
 const f=await setup(t),site=await f.launch(pilot);
 const original=await site.submit('private fixture question');
 assert.equal(original.turn.code,'ROOT_BUDGET_EXHAUSTED');
 assert.equal(original.turn.status,'failed');
 assert.equal(original.turn.output,null);
 assert.equal(original.turn.budgetFailure.owner,'local-run');
 assert.equal(original.turn.budgetFailure.exhausted,'model');
 assert.deepEqual(original.turn.budgetFailure.model,{used:4,limit:4});
 assert.deepEqual(original.turn.budgetFailure.tools,{used:4,limit:40});
 assert.doesNotMatch(JSON.stringify(original.turn.budgetFailure),/fixture|provider|private|example/);
 const history=await site.get(original.path);
 const previous=await inspectResearchProject({projectDir:f.projectDir});
 const settle=await inspectResearchCapacity({projectDir:f.projectDir,runId:original.turn.runId});
 assert.equal(settle.requests.length,4);
 assert.ok(settle.requests.every(row=>row.state==='completed'));
 assert.deepEqual(f.counts(),{searches:1,reads:3});
 await site.close();
 await assert.rejects(f.launch(normal),{message:'GUI_LIVE_PROJECT_REQUIRED'});
 const result=await updateResearchProject({projectDir:f.projectDir,config:{...previous.config,limits:normal},expectedConfigSha256:previous.configSha256});
 assert.equal(result.projectId,previous.projectId);
 assert.deepEqual(result.config.limits,normal);
 const fresh=await f.launch(normal);
 assert.deepEqual(await fresh.get(original.path),history);
 assert.deepEqual(await inspectResearchCapacity({projectDir:f.projectDir,runId:original.turn.runId}),settle);
 const originalRun=(await inspectResearchTask({projectDir:f.projectDir,runId:original.turn.runId})).run;
 assert.equal(originalRun.definition.rootLimits.model,4);
 const next=await fresh.submit('new request under raised operator profile');
 assert.equal(next.turn.status,'completed');
 assert.match(next.turn.output.answer,/original evidence/);
 assert.deepEqual(f.seen.filter(r=>r.runId===next.turn.runId).map(x=>x.n),[1,2,3,4,5]);
 assert.deepEqual(f.counts(),{searches:2,reads:6});
 const current=(await inspectResearchTask({projectDir:f.projectDir,runId:next.turn.runId})).run;
 assert.deepEqual(current.rootUsage,{model:5,tool:4});
 assert.equal(current.definition.rootLimits.model,36);
 // Roll back by CAS using the new observed SHA, not task/session mutation.
 await fresh.close();
 await updateResearchProject({projectDir:f.projectDir,config:previous.config,expectedConfigSha256:result.configSha256});
 const back=await f.launch(pilot);
 assert.deepEqual(await back.get(original.path),history);
 assert.equal((await back.get(next.path)).messages[0].output.answer,next.turn.output.answer);
 assert.equal(f.seen.length,9);
});

test('configured Run round limit is separate from Root model budget and stops after exactly three requests',async t=>{
 const f=await setup(t),site=await f.launch({...normal,maxRounds:3});
 const {turn}=await site.submit('typed mock query');
 assert.equal(turn.code,'ROUND_LIMIT');
 assert.deepEqual(turn.budgetFailure.model,{used:3,limit:36});
 assert.deepEqual(turn.budgetFailure.rounds,{used:3,limit:3});
 assert.equal(f.seen.length,3);
});

test('provider HTTP quota refusal remains separate from local limits and does not echo raw response',async t=>{
 const f=await setup(t,{providerStatus:429}),site=await f.launch(normal);
 const {turn}=await site.submit('provider-quota fixture request');
 assert.equal(turn.code,'PROVIDER_HTTP_429');
 assert.equal(Object.hasOwn(turn,'budgetFailure'),false);
 assert.doesNotMatch(JSON.stringify(turn),/synthetic provider detail|synthetic-provider-only/);
 assert.equal(f.seen.length,1);
 assert.deepEqual(f.counts(),{searches:0,reads:0});
});
