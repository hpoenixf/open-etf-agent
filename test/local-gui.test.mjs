import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { startLocalGui } from '../src/gui-server.mjs';
import { createResearchProject, inspectResearchCapacity, inspectResearchTask } from '../src/research-project.mjs';

const exec = promisify(execFile);
const sha = text => createHash('sha256').update(text).digest('hex');
async function setting(t) {
  await mkdir('test-output', { recursive:true });
  const projectDir = await mkdtemp(resolve('test-output/gui-'));
  const sessions = [];
  t.after(async () => {
    await Promise.all(sessions.map(s=>s.close()));
    await rm(projectDir,{recursive:true,force:true});
  });
  return {projectDir, async start() {
    const s=await startLocalGui({projectDir});
    sessions.push(s);
    const get=(path,init)=>fetch(s.origin+path,init);
    const post=(path,input,override={})=>get(path,{method:'POST',headers:{origin:s.origin,'content-type':'application/json',...override},body:JSON.stringify(input)});
    return {...s,post,get};
  }};
}
async function eventual(get, path) {
  for (let i=0;i<50;i++) {
    const value=await get(path).then(r=>r.json());
    if (value.messages?.[0]?.status==='completed') return value;
    await new Promise(r=>setTimeout(r,25));
  }
  throw Error('Expected original message to complete');
}

test('local GUI persists one original turn and verifies published report and its exact source across cold readers', async t => {
  const f=await setting(t), g=await f.start();
  const shell=await g.get('/');
  assert.equal(shell.status,200);
  assert.match(shell.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.match(await shell.text(),/离线演练/);
  const workspace=await g.get('/api/workspace').then(r=>r.json());
  assert.equal(workspace.mode,'offline-demo');
  assert.equal(typeof workspace.projectId,'string');
  assert.equal(workspace.sources.length,2);
  assert.equal(workspace.conversations.length,0);
  const conversationId=(await g.post('/api/conversations',{}).then(r=>r.json())).id;
  const path='/api/conversations/'+conversationId, turn={messageId:'stable-turn',question:'核对 Alpha 和 Beta 的费率 <b>作为文字</b>',sourceId:workspace.sources[0].id};
  assert.deepEqual((await g.get('/api/workspace').then(r=>r.json())).conversations,[{id:conversationId,title:null}]);
  const reportPath=path+'/messages/'+turn.messageId+'/report.md';
  assert.equal((await g.get(reportPath)).status,404);
  const sent=await g.post(path+'/messages',turn);
  assert.equal(sent.status,202);
  const {runId}=await sent.json();
  const result=(await eventual(g.get,path)).messages[0];
  assert.equal(result.runId,runId);
  assert.equal(result.output.publicationStatus,'published');
  assert.equal(result.question,turn.question);
  assert.match(result.output.report.text,/Alpha ETF 的年管理费率为 0.20%/);
  assert.equal(sha(result.output.report.text),result.output.report.sha256);
  assert.equal(sha(result.output.sources[0].text),result.output.sources[0].sha256);
  assert.equal(result.output.sources.length,1);
  assert.equal((await g.post(path+'/messages',turn).then(r=>r.json())).runId,runId);
  assert.equal((await g.post(path+'/messages',{...turn,question:'不同'})).status,409);
  await g.close();

  const cli=JSON.parse((await exec(process.execPath,['src/conversation-cli.mjs','read','--project',f.projectDir,'--conversation',conversationId,'--message',turn.messageId])).stdout);
  assert.equal(cli.output.report.sha256,result.output.report.sha256);
  const cold=await f.start();
  assert.deepEqual((await cold.get(path).then(r=>r.json())).messages,[result]);
  const reloaded=await cold.get('/api/workspace').then(r=>r.json());
  assert.equal(reloaded.projectId,workspace.projectId);
  assert.deepEqual(reloaded.conversations,[{id:conversationId,title:turn.question}]);
  const attachment=await cold.get(reportPath);
  assert.equal(attachment.status,200);
  assert.equal(attachment.headers.get('content-type'),'text/markdown; charset=utf-8');
  assert.equal(attachment.headers.get('content-disposition'),'attachment; filename="etf-report-stable-turn.md"');
  assert.equal(await attachment.text(),result.output.report.text);
  assert.equal((await cold.get(reportPath,{headers:{origin:'http://invalid.test'}})).status,403);
  assert.equal((await cold.get(reportPath.replace('report.md','reportXmd'))).status,404);
});

test('lost submit response permits only the original Run and original fixture dispatch receipts after reload', async t => {
  const f = await setting(t), g = await f.start();
  const { sources } = await g.get('/api/workspace').then(r => r.json());
  const { id } = await g.post('/api/conversations',{}).then(r => r.json());
  const path = '/api/conversations/' + id;
  const input = { messageId:'lost-reply-id', question:'核对原始费率。', sourceId:sources[0].id };
  const bytes = JSON.stringify(input);
  // Only the intermediary observes 202; drop the reply before any body can
  // reach the simulated caller. Its stable retry envelope is unchanged.
  await new Promise((resolve,reject) => {
    const req = request(g.origin + path + '/messages',{ method:'POST',headers:{
      origin:g.origin, 'content-type':'application/json', 'content-length':Buffer.byteLength(bytes),
    }}, response => { assert.equal(response.statusCode,202); response.destroy(); resolve(); });
    req.once('error',reject);
    req.end(bytes);
  });
  const original = await eventual(g.get,path);
  assert.equal(original.messages.length,1);
  const [before] = original.messages;
  assert.equal(before.id,input.messageId);
  assert.equal(before.question,input.question);
  const { run:beforeRun } = await inspectResearchTask({projectDir:f.projectDir,runId:before.runId});
  const originalUsage = await inspectResearchCapacity({projectDir:f.projectDir,runId:before.runId});
  assert.equal(beforeRun.rootUsage.model,3); // read, save, final: one scripted sequence
  assert.equal(originalUsage.requests.length,3);
  assert.deepEqual(originalUsage.requests.map(x=>[x.runId,x.modelOrdinal,x.state]),
    [1,2,3].map(n=>[before.runId,n,'completed']));
  await g.close();

  const cold = await f.start();
  assert.deepEqual(await cold.get(path).then(r=>r.json()), original);
  const replies = await Promise.all(Array.from({length:3},()=>cold.post(path+'/messages',input)));
  assert.ok(replies.some(r=>r.status===202));
  for (const r of replies) {
    assert.ok([202,409].includes(r.status));
    const payload = await r.json();
    if (r.status===202) assert.equal(payload.runId,before.runId);
    else assert.equal(payload.error,'GUI_WORKER_BUSY');
  }
  assert.equal((await cold.post(path+'/messages',{...input,question:'不同的问题'})).status,409);
  assert.deepEqual(await cold.get(path).then(r=>r.json()), original);
  const { run:afterRun } = await inspectResearchTask({projectDir:f.projectDir,runId:before.runId});
  assert.deepEqual(afterRun.rootUsage,beforeRun.rootUsage);
  assert.deepEqual(await inspectResearchCapacity({projectDir:f.projectDir,runId:before.runId}),originalUsage);
  assert.equal(sha(before.output.report.text),before.output.report.sha256);
  assert.equal(sha(before.output.sources[0].text),before.output.sources[0].sha256);
});

test('GUI stays loopback/origin-bound and refuses arbitrary source/files/config in requests', async t => {
  const f=await setting(t),g=await f.start();
  assert.match(g.origin,/^http:\/\/127\.0\.0\.1:/);
  assert.equal((await g.post('/api/conversations',{}, {origin:'http://invalid.test'})).status,403);
  assert.equal((await g.get('/api/conversations',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
  const { id }=await g.post('/api/conversations',{}).then(r=>r.json());
  assert.equal((await g.post('/api/conversations/'+id+'/messages',{messageId:'bad',question:'x',sourceId:'/arbitrary/path'})).status,400);
  assert.equal((await g.post('/api/conversations/'+id+'/messages',{messageId:'big',question:'a'.repeat(19000),sourceId:'bad'})).status,413);
  assert.equal((await g.get('/gui/etf-fees.md')).status,404);
  assert.equal((await g.get('/@private')).status,404);
});

test('GUI does not adopt a different existing research project or enable live mode',async t=>{
  const f=await setting(t);
  await createResearchProject({directory:f.projectDir,config:{
    schemaVersion:'research-project@1',
    gateway:{mode:'fixture',provider:'fixture',protocol:'fixture@1',model:'other'},
    capabilities:['report'],
  }});
  await assert.rejects(f.start(),/GUI_DEMO_PROJECT_REQUIRED/);
});
