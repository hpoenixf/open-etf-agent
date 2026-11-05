import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,lstat,readFile,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {runSpecialistDemo,readSpecialistRun} from '../src/specialist-demo.mjs';

async function inventory(directory){
 const rows=[];
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);
  else rows.push([path,createHash('sha256').update(await readFile(path)).digest('hex')]);
 }}
 await walk(directory);return rows.sort();
}

test('Session spill fixture keeps a hot journal through forced GC until explicit process death',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/spill-lifetime-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const result=await runSpecialistDemo({directory});
 const fixture=new URL('./fixtures/session-recovery-process.mjs',import.meta.url);
 const source=`process.argv=[process.execPath,${JSON.stringify(fileURLToPath(fixture))},'spill',${JSON.stringify(directory)}];
 await import(${JSON.stringify(fixture.href)});
 for(let i=0;i<8;i++){global.gc();await new Promise(resolve=>setImmediate(resolve));}
 process.send({kind:'gc-complete'});`;
 const child=spawn(process.execPath,['--expose-gc','--input-type=module','-e',source],{stdio:['ignore','ignore','ignore','ipc']});
 const ended=once(child,'exit');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);let exit;
 try{
  const completed=new Promise(resolve=>child.on('message',message=>{if(message?.kind==='gc-complete')resolve(message);}));
  await Promise.race([completed,ended.then(()=>{throw Error('Synthetic spill ended before GC proof');})]);
  const journal=await lstat(join(directory,'session.sqlite-journal'));
  assert.ok(journal.isFile()&&journal.size>0,'live transaction must retain its journal after GC');
 }finally{
  clearTimeout(timer);if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');exit=await ended;
 }
 assert.deepEqual(exit,[null,'SIGKILL']);
 assert.ok((await lstat(join(directory,'session.sqlite-journal'))).size>0);
 const before=await inventory(directory);
 await assert.rejects(readSpecialistRun({directory,runId:result.runId}),/SESSION_READ_SIDECAR_UNSUPPORTED/);
 assert.deepEqual(await inventory(directory),before);
});
