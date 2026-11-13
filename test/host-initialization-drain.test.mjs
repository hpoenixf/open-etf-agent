import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {resolve} from 'node:path';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {run} from '../src/runtime.mjs';

test('cancelled Runtime drains admitted Host initialization before returning',{timeout:3000},async t=>{
 await fs.mkdir('test-output',{recursive:true});
 const directory=await fs.mkdtemp(resolve('test-output/host-init-drain-'));
 const stop=new AbortController();let entered,release,returned=false,modelCalls=0;
 const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const read=fs.readFile;
 const mock=t.mock.method(fs,'readFile',async function(path,...args){
  if(path instanceof URL&&path.pathname.endsWith('/fixtures/documents.json')){entered();await gate;}
  return read.call(this,path,...args);
 });
 syncBuiltinESMExports();
 const pending=run({question:'Synthetic cancellation',outputRoot:directory,signal:stop.signal,requireReport:false,gateway:{mode:'fixture',next:async()=>{modelCalls++;return {kind:'final',text:'Not reached'};}}}).then(value=>{returned=true;return value;});
 try{
  await started;stop.abort();
  // Event-loop barriers allow cancellation finalization to run without timing sleeps.
  for(let i=0;i<10;i++)await nextTurn();
  assert.equal(returned,false,'Runtime returned while its Host initialization was still held');
 }finally{release();const result=await pending;mock.mock.restore();syncBuiltinESMExports();assert.equal(result.status,'cancelled');assert.equal(modelCalls,0);}
});

 test('cancelled Runtime bounds stuck initialization and reports unfinished cleanup',{timeout:3000},async t=>{
 await fs.mkdir('test-output',{recursive:true});
 const directory=await fs.mkdtemp(resolve('test-output/host-init-bounded-'));
 const stop=new AbortController();let entered,release;
 const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const read=fs.readFile;
 const mock=t.mock.method(fs,'readFile',async function(path,...args){
  if(path instanceof URL&&path.pathname.endsWith('/fixtures/documents.json')){entered();await gate;throw new Error('SYNTHETIC_LATE_INIT_FAILURE');}
  return read.call(this,path,...args);
 });syncBuiltinESMExports();
 const pending=run({question:'Synthetic stuck initialization',outputRoot:directory,signal:stop.signal,requireReport:false,gateway:{mode:'fixture',next:async()=>assert.fail('No model dispatch after cancellation')}});
 try{await started;stop.abort();const result=await pending;assert.equal(result.status,'cancelled');assert.deepEqual(result.cleanup,{effectsStopped:false,pending:'host-initialization'});}
 finally{release();await pending;mock.mock.restore();syncBuiltinESMExports();}
 });
