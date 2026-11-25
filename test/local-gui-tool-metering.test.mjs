import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {prepareGuiLiveConfig} from '../src/gui-live-config.mjs';
import {inspectResearchProject,inspectResearchTask,inspectResearchCapacity,updateResearchProject} from '../src/research-project.mjs';
import {hasOwnerMeteredTools} from '../src/tool-accounting.mjs';

const env={ETF_GUI_PROVIDER_KEY:'synthetic-test-key'};
const limits={model:36,maxRounds:36,maxTools:72,tool:72,timeoutMs:3600000};
const gateway={provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'fake',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'};
const liveConfig={gateway,limits,connectivity:{web:true}};
const meter='metered-only@1';
async function setup(t,{unknown=false,model=36,refusal=false,postDispatchFailure=false}={}){
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/tool-metering-')),servers=[],events=[],calls=[];
 t.after(async()=>{await Promise.all(servers.map(s=>s.close()));await rm(projectDir,{recursive:true,force:true});});
 const acquisitions=new Map();
 const launch=async enabled=>{
  const gui=await startLocalGui({projectDir,liveConfig:{...liveConfig,limits:{...limits,model},...(enabled?{toolAccounting:meter}:{})},env,
   ownerWebTransport:{async acquire({acquisitionId,urls}){
    const [url]=urls;events.push(url);if(postDispatchFailure)throw new Error('synthetic source transport failure');const stamp=String(events.length).padStart(64,'0');
    const data={manifestSha256:stamp,catalog:{documents:[{pages:['Approved static fixture.'],web:{requestedUrl:url,finalUrl:url,retrievedAt:'2026-11-22T00:00:00Z',originalSha256:stamp}}]}};
    acquisitions.set(acquisitionId,{urls,data});return data;
   },async inspect({acquisitionId}){
    const saved=acquisitions.get(acquisitionId);
    return {status:'succeeded',manifestSha256:saved.data.manifestSha256,plan:{urls:saved.urls}};
   },async load({manifestSha256}){return Array.from(acquisitions.values()).find(item=>item.data.manifestSha256===manifestSha256).data;}},
   async fetchImpl(_url,opts,context){
    const n=context.modelOrdinal;calls.push({id:context.runId,n});
    const body=JSON.parse(opts.body);
    assert.deepEqual(body.tools.map(tool=>tool.function.name),['public_web_read','public_web_continue']);
    if(unknown)throw new TypeError('synthetic transport unknown; no response bytes');
    if(refusal){
      if(n===1)return Response.json({choices:[{message:{role:'assistant',tool_calls:[{id:'not-registered-call',type:'function',function:{name:'not_registered',arguments:'{}'}}]},finish_reason:'tool_calls'}]});
      return Response.json({choices:[{message:{role:'assistant',content:'No approved sources were contacted.'},finish_reason:'stop'}]});
    }
    if(postDispatchFailure&&n===1)return Response.json({choices:[{message:{role:'assistant',tool_calls:[{id:'transport-failure',type:'function',function:{name:'public_web_read',arguments:'{"url":"https://example.com/public"}'}}]},finish_reason:'tool_calls'}]});
    if(postDispatchFailure)return Response.json({choices:[{message:{role:'assistant',content:'The source could not be verified.'},finish_reason:'stop'}]});
    if(n<=7)return Response.json({choices:[{message:{role:'assistant',tool_calls:Array.from({length:12},(_,i)=>({id:n+'-call-'+i,type:'function',function:{name:'public_web_read',arguments:JSON.stringify({url:'https://example.com/round-'+n+'/page-'+i})}}))},finish_reason:'tool_calls'}]});
    return Response.json({choices:[{message:{role:'assistant',content:'Verified response after 84 original tools.'},finish_reason:'stop'}]});
   }});
  servers.push(gui);
  const get=path=>fetch(gui.origin+path).then(r=>r.json());
  const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  return {...gui,get,async submit(question){
   const {id}=await post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
   assert.equal((await post(path+'/messages',{messageId:'original',question})).status,202);
   for(let i=0;i<400;i++){const result=await get(path),turn=result.messages[0];
    if(['completed','failed','cancelled'].includes(turn?.status))return {path,turn};
    await delay(15);
   }throw Error('timed out waiting for offline run');
  }};
 };
 const migrate=async enabled=>{
  const before=await inspectResearchProject({projectDir}), config={...before.config};
  if(enabled)config.ownerToolAccounting=meter;else delete config.ownerToolAccounting;
  return updateResearchProject({projectDir,config,expectedConfigSha256:before.configSha256});
 };
 return {projectDir,launch,migrate,events,calls};
}

test('explicit meter handles 84 actual tool dispatches with no aggregate cutoff, persisted across config rollback',async t=>{
 const f=await setup(t),bounded=await f.launch(false);
 const old=await bounded.submit('old bounded owner question');
 const oldHistory=await bounded.get(old.path);
 assert.equal(old.turn.code,'TOOL_LIMIT');
 assert.equal(Object.hasOwn(old.turn,'toolAccounting'),false);
 assert.equal(f.events.length,72);
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:old.turn.runId})).run.rootUsage.tool,72);
 await bounded.close();
 await assert.rejects(f.launch(true),{message:'GUI_LIVE_PROJECT_REQUIRED'});
 await f.migrate(true);
 const active=await f.launch(true);
 assert.equal((await active.get('/api/workspace')).liveNotice.toolAccounting,meter);
 const fresh=await active.submit('new metered owner question');
 assert.equal(fresh.turn.status,'completed',JSON.stringify(fresh.turn));
 assert.deepEqual(fresh.turn.toolAccounting,{mode:meter,used:84});
 assert.equal(f.events.length,72+84);
 const stored=(await inspectResearchTask({projectDir:f.projectDir,runId:fresh.turn.runId})).run;
 assert.equal(hasOwnerMeteredTools(stored.definition.bindings),true);
 assert.equal(stored.snapshot.toolsDispatched,84);
 assert.deepEqual(stored.rootUsage,{model:8,tool:84});
 assert.equal(stored.definition.rootLimits.tool,72); // Fallback storage metadata, not a sentinel.
 assert.equal((await inspectResearchCapacity({projectDir:f.projectDir,runId:fresh.turn.runId})).requests.length,8);
 const meteredHistory=await active.get(fresh.path);
 await active.close();await f.migrate(false);const cold=await f.launch(false);
 assert.deepEqual(await cold.get(old.path),oldHistory);
 assert.deepEqual(await cold.get(fresh.path),meteredHistory);
 assert.equal(f.events.length,156);
});

test('existing unknown dispatch and frozen non-metered state are not migrated or redispatched',async t=>{
 const f=await setup(t,{unknown:true}),site=await f.launch(false);
 const original=await site.submit('leave the original uncertain');
 const oldRun=(await inspectResearchTask({projectDir:f.projectDir,runId:original.turn.runId})).run;
 const previous=await inspectResearchCapacity({projectDir:f.projectDir,runId:original.turn.runId});
 assert.ok(previous.requests.some(r=>r.state==='unknown'));
 await site.close();await f.migrate(true);
 const cold=await f.launch(true);await cold.get(original.path);
 const unchanged=(await inspectResearchTask({projectDir:f.projectDir,runId:original.turn.runId})).run;
 assert.deepEqual(unchanged,oldRun);
 assert.deepEqual(await inspectResearchCapacity({projectDir:f.projectDir,runId:original.turn.runId}),previous);
 assert.equal(f.calls.length,1);assert.equal(f.events.length,0);
});

test('operator profile refuses non-owner provider; numeric fake-unlimited setting is not accepted',()=>{
 assert.throws(()=>prepareGuiLiveConfig({...liveConfig,toolAccounting:'unlimited'},env),{code:'PROJECT_OWNER_TOOL_ACCOUNTING'});
 assert.throws(()=>prepareGuiLiveConfig({...liveConfig,connectivity:undefined,gateway:{...gateway,provider:'generic',endpoint:'https://example.com/chat/completions'},toolAccounting:meter},env),{code:'PROJECT_OWNER_TOOL_ACCOUNTING'});
 assert.throws(()=>prepareGuiLiveConfig({...liveConfig,limits:{...limits,tool:999999},toolAccounting:meter},env),{code:'PROJECT_LIMITS'});
});

test('metered tools never relax independent Root model ceiling',async t=>{
 const f=await setup(t,{model:4}),live=await f.launch(true);
 const {turn}=await live.submit('Meter tools, not model capacity');
 assert.equal(turn.code,'ROOT_BUDGET_EXHAUSTED');
 assert.deepEqual(turn.toolAccounting,{mode:meter,used:48});
 assert.deepEqual(turn.budgetFailure.model,{used:4,limit:4});
 assert.equal(turn.budgetFailure.exhausted,'model');
 assert.equal(turn.budgetFailure.tools,null);
 assert.equal(f.calls.length,4);
});

test('metered Run records no tool usage for a rejected unavailable tool proposal',async t=>{
 const f=await setup(t,{refusal:true}),live=await f.launch(true);
 const {turn}=await live.submit('No tool that is not authorized');
 assert.equal(turn.code,'TOOL_REJECTED',JSON.stringify(turn));
 assert.deepEqual(turn.toolAccounting,{mode:meter,used:0});
 assert.equal(f.events.length,0);
 const stored=(await inspectResearchTask({projectDir:f.projectDir,runId:turn.runId})).run;
 assert.equal(stored.snapshot.toolsDispatched,0);
 assert.equal(stored.rootUsage.tool,0);
 assert.equal(f.calls.length,1);
});

test('failed acquisition is still exactly one authorized dispatch, including a cold read',async t=>{
 const f=await setup(t,{postDispatchFailure:true}),live=await f.launch(true);
 const {path,turn}=await live.submit('Attempt the public source once');
 assert.deepEqual(turn.toolAccounting,{mode:meter,used:1});
 const before=await live.get(path),calls=f.calls.length;
 assert.equal(f.events.length,1);
 await live.close();
 const cold=await f.launch(true);
 assert.deepEqual(await cold.get(path),before);
 assert.equal(f.events.length,1);
 assert.equal(f.calls.length,calls);
});
