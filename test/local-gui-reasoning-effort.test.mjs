import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {inspectResearchTask} from '../src/research-project.mjs';
import {prepareGuiLiveConfig} from '../src/gui-live-config.mjs';

const env={ETF_GUI_PROVIDER_KEY:'local-test-nonsecret'};
const config={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'glm-5.3-flash',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{web:true}};
const enabled={...config,reasoningEffortProfile:'opencode-go-glm-5.3-flash-preview@1'};
const question='Read the public example for a small explanation.';
const privateMarker='SYNTHETIC_REASONING_NOT_PROJECTED_OR_REPLAYED';
const final=content=>Response.json({choices:[{message:{role:'assistant',content,reasoning_content:privateMarker},finish_reason:'stop'}]});
const choice=(name,args)=>Response.json({choices:[{message:{role:'assistant',reasoning_content:privateMarker,tool_calls:[{type:'function',id:'first-tool',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]});
const post=(g,path,body)=>fetch(g.origin+path,{method:'POST',headers:{origin:g.origin,'content-type':'application/json'},body:JSON.stringify(body)});
const get=(g,path)=>fetch(g.origin+path).then(r=>r.json());
const fixtureDir=()=>mkdtemp(resolve('.effort-test-'));
async function finish(g,path){
 for(let i=0;i<120;i++){const m=(await get(g,path)).messages[0];if(['completed','failed'].includes(m?.status)&&!m.working)return m;await sleep(20);}
 assert.fail('Run did not settle');
}

test('effort is explicitly enabled for exact live Go GLM tuple; unverified and unsupported reject without dispatch',async t=>{
 const unverified=await fixtureDir(),unsupported=await fixtureDir();
 t.after(async()=>{for(const dir of [unverified,unsupported])await rm(dir,{recursive:true,force:true});});
 const different={...config,gateway:{...config.gateway,model:'deepseek-v4.1-flash'}};
 const direct={...config,gateway:{...config.gateway,provider:'deepseek-direct',endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-flash'}};
 for(const bad of [{...enabled,gateway:different.gateway},{...enabled,gateway:direct.gateway},{...enabled,gateway:{...enabled.gateway,endpoint:'https://example.invalid/v1/chat/completions'}}]){
  assert.throws(()=>prepareGuiLiveConfig(bad,env),{code:'PROJECT_REASONING_EFFORT_UNSUPPORTED'});
 }
 let posts=0;
 for(const [projectDir,liveConfig,expected] of [[unverified,config,'unverified'],[unsupported,different,'unsupported']]){
  const g=await startLocalGui({projectDir,liveConfig,env,fetchImpl:async()=>{posts++;return final('Unexpected');}});
  try {
   assert.deepEqual((await get(g,'/api/workspace')).reasoningEffort,{status:expected,options:[]});
   const {id}=await post(g,'/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
   const answer=await post(g,path+'/messages',{messageId:'refused',question,reasoningEffort:'high'});
   assert.equal(answer.status,400);assert.equal((await answer.json()).error,'GUI_REASONING_EFFORT_UNSUPPORTED');
   assert.deepEqual((await get(g,path)).messages,[]);
  }finally{await g.close();}
 }
 assert.equal(posts,0);
});

test('composed Auto, Standard and Deep preserve effort across tool return, cold History and exact replay',async t=>{
 const projectDir=await fixtureDir();let g;
 t.after(async()=>{await g?.close();await rm(projectDir,{recursive:true,force:true});});
 const calls=[];
 const fetchImpl=async(_url,{body})=>{
  const wire=JSON.parse(body), available=wire.tools.map(t=>t.function.name);
  const tool=wire.messages.find(m=>m.role==='tool');
  const system=wire.messages.find(m=>m.role==='system')?.content;
  assert.ok(wire.messages.some(m=>m.role==='user'&&m.content.startsWith(question)));
  assert.ok(!wire.messages.some(m=>m.reasoning_content||JSON.stringify(m).includes(privateMarker)));
  assert.equal(wire.thinking,undefined); // no invented Go enable/disable/clear_thinking parameters
  calls.push({option:wire.reasoning_effort,select:available.includes('select_research_intent'),system,tool:!!tool});
  if(available.includes('select_research_intent'))return choice('select_research_intent',{intent:'research'});
  if(tool)assert.equal(JSON.parse(tool.content).value.kind,'auto-intent@1');
  return final('Synthetic answer');
 };
 const launch=async()=>startLocalGui({projectDir,liveConfig:enabled,env,fetchImpl});
 g=await launch();
 assert.deepEqual((await get(g,'/api/workspace')).reasoningEffort,{status:'available',options:['low','high','max']});
 const create=async()=>'/api/conversations/'+(await post(g,'/api/conversations',{}).then(r=>r.json())).id;
 const combos=[];
 for(const [researchDepth,reasoningEffort,effective] of [['auto','low','research'],['standard','high','standard'],['deep','max','deep'],[undefined,undefined,undefined]]){
  const path=await create(),body={messageId:'fixed-id',question,...(researchDepth?{researchDepth}:{}),...(reasoningEffort?{reasoningEffort}:{})};
  if(reasoningEffort){
   for(const invalid of ['medium','',null]){
    const r=await post(g,path+'/messages',{...body,reasoningEffort:invalid});
    assert.equal(r.status,400);assert.equal((await r.json()).error,'GUI_REASONING_EFFORT_UNSUPPORTED');
   }
  }
  assert.equal((await post(g,path+'/messages',body)).status,202);
  const m=await finish(g,path);
  assert.equal(m.status,'completed',JSON.stringify(m));
  assert.equal(m.effectiveResearchIntent,effective);
  assert.deepEqual(m.reasoningEffort,reasoningEffort?{requested:reasoningEffort,serialized:reasoningEffort,providerAdoption:'unconfirmed'}:undefined);
  assert.doesNotMatch(JSON.stringify(m),new RegExp(privateMarker));
  const task=await inspectResearchTask({projectDir,runId:m.runId});
  assert.equal(task.definition.reasoningEffort,reasoningEffort);
  assert.equal(task.run.definition.config.reasoningEffort,reasoningEffort);
  assert.doesNotMatch(JSON.stringify(task.run.snapshot),new RegExp(privateMarker));
  combos.push({path,body,m});
 }
 assert.deepEqual(calls.map(c=>[c.option,c.select,c.tool]),[['low',true,false],['low',false,true],['high',false,false],['max',false,false],[undefined,false,false]]);
 assert.match(calls[3].system,/deep-evidence/);
 assert.equal(calls[2].system,undefined);
 await g.close();g=await launch();
 for(const {path,body,m} of combos){
  assert.deepEqual((await get(g,path)).messages[0].reasoningEffort,m.reasoningEffort);
  assert.equal((await post(g,path+'/messages',body)).status,202);
  if(body.reasoningEffort){
   const {reasoningEffort:_,...omitted}=body;
   for(const changed of [omitted,{...body,reasoningEffort:body.reasoningEffort==='max'?'high':'max'}]){
    const r=await post(g,path+'/messages',changed);
    assert.equal(r.status,409);assert.equal((await r.json()).error,'CONVERSATION_ID_CONFLICT');
   }
  }
 }
 assert.equal(calls.length,5);
});

test('failed original tool-bearing request never projects provider adoption or redispatches on replay',async t=>{
 const projectDir=await fixtureDir();let g,calls=0;
 t.after(async()=>{await g?.close();await rm(projectDir,{recursive:true,force:true});});
 const fetchImpl=async(_url,{body})=>{
  calls++;
  assert.equal(JSON.parse(body).reasoning_effort,'high');
  return new Response(null,{status:422});
 };
 const launch=async()=>startLocalGui({projectDir,liveConfig:enabled,env,fetchImpl});
 g=await launch();
 const path='/api/conversations/'+(await post(g,'/api/conversations',{}).then(r=>r.json())).id;
 const body={messageId:'fails-once',question,researchDepth:'auto',reasoningEffort:'high'};
 assert.equal((await post(g,path+'/messages',body)).status,202);
 const turn=await finish(g,path);
 assert.equal(turn.status,'failed');assert.equal(turn.output,null);
 assert.equal(turn.effectiveResearchIntent,undefined);
 assert.deepEqual(turn.reasoningEffort,{requested:'high',serialized:null,providerAdoption:'unconfirmed'});
 await g.close();g=await launch();
 assert.deepEqual((await get(g,path)).messages[0].reasoningEffort,turn.reasoningEffort);
 assert.equal((await post(g,path+'/messages',body)).status,202);
 assert.equal(calls,1);
});
