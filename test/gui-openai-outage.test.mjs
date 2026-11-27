import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createGoHealth} from '../src/go-health.mjs';
import {startLocalGui} from '../src/gui-server.mjs';
import {prepareGuiLiveConfig} from '../src/gui-live-config.mjs';
import {inspectResearchRequests,inspectResearchTask,maintainOwnerGuiAdmission,releaseResearchUnknownCapacity} from '../src/research-project.mjs';
import {OPENCODE_GO_CURRENT_ENDPOINT,OPENCODE_GO_OWNER_PROVIDER} from '../src/gateway.mjs';
import {OPENAI_RESPONSES_MODEL,OPENAI_RESPONSES_ENDPOINT} from '../src/openai-responses-gateway.mjs';

const primary='synthetic-go-not-a-secret', backup='synthetic-openai-not-a-secret';
const env={ETF_GUI_PROVIDER_KEY:primary,ETF_OPENAI_API_KEY:backup,ETF_GUI_CONCURRENT_ADMISSION:'1'};
const liveConfig={gateway:{provider:OPENCODE_GO_OWNER_PROVIDER,endpoint:OPENCODE_GO_CURRENT_ENDPOINT,
  model:'glm-5.3-flash',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},
  openAIBackup:{profile:'owner-gpt-6-1-terra@1',maxOutputTokens:4096,maxAttempts:8}};

test('bounded HEAD carries no key, no prompt, and recovery returns new roots to Go',async()=>{
 let clock=1000,status=503,calls=0;
 const health=createGoHealth({now:()=>clock,fetchImpl:async(url,options)=>{
  calls++;assert.equal(url.href,OPENCODE_GO_CURRENT_ENDPOINT);assert.equal(options.method,'HEAD');
  assert.equal(options.redirect,'manual'); assert.equal(options.headers,undefined); assert.equal(options.body,undefined);
  return new Response(null,{status});
 }});
 assert.deepEqual(await Promise.all([health.outage(),health.outage()]),[true,true]);assert.equal(calls,1);
 clock+=29_999;assert.equal(await health.outage(),true);assert.equal(calls,1);
 clock+=1;status=405;assert.equal(await health.outage(),false);assert.equal(calls,2);
 health.observe({status:'unknown',code:undefined});assert.equal(await health.outage(),false);
 health.observe({status:'http-error',code:'PROVIDER_HTTP_429'});assert.equal(await health.outage(),false);
 health.observe({status:'http-error',code:'PROVIDER_HTTP_503'});assert.equal(await health.outage(),true);
 const cancelled=AbortSignal.abort(new Error('cancelled'));await assert.rejects(health.outage(cancelled),/cancelled/);
});

async function launch(t,responses){
 await mkdir('test-output',{recursive:true});
 const directory=await mkdtemp(resolve('test-output/gui-provider-outage-')), requests=[];
 const gui=await startLocalGui({projectDir:directory,liveConfig,env,fetchImpl:async(url,options)=>{
  requests.push({endpoint:url.href,method:options.method});
  return responses(url,options);
 }});
 t.after(async()=>{await gui.close();await rm(directory,{recursive:true,force:true});});
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=path=>fetch(gui.origin+path);
 async function turn(n){
  const messageId='m-'+n;
  const newConversation=await post('/api/conversations',{});assert.equal(newConversation.status,201); const {id:conversationId}=await newConversation.json();
  const path='/api/conversations/'+conversationId;
  const submitted=await post(path+'/messages',{messageId,question:'Synthetic: reply with a brief explanation of an ETF.'});
  assert.equal(submitted.status,202); const {runId}=await submitted.json();
  for(let i=0;i<100;i++){const body=await get(path).then(r=>r.json());const state=body.messages?.[0]?.status;
   if(state==='failed'||state==='completed')return {path,runId,messageId,state,code:body.messages[0].code};
   await delay(20);}
  assert.fail('Run did not reach terminal receipt');
 }
 return {directory,requests,get,turn};
}
const direct=(url,options)=>{
 assert.equal(url.href,OPENAI_RESPONSES_ENDPOINT);assert.equal(options.headers.authorization,'Bearer '+backup);
 const p=JSON.parse(options.body);assert.equal(p.model,OPENAI_RESPONSES_MODEL);assert.equal(p.store,false);
 return Response.json({object:'response',model:OPENAI_RESPONSES_MODEL,status:'completed',output:[{type:'message',role:'assistant',
  status:'completed',content:[{type:'output_text',text:'Synthetic backup answer.'}]}]});
};
const ticket=(fx,result)=>inspectResearchRequests({projectDir:fx.directory,runId:result.runId,reservations:[{rootId:result.runId,modelOrdinal:1}]});

test('fresh owner GUI turn switches before a single primary POST and commits the direct answer',async t=>{
 const fx=await launch(t,(url,opts)=>opts.method==='HEAD'?new Response(null,{status:503}):direct(url,opts));
 const turn=await fx.turn(1);assert.equal(turn.state,'completed',JSON.stringify({turn,requests:fx.requests}));
 assert.deepEqual(fx.requests.map(x=>x.method),['HEAD','POST']);
 const [proof]=await ticket(fx,turn);assert.equal(proof.fallbackModel,OPENAI_RESPONSES_MODEL);assert.equal(proof.state,'completed');
 const {run}=await inspectResearchTask({projectDir:fx.directory,runId:turn.runId});assert.equal(run.rootUsage.model,1);
 const path=turn.path+'/messages/'+turn.messageId+'/body', body=await fx.get(path);
 assert.equal(body.status,200);assert.match(await body.text(),/Synthetic backup answer/);assert.equal(fx.requests.length,2);
});

test('a dispatched Go 503 remains unknown and does not replay; only the next owner turn uses GPT',async t=>{
 const fx=await launch(t,(url,opts)=>opts.method==='HEAD'?new Response(null,{status:405}):
   url.href===OPENCODE_GO_CURRENT_ENDPOINT?new Response(null,{status:503}):direct(url,opts));
 const original=await fx.turn(1);assert.equal(original.state,'failed');
 assert.equal((await ticket(fx,original))[0].state,'unknown');
 assert.equal(fx.requests.filter(x=>x.endpoint===OPENAI_RESPONSES_ENDPOINT).length,0);
 const next=await fx.turn(2);assert.equal(next.state,'completed',JSON.stringify({next,requests:fx.requests}));
 assert.deepEqual(fx.requests.map(({method,endpoint})=>[method,endpoint]),[
 ['HEAD',OPENCODE_GO_CURRENT_ENDPOINT],['POST',OPENCODE_GO_CURRENT_ENDPOINT],['POST',OPENAI_RESPONSES_ENDPOINT]]);
 assert.equal((await ticket(fx,original))[0].state,'unknown');
});

test('backup is opt-in on exact Go route, with its own mandatory key',()=>{
 assert.throws(()=>prepareGuiLiveConfig(liveConfig,{ETF_GUI_PROVIDER_KEY:primary}),{code:'OPENAI_RESPONSES_KEY_MISSING'});
 assert.throws(()=>prepareGuiLiveConfig({...liveConfig,gateway:{...liveConfig.gateway,provider:'other',endpoint:'https://other.invalid/v1/chat/completions'}},env),{code:'PROJECT_OPENAI_RESPONSES_CONFIG'});
});

test('unknown Terra does not deadlock its only slot; the three-minute sweep preserves the original ticket',async t=>{
 let attempts=0;
 const fx=await launch(t,(url,opts)=>opts.method==='HEAD'?new Response(null,{status:503}):
   ++attempts===1?new Response(null,{status:503}):direct(url,opts));
 const initial=await fx.turn(1);assert.equal(initial.state,'failed');
 const [unknown]=await ticket(fx,initial);assert.equal(unknown.state,'unknown');assert.equal(unknown.localRelease,undefined);
 t.mock.timers.enable({apis:['Date'],now:unknown.updatedAt+179_999});
 await maintainOwnerGuiAdmission({projectDir:fx.directory});
 assert.equal((await ticket(fx,initial))[0].localRelease,undefined);
 t.mock.timers.tick(1);
 await maintainOwnerGuiAdmission({projectDir:fx.directory});
 const [released]=await ticket(fx,initial);
 assert.equal(released.ticketId,unknown.ticketId);assert.equal(released.state,'unknown');assert.ok(released.localRelease);
 t.mock.timers.reset();
 const next=await fx.turn(2);assert.equal(next.state,'completed',JSON.stringify(next));
 assert.equal(attempts,2);assert.equal((await ticket(fx,initial))[0].state,'unknown');
});

test('manual repeatable release uses the frozen Terra ledger, not the Go ledger',async t=>{
 const fx=await launch(t,(_url,opts)=>new Response(null,{status:503}));
 const original=await fx.turn(1),[unknown]=await ticket(fx,original);
 const identity={routeId:'owner-openai-gpt-6-1-terra-1',...Object.fromEntries(
   ['ticketId','reservationId','rootId','runId','modelOrdinal','inputHash','owner','fence'].map(k=>[k,unknown[k]]))};
 const args={projectDir:fx.directory,runId:original.runId,operationId:'operator-backup-release',identity,
   expectedTicketSha256:unknown.ticketSha256,reason:'Synthetic authorized local slot release.',
   acknowledgements:{preserveUnknown:true,noReplay:true,noRefund:true}};
 const release=await releaseResearchUnknownCapacity(args);
 assert.deepEqual(await releaseResearchUnknownCapacity(args),release);
 assert.equal((await ticket(fx,original))[0].state,'unknown');
 await assert.rejects(releaseResearchUnknownCapacity({...args,identity:{...identity,routeId:'other-project'}}),{code:'PROJECT_REQUEST_ROOT'});
});
