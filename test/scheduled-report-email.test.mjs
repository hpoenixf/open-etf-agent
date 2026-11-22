import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { deliverScheduledReportEmail, inspectScheduledEmailDelivery } from '../src/scheduled-report-email.mjs';

async function fixture(t){
 const directory=await mkdtemp(resolve('.email-ledger-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const text='Synthetic analysis, with original source [1].';
 const reportRef={conversationId:'conversation-1',messageId:'message-1',runId:'run-1',
  revisionId:'revision:sha256:test',sha256:createHash('sha256').update(text).digest('hex')};
 const destination={address:'owner@example.invalid',enabled:true,verified:true,version:'account-verified-v1'};
 const args={directory,occurrenceId:'daily-2026-11-22',reportRef,destination,
   readCompletedReport:async()=>({...reportRef,status:'completed',text})};
 return {args,text};
}

test('same occurrence accepts once, uses exact original text and remains cold inspectable',async t=>{
 const {args,text}=await fixture(t), calls=[];
 const send=overrides=>deliverScheduledReportEmail({...args,transport:async x=>{calls.push(x);return {status:'accepted',receiptId:'fixture-accepted'};},...overrides});
 assert.deepEqual(await inspectScheduledEmailDelivery(args),{status:'not-started',attempts:0});
 assert.deepEqual(await send(),{status:'accepted',attempts:1,receiptId:'fixture-accepted'});
 assert.deepEqual(await send({readCompletedReport(){assert.fail('terminal receipt must not read report');}}),await inspectScheduledEmailDelivery(args));
 assert.equal(calls.length,1);
 assert.equal(calls[0].text,text);
 assert.equal(calls[0].to,args.destination.address);
 assert.match(calls[0].idempotencyKey,/^[a-f0-9]{64}$/);
 await assert.rejects(send({destination:{...args.destination,address:'other@example.invalid'}}),{code:'EMAIL_OCCURRENCE_BINDING_CHANGED'});
 const [dir]=await readdir(args.directory);
 for(const name of await readdir(join(args.directory,dir))){
  const raw=await readFile(join(args.directory,dir,name),'utf8');
  assert.ok(!raw.includes(text)&&!raw.includes(args.destination.address));
 }
});

test('owner destination gate and immutable completed output gate fail without transport',async t=>{
 const {args}=await fixture(t), never=()=>assert.fail('external dispatch');
 for(const destination of [{...args.destination,enabled:false},{...args.destination,verified:false},
   {...args.destination,version:''},{...args.destination,address:'a@example.invalid\r\nBcc: x@example.invalid'}]){
  await assert.rejects(deliverScheduledReportEmail({...args,destination,transport:never}),{code:'EMAIL_DESTINATION_NOT_ENABLED'});
 }
 for(const changed of [{status:'active'},{messageId:'different-m'},{text:'changed'}]){
  await assert.rejects(deliverScheduledReportEmail({...args,transport:never,
   readCompletedReport:async()=>({...await args.readCompletedReport(),...changed})}),{code:'EMAIL_REPORT_NOT_VERIFIED'});
 }
 assert.deepEqual(await inspectScheduledEmailDelivery(args),{status:'not-started',attempts:0});
});

test('parallel workers and lost receipt never resend; unresolved claim is observable',async t=>{
 const {args}=await fixture(t);
 let entered,release,n=0;
 const called=new Promise(r=>{entered=r;});
 const done=new Promise(r=>{release=r;});
 t.after(()=>release());
 const transport=async()=>{n++;entered();await done;throw Error('network acknowledgement lost');};
 const first=deliverScheduledReportEmail({...args,transport});
 await called;
 const others=await Promise.all(Array.from({length:8},()=>deliverScheduledReportEmail({...args,transport,retryNotDispatched:true})));
 for(const view of others)assert.deepEqual(view,{status:'unknown',attempts:1});
 release();
 assert.deepEqual(await first,{status:'unknown',attempts:1});
 assert.deepEqual(await inspectScheduledEmailDelivery(args),{status:'unknown',attempts:1});
 assert.deepEqual(await deliverScheduledReportEmail({...args,transport,retryNotDispatched:true}),{status:'unknown',attempts:1});
 assert.equal(n,1);
});

test('only provable non-dispatch allows one explicitly requested retry, same payload and key',async t=>{
 const {args}=await fixture(t),calls=[];
 const transport=async x=>{calls.push(x);return {status:'not-dispatched'};};
 assert.deepEqual(await deliverScheduledReportEmail({...args,transport}),{status:'not-dispatched',attempts:1,canRetry:true});
 assert.deepEqual(await deliverScheduledReportEmail({...args,transport}),{status:'not-dispatched',attempts:1,canRetry:true});
 assert.deepEqual(await deliverScheduledReportEmail({...args,transport,retryNotDispatched:true}),{status:'not-dispatched',attempts:2,canRetry:false});
 await deliverScheduledReportEmail({...args,transport,retryNotDispatched:true});
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0],calls[1]);
});

test('owner withdrawal between claim and dispatch is provably not dispatched',async t=>{
 const {args}=await fixture(t);
 const actual=await deliverScheduledReportEmail({...args,
  recheckDestination:async()=>({...args.destination,enabled:false}),transport(){assert.fail('external dispatch');}});
 assert.deepEqual(actual,{status:'not-dispatched',attempts:1,canRetry:true});
});
