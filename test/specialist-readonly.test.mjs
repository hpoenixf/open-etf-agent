import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir,rename,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {runSpecialistDemo,readSpecialistRun} from '../src/specialist-demo.mjs';
import {openSession} from '../src/session.mjs';
import {createResultStore} from '../src/results.mjs';
import {createToolHost} from '../src/tools.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/specialist-readonly-'));}
async function inventory(path){const out=[];async function walk(dir){for(const n of await readdir(dir,{withFileTypes:true})){const p=join(dir,n.name);if(n.isDirectory())await walk(p);else out.push([p,createHash('sha256').update(await readFile(p)).digest('hex')]);}}await walk(path);return out.sort();}
test('15.13 read-only existing owners refuse missing stores without creating directories',async()=>{
 const dir=await directory(),result=await runSpecialistDemo({directory:dir});const session=await openSession({directory:dir,readOnly:true});let child;try{assert.equal(session.claim,undefined);assert.equal(session.create,undefined);child=session.findChild(result.runId,'source-check-v1');}finally{session.close();}
 for(const leaf of ['results','artifacts']){const original=join(child.directory,leaf),backup=original+'-held';await rename(original,backup);const before=await inventory(dir);await assert.rejects(readSpecialistRun({directory:dir,runId:result.runId}));assert.deepEqual(await inventory(dir),before);await rename(backup,original);}
 const blank=await directory(),before=await inventory(blank);await assert.rejects(openSession({directory:blank,readOnly:true}));await assert.rejects(createResultStore({directory:blank,readOnly:true}));await assert.rejects(createToolHost({directory:blank,readOnly:true}));assert.deepEqual(await inventory(blank),before);
});
test('15.14 read-only Session rejects actual hot journal and cold sidecars without recovery',async()=>{
 const dir=await directory(),result=await runSpecialistDemo({directory:dir});
 const child=fork(new URL('./fixtures/session-recovery-process.mjs',import.meta.url),['spill',dir],{stdio:['ignore','ignore','ignore','ipc'],execArgv:[]});const ended=once(child,'exit');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);
 try{const [event]=await Promise.race([once(child,'message'),ended.then(()=>{throw Error('spill ended early');})]);assert.equal(event.kind,'spilled');}finally{clearTimeout(timer);if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');await ended;}
 const before=await inventory(dir);await assert.rejects(readSpecialistRun({directory:dir,runId:result.runId}),/SESSION_READ_SIDECAR_UNSUPPORTED/);assert.deepEqual(await inventory(dir),before);
 const cold=await directory(),normal=await runSpecialistDemo({directory:cold});await writeFile(join(cold,'session.sqlite-wal'),'synthetic-refuse');const inventoryBefore=await inventory(cold);await assert.rejects(readSpecialistRun({directory:cold,runId:normal.runId}),/SESSION_READ_SIDECAR_UNSUPPORTED/);assert.deepEqual(await inventory(cold),inventoryBefore);
});

test('15.17 read-only Host rejects reconcile before any extension callback',async()=>{
 const dir=await directory();let calls=0;
 const extension={name:'synthetic_reconcile',description:'Original test callback.',parameters:{type:'object',properties:{},additionalProperties:false},recoveryVersion:'test@1',validate(){},execute:async()=>({ok:true}),reconcile:async()=>{calls++;return{ok:true};}};
 await createToolHost({directory:dir,extensions:[extension]});const host=await createToolHost({directory:dir,extensions:[extension],readOnly:true});
 await assert.rejects(host.reconcile({id:'old',name:extension.name,arguments:{}},{}),/Read-only tool Host/);assert.equal(calls,0);
});
