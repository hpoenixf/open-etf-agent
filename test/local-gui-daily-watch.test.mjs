import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLocalGui} from '../src/gui-server.mjs';
import {dailySlot,openGuiDailyWatch} from '../src/gui-daily-watch.mjs';
import {createScheduledReportEmailHook} from '../src/scheduled-report-email.mjs';

const at=s=>Date.parse('2026-11-'+s+'+08:00');
const fixed={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'offline-test',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:1}};
const env={ETF_GUI_PROVIDER_KEY:'fixture-provider-credential',ETF_GUI_DAILY_AUTORUN:'1'};
const result=text=>Response.json({choices:[{message:{role:'assistant',content:text},finish_reason:'stop'}]});
async function workspace(t) {
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/daily-watch-'));
 const servers=[];
 t.after(async()=>{await Promise.all(servers.map(s=>s.close()));await rm(projectDir,{recursive:true,force:true});});
 return {projectDir,async launch(options={}){
  const server=await startLocalGui({projectDir,liveConfig:fixed,env,...options});servers.push(server);
  const get=(path,init)=>fetch(server.origin+path,init);
  const post=(path,body)=>get(path,{method:'POST',headers:{origin:server.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const daily=()=>get('/api/daily-watch').then(r=>r.json());
  return {...server,get,post,daily};
 }};
}
const collection='/api/daily-watch';

test('three due watches are independently observed once; busy manual work preserves all slots; paused and edited schedules stay authoritative',async t=>{
 let now=at('22T07:55:00'),modelCalls=0, entered, release;
 const waiting=new Promise(r=>{entered=r;});
 const held=new Promise(r=>{release=r;});
 t.after(()=>release());
 const setup=await workspace(t);
 const launch=()=>setup.launch({dailyClock:()=>now,async fetchImpl(_url,opts){
  const request=JSON.parse(opts.body);
  modelCalls++;
  if(request.messages[0].content.startsWith('manual busy')){entered();await held;}
  return result('original verified answer '+modelCalls);
 }});
 const g=await launch();
 const create=async(question,extra={})=>{
  const rr=await g.post(collection,{question,localTime:'08:00',enabled:true,...extra});
  assert.equal(rr.status,201);return rr.json();
 };
 const [a,b,c]=await Promise.all(['Gold','Bonds','Index'].map((name,i)=>create(name,{requestId:'w'+'a'.repeat(23)+i})));
 const paused=await create('Pause me'),edited=await create('Edit me');
 assert.equal((await create('Gold',{requestId:'w'+'a'.repeat(23)+'0'})).id,a.id);
 assert.equal((await g.post(collection,{requestId:'w'+'a'.repeat(23)+'0',question:'changed',localTime:'08:00',enabled:true})).status,409);
 await g.sweepDaily();assert.equal(modelCalls,0);
 now=at('22T07:59:00');
 assert.equal((await g.post(collection+'/'+paused.id,{question:paused.question,localTime:'08:00',enabled:false})).status,200);
 assert.equal((await g.post(collection+'/'+edited.id,{question:edited.question,localTime:'09:00',enabled:true})).status,200);
 const manual=(await g.post('/api/conversations',{}).then(r=>r.json())).id;
 assert.equal((await g.post('/api/conversations/'+manual+'/messages',{question:'manual busy',messageId:'manual'})).status,202);
 await waiting;
 now=at('22T08:00:00');
 await g.sweepDaily();
 assert.ok((await g.daily()).items.every(item=>item.history.length===0));
 release();
 // Await the actual manual worker finish before handing off.
 for(let i=0;i<80;i++){
  const {messages}=await g.get('/api/conversations/'+manual).then(r=>r.json());
  if(!messages[0]?.working&&messages[0]?.status==='completed')break;
  await new Promise(r=>setTimeout(r,20));
 }
 for(let i=0;i<5;i++)await g.sweepDaily();
 assert.equal(modelCalls,4);
 const visible=await g.daily();
 const expected=new Set([a.id,b.id,c.id]);
 for(const item of visible.items){
  if(expected.has(item.id)){
   assert.equal(item.history.length,1);assert.equal(item.history[0].status,'completed');
   const turn=(await g.get('/api/conversations/'+item.history[0].conversationId).then(r=>r.json())).messages;
   assert.equal(turn[0].id,item.history[0].messageId);
   assert.equal(turn[0].question,item.question);
   assert.match(turn[0].output.answer,/original verified answer/);
  }else assert.equal(item.history.length,0);
 }
 assert.equal(visible.items.find(row=>row.id===paused.id).enabled,false);
 assert.equal(visible.items.find(row=>row.id===edited.id).localTime,'09:00');
 assert.equal((await g.get(collection,{headers:{origin:'https://foreign.example'}})).status,403);
 await g.close();
 const cold=await launch();
 await cold.sweepDaily();assert.equal(modelCalls,4);
 assert.deepEqual(await cold.daily(),visible);
});

test('daily receipt holds a crash ambiguity; Shanghai calendar does not catch up old days or late settings',async t=>{
 let now=at('22T08:01:00');
 const setup=await workspace(t);
 const db=await openGuiDailyWatch(setup.projectDir,{now:()=>now});
 const watch=db.save({question:'late explicit',localTime:'08:00',enabled:true});
 assert.equal(db.claim(),null);
 now=at('23T08:00:00');
 assert.equal(dailySlot(now,'08:00').date,'2026-11-23');
 const held=db.claim();assert.equal(held.watchId,watch.id);
 db.close();
 const cold=await openGuiDailyWatch(setup.projectDir,{now:()=>now});
 try{
  assert.equal(cold.claim(),null);
  assert.equal(cold.list()[0].history[0].status,'unknown');
  now=at('25T08:00:00');
  assert.equal(cold.claim().date,'2026-11-25');
  assert.deepEqual(cold.list()[0].history.map(x=>x.date),['2026-11-25','2026-11-23']);
 }finally{cold.close();}
});

test('email failure from verified original Publication leaves completed research untouched and never resends',async t=>{
 let now=at('22T07:55:00'),model=0,transmissions=0;
 const setup=await workspace(t);
 const destination={address:'daily@example.invalid',verified:true,enabled:true,version:'mock-confirmed-1'};
 const onDailyCompleted=createScheduledReportEmailHook({resolveConfirmedDestination:async()=>destination,async transport({to,text}){
  transmissions++;assert.equal(to,destination.address);assert.equal(text,'immutable model answer');
  throw Error('synthetic ambiguous mail reply');
 }});
 const launch=()=>setup.launch({dailyClock:()=>now, onDailyCompleted, async fetchImpl(){model++;return result('immutable model answer');}});
 const noMail=await setup.launch({env:{...env,ETF_GUI_DAILY_AUTORUN:'0'},dailyClock:()=>now});
 assert.equal((await noMail.post(collection,{question:'deny',localTime:'08:00',enabled:true,emailEnabled:true})).status,400);
 await noMail.close();
 const g=await launch();
 assert.equal((await g.post(collection,{question:'daily email evidence',localTime:'08:00',enabled:true,emailEnabled:true,emailConsentToken:(await g.daily()).emailConsentToken})).status,201);
 assert.equal(model,0);
 now=at('22T08:00:00');await g.sweepDaily();
 const first=await g.daily();
 assert.deepEqual(first.items.map(x=>x.history.map(y=>[y.status,y.emailStatus])),[[['completed','unknown']]]);
 assert.deepEqual([model,transmissions],[1,1]);
 await g.close();const cold=await launch();await cold.sweepDaily();
 const readback=await cold.daily();
 assert.deepEqual(readback.items,first.items);
 assert.deepEqual([model,transmissions],[1,1]);
});

test('cold sweep observes a Run committed between daily claim and index write, but never resubmits it',async t=>{
 const {createConversation,submitConversationMessage,workConversationMessage}=await import('../src/conversation.mjs');
 let now=at('22T07:55:00'),model=0;
 const setup=await workspace(t);
 const fetchImpl=async()=>{model++;return result('verified prior occurrence');};
 const g=await setup.launch({dailyClock:()=>now,fetchImpl});
 const saved=await g.post(collection,{question:'observe pre-existing daily Run',localTime:'08:00',enabled:true}).then(r=>r.json());
 await g.close();
 const watch=await openGuiDailyWatch(setup.projectDir,{now:()=>now});
 const {inspectResearchProject}=await import('../src/research-project.mjs');
 const configVersion=(await inspectResearchProject({projectDir:setup.projectDir})).configSha256;
 now=at('22T08:00:00');const held=watch.claim(configVersion);
 const {conversationId,messageId,question}=held;
 await createConversation({projectDir:setup.projectDir,conversationId});
 const original=await submitConversationMessage({projectDir:setup.projectDir,conversationId,messageId,text:question,sourceManifestSha256:null,
  authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
 await workConversationMessage({projectDir:setup.projectDir,conversationId,messageId,fetchImpl,apiKey:'mock-key'});
 assert.equal(watch.list()[0].history[0].runId,null);
 watch.close();
 const cold=await setup.launch({dailyClock:()=>now,fetchImpl});
 await cold.sweepDaily();
 const current=(await cold.daily()).items.find(x=>x.id===saved.id).history[0];
 assert.equal(current.runId,original.runId);
 assert.equal(current.status,'completed');
 assert.equal(model,1);
});

test('pause/edit without configured mail preserves prior explicit preference',async t=>{
 let now=at('22T07:55:00');
 const setup=await workspace(t);
 const g=await setup.launch({dailyClock:()=>now,onDailyCompleted:async()=>({status:'accepted'})});
 const watch=await g.post(collection,{question:'daily mail preference',localTime:'08:00',enabled:true,emailEnabled:true,emailConsentToken:(await g.daily()).emailConsentToken}).then(r=>r.json());
 await g.close();
 const cold=await setup.launch({dailyClock:()=>now});
 const edit=await cold.post(collection+'/'+watch.id,{question:'edited',localTime:'08:05',enabled:false});
 assert.equal(edit.status,200);assert.equal((await edit.json()).emailEnabled,true);
});
