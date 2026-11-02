import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openSession } from '../src/session.mjs';

globalThis.fetch = () => { throw new Error('OFFLINE_TEST_FETCH_FORBIDDEN'); };
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/schema-lock-')); }
const childSource = `
import { DatabaseSync } from 'node:sqlite';
const db=new DatabaseSync(process.argv[1]); let timer,finished=false;
const release=()=>{if(finished)return;finished=true;clearTimeout(timer);db.exec('COMMIT');db.close();process.disconnect();};
db.exec('BEGIN EXCLUSIVE');process.send({kind:'held',pid:process.pid});
process.on('message',message=>{if(message.kind==='arm'){if(message.holdMs!==null)timer=setTimeout(release,message.holdMs);process.send({kind:'armed'});}else if(message.kind==='release')release();});
`;
async function lock(filename, holdMs) {
 const child = spawn(process.execPath, ['--input-type=module', '-e', childSource, filename], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
 let stderr=''; child.stderr.on('data',x=>{stderr+=x;}); const messages=[]; const waiters=[];
 child.on('message',message=>{messages.push(message);for(const waiter of waiters)if(waiter.kind===message.kind)waiter.resolve(message);});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 const wait=kind=>messages.some(m=>m.kind===kind)?Promise.resolve(messages.find(m=>m.kind===kind)):new Promise((resolve,reject)=>{waiters.push({kind,resolve});child.once('exit',()=>reject(new Error('Synthetic lock exited before '+kind+': '+stderr)));});
 const held=await wait('held'); assert.notEqual(held.pid,process.pid); child.send({kind:'arm',holdMs});await wait('armed');
 return { async release() { if(child.connected)child.send({kind:'release'}); const result=await exited;assert.equal(result.code,0);assert.equal(result.signal,null);assert.equal(stderr,''); } };
}

// Keep the potentially blocking native SQLite admission in a normal Node process.
// The test runner coordinates explicit IPC barriers; it never performs the locked read.
async function opener(directory) {
 const moduleUrl=new URL('../src/session.mjs',import.meta.url).href;
 const code=`import {openSession} from ${JSON.stringify(moduleUrl)};
 process.send({kind:'ready',pid:process.pid});
 process.once('message',async()=>{let store,result;try{store=await openSession({directory:process.argv[1]});result={ok:true};}catch(error){result={ok:false,code:error.code,errcode:error.errcode??null};}finally{store?.close();}process.send({kind:'result',result},()=>process.disconnect());});`;
 const child=spawn(process.execPath,['--input-type=module','-e',code,directory],{stdio:['ignore','ignore','pipe','ipc']});let stderr='';child.stderr.on('data',x=>{stderr+=x;});const messages=[];const waiters=[];
 child.on('message',message=>{messages.push(message);for(const w of waiters)if(w.kind===message.kind)w.resolve(message);});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 const wait=kind=>messages.some(m=>m.kind===kind)?Promise.resolve(messages.find(m=>m.kind===kind)):new Promise((resolve,reject)=>{waiters.push({kind,resolve});child.once('exit',()=>reject(new Error('Synthetic admission exited before '+kind+': '+stderr)));});
 const ready=await wait('ready');assert.notEqual(ready.pid,process.pid);
 return {async open(){child.send({kind:'open'});const observed=await wait('result');const result=await exited;assert.equal(result.code,0);assert.equal(result.signal,null);assert.equal(stderr,'');return observed.result;}};
}

test('schema admission waits for a handshaken short exclusive lock before reading a valid original Session', async () => {
 const d=await directory();const original=await openSession({directory:d});original.close();const filename=join(d,'session.sqlite');const before=await readFile(filename);const admission=await opener(d);const blocker=await lock(filename,125);
 try { assert.deepEqual(await admission.open(),{ok:true}); }
 finally { await blocker.release(); }
 assert.deepEqual(await readFile(filename),before);
});

test('schema admission remains bounded and fails closed when the exclusive lock is not released', async () => {
 const d=await directory();const original=await openSession({directory:d});original.close();const filename=join(d,'session.sqlite');const before=await readFile(filename);const admission=await opener(d);const blocker=await lock(filename,null);const started=performance.now();
 try { assert.deepEqual(await admission.open(),{ok:false,code:'ERR_SQLITE_ERROR',errcode:5});assert.ok(performance.now()-started<1800,'existing one-second busy bound must not become an unbounded retry'); }
 finally { await blocker.release(); }
 assert.deepEqual(await readFile(filename),before);
});

test('after a short lock, an unknown schema is still refused before any writable recovery or byte change', async () => {
 const d=await directory(),filename=join(d,'session.sqlite');const db=new DatabaseSync(filename);db.exec('PRAGMA user_version=999; CREATE TABLE unrelated(value TEXT)');db.close();const before=await readFile(filename);const admission=await opener(d);const blocker=await lock(filename,125);
 try { assert.deepEqual(await admission.open(),{ok:false,code:'UNSUPPORTED_SESSION_SCHEMA',errcode:null}); }
 finally { await blocker.release(); }
 assert.deepEqual(await readFile(filename),before);
});
