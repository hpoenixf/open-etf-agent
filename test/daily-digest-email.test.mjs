import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {composeDailyDigest,createDailyDigestHook,inspectDailyDigestEmail} from '../src/daily-digest-email.mjs';

const ownerOrigin='https://workspace.example.invalid', date='2026-11-22';
const w=i=>'w'+i.toString(16).padStart(24,'0');
const done=(i=1)=>({watchId:w(i),localTime:'08:00',status:'completed',conversationId:'daily-'+w(i)+'-2026',
 messageId:'day-'+date,runId:'conversation-'+'f'.repeat(40)});
const pending=(i=2)=>({watchId:w(i),localTime:'10:00',status:'pending'});
const recipient={address:'test-owner@example.invalid',version:'verified-1',enabled:true,verified:true};
const read=async x=>({...x,status:'completed',text:'LEAK_CHECK_ORIGINAL_CONTENT'});
async function project(t){
 const p=await mkdtemp(resolve('.digest-test-'));
 t.after(()=>rm(p,{recursive:true,force:true}));return p;
}
test('daily digest summarizes states, verifies exact completed identity, and never copies original or private row content',async()=>{
 let checked=0;
 const result=await composeDailyDigest({ownerOrigin,date,projectDir:'/fixture',rows:[
  {...done(),evidenceDate:'2026-11-21',question:'LEAK_CHECK_QUESTION',note:'LEAK_CHECK_NOTE'},
  {...pending(),question:'LEAK_CHECK_PENDING'}, {...pending(3),status:'unknown'}, {...pending(4),status:'failed'},
  {...done(5),conversationId:'daily-'+w(7)+'-2026',evidenceDate:'2026-11-21'},
  {...done(6),evidenceDate:'fake'},
 ],
 readOriginal:async identity=>{checked++;return read(identity);}});
 assert.equal(result.count,6);
 assert.equal(checked,2);
 assert.match(result.text,/已核实完成：2/);
 assert.match(result.text,/证据日期：2026-11-21/);
 assert.match(result.text,/证据日期：未记录/);
 assert.match(result.text,/失败，无法确认/);
 assert.match(result.text,/未知，不代表没有变化/);
 assert.match(result.text,/未核实完成结果/);
 assert.match(result.text,new RegExp('/#daily-'+w(1)+'-2026~day-'+date));
 assert.doesNotMatch(result.text,/LEAK_CHECK|#daily-w0*7-/);
 await assert.rejects(composeDailyDigest({date,rows:[],ownerOrigin:'http://invalid'}),{code:'DIGEST_ORIGIN_INVALID'});
});
test('one owner-local digest across concurrent calls and cold reopen; later rows cannot rewrite payload',async t=>{
 const projectDir=await project(t),calls=[];
 const args={projectDir,date,ownerId:'owner-1',rows:[done(),pending()]};
 const setup={ownerOrigin,resolveConfirmedDestination:async()=>recipient,readOriginal:read,
  transport:async payload=>{calls.push(payload);return {status:'accepted',receiptId:'fixture-accepted'};}};
 const make=()=>createDailyDigestHook(setup);
 await Promise.all(Array.from({length:8},()=>make()(args)));
 assert.equal(calls.length,1);
 assert.equal(calls[0].to,recipient.address);
 assert.match(calls[0].text,/计划事项：2/);
 assert.deepEqual(await make()({...args,rows:[done()]}),{status:'accepted',attempts:1});
 assert.deepEqual(await inspectDailyDigestEmail(args),{status:'accepted',attempts:1});
 const [dir]=await readdir(join(projectDir,'daily-digest-email'));
 const ledger=await readFile(join(projectDir,'daily-digest-email',dir,'digest.json'),'utf8');
 assert.doesNotMatch(ledger,/LEAK_CHECK|test-owner@example/);
});
test('withdrawn consent or unknown transport does not redeliver; a different day has a distinct occurrence',async t=>{
 const projectDir=await project(t);
 const args={projectDir,date,ownerId:'owner-1',rows:[pending()]};
 let reads=0, attempts=0;
 const base={ownerOrigin,readOriginal:read,transport:async()=>{attempts++;throw Error('lost acknowledgement');}};
 const stopped=createDailyDigestHook({...base,resolveConfirmedDestination:async()=>++reads===1?recipient:null});
 assert.deepEqual(await stopped(args),{status:'not-dispatched',attempts:1});
 assert.equal(attempts,0);
 const enabled=createDailyDigestHook({...base,resolveConfirmedDestination:async()=>recipient});
 assert.equal((await enabled(args)).status,'not-dispatched');
 const next={...args,date:'2026-11-23'};
 assert.equal((await enabled(next)).status,'unknown');
 assert.equal((await enabled(next)).status,'unknown');
 assert.equal(attempts,1);
});
test('empty opt-in set and unverified destination do not create an email effect',async t=>{
 const projectDir=await project(t),args={projectDir,date,ownerId:'owner-1',rows:[]};
 const options={ownerOrigin,readOriginal:read,transport(){assert.fail('unexpected dispatch');}};
 assert.deepEqual(await createDailyDigestHook({...options,resolveConfirmedDestination:async()=>recipient})(args),{status:'empty',attempts:0});
 assert.deepEqual(await createDailyDigestHook({...options,resolveConfirmedDestination:async()=>({...recipient,verified:false})})(args),{status:'not-configured',attempts:0});
 assert.deepEqual(await inspectDailyDigestEmail(args),{status:'not-started',attempts:0});
});

test('full digest rejects altered bodies, keeps original text out of its receipt ledger and refuses duplicate unknown dispatch',async t=>{
 const projectDir=await project(t),calls=[];
 const original='## 核实正文\n\n完整报告\n\n最后一段。';
 const sha256=createHash('sha256').update(original).digest('hex');
 const args={projectDir,date,ownerId:'owner-1',rows:[done(),done(2),pending(3)]};
 const options={ownerOrigin,mode:'full-report',resolveConfirmedDestination:()=>recipient,
  readOriginal:async x=>({...x,status:'completed',sha256,text:x.conversationId.includes(w(1))?original:'FORGED_BODY'}),
  transport:async x=>{calls.push(x);throw Error('synthetic ambiguous dispatch');}};
 const make=()=>createDailyDigestHook(options);
 assert.deepEqual(await make()(args),{status:'unknown',attempts:1});
 assert.deepEqual(await make()(args),{status:'unknown',attempts:1});
 assert.equal(calls.length,1);
 const [sent]=calls;
 assert.ok(sent.text.includes(original));
 assert.match(sent.text,/已核实完成：1/);
 assert.match(sent.text,/未核实完成结果/);
 assert.doesNotMatch(sent.text+sent.html,/FORGED_BODY/);
 const [dir]=await readdir(join(projectDir,'daily-digest-email'));
 for(const file of await readdir(join(projectDir,'daily-digest-email',dir))){
  const saved=await readFile(join(projectDir,'daily-digest-email',dir,file),'utf8');
  assert.doesNotMatch(saved,/完整报告|FORGED_BODY|test-owner@example|<html|每日研究报告/);
 }
});

test('a full digest over its transport bound refuses to send instead of truncating',async t=>{
 const projectDir=await project(t);
 const text='<'.repeat(126000)+'END';
 const sha256=createHash('sha256').update(text).digest('hex');
 const args={projectDir,date,ownerId:'owner-1',rows:[done(),done(2)]};
 const send=createDailyDigestHook({ownerOrigin,mode:'full-report',resolveConfirmedDestination:()=>recipient,
  readOriginal:async identity=>({...identity,status:'completed',text,sha256}),transport(){assert.fail('unexpected dispatch');}});
 assert.deepEqual(await send(args),{status:'unavailable',attempts:0});
 assert.deepEqual(await inspectDailyDigestEmail(args),{status:'not-started',attempts:0});
});
