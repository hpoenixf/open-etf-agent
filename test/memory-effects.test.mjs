import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {resolve,join} from 'node:path';
import {openMemoryLibrary} from '../src/memory.mjs';
import {createMemoryBindings} from '../src/memory-tools.mjs';
import {run} from '../src/runtime.mjs';
import {sha256} from '../src/source.mjs';
test('5.4 consumed intent and unpublished revision remain explicit in Runtime after Memory write failure',async t=>{
  await fs.mkdir('test-output',{recursive:true});const root=await fs.mkdtemp(resolve('test-output/memory-effects-'));const library=await openMemoryLibrary({directory:join(root,'library'),writable:true});const text='Synthetic partial-write candidate.';const grant={explicit:true,libraryId:library.libraryId,operation:'save',intentId:'synthetic-failed-write',origin:'synthetic-demo-intent',approvedTextHash:sha256(text)};const originalOpen=fs.open;
  t.mock.method(fs,'open',async(...args)=>{const handle=await originalOpen(...args);if(String(args[0]).includes('/entries/')&&args[1]==='wx')t.mock.method(handle,'writeFile',async()=>{throw new Error('synthetic revision write failure');});return handle;});syncBuiltinESMExports();
  try{const result=await run({question:'Explicit synthetic write failure evidence.',gateway:{async next(){return{kind:'calls',calls:[{id:'attempt',name:'memory_save',arguments:{text}}]};}},outputRoot:join(root,'runs'),requireReport:false,extensions:createMemoryBindings({library,intents:[grant]}),workingInput:{memoryLibrary:library}});assert.equal(result.status,'failed');assert.equal(result.partialEffects.length,1);const effect=result.partialEffects[0].memoryEffect;assert.equal(effect.libraryId,library.libraryId);assert.equal(effect.intentId,grant.intentId);assert.equal(effect.intentConsumed,true);assert.equal(effect.revisionPublished,false);assert.equal(effect.revision,1);const events=(await fs.readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(events.find(e=>e.type==='tool_result').memoryEffect,effect);assert.deepEqual(await library.list(),[]);await assert.rejects(library.save({text},{intent:grant}),/consumed/i);}finally{t.mock.restoreAll();syncBuiltinESMExports();await library.close();}
});
