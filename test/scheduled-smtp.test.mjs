import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createServer } from 'node:tls';
import { prepareScheduledSmtp,createScheduledSmtpHook } from '../src/scheduled-smtp.mjs';

const envFrom=attrs=>Object.fromEntries(Object.entries(attrs).map(([k,v])=>['ETF_SCHEDULED_SMTP_'+k,v]));
test('scheduled SMTP disabled by default, rejects insufficient opt-in and plaintext mode',()=>{
 assert.equal(prepareScheduledSmtp({}),null);
 assert.equal(createScheduledSmtpHook({}),undefined);
 assert.throws(()=>prepareScheduledSmtp(envFrom({ENABLED:'1'})),{code:'SCHEDULED_SMTP_CONFIG_INVALID'});
 assert.throws(()=>prepareScheduledSmtp(envFrom({ENABLED:'1',TLS:'plain'})),{code:'SCHEDULED_SMTP_CONFIG_INVALID'});
});
test('local authenticated TLS SMTP accepted, pre-DATA refusal not dispatched, post-DATA disconnect unknown',async t=>{
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
 const payload={to:'owner@example.invalid',subject:'Synthetic report',text:'Plain exact report lines.',idempotencyKey:'1'.repeat(64)};
 const adapter=prepareScheduledSmtp(input,{testCaFile:cert});
 const changedVersion=prepareScheduledSmtp({...input,ETF_SCHEDULED_SMTP_VERIFIED_TO:'changed@example.invalid'},{testCaFile:cert}).resolveDestination().version;
 assert.notEqual(adapter.resolveDestination().version,changedVersion);
 assert.equal(JSON.stringify(adapter),'{}');
 assert.deepEqual(await adapter.transport({...payload,to:'unapproved@example.invalid'}),{status:'not-dispatched'});
 assert.deepEqual(await prepareScheduledSmtp(input).transport(payload),{status:'not-dispatched'}); // system trust rejects the private fixture CA
 assert.equal(authenticated,0);
 const accepted=await adapter.transport(payload);
 assert.deepEqual(accepted,{status:'accepted',receiptId:'smtp-'+payload.idempotencyKey});
 assert.match(content[0],/Plain exact report lines\./);
 assert.doesNotMatch(content[0],/fixture-password|fixture-user/);
 behavior='before-data';
 assert.deepEqual(await adapter.transport(payload),{status:'not-dispatched'});
 assert.equal(dataAttempts,1);
 behavior='unknown';
 assert.deepEqual(await adapter.transport(payload),{status:'unknown'});
 assert.equal(dataAttempts,2);
 assert.equal(authenticated,3);
});
