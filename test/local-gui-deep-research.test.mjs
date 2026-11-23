import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';
import {inspectResearchTask} from '../src/research-project.mjs';

const config={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic-deep',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:2},connectivity:{web:true}};
const question='请深度研究这个公开合成基金资料的日期';
const url='https://example.com/first';
const known={manifestSha256:'a'.repeat(64),catalog:{documents:[{pages:['Evidence dated 2020-01-01.'],web:{requestedUrl:url,finalUrl:url,retrievedAt:'2020-01-02T00:00:00Z',originalSha256:'b'.repeat(64)}}]}};
const final=content=>Response.json({choices:[{message:{role:'assistant',content},finish_reason:'stop'}]});
test('manual depth frozen across exact replay and cold history; default remains unchanged and never keyword-promoted',async t=>{
  await mkdir('test-output',{recursive:true});
  const projectDir=await mkdtemp(resolve('test-output/deep-research-'));
  const instances=[]; t.after(async()=>{for(const g of instances)await g.close();await rm(projectDir,{recursive:true,force:true});});
  const requests=[];let acq=0;
  const ownerWebTransport={async acquire(){acq++;return known;},async inspect(){return {status:'succeeded',manifestSha256:known.manifestSha256,plan:{urls:[url]}};},async load(){return known;}};
  const fetchImpl=async(_url,{body})=>{
    const input=JSON.parse(body);requests.push(input);
    if(input.messages.some(m=>m.content?.includes('synthetic-fail-only')))return new Response('not valid JSON',{status:200});
    if(input.messages.some(m=>m.role==='system'&&m.content?.includes('[Research contract: deep-evidence@2]'))){
      assert.ok(input.messages.find(m=>m.role==='user')?.content.includes(question));
      assert.ok(!input.messages.find(m=>m.role==='user')?.content.includes('deep-evidence@1'));
      if(!input.messages.some(m=>m.role==='tool'))return Response.json({choices:[{message:{role:'assistant',tool_calls:[{type:'function',id:'read-one',function:{name:'public_web_read',arguments:JSON.stringify({url})}}]},finish_reason:'tool_calls'}]});
      assert.match(input.messages.at(-1).content,/Evidence dated 2020/);
      return final('Verified original: 2020-01-01 '+url);
    }
    assert.ok(input.messages.some(m=>m.content?.includes(question)));
    return final('Standard answer');
  };
  const launch=async()=>{const g=await startLocalGui({projectDir,liveConfig:config,env:{ETF_GUI_PROVIDER_KEY:'fixture-not-secret'},fetchImpl,ownerWebTransport});instances.push(g);return g;};
  const post=(g,path,body)=>fetch(g.origin+path,{method:'POST',headers:{origin:g.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const get=(g,path)=>fetch(g.origin+path).then(r=>r.json());
  const g=await launch();
  assert.ok((await get(g,'/api/workspace')).capabilities.includes('deep-research'));
  const boot=async(depth,messageId)=>{
    const {id}=await post(g,'/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
    const body={question,messageId,...(depth?{researchDepth:depth}:{})};
    assert.equal((await post(g,path+'/messages',body)).status,202);
    let m;
    for(let i=0;i<100;i++){m=(await get(g,path)).messages[0];if(['completed','failed'].includes(m?.status)&&!m.working)break;await sleep(20);}
    assert.equal(m.status,'completed',JSON.stringify(m));
    return {path,body,m};
  };
  const a=await boot('auto','standard'),d=await boot('deep','deep-id');
  assert.equal(a.m.researchDepth,'auto');assert.equal(a.m.effectiveResearchIntent,'direct');assert.equal(d.m.researchDepth,'deep');assert.equal(d.m.question,question);
  assert.equal(d.m.output.answer,'Verified original: 2020-01-01 '+url);
  assert.equal(requests.length,3);assert.equal(acq,1);
  assert.equal(requests[0].messages.some(m=>m.content?.includes('[Deep research evidence state]')),false);
  assert.match(requests[1].messages.filter(m=>m.role==='system').map(m=>m.content).join(' '),/No original source is recorded yet/);
  assert.match(requests[2].messages.filter(m=>m.role==='system').map(m=>m.content).join(' '),/Original sources have been acquired/);
  assert.match(requests[2].messages.filter(m=>m.role==='system').map(m=>m.content).join(' '),/last remaining Main round/);
  assert.doesNotMatch(requests[1].messages.filter(m=>m.role==='system').map(m=>m.content).join(' '),/last remaining Main round/);
  assert.deepEqual(requests[1].tools,requests[2].tools);
  assert.deepEqual(d.m.deepProgress,{schemaVersion:'evidence-milestones@1',phase:'delivered',originalsRead:1,settledSourceChecks:1,unavailableSourceChecks:0});
  const frozen=await inspectResearchTask({projectDir,runId:d.m.runId});
  assert.equal(frozen.definition.researchDepth,'deep');assert.equal(frozen.run.definition.config.researchProfile,'deep-evidence@2');
  assert.doesNotMatch(frozen.definition.question,/deep-evidence@1/);
  assert.equal(d.m.evidenceAssessment,'unreviewed');
  const progress=await get(g,d.path+'/messages/deep-id/progress');
  assert.equal(progress.researchIntent,'deep');
  assert.deepEqual(progress.deepProgress,d.m.deepProgress);
  assert.match(JSON.stringify(progress), /tool|source/i);
  assert.doesNotMatch(JSON.stringify(progress),/deep-evidence@1|Evidence dated 2020/);
  await g.close();
  const cold=await launch();
  assert.equal((await get(cold,d.path)).messages[0].researchDepth,'deep');
  assert.deepEqual((await get(cold,d.path)).messages[0].deepProgress,d.m.deepProgress);
  assert.equal((await post(cold,d.path+'/messages',d.body)).status,202);
  assert.notEqual((await post(cold,d.path+'/messages',{...d.body,researchDepth:'auto'})).status,202);
  assert.notEqual((await post(cold,d.path+'/messages',{...d.body,researchDepth:'unknown'})).status,202);
  assert.equal(requests.length,3);
  const {id}=await post(cold,'/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  const failure={messageId:'deep-fail',question:'synthetic-fail-only',researchDepth:'deep'};
  assert.equal((await post(cold,path+'/messages',failure)).status,202);
  let m;
  for(let i=0;i<100;i++){m=(await get(cold,path)).messages[0];if(m?.status==='failed'&&!m.working)break;await sleep(20);}
  assert.equal(m.researchDepth,'deep');assert.equal(m.code,'PROVIDER_PROTOCOL_INVALID');assert.equal(m.output,null);assert.equal(m.deepProgress.phase,'stopped');
  await cold.close();
  const reopen=await launch();
  assert.equal((await get(reopen,path)).messages[0].researchDepth,'deep');
  assert.equal((await post(reopen,path+'/messages',failure)).status,202);
  assert.equal(requests.length,4);
});

test('automatic intent uses the first normal proposal; durable Research/Deep, manual override, false labels and unsupported capability',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/deep-intent-'));
 const instances=[];t.after(async()=>{for(const g of instances)await g.close();await rm(projectDir,{recursive:true,force:true});});
 const calls=[];
 const fetchImpl=async(_url,{body})=>{
  const p=JSON.parse(body),q=p.messages.find(m=>m.role==='user').content;
  const system=p.messages.find(m=>m.role==='system')?.content;
  const route=p.tools.some(t=>t.function.name==='select_research_intent');
  const receipt=p.messages.find(m=>m.role==='tool');
  calls.push({q,system,route,receipt:!!receipt});
  if(q.includes('wrong type'))return final('select_research_intent: deep; I claim verification');
  if(q.includes('no tools available')){assert.equal(route,false);assert.equal(system,undefined);return final('Available knowledge only');}
  if(q.includes('unsupported intent sample')){
    assert.equal(route,false);assert.equal(system,undefined);
    if(receipt){assert.notEqual(JSON.parse(receipt.content).value?.kind,'auto-intent@1');return final('No promoted intent');}
    return Response.json({choices:[{message:{role:'assistant',tool_calls:[{type:'function',id:'unlisted',function:{name:'select_research_intent',arguments:JSON.stringify({intent:'deep'})}}]},finish_reason:'tool_calls'}]});
  }
  if(q.includes('manual wins')){assert.equal(route,false);assert.match(system,/deep-evidence/);return final('Manual');}
  if(!receipt){
   assert.equal(route,true);
   return Response.json({choices:[{message:{role:'assistant',tool_calls:[{type:'function',id:'selection',function:{name:'select_research_intent',arguments:JSON.stringify({intent:q.includes('cross-market comparison')?'deep':'research'})}}]},finish_reason:'tool_calls'}]});
  }
  assert.equal(route,false);assert.equal(JSON.parse(receipt.content).value.kind,'auto-intent@1');
  if(q.includes('cross-market comparison'))assert.match(system,/deep-evidence/);else assert.match(system,/available original source/);
  return final('Factual or scoped uncertainty');
 };
 const launch=async(connectivity=config.connectivity)=>{
  const profile={...config,connectivity};if(!connectivity)delete profile.connectivity;
  const g=await startLocalGui({projectDir,liveConfig:profile,env:{ETF_GUI_PROVIDER_KEY:'fixture'},fetchImpl});instances.push(g);return g;
 };
 const post=(g,path,body)=>fetch(g.origin+path,{method:'POST',headers:{origin:g.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=(g,path)=>fetch(g.origin+path).then(r=>r.json());
 async function execute(g,messageId,question,researchDepth='auto'){
  const {id}=await post(g,'/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  const body={messageId,question,researchDepth};
  assert.equal((await post(g,path+'/messages',body)).status,202);
  let turn;
  for(let i=0;i<120;i++){
   turn=(await get(g,path)).messages[0];
   if(['completed','failed'].includes(turn?.status)&&!turn.working)break;
   await sleep(20);
  }
  assert.equal(turn.status,'completed',JSON.stringify(turn));
  return {path,turn,body};
 }
 const g=await launch();
 const r=await execute(g,'auto-research','source check for today');
 const d=await execute(g,'auto-deep','cross-market comparison across dated originals');
 const f=await execute(g,'false-label','wrong type');
 const m=await execute(g,'manual','manual wins','deep');
 assert.deepEqual([r,d,f,m].map(x=>x.turn.effectiveResearchIntent),['research','deep','direct','deep']);
 assert.equal((await get(g,d.path+'/messages/auto-deep/progress')).researchIntent,'deep');
 assert.equal((await get(g,f.path+'/messages/false-label/progress')).researchIntent,undefined);
 assert.equal(f.turn.evidenceAssessment,undefined);assert.equal(d.turn.evidenceAssessment,'unreviewed');
 assert.equal(calls.length,6);
 assert.equal(r.turn.deepProgress,undefined);assert.equal(f.turn.deepProgress,undefined);
 assert.equal(d.turn.deepProgress.phase,'delivered');assert.equal(d.turn.deepProgress.originalsRead,0);
 const frozen=await inspectResearchTask({projectDir,runId:d.turn.runId});
 assert.equal(frozen.definition.researchDepth,'auto');assert.equal(frozen.run.definition.config.researchProfile,'auto-intent@2');
 await g.close();
 const cold=await launch();
 assert.equal((await get(cold,d.path)).messages[0].effectiveResearchIntent,'deep');
 assert.equal((await post(cold,d.path+'/messages',d.body)).status,202);
 assert.equal(calls.length,6);
 await cold.close();
 const unsupported=await launch(false);
 const u=await execute(unsupported,'unsupported','no tools available');
 assert.equal(u.turn.effectiveResearchIntent,'direct');assert.equal(calls.length,7);
 const original=await inspectResearchTask({projectDir,runId:u.turn.runId});
 assert.equal(original.run.definition.config.allowedTools.includes('select_research_intent'),false);
 assert.equal(original.run.definition.bindings.adapters.some(x=>x.id==='research-intent'),false);
 const {id}=await post(unsupported,'/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
 assert.equal((await post(unsupported,path+'/messages',{messageId:'unsupported-hidden',question:'unsupported intent sample',researchDepth:'auto'})).status,202);
 let hidden;
 for(let i=0;i<120;i++){hidden=(await get(unsupported,path)).messages[0];if(['completed','failed'].includes(hidden?.status)&&!hidden.working)break;await sleep(20);}
 assert.ok(['completed','failed'].includes(hidden?.status));
 assert.notEqual(hidden.effectiveResearchIntent,'deep');
 assert.equal((await get(unsupported,path+'/messages/unsupported-hidden/progress')).researchIntent,undefined);
 const rejected=await inspectResearchTask({projectDir,runId:hidden.runId});
 assert.equal(rejected.run.definition.config.allowedTools.includes('select_research_intent'),false);
 assert.equal(rejected.run.snapshot.messages.some(x=>x.role==='tool'&&x.result?.value?.kind==='auto-intent@1'),false);
});
