import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createServer } from 'node:tls';
import { DatabaseSync } from 'node:sqlite';
import { prepareScheduledSmtp,createScheduledSmtpHook } from '../src/scheduled-smtp.mjs';
import { startLocalGui } from '../src/gui-server.mjs';

const envFrom=attrs=>Object.fromEntries(Object.entries(attrs).map(([k,v])=>['ETF_SCHEDULED_SMTP_'+k,v]));
test('daily SMTP requires fresh recipient consent and does not replay past mail across cold restart',async t=>{
 const folder=await mkdtemp(resolve('.smtp-fixture-'));
 const key=join(folder,'fixture-key.pem'),cert=join(folder,'fixture-cert.pem');
 await t.after(()=>rm(folder,{recursive:true,force:true}));
 execFileSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
  '-addext','subjectAltName=DNS:localhost','-keyout',key,'-out',cert],{stdio:'ignore'});
 const content=[];
 let behavior='accepted',authenticated=0,dataAttempts=0;
 const server=createServer({key:await readFile(key),cert:await readFile(cert)},socket=>{
  socket.on('error',()=>{});
  socket.write('220 local fixture\r\n');
  let input='',data=false,message=[];
  socket.on('data',chunk=>{
   input+=chunk.toString('utf8');
   for(;;){
    const br=input.indexOf('\r\n');if(br<0)break;
    const line=input.slice(0,br);input=input.slice(br+2);
    if(data){
     if(line!=='.'){message.push(line);continue;}
     data=false;content.push(message.join('\r\n'));message=[];
     if(behavior==='unknown'){socket.destroy();return;}
     socket.write('250 queued for fixture\r\n');continue;
    }
    if(/^ehlo /i.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
    else if(/^auth plain /i.test(line)){
     assert.equal(Buffer.from(line.split(' ')[2],'base64').toString(),'\0fixture-user\0fixture-password');
     authenticated++;socket.write('235 auth ok\r\n');
    }else if(/^mail from:/i.test(line))socket.write('250 from ok\r\n');
    else if(/^rcpt to:/i.test(line))socket.write(behavior==='before-data'?'550 rejected\r\n':'250 recipient ok\r\n');
    else if(/^data$/i.test(line)){dataAttempts++;data=true;socket.write('354 proceed\r\n');}
    else socket.write('500 unsupported\r\n');
   }
  });
 });
 await new Promise((ok,fail)=>server.listen(0,'localhost',ok).once('error',fail));
 t.after(()=>new Promise(ok=>server.close(ok)));
 const input=envFrom({ENABLED:'1',HOST:'localhost',TLS:'implicit',PORT:String(server.address().port),
  FROM:'sender@example.invalid',VERIFIED_TO:'owner@example.invalid',VERIFIED_TO_VERSION:'fixture-owner-1',
  USER:'fixture-user',PASSWORD:'fixture-password'});

 const projectDir=await mkdtemp(resolve('.daily-smtp-project-'));
 let gui, modelCalls=0, now=Date.parse('2026-11-22T01:59:00Z');
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const config={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'fixture-model',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:2}};
 const start=async(recipient)=>{
  gui=await startLocalGui({projectDir,liveConfig:config,dailyClock:()=>now,
   env:{...input,ETF_GUI_PROVIDER_KEY:'synthetic-only',ETF_GUI_DAILY_AUTORUN:'1',ETF_SCHEDULED_SMTP_VERIFIED_TO:recipient},
   smtpOptions:{testCaFile:cert},
   async fetchImpl(){modelCalls++;return Response.json({choices:[{message:{role:'assistant',content:'Exact daily research body.'},finish_reason:'stop'}]});},
  });
 };
 const collection='/api/daily-watch';
 const list=()=>fetch(gui.origin+collection).then(r=>r.json());
 const post=(body,id)=>fetch(gui.origin+collection+(id?'/'+id:''),{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const watch={question:'Synthetic daily question',enabled:true,localTime:'10:00',emailEnabled:true};
 await start('owner@example.invalid');
 const originalToken=(await list()).emailConsentToken;
 assert.ok(originalToken);
 assert.equal((await post(watch)).status,409);
 const create=await post({...watch,emailConsentToken:originalToken});
 assert.equal(create.status,201);
 const {id}=await create.json();
 await gui.sweepDaily();
 assert.equal(dataAttempts,0);
 now=Date.parse('2026-11-22T02:00:03Z');
 await gui.sweepDaily();
 assert.equal((await list()).items[0].history[0].emailStatus,'accepted');
 assert.equal(dataAttempts,1);assert.equal(modelCalls,1);
 await gui.close();
 await start('owner@example.invalid');
 await gui.sweepDaily();
 assert.equal(dataAttempts,1);assert.equal(modelCalls,1);
 await gui.close();
 // Reproduce loss of the GUI projection after durable SMTP acceptance.
 // The actual email ledger stays accepted and survives recipient change.
 const db=new DatabaseSync(join(projectDir,'gui-daily-watch','watch.sqlite'));
 try{db.prepare("UPDATE occurrence SET email_state='pending' WHERE watch_id=? AND day=?").run(id,'2026-11-22');}
 finally{db.close();}
 await start('new-owner@example.invalid');
 const rotated=await list();
 assert.equal(rotated.items[0].emailConfirmed,false);
 await gui.sweepDaily();
 assert.equal((await list()).items[0].history[0].emailStatus,'accepted');
 assert.equal(dataAttempts,1);assert.equal(modelCalls,1);
 assert.equal((await post({...watch,emailConsentToken:originalToken},id)).status,409);
 now=Date.parse('2026-11-23T02:00:03Z');
 await gui.sweepDaily();
 assert.equal(dataAttempts,1);assert.equal(modelCalls,2);
 assert.equal((await list()).items[0].history[0].emailStatus,'not-dispatched');
 const renewed=(await list()).emailConsentToken;
 assert.equal((await post({...watch,emailConsentToken:renewed},id)).status,200);
 await gui.sweepDaily();
 assert.equal(dataAttempts,1);assert.equal(modelCalls,2);
 now=Date.parse('2026-11-24T02:00:03Z');
 await gui.sweepDaily();
 assert.equal(dataAttempts,2);assert.equal(modelCalls,3);
 assert.match(content[0],/To: owner@example.invalid/);
 assert.match(content[1],/To: new-owner@example.invalid/);
 assert.ok(content.every(x=>x.includes('Exact daily research body.')));
 await gui.close();await start('new-owner@example.invalid');await gui.sweepDaily();
 assert.equal(dataAttempts,2);assert.equal(modelCalls,3);
});

test('two native Watch slots send full multipart once each; activation and restart cannot replay',{timeout:25000},async t=>{
 const base=await mkdtemp(resolve('.watch-full-smtp-'));
 const key=join(base,'key.pem'),cert=join(base,'cert.pem'),projectDir=join(base,'project');
 await (await import('node:fs/promises')).mkdir(projectDir);
 execFileSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
  '-addext','subjectAltName=DNS:localhost','-keyout',key,'-out',cert],{stdio:'ignore'});
 const captured=[],prompts=[];
 let loseAck=false,gui,now=Date.parse('2026-11-23T08:55:00+08:00');
 const relay=createServer({key:await readFile(key),cert:await readFile(cert)},socket=>{
  socket.on('error',()=>{});socket.write('220 isolated fixture\r\n');
  let data=false,buf='',lines=[];
  socket.on('data',bytes=>{
   buf+=bytes.toString('utf8');
   for(let p;(p=buf.indexOf('\r\n'))>=0;){
    const line=buf.slice(0,p);buf=buf.slice(p+2);
    if(data&&line!=='.'){lines.push(line.startsWith('..')?line.slice(1):line);continue;}
    if(data){captured.push(lines.join('\r\n'));lines=[];data=false;if(loseAck)socket.destroy();else socket.write('250 queued\r\n');continue;}
    if(/^ehlo /i.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
    else if(/^auth plain /i.test(line))socket.write('235 OK\r\n');
    else if(/^(mail from|rcpt to):/i.test(line))socket.write('250 OK\r\n');
    else if(/^data$/i.test(line)){data=true;socket.write('354 proceed\r\n');}
    else if(/^quit$/i.test(line)){socket.end('221 bye\r\n');}
    else socket.write('500 unsupported\r\n');
   }
  });
 });
 await new Promise((ok,fail)=>relay.listen(0,'localhost',ok).once('error',fail));
 t.after(async()=>{await gui?.close();await new Promise(ok=>relay.close(ok));await rm(base,{recursive:true,force:true});});
 const relayEnv=envFrom({ENABLED:'1',HOST:'localhost',TLS:'implicit',PORT:String(relay.address().port),FROM:'sender@example.invalid',
  VERIFIED_TO:'owner@example.invalid',VERIFIED_TO_VERSION:'fixture-owner',USER:'fixture',PASSWORD:'fixture'});
 const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'fixture',
  apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:2}};
 const body=i=>'## 研究主题\n\n- **截至当时**：报告 '+i+' 的完整正文。\n- [原始资料](https://issuer.example.invalid/notice)\n\n末尾 '+i;
 const env={...relayEnv,ETF_GUI_PROVIDER_KEY:'synthetic',ETF_GUI_DAILY_AUTORUN:'1',ETF_GUI_DAILY_WATCH_SKILL:'daily-watch-brief',
  ETF_DAILY_WATCH_EMAIL_CONTENT:'full-report',ETF_DAILY_WATCH_EMAIL_OWNER_ORIGIN:'https://owner.example.invalid'};
 const options={projectDir,liveConfig,env,dailyClock:()=>now,smtpOptions:{testCaFile:cert},async fetchImpl(_url,request){
  prompts.push(JSON.parse(request.body).messages[0].content);
  return Response.json({choices:[{message:{role:'assistant',content:body(prompts.length)},finish_reason:'stop'}]});
 }};
 await assert.rejects(startLocalGui({...options,env:{...env,ETF_DAILY_WATCH_EMAIL_OWNER_ORIGIN:'http://owner.example.invalid'}}),{code:'WATCH_FULL_EMAIL_ORIGIN'});
 await assert.rejects(startLocalGui({...options,ownerDailyDigest:{version:'synthetic-conflict'}}),{message:'WATCH_FULL_EMAIL_MODE'});
 const start=async()=>{gui=await startLocalGui(options);};
 await start();
 const path='/api/daily-watch';
 const list=()=>fetch(gui.origin+path).then(r=>r.json());
 const post=(body,id)=>fetch(gui.origin+path+(id?'/'+id:''),{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await list()).emailContentMode,'full-report');
 const am={question:'【早报】公开合成材料',localTime:'09:00',enabled:true};
 const pm={question:'【晚报】公开合成材料',localTime:'20:00',enabled:true};
 const amId=(await (await post(am)).json()).id;
 const pmId=(await (await post({...pm,emailEnabled:true,emailConsentToken:(await list()).emailConsentToken})).json()).id;
 now=Date.parse('2026-11-23T09:03:00+08:00');
 assert.equal((await post({...am,emailEnabled:true},amId)).status,409);
 assert.equal((await post({...am,emailEnabled:true,emailConsentToken:(await list()).emailConsentToken},amId)).status,200);
 await gui.sweepDaily();
 assert.equal(captured.length,0,'mail-only opt-in after slot must not backfill');
 assert.equal((await list()).items.find(x=>x.id===amId).history[0].emailStatus,'off');
 // Disable tonight before the pre-existing slot; preserves tomorrow re-opt-in as a new confirmation.
 assert.equal((await post({...pm,emailEnabled:false},pmId)).status,200);
 now=Date.parse('2026-11-23T20:01:00+08:00');await gui.sweepDaily();assert.equal(captured.length,0);
 now=Date.parse('2026-11-24T08:55:00+08:00');
 assert.equal((await post({...pm,emailEnabled:true,emailConsentToken:(await list()).emailConsentToken},pmId)).status,200);
 now=Date.parse('2026-11-24T09:00:03+08:00');await Promise.all([gui.sweepDaily(),gui.sweepDaily()]);
 now=Date.parse('2026-11-24T20:01:00+08:00');await Promise.all([gui.sweepDaily(),gui.sweepDaily()]);
 assert.equal(captured.length,2);assert.equal(prompts.length,4);
 assert.match(prompts[2],/2026-11-24 周二/);
 assert.match(prompts[2],/\[2026-11-23T00:00:00\+08:00, 2026-11-24T00:00:00\+08:00\)/);
 assert.match(prompts[3],/\[2026-11-24T00:00:00\+08:00, 2026-11-24T20:00:00\+08:00\]/);
 const readMIME=raw=>JSON.parse(execFileSync('/usr/bin/python3',['-c',[
  'import sys,json,email,email.policy','m=email.message_from_bytes(sys.stdin.buffer.read(),policy=email.policy.default)',
  'print(json.dumps([str(m["Subject"]),str(m["To"]),str(m["Message-ID"]),*[p.get_content() for p in m.iter_parts()]]))',
 ].join('\n')],{input:raw,encoding:'utf8'}));
 const [morning,evening]=captured.map(readMIME);
 assert.match(morning[0],/^早报 · 2026-11-24 09:00/);assert.match(evening[0],/^晚报 · 2026-11-24 20:00/);
 assert.equal(morning[1],'owner@example.invalid');assert.equal(evening[1],'owner@example.invalid');assert.notEqual(morning[2],evening[2]);
 for(const [mail,idx] of [[morning,3],[evening,4]]){
  assert.equal(mail[3].replace(/\r\n/g,'\n').trimEnd(),body(idx));
  assert.match(mail[4],/<h2[^>]*>研究主题<\/h2>/);assert.match(mail[4],/<li[^>]*><strong>截至当时<\/strong>/);
  assert.match(mail[4],/https:\/\/owner\.example\.invalid\/#daily-/);
 }
 await gui.close();await start();await gui.sweepDaily();assert.equal(captured.length,2);
 // Emulate the ambiguous SMTP DATA/ack window: persist old identity, never replay it.
 now=Date.parse('2026-11-25T09:00:03+08:00');loseAck=true;await gui.sweepDaily();
 assert.equal(captured.length,3);
 assert.equal((await list()).items.find(x=>x.id===amId).history[0].emailStatus,'unknown');
 assert.equal((await post({...am,emailEnabled:false},amId)).status,200);
 await gui.close();await start();await gui.sweepDaily();
 assert.equal(captured.length,3);assert.equal(prompts.length,5);
 assert.equal((await list()).items.find(x=>x.id===amId).history[0].emailStatus,'unknown');
 await gui.close();
 // Lose only the GUI projection, then roll back to legacy delivery. The same
 // occurrence key must expose original accepted / unknown, not start new mail.
 const db=new DatabaseSync(join(projectDir,'gui-daily-watch','watch.sqlite'));
 try{
  db.prepare("UPDATE occurrence SET email_state='pending' WHERE watch_id=? AND day=?").run(amId,'2026-11-25');
  db.prepare("UPDATE occurrence SET email_state='pending' WHERE watch_id=? AND day=?").run(pmId,'2026-11-24');
 }finally{db.close();}
 gui=await startLocalGui({...options,env:{...env,ETF_DAILY_WATCH_EMAIL_CONTENT:'text'}});
 await gui.sweepDaily();
 assert.equal((await list()).items.find(x=>x.id===amId).history[0].emailStatus,'unknown');
 assert.equal((await list()).items.find(x=>x.id===pmId).history[0].emailStatus,'accepted');
 assert.equal(captured.length,3);assert.equal(prompts.length,5);
});
