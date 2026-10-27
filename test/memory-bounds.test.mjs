import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {resolve} from 'node:path';
import {openMemoryLibrary} from '../src/memory.mjs';
test('5.1 failed initial lock write removes only the lock inode owned by this open',async t=>{
  await fs.mkdir('test-output',{recursive:true});const directory=await fs.mkdtemp(resolve('test-output/lock-failure-'));const originalOpen=fs.open;let injected=false;
  t.mock.method(fs,'open',async(...args)=>{const handle=await originalOpen(...args);if(String(args[0]).endsWith('/.writer.lock')&&args[1]==='wx'){injected=true;t.mock.method(handle,'writeFile',async()=>{throw new Error('synthetic lock write failure');});}return handle;});syncBuiltinESMExports();
  try{await assert.rejects(openMemoryLibrary({directory,writable:true}),/synthetic lock write failure/);assert.equal(injected,true);assert.equal((await fs.readdir(directory)).includes('.writer.lock'),false);}finally{t.mock.restoreAll();syncBuiltinESMExports();}
});
