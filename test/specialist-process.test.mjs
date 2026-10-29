import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync,fork} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {openSession} from '../src/session.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/specialist-process-'));}
function cli(args){const r=spawnSync(process.execPath,['src/specialist-cli.mjs',...args],{encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
async function inventory(path){const out=[];async function walk(dir){for(const n of await readdir(dir,{withFileTypes:true})){const p=join(dir,n.name);if(n.isDirectory())await walk(p);else out.push([p,createHash('sha256').update(await readFile(p)).digest('hex')]);}}await walk(path);return out.sort();}
test('15.10 separate CLI process reads original Child/report without writing or executing',async()=>{
 const dir=await directory(),run=cli(['run','--session',dir]);assert.equal(run.mode,'fixture');assert.equal(run.providerCalls,0);
 const before=await inventory(dir),read=cli(['read','--session',dir,'--run',run.runId]);assert.equal(read.child.parentRunId,run.runId);assert.equal(read.report.sha256,run.receipt.sha256);assert.equal(read.sources.length,2);assert.deepEqual(await inventory(dir),before);
 const again=cli(['resume','--session',dir,'--run',run.runId]);assert.equal(again.runId,run.runId);assert.deepEqual(again.rootUsage,run.rootUsage);assert.deepEqual(await inventory(dir),before);
});
test('15.11 real kill after Child result commit resumes original result without new Child request',async()=>{
 const dir=await directory(),child=fork(new URL('./fixtures/specialist-process.mjs',import.meta.url),[dir,'kill-after-child'],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});let stderr='';child.stdout.resume();child.stderr.on('data',b=>stderr+=b);const exited=once(child,'exit');
 let timer,point;try{point=await Promise.race([once(child,'message').then(([m])=>m),exited.then(()=>{throw Error('early exit '+stderr);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('checkpoint timeout '+stderr)),5000);})]);}finally{clearTimeout(timer);if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');await exited;}assert.equal(point.kind,'checkpoint');
 const store=await openSession({directory:dir});let remaining;try{remaining=store.inspect(point.runId).leaseUntil-Date.now();}finally{store.close();}if(remaining>0)await delay(remaining+30);
 const r=spawnSync(process.execPath,['test/fixtures/specialist-process.mjs',dir,'resume',point.runId],{encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.status,'completed');assert.equal(result.runId,point.runId);
 const attempts=(await readFile(join(dir,'request-counts.safe.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(attempts.filter(x=>x.role==='child').length,3);assert.equal(attempts.filter(x=>x.role==='main').length,3);assert.ok(attempts.some(x=>x.pid!==child.pid));assert.deepEqual(result.rootUsage,{model:6,tool:4});
});

test('15.12 Child terminal with parent tool-dispatched recovers through adapter reconcile',async()=>{
 const dir=await directory(),child=fork(new URL('./fixtures/specialist-process.mjs',import.meta.url),[dir,'kill-before-parent-commit'],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});child.stdout.resume();let stderr='';child.stderr.on('data',b=>stderr+=b);const ended=once(child,'exit');let timer,point;
 try{point=await Promise.race([once(child,'message').then(([m])=>m),ended.then(()=>{throw Error('early exit '+stderr);}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('checkpoint timeout '+stderr)),5000);})]);}
 finally{clearTimeout(timer);if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');await ended;}
 const store=await openSession({directory:dir});let remaining;try{const parent=store.inspect(point.runId);assert.equal(parent.snapshot.phase,'tool-dispatched');assert.equal(store.findChild(point.runId,'source-check-v1').status,'completed');remaining=parent.leaseUntil-Date.now();}finally{store.close();}if(remaining>0)await delay(remaining+30);
 const resumed=spawnSync(process.execPath,['test/fixtures/specialist-process.mjs',dir,'resume-before-parent-commit',point.runId],{encoding:'utf8',timeout:15000});assert.equal(resumed.status,0,resumed.stderr);const result=JSON.parse(resumed.stdout);assert.equal(result.status,'completed');
 const after=await openSession({directory:dir});try{const settled=after.inspect(point.runId);assert.equal(settled.snapshot.messages.find(m=>m.role==='tool').result.reconciled,true);}finally{after.close();}
 const attempts=(await readFile(join(dir,'request-counts.safe.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(attempts.filter(x=>x.role==='child').length,2);assert.equal(attempts.filter(x=>x.role==='main').length,2);assert.deepEqual(result.rootUsage,{model:4,tool:2});
});

test('15.16 CLI has no live/key switch or implicit network fallback',async()=>{
 const dir=await directory(),before=await inventory(dir);const r=spawnSync(process.execPath,['src/specialist-cli.mjs','run','--session',dir,'--live','yes'],{encoding:'utf8',timeout:5000});assert.equal(r.status,2);assert.match(r.stderr,/INVALID_ARGUMENT/);assert.deepEqual(await inventory(dir),before);
});
