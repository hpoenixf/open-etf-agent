import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openSession } from '../src/session.mjs';
import { SCHEDULE_PROFILE, scheduleRunId, validateSchedule } from '../src/schedule.mjs';
import { confirmScheduledRun, materializeScheduledRun, submitRun } from '../src/runtime.mjs';
import { scheduleDemoOptions } from '../src/schedule-demo.mjs';
import { workRun } from '../src/worker.mjs';
import { startReader } from '../src/reader.mjs';
import { createSharedAdmission } from '../src/admission.mjs';

async function fixture(){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/schedule-'));
 const due=Date.now()-1000;let clock=due-100;const store=await openSession({directory,profile:SCHEDULE_PROFILE,clock:()=>typeof clock==='function'?clock():clock});
 const options=await scheduleDemoOptions(store);let calls=0;const next=options.gateway.next;options.gateway.next=async input=>{calls++;return next(input);};
 const schedule={scheduleId:'public-one-shot',definitionRevision:1,scheduledInstant:new Date(due).toISOString(),timeZone:'America/Los_Angeles',maxLatenessMs:600000};
 const confirmed=await confirmScheduledRun(options,schedule);
 return {directory,store,options,schedule,confirmed,due,setClock:value=>{clock=value;},calls:()=>calls,async materialize(){clock=due;return materializeScheduledRun(options,confirmed.reference);}};
}
function child(input,cli=false){return new Promise((resolve,reject)=>{
 const args=cli?['src/session-cli.mjs',...input]:['test/fixtures/schedule-process.mjs',JSON.stringify(input)];
 const p=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],env:process.env});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);p.once('error',reject);p.once('close',(code,signal)=>resolve({pid:p.pid,code,signal,stdout,stderr,value:code===0?JSON.parse(stdout):null}));
 });}
function countRuns(directory){const db=new DatabaseSync(join(directory,'session.sqlite'),{readOnly:true});try{return db.prepare('SELECT count(*) AS n FROM runs').get().n;}finally{db.close();}}

test('18 confirmation is exact, zero-Run and ACK retry does not grant new authority',async()=>{
 const f=await fixture();try{
  assert.equal(f.confirmed.state,'confirmed');assert.equal(countRuns(f.directory),0);assert.equal(f.calls(),0);
  f.setClock(f.due+700000);assert.deepEqual(await confirmScheduledRun(f.options,f.schedule),f.confirmed);
  for(const schedule of [{...f.schedule,definitionRevision:2},{...f.schedule,timeZone:'UTC'},{...f.schedule,maxLatenessMs:600001}])await assert.rejects(confirmScheduledRun(f.options,schedule),/SCHEDULE_BINDING_MISMATCH/);
  for(const options of [{...f.options,question:'Changed request'},{...f.options,durable:{...f.options.durable,grantId:'other'}},{...f.options,limits:{...f.options.limits,maxRounds:35}}])await assert.rejects(confirmScheduledRun(options,f.schedule),/SCHEDULE_BINDING_MISMATCH/);
  assert.equal(countRuns(f.directory),0);
 }finally{f.store.close();}
});
test('18 no arbitrary five-minute lateness cap; invalid window and first late confirmation reject',async()=>{
 const f=await fixture();try{
  assert.equal(f.confirmed.envelope.schedule.maxLatenessMs,600000);
  for(const value of [0,3600000,1.5])await assert.rejects(confirmScheduledRun(f.options,{...f.schedule,scheduleId:'invalid-'+String(value),maxLatenessMs:value}),/INVALID_SCHEDULE/);
  f.setClock(f.due);await assert.rejects(confirmScheduledRun(f.options,{...f.schedule,scheduleId:'first-too-late'}),/SCHEDULE_CONFIRMATION_TOO_LATE/);
 }finally{f.store.close();}
});
test('18 due boundaries, fixed deadline and late ACK-loss preserve one original Run',async()=>{
 const f=await fixture();try{
  f.setClock(f.due-1);assert.equal((await materializeScheduledRun(f.options,f.confirmed.reference)).state,'not-due');assert.equal(countRuns(f.directory),0);
  const first=await f.materialize();assert.equal(first.state,'materialized');assert.equal(first.run.definition.deadlineAt,f.due+3600000);assert.equal(first.run.definition.config.taskTime.anchorInstant,f.schedule.scheduledInstant);
  f.setClock(f.due+700000);const again=await materializeScheduledRun(f.options,f.confirmed.reference);assert.deepEqual(again,first);assert.equal(countRuns(f.directory),1);assert.equal(f.calls(),0);
  assert.throws(()=>materializeScheduledRun(f.options,{...f.confirmed.reference,confirmationHash:'0'.repeat(64)}),/SCHEDULE_BINDING_MISMATCH/);
 }finally{f.store.close();}
});
test('18 exclusive window end is durable missed with zero Run; last allowed millisecond materializes',async()=>{
 for(const delta of [599999,600000]){const f=await fixture();try{
  f.setClock(f.due+delta);const value=await materializeScheduledRun(f.options,f.confirmed.reference);assert.equal(value.state,delta===599999?'materialized':'missed');assert.equal(countRuns(f.directory),delta===599999?1:0);
  f.setClock(f.due);assert.equal((await materializeScheduledRun(f.options,f.confirmed.reference)).state,value.state);assert.equal(f.calls(),0);
 }finally{f.store.close();}}
});
test('18 cancel/revoke before due persists zero Run and confirmation replay cannot resurrect',async()=>{
 for(const revoke of [false,true]){const f=await fixture();try{
  const cancelled=f.store.cancelSchedule(f.confirmed.reference,{revoke});assert.equal(cancelled.state,revoke?'revoked':'cancelled');
  assert.deepEqual(await confirmScheduledRun(f.options,f.schedule),cancelled);f.setClock(f.due);assert.deepEqual(await materializeScheduledRun(f.options,f.confirmed.reference),cancelled);assert.equal(countRuns(f.directory),0);assert.equal(f.calls(),0);
 }finally{f.store.close();}}
});
test('18 materialization first then revoke keeps original Run link and spent unknown reservation',async()=>{
 const f=await fixture();try{
  const first=await f.materialize(),claim=f.store.claim(first.runId,'reservation-owner');
  const snapshot=structuredClone(first.run.snapshot);snapshot.phase='model-reserved';snapshot.rounds=1;snapshot.gatewayOutcome='unknown';
  claim.reserve('model',snapshot);const cancelled=f.store.cancelSchedule(f.confirmed.reference,{revoke:true});
  assert.equal(cancelled.runId,first.runId);assert.equal(cancelled.run.status,'cancelled');assert.equal(cancelled.run.snapshot.gatewayOutcome,'unknown');assert.deepEqual(cancelled.run.rootUsage,{model:1,tool:0});assert.equal(cancelled.materializedAt,first.materializedAt);
  assert.throws(()=>claim.checkpoint(snapshot),/RUN_CANCELLED/);assert.equal((await materializeScheduledRun(f.options,f.confirmed.reference)).state,'revoked');
 }finally{f.store.close();}
});
test('18 ordinary create/submit cannot bypass occurrence; unsupported combinations dispatch zero',async()=>{
 const f=await fixture();try{
  assert.throws(()=>f.store.create({}),/SCHEDULE_MATERIALIZATION_REQUIRED/);
  await assert.rejects(submitRun({...f.options,durable:{...f.options.durable,runId:'bypass'}}),/SCHEDULE_MATERIALIZATION_REQUIRED/);
  for(const change of [{workingInput:{}},{extensions:[{}]},{plugins:[]},{hooks:{}},{ordinaryResponse:true},{documentProtection:true},{pdfInput:{}},{allowedDocuments:['atlas-a']},{durable:{...f.options.durable,parentRunId:'parent'}}])await assert.rejects(confirmScheduledRun({...f.options,...change},f.schedule),/SCHEDULE_SCOPE_UNSUPPORTED|PDF_ACTIVE_RECOVERY_UNSUPPORTED/);
  assert.equal(countRuns(f.directory),0);assert.equal(f.calls(),0);
 }finally{f.store.close();}
});
test('18 failed link write rolls back original root and Run with confirmation intact',async()=>{
 const f=await fixture();const raw=new DatabaseSync(join(f.directory,'session.sqlite'));try{
  raw.exec("CREATE TRIGGER fail_schedule_link BEFORE UPDATE OF run_id ON schedule_occurrences BEGIN SELECT RAISE(ABORT,'synthetic link failure'); END");
  await assert.rejects(f.materialize(),/synthetic link failure/);assert.equal(countRuns(f.directory),0);assert.equal(raw.prepare('SELECT count(*) n FROM roots').get().n,0);assert.equal(f.store.inspectSchedule(f.confirmed.reference).state,'confirmed');assert.equal(f.calls(),0);
  raw.exec('DROP TRIGGER fail_schedule_link');assert.equal((await f.materialize()).state,'materialized');
 }finally{raw.close();f.store.close();}
});
test('18 concurrent process wakes and lost ACK return the same Run and no dispatch',async()=>{
 const f=await fixture();f.store.close();
 const input={operation:'materialize',directory:f.directory,reference:f.confirmed.reference,clock:f.due};const [a,b]=await Promise.all([child(input),child(input)]);
 for(const x of [a,b]){assert.equal(x.code,0,x.stderr);assert.equal(x.signal,null);assert.equal(x.value.calls,0);assert.equal(x.value.result.state,'materialized');}
 assert.notEqual(a.value.pid,b.value.pid);assert.deepEqual(a.value.result,b.value.result);assert.equal(countRuns(f.directory),1);
 const retry=await child({...input,clock:f.due+700000});assert.equal(retry.code,0,retry.stderr);assert.deepEqual(retry.value.result,a.value.result);
});
test('18 different-PID Worker completion, readonly Publication and original Reader exact bytes',async()=>{
 const f=await fixture();await f.materialize();f.store.close();
 const first=await child(['schedule-wake','--session',f.directory,'--schedule',f.schedule.scheduleId,'--hash',f.confirmed.reference.confirmationHash],true);assert.equal(first.code,0,first.stderr);assert.equal(first.value.outcome.run.rootUsage.model,4);assert.equal(first.value.outcome.run.status,'completed');
 const bytes=await readFile(join(f.directory,'session.sqlite'));const read=await child({operation:'read',directory:f.directory,reference:f.confirmed.reference});assert.equal(read.code,0,read.stderr);assert.notEqual(first.pid,read.value.pid);assert.equal(read.value.calls,0);assert.deepEqual(await readFile(join(f.directory,'session.sqlite')),bytes);
 const run=read.value.result.occurrence.run;assert.deepEqual(read.value.result.publication.receipt,first.value.outcome.publication);const reader=await startReader({directory:run.directory});
 try{const id=run.snapshot.host.receipt.artifactId;const response=await fetch(reader.origin+'/artifacts/'+id);assert.equal(response.status,200);const content=Buffer.from(await response.arrayBuffer());assert.deepEqual(content,await readFile(join(run.directory,'report.md')));const head=await fetch(reader.origin+'/artifacts/'+id,{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),content.length);assert.equal(await head.text(),'');}finally{await reader.close();}
 const again=await child({operation:'work',directory:f.directory,reference:f.confirmed.reference});assert.equal(again.code,0,again.stderr);assert.equal(again.value.calls,0);assert.equal(countRuns(f.directory),1);
});
test('18 one original Admission wrap consumes branded reservations, no scheduler budget',async()=>{
 const f=await fixture();let admission;try{
  const original=await f.materialize();f.setClock(Date.now);admission=await createSharedAdmission({directory:join(f.directory,'capacity'),routeId:'schedule-synthetic',queueTimeoutMs:300000});
  const gateway=admission.wrap(f.options.gateway,{session:f.store,runId:original.runId});
  const result=await workRun({...f.options,gateway,durable:{...f.options.durable,runId:original.runId}});assert.equal(result.run.status,'completed');assert.equal(f.calls(),4);assert.deepEqual(result.run.rootUsage,{model:4,tool:3});assert.equal(admission.snapshot().requests.length,4);assert.ok(admission.snapshot().requests.every(item=>item.state==='completed'));
 }finally{admission?.close();f.store.close();}
});
test('18 host stop preserves proposal; wake reuses original Worker checkpoint and deadline',async()=>{
 const f=await fixture();try{
  const original=await f.materialize(),stop=new AbortController();
  const first=await workRun({...f.options,hostSignal:stop.signal,durable:{...f.options.durable,runId:original.runId,onCheckpoint:value=>{if(value.phase==='proposal-sealed')stop.abort();}}});assert.equal(first.workerStatus,'interrupted');assert.equal(first.run.snapshot.phase,'proposal-sealed');assert.equal(f.calls(),1);
  const resumed=await workRun({...f.options,durable:{...f.options.durable,runId:original.runId}});assert.equal(resumed.run.status,'completed');assert.equal(f.calls(),4);assert.equal(resumed.run.definition.deadlineAt,original.run.definition.deadlineAt);assert.equal(countRuns(f.directory),1);
  const body=f.store.publication(original.runId);f.store.cancelSchedule(f.confirmed.reference);assert.deepEqual(f.store.publication(original.runId),body);
 }finally{f.store.close();}
});
test('18 schema5 opt-in refuses old2/3/4 without mutation; old reader refuses5',async()=>{
 const base=await import(process.env.SCHEDULE_BASE_SESSION);for(const profile of [undefined,'ordinary-response@1','document-revocation@1']){
  await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/schedule-old-'));const old=await base.openSession({directory,...(profile?{profile}:{})});old.close();const bytes=await readFile(join(directory,'session.sqlite')),inventory=await readdir(directory);
  await assert.rejects(openSession({directory,profile:SCHEDULE_PROFILE}),/UNSUPPORTED_SESSION_SCHEMA/);assert.deepEqual(await readFile(join(directory,'session.sqlite')),bytes);assert.deepEqual(await readdir(directory),inventory);
 }
 const f=await fixture();f.store.close();const bytes=await readFile(join(f.directory,'session.sqlite'));await assert.rejects(base.openSession({directory:f.directory}),/UNSUPPORTED_SESSION_SCHEMA/);assert.deepEqual(await readFile(join(f.directory,'session.sqlite')),bytes);
});
test('18 corrupted confirmation/link refuses read-only admission without repairing bytes',async()=>{
 for(const sql of ["UPDATE schedule_definitions SET confirmation_hash=printf('%064d',0)","DELETE FROM schedule_occurrences"]){const f=await fixture();await f.materialize();f.store.close();const raw=new DatabaseSync(join(f.directory,'session.sqlite'));raw.exec(sql);raw.close();const bytes=await readFile(join(f.directory,'session.sqlite'));await assert.rejects(openSession({directory:f.directory,profile:SCHEDULE_PROFILE,readOnly:true}),/CORRUPT_SCHEDULE/);assert.deepEqual(await readFile(join(f.directory,'session.sqlite')),bytes);}
});
test('18 explicit CLI inspect is readonly; no command invents a background service',async()=>{
 const f=await fixture();f.store.close();const args=['--session',f.directory,'--schedule',f.schedule.scheduleId,'--hash',f.confirmed.reference.confirmationHash];const bytes=await readFile(join(f.directory,'session.sqlite'));
 const read=await child(['schedule-inspect',...args],true);assert.equal(read.code,0,read.stderr);assert.equal(read.value.state,'confirmed');assert.deepEqual(await readFile(join(f.directory,'session.sqlite')),bytes);
 const wrong=await child(['schedule-daemon',...args],true);assert.equal(wrong.code,2);assert.match(wrong.stderr,/INVALID_ARGUMENT/);
});

test('18 explicit instant never defaults own undefined to the host clock',()=>{
 const value={scheduleId:'explicit',definitionRevision:1,scheduledInstant:undefined,timeZone:'UTC',maxLatenessMs:1};assert.throws(()=>validateSchedule(value),/INVALID_SCHEDULE/);assert.throws(()=>scheduleRunId(value),/INVALID_SCHEDULE/);
});
