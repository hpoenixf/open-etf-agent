import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, copyFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createLocalGuiWorkspace } from '../src/gui-server.mjs';
import { createConversation, submitConversationMessage } from '../src/conversation.mjs';
import { inspectResearchTask } from '../src/research-project.mjs';
import { openSession } from '../src/session.mjs';
import { preparePublication } from '../src/publication.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');
const conv='/api/conversations/exact';
const exactBody=messageId=>conv+'/messages/'+messageId+'/body';
const bodyText='  原始发布正文\n\n**未经重新生成**\n';
async function fixture(t){
  await mkdir('test-output',{recursive:true});
  const root=await mkdtemp(resolve('test-output/gui-body-'));
  const projectDir=join(root,'owner'), otherDir=join(root,'other');
  const owner=await createLocalGuiWorkspace({projectDir}), other=await createLocalGuiWorkspace({projectDir:otherDir});
  // The listener-free application is mounted only after the host authenticates
  // and selects a Project. Neither route path nor query can choose its Project.
  const server=createServer((req,res)=>{
    const selected={owner,other}[req.headers['x-test-account']];
    if(selected!==owner&&selected!==other){res.writeHead(401,{'cache-control':'no-store'});res.end();return;}
    void selected.handle(req,res);
  });
  const close=()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  t.after(async()=>{
    await Promise.all([close(),owner.close(),other.close()]);
    await rm(root,{recursive:true,force:true});
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  owner.setOrigin(origin); other.setOrigin(origin);
  const get=(path,{account='owner',method='GET',headers={}}={})=>fetch(origin+path,{
    method,headers:{...(account?{'x-test-account':account}:{}),...headers},
  });
  const post=(path,input)=>fetch(origin+path,{method:'POST',headers:{'x-test-account':'owner',origin,'content-type':'application/json'},body:JSON.stringify(input)});
  const workspace=await get('/api/workspace').then(r=>r.json());
  const otherWorkspace=await get('/api/workspace',{account:'other'}).then(r=>r.json());
  assert.notEqual(workspace.projectId,otherWorkspace.projectId);
  for(const dir of [projectDir,otherDir])await createConversation({projectDir:dir,conversationId:'exact'});
  const add=(messageId,dir=projectDir)=>submitConversationMessage({projectDir:dir,conversationId:'exact',
    messageId,text:'synthetic question '+messageId,sourceManifestSha256:(dir===projectDir?workspace:otherWorkspace).sources[0].id});
  const session=(runId)=>openSession({directory:join(projectDir,'sessions',runId)});
  return {get,post,workspace,add,session,projectDir,otherDir};
}
async function readJson(response,status){
  assert.equal(response.status,status);
  assert.equal(response.headers.get('cache-control'),'no-store');
  return response.json();
}
test('exact body is scoped to the authenticated mounted Project, not supplied IDs or alias files',async t=>{
  const f=await fixture(t);
  const a=await f.add('original');
  const store=await f.session(a.runId);
  try{
    const writer=store.claim(a.runId,'owner-test');
    writer.publish(preparePublication({runId:a.runId,rootId:a.runId,text:bodyText}));
    writer.release();
  }finally{store.close();}
  assert.equal((await f.get(exactBody('original'),{account:null})).status,401);
  assert.deepEqual(await readJson(await f.get(exactBody('original'),{account:'other'}),404),{error:'NOT_FOUND'});
  await f.add('original',f.otherDir);
  assert.deepEqual(await readJson(await f.get(exactBody('original'),{account:'other'}),409),{error:'BODY_NOT_PUBLISHED',status:'active'});
  assert.deepEqual(await readJson(await f.get(exactBody('original'),{headers:{origin:'https://elsewhere.invalid'}}),403),{error:'GUI_ORIGIN_REQUIRED'});
  assert.deepEqual(await readJson(await f.get(exactBody('original')+'?projectDir=other'),404),{error:'NOT_FOUND'});
  const messages=join(f.projectDir,'conversations','exact','messages');
  await copyFile(join(messages,'original.json'),join(messages,'alias.json'));
  assert.deepEqual(await readJson(await f.get(exactBody('alias')),503),{error:'BODY_READ_UNAVAILABLE'});
  await writeFile(join(messages,'broken.json'),'{invalid-json');
  assert.equal((await f.get(conv)).status,500);
  assert.deepEqual(await readJson(await f.get(exactBody('original')),200),{
    conversationId:'exact',messageId:'original',status:'active',body:{text:bodyText,sha256:sha(bodyText),revision:1},
  });
  const head=await f.get(exactBody('original'),{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(head.headers.get('cache-control'),'no-store');
  assert.equal(await head.text(),'');
});

test('Publication alone controls exact body; reads cannot change the original active or cancelled Run',async t=>{
  const f=await fixture(t);
  const {runId}=await f.add('terminal');
  const store=await f.session(runId);
  try{
    const before=store.inspect(runId);
    assert.deepEqual(await readJson(await f.get(exactBody('terminal')),409),{error:'BODY_NOT_PUBLISHED',status:'active'});
    assert.deepEqual(store.inspect(runId),before);
    const claim=store.claim(runId,'owner-test');
    const draft=preparePublication({runId,rootId:runId,text:bodyText});
    // A prepared but uncommitted model body is not delivery.
    assert.deepEqual(await readJson(await f.get(exactBody('terminal')),409),{error:'BODY_NOT_PUBLISHED',status:'active'});
    claim.publish(draft);
    const live=store.inspect(runId);
    assert.deepEqual(await readJson(await f.get(exactBody('terminal')),200),{
      conversationId:'exact',messageId:'terminal',status:'active',body:{text:bodyText,sha256:sha(bodyText),revision:1},
    });
    assert.deepEqual(store.inspect(runId),live);
    claim.release();
    store.cancel(runId);
    const cancelled=store.inspect(runId);
    assert.equal(cancelled.status,'cancelled');
    const output=await readJson(await f.get(exactBody('terminal')),200);
    assert.equal(output.status,'cancelled');
    assert.equal(output.body.text,bodyText);
    assert.deepEqual(store.inspect(runId),cancelled);
  }finally{store.close();}
});

test('exact committed body survives missing report artifacts and oversized History',async t=>{
  const f=await fixture(t);
  const posted=await f.post(conv+'/messages',{messageId:'report',question:'synthetic report question',sourceId:f.workspace.sources[0].id});
  const {runId}=await readJson(posted,202);
  let run;
  for(let i=0;i<100;i++){
    ({run}=await inspectResearchTask({projectDir:f.projectDir,runId}));
    if(run.status==='completed')break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(run.status,'completed');
  const oldReport=await f.get(conv+'/messages/report/report.md');
  assert.equal(oldReport.status,200);
  assert.match(await oldReport.text(),/离线演练报告/);
  await rename(join(run.directory,'artifacts'),join(run.directory,'fixture-report-hidden'));
  const dir=join(f.projectDir,'conversations','exact','messages');
  for(let i=0;i<1024;i++)await writeFile(join(dir,'oversized-'+i+'.txt'),'unused');
  assert.equal((await f.get(conv)).status,500);
  assert.equal((await f.get(conv+'/messages/report/report.md')).status,404);
  assert.deepEqual(await readJson(await f.get(exactBody('report')),200),{
    conversationId:'exact',messageId:'report',status:'completed',body:{text:'演练报告已保存。',sha256:sha('演练报告已保存。'),revision:1},
  });
});

test('unverifiable Publication fails closed without exposing stored data or internal diagnostics',async t=>{
  const f=await fixture(t);
  const {runId}=await f.add('unverifiable');
  const store=await f.session(runId);
  try{
    const writer=store.claim(runId,'owner-test');
    writer.publish(preparePublication({runId,rootId:runId,text:bodyText}));
    writer.release();
  }finally{store.close();}
  assert.equal((await f.get(exactBody('unverifiable'))).status,200);
  // Damage only the private synthetic fixture's ledger, never a user's data.
  const db=new DatabaseSync(join(f.projectDir,'sessions',runId,'session.sqlite'));
  try{db.prepare('UPDATE publication_versions SET body=? WHERE run_id=?').run('damaged fixture bytes',runId);}
  finally{db.close();}
  assert.deepEqual(await readJson(await f.get(exactBody('unverifiable')),503),{error:'BODY_READ_UNAVAILABLE'});
});
