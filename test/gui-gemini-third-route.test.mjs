import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {prepareGuiLiveConfig} from '../src/gui-live-config.mjs';
import {inspectResearchRequests,inspectResearchTask,maintainOwnerGuiAdmission} from '../src/research-project.mjs';
import {terraRouteUnavailable} from '../src/terra-route-health.mjs';
import {OPENCODE_GO_CURRENT_ENDPOINT,OPENCODE_GO_OWNER_PROVIDER} from '../src/gateway.mjs';
import {OPENAI_RESPONSES_ENDPOINT,OPENAI_RESPONSES_MODEL} from '../src/openai-responses-gateway.mjs';
import {GEMINI_FREE_ENDPOINT,GEMINI_FREE_MODEL} from '../src/gemini-free-gateway.mjs';

const google= 'AIza'+'A'.repeat(32),terra='synthetic-terra-not-a-secret';
const env={ETF_GUI_PROVIDER_KEY:'synthetic-go-not-a-secret',ETF_OPENAI_API_KEY:terra,ETF_GUI_GEMINI_FREE_API_KEY:google,ETF_GUI_GEMINI_FREE_PROJECT_VERIFIED:'1'};
const liveConfig={gateway:{provider:OPENCODE_GO_OWNER_PROVIDER,endpoint:OPENCODE_GO_CURRENT_ENDPOINT,model:'glm-5.3-flash',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},openAIBackup:{profile:'owner-gpt-6-1-terra@1',maxOutputTokens:4096,maxAttempts:8},geminiFreeBackup:{model:GEMINI_FREE_MODEL,maxOutputTokens:3072,maxAttempts:2}};
const prompt='Synthetic example: explain the ETF creation and redemption mechanism using invented numbers.';
const modelURL='https://api.openai.com/v1/models/gpt-6.1-terra';
function googleReply(url,options){
 assert.equal(url.href,GEMINI_FREE_ENDPOINT);assert.deepEqual(options.headers,{'x-goog-api-key':google,'content-type':'application/json'});
 assert.deepEqual(JSON.parse(options.body),{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:3072,candidateCount:1}});
 return Response.json({modelVersion:GEMINI_FREE_MODEL,candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:'Synthetic Google answer.'}]}}]});
}
function terraReply(){return Response.json({object:'response',model:OPENAI_RESPONSES_MODEL,status:'completed',output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'Synthetic Terra answer.'}]}]});}
const resultStatus=({state})=>state;
async function launch(t,responses,environment=env){
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/gui-gemini-route-')),calls=[];
 const gui=await startLocalGui({projectDir,env:environment,liveConfig,fetchImpl:async(url,op)=>{calls.push([op.method,url.href]);return responses(url,op);}});
 t.after(async()=>{await gui.close();await rm(projectDir,{recursive:true,force:true});});
 const get=path=>fetch(gui.origin+path);
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 async function begin(n,{approved=true,other={},path}={}){
  if(!path){const r=await post('/api/conversations',{});assert.equal(r.status,201);path='/api/conversations/'+(await r.json()).id;}
  const messageId='m-'+n;
  const r=await post(path+'/messages',{messageId,question:prompt,...(approved?{approveGeminiPublic:true}:{}),...other});
  if(r.status!==202)return {status:r.status,code:(await r.json()).error,path};
  const {runId}=await r.json();
  for(let i=0;i<80;i++){
   const message=(await get(path).then(r=>r.json())).messages.find(m=>m.id===messageId);
   if(message?.status==='failed'||message?.status==='completed')return {state:message.status,path,runId,messageId};
   await delay(20);
  }
  assert.fail('run not terminal');
 }
 const ticket=async run=>(await inspectResearchRequests({projectDir,runId:run.runId,reservations:[{rootId:run.runId,modelOrdinal:1}]}))[0];
 return {get,post,begin,ticket,calls,projectDir};
}
test('confirmed Go and Terra predispatch outage selects public Google and one reservation',async t=>{
 const f=await launch(t,(u,o)=>{
  if(o.method==='HEAD')return new Response(null,{status:503});
  if(o.method==='GET'){
   assert.equal(u.href,modelURL);assert.equal(o.redirect,'manual');assert.equal(o.body,undefined);
   assert.deepEqual(o.headers,{authorization:'Bearer '+terra});
   return new Response(null,{status:503});
  }
  return googleReply(u,o);
 });
 assert.equal((await f.get('/api/workspace').then(r=>r.json())).geminiFreePublicFallback,true);
 const run=await f.begin(1);assert.equal(run.state,'completed',JSON.stringify({run,calls:f.calls}));
 assert.deepEqual(f.calls,[['HEAD',OPENCODE_GO_CURRENT_ENDPOINT],['GET',modelURL],['POST',GEMINI_FREE_ENDPOINT]]);
 const proof=await f.ticket(run);assert.equal(proof.state,'completed');assert.equal(proof.fallbackModel,GEMINI_FREE_MODEL);
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:run.runId})).run.rootUsage.model,1);
 assert.match(await f.get(run.path+'/messages/'+run.messageId+'/body').then(r=>r.text()),/Synthetic Google answer/);
 assert.equal((await f.begin(2,{path:run.path})).status,400);
 assert.equal((await f.begin(3,{other:{skillId:'auto'}})).status,400);
 assert.equal(f.calls.length,3);
});
test('healthy Terra stays second, and a dispatched error never triggers Google',async t=>{
 const f=await launch(t,(u,o)=>o.method==='HEAD'?new Response(null,{status:503}):
   o.method==='GET'?new Response(null,{status:200}):new Response(null,{status:503}));
 const run=await f.begin(1);assert.equal(run.state,'failed');
 assert.deepEqual(f.calls,[['HEAD',OPENCODE_GO_CURRENT_ENDPOINT],['GET',modelURL],['POST',OPENAI_RESPONSES_ENDPOINT]]);
 assert.equal((await f.ticket(run)).state,'unknown');
});
test('without explicit consent even both providers down cannot send content to Google',async t=>{
 const f=await launch(t,(u,o)=>o.method==='HEAD'?new Response(null,{status:503}):terraReply());
 assert.equal(resultStatus(await f.begin(1,{approved:false})),'completed');
 assert.deepEqual(f.calls,[['HEAD',OPENCODE_GO_CURRENT_ENDPOINT],['POST',OPENAI_RESPONSES_ENDPOINT]]);
});
test('durable Google quota bounds attempts and never chooses another Google model',async t=>{
 const f=await launch(t,(u,o)=>o.method==='HEAD'?new Response(null,{status:503}):
  o.method==='GET'?new Response(null,{status:503}):u.href===OPENAI_RESPONSES_ENDPOINT?terraReply():googleReply(u,o));
 for(const n of [1,2]){
  const run=await f.begin(n);assert.equal(run.state,'completed');assert.equal((await f.ticket(run)).state,'completed');
 }
 await f.begin(3);
 assert.equal(f.calls.filter(([method,url])=>method==='POST'&&url===GEMINI_FREE_ENDPOINT).length,2);
});
test('a dispatched Google error stays unknown without automatic retry or downgrade',async t=>{
 const f=await launch(t,(u,o)=>o.method==='HEAD'||o.method==='GET'?new Response(null,{status:503}):new Response(null,{status:503}));
 const run=await f.begin(1);assert.equal(run.state,'failed');assert.equal((await f.ticket(run)).state,'unknown');
 assert.deepEqual(f.calls,[['HEAD',OPENCODE_GO_CURRENT_ENDPOINT],['GET',modelURL],['POST',GEMINI_FREE_ENDPOINT]]);
});
test('ineligible credential/project, untrusted models and ambiguous Terra checks fail closed',async()=>{
 assert.throws(()=>prepareGuiLiveConfig(liveConfig,{...env,ETF_GUI_GEMINI_FREE_PROJECT_VERIFIED:undefined}),{code:'GUI_GEMINI_FREE_CONFIG_INVALID'});
 assert.throws(()=>prepareGuiLiveConfig({...liveConfig,geminiFreeBackup:{...liveConfig.geminiFreeBackup,model:'unverified-model'}},env),{code:'PROJECT_GEMINI_FREE_CONFIG'});
 for(const code of [200,301,401,403,404,429])assert.equal(await terraRouteUnavailable({apiKey:terra,fetchImpl:async()=>new Response(null,{status:code})}),false);
 assert.equal(await terraRouteUnavailable({apiKey:terra,fetchImpl:async()=>{throw Object.assign(new Error(),{cause:{code:'ECONNREFUSED'}})}}),true);
 assert.equal(await terraRouteUnavailable({apiKey:terra,fetchImpl:async()=>{throw new Error('unclassified')}}),false);
 await assert.rejects(()=>terraRouteUnavailable({apiKey:terra,signal:AbortSignal.abort(new Error('cancelled'))}),/cancelled/);
});

test('Gemini unknown releases only its local slot at the owner deadline',async t=>{
 let n=0;const f=await launch(t,(u,o)=>o.method==='HEAD'||o.method==='GET'?new Response(null,{status:503}):
  ++n===1?new Response(null,{status:503}):googleReply(u,o));
 const a=await f.begin(1),old=await f.ticket(a);assert.equal(old.state,'unknown');
 t.mock.timers.enable({apis:['Date'],now:old.updatedAt+180000});
 await maintainOwnerGuiAdmission({projectDir:f.projectDir});const updated=await f.ticket(a);
 assert.equal(updated.state,'unknown');assert.equal(updated.ticketId,old.ticketId);assert.ok(updated.localRelease);
 t.mock.timers.reset();
 const b=await f.begin(2);assert.equal(b.state,'completed');assert.equal(n,2);
});
