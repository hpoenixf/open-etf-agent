import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {startLocalGui} from '../src/gui-server.mjs';

const ownerConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic-deep',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:3},connectivity:{web:true}};
const question='介绍一下最近两周纳斯达克为什么大跌？';
const url='https://example.com/original';
const bad1='https://example.net/refusal';
const bad2='https://example.org/refusal';
const known={manifestSha256:'a'.repeat(64),catalog:{documents:[{pages:['Synthetic original on the timing.'],web:{requestedUrl:url,finalUrl:url,retrievedAt:'2020-01-02T00:00:00Z',originalSha256:'b'.repeat(64)}}]}};
const tool=(id,name,args)=>({type:'function',id,function:{name,arguments:JSON.stringify(args)}});
const respond=(message,finish_reason)=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
const system=input=>input.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
const update=(status='open')=>({items:[{id:'market-baseline',need:'Verify the index return and dates',status}]});

test('new Deep Main serializes a committed brief and missing-original guidance without extra mandatory model calls',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/research-needs-'));
 const requests=[],attempts=new Map();let g;
 t.after(async()=>{await g?.close();await rm(projectDir,{recursive:true,force:true});});
 const ownerWebTransport={
  async acquire(input){
   attempts.set(input.acquisitionId,input.urls[0]);
   if(input.urls[0]===url)return known;
   throw Object.assign(new Error('synthetic refusal'),{code:'WEB_ROBOTS_WORK_LIMIT'});
  },
  async inspect({acquisitionId}){
   const found=attempts.get(acquisitionId);
   if(found===url)return {status:'succeeded',manifestSha256:known.manifestSha256,plan:{urls:[url]}};
   return {status:'failed',code:'WEB_ROBOTS_WORK_LIMIT',dispatchOutcomeKnown:true,unknownRequests:0,plan:{urls:[found]}};
  },
  async load(){return known;}
 };
 const fetchImpl=async(_url,{body})=>{
  const input=JSON.parse(body);requests.push(input);
  assert.ok(input.messages.find(m=>m.role==='user').content.includes(question));
  const isDeep=/\[Research contract: deep-evidence@\d+\]/.test(system(input));
  const hasNoteTool=input.tools.some(item=>item.function.name==='update_research_needs');
  if(!isDeep){
   assert.equal(hasNoteTool,false);
   assert.doesNotMatch(system(input),/Deep research working brief/);
   return respond({content:'Standard fixture answer'},'stop');
  }
  // Replay the same original-source access and refusals on both baselines.
  // Pair the optional note with the existing tool calls, not a dedicated model round.
  if(!input.messages.some(m=>m.role==='tool')){
   return respond({tool_calls:[...(hasNoteTool?[tool('needs','update_research_needs',update())]:[]),tool('source','public_web_read',{url}),tool('fail-1','public_web_read',{url:bad1}),tool('fail-2','public_web_read',{url:bad2})]},'tool_calls');
  }
  const results=input.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
  assert.equal(results.filter(v=>v?.reason==='WEB_ROBOTS_WORK_LIMIT').length,2);
  return respond({content:'Scoped evidence only; the alternatives were inaccessible.'},'stop');
 };
 g=await startLocalGui({projectDir,liveConfig:ownerConfig,env:{ETF_GUI_PROVIDER_KEY:'fixture-not-secret'},fetchImpl,ownerWebTransport});
 const post=(path,body)=>fetch(g.origin+path,{method:'POST',headers:{origin:g.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const read=path=>fetch(g.origin+path).then(r=>r.json());
 const ask=async(researchDepth)=>{
  const {id}=await post('/api/conversations',{}).then(r=>r.json()),path='/api/conversations/'+id;
  assert.equal((await post(path+'/messages',{question,messageId:researchDepth,researchDepth})).status,202);
  let m;
  for(let i=0;i<160;i++){
   m=(await read(path)).messages[0];
   if(['completed','failed'].includes(m?.status)&&!m.working)break;
   await sleep(25);
  }
  assert.equal(m.status,'completed',JSON.stringify(m));return m;
 };
 const standard=await ask('standard');
 const deep=await ask('deep');
 assert.equal(standard.output.answer,'Standard fixture answer');
 assert.equal(deep.output.answer,'Scoped evidence only; the alternatives were inaccessible.');
 assert.equal(deep.evidenceAssessment,'unreviewed');
 assert.deepEqual(deep.deepProgress,{schemaVersion:'evidence-milestones@1',phase:'delivered',originalsRead:1,settledSourceChecks:3,unavailableSourceChecks:2});
 assert.equal(requests.length,3);
 assert.match(system(requests[1]),/"kind":"original-question"/);
 assert.match(system(requests[1]),/exact interval, index\/metric and size/);
 assert.match(system(requests[1]),/competing explanations against observed timing/);
 assert.match(system(requests[2]),/"kind":"authored","items":\[\{"id":"market-baseline"/);
 assert.match(system(requests[2]),/Original sources have been acquired/);
 assert.match(system(requests[2]),/Do not retry the same refusal/);
 assert.match(system(requests[2]),/high-impact gap remains and a useful authorized alternative exists/);
 assert.match(system(requests[2]),/State limitations and do not invent evidence/); // One ordinary Standard + two Deep, no extra planning turn.
 assert.equal(attempts.size,3);
});
