import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, appendFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startLocalGui } from '../src/gui-server.mjs';
import { inspectResearchTask } from '../src/research-project.mjs';
import { readGuiResearchProgress } from '../src/gui-progress.mjs';

async function setup(t) {
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/gui-progress-'));
 const servers=[];
 t.after(async()=>{await Promise.all(servers.map(s=>s.close()));await rm(projectDir,{recursive:true,force:true});});
 return {projectDir,async launch(options={}){
  const server=await startLocalGui({projectDir,...options});servers.push(server);
  const get=(path,init)=>fetch(server.origin+path,init);
  const post=(path,body)=>get(path,{method:'POST',headers:{origin:server.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  return {...server,get,post};
 }};
}
async function conversation(gui){
 const {id}=await gui.post('/api/conversations',{}).then(r=>r.json());
 return '/api/conversations/'+id;
}
async function terminal(gui,path){
 for(let i=0;i<120;i++){
  const c=await gui.get(path).then(r=>r.json());
  if(['completed','failed','cancelled'].includes(c.messages?.[0]?.status))return c.messages[0];
  await delay(25);
 }
 assert.fail('expected terminal GUI turn');
}

test('own GUI progress is scoped by conversation and stable across cold reopen; hostile raw fields never leave the API',async t=>{
 const fixture=await setup(t),g=await fixture.launch();
 const {sources}=await g.get('/api/workspace').then(r=>r.json());
 const path=await conversation(g),other=await conversation(g),input={messageId:'my-turn',question:'private-input-example <img onerror=x>',sourceId:sources[0].id};
 const response=await g.post(path+'/messages',input);
 assert.equal(response.status,202);
 const {runId}=await response.json();
 assert.equal((await terminal(g,path)).status,'completed');
 const endpoint=path+'/messages/my-turn/progress';
 assert.equal((await g.get(other+'/messages/my-turn/progress')).status,404);
 const {run}=await inspectResearchTask({projectDir:fixture.projectDir,runId});
 const clean=await g.get(endpoint).then(r=>r.json());
 assert.equal(clean.status,'available',JSON.stringify(clean));
 assert.deepEqual(clean.steps.map(x=>x.code),['started','tool_prepare','tool_returned','tool_prepare','tool_returned','synthesis','completed']);
 assert.ok(clean.steps.some(x=>x.label==='读取所选资料已返回'));
 assert.ok(clean.steps.some(x=>x.label==='保存报告已返回'));
 const hostile='private-input-example BEARER-X <img src=x onerror=x> https://secret.example/private?q=token';
 const envelope={runId:run.runId,rootId:run.rootId,sequence:999};
 await appendFile(join(run.directory,'run.jsonl'),[
  {...envelope,type:'tool_result',name:'external_unknown_tool',status:'failed',dispatched:true,reasoning_content:hostile},
  {...envelope,type:'tool_proposal',name:'public_web_search',rootId:'other-root',question:hostile},
  {...envelope,type:'tool_result',name:'public_web_read',status:'failed',arguments:hostile,result:hostile,error:hostile},
  {...envelope,type:'model_proposal',kind:'calls',prompt:hostile,reasoning_content:hostile,usage:{total_tokens:123}},
 ].map(x=>JSON.stringify(x)).join('\n')+'\n');
 const projected=await g.get(endpoint).then(r=>r.json());
 assert.equal(projected.steps.length,clean.steps.length+1);
 assert.deepEqual(projected.steps.at(-2),{code:'tool_unavailable',label:'读取公开网页未完成'});
 assert.doesNotMatch(JSON.stringify(projected),/private-input-example|BEARER-X|secret\.example|external_unknown_tool|reasoning_content|arguments|onerror|runId|123/);
 assert.equal((await g.get(endpoint,{headers:{origin:'https://example.test'}})).status,403);
 assert.equal((await readGuiResearchProgress(fixture.projectDir,{...run,directory:fixture.projectDir})).status,'unavailable');
 await g.close();
 const cold=await fixture.launch();
 assert.deepEqual(await cold.get(endpoint).then(r=>r.json()),projected);
 assert.equal((await cold.get(path).then(r=>r.json())).messages[0].question,input.question);
});

test('active progress responds during a genuine in-flight fake model call, then settles without exposing reasoning',async t=>{
 const fixture=await setup(t);
 const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'mock',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:3}};
 let release,entered;
 const waiting=new Promise(r=>{release=r;});
 const firstRequest=new Promise(r=>{entered=r;});
 t.after(()=>release());
 const fakeKey='only-an-inference-fixture';
 const g=await fixture.launch({liveConfig,env:{ETF_GUI_PROVIDER_KEY:fakeKey},async fetchImpl(){
  entered();await waiting;
  return Response.json({choices:[{message:{role:'assistant',content:'final answer',reasoning_content:'synthetic hidden reasoning <script>'},finish_reason:'stop'}]});
 }});
 const c=await conversation(g);
 const turn={messageId:'in-flight',question:'in flight private question'};
 assert.equal((await g.post(c+'/messages',turn)).status,202);
 await firstRequest;
 try{
  const check=await g.get(c+'/messages/in-flight/progress').then(r=>r.json());
  assert.deepEqual(check.steps,[{code:'started',label:'开始处理问题'}]);
 }finally{release();}
 assert.equal((await terminal(g,c)).status,'completed');
 const done=await g.get(c+'/messages/in-flight/progress').then(r=>r.json());
 assert.deepEqual(done.steps.map(x=>x.code),['started','synthesis','completed']);
 assert.doesNotMatch(JSON.stringify(done),/hidden reasoning|script|private question|inference-fixture|final answer/);
 const guiJs=await g.get('/gui.mjs').then(r=>r.text());
 assert.match(guiJs,/make\('summary','研究进度'\)/);
 assert.match(guiJs,/e\.textContent = text/);
});
