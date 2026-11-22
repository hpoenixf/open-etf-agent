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
