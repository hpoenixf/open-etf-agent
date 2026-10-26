import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {openMemoryLibrary} from '../src/memory.mjs';
import {sha256} from '../src/source.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/memory-'));}
let intentSequence=0;
const intent=(library,operation,text,extra={})=>({explicit:true,libraryId:library.libraryId,operation,intentId:'synthetic-'+operation+'-'+(++intentSequence),origin:'synthetic-demo-intent',...(text===undefined?{}:{approvedTextHash:sha256(text)}),...extra});
const text='SYNTHETIC preference: always cite both acquired guide versions.';
test('5.1 explicit selected library persists actual entry and readback after reopen',async()=>{
  const dir=await directory();const library=await openMemoryLibrary({directory:dir,writable:true});let written;
  try{written=await library.save({text},{intent:intent(library,'save',text)});assert.equal(written.revision,1);assert.equal(written.operation,'saved');assert.equal((await library.read(written.id)).text,text);assert.equal((await library.list())[0].text,undefined);}finally{await library.close();}
  const reopened=await openMemoryLibrary({directory:dir});try{assert.equal((await reopened.read(written.id)).text,text);}finally{await reopened.close();}
});
test('5.1 missing or mismatched intent and sensitive candidate do not grant writes',async()=>{
  const library=await openMemoryLibrary({directory:await directory(),writable:true});
  try{
    await assert.rejects(library.save({text}),/intent|authorized/i);
    await assert.rejects(library.save({text},{intent:intent(library,'revise',text)}),/intent|operation/i);
    await assert.rejects(library.save({text},{intent:intent(library,'save','different approved text')}),/intent|content/i);
    const sensitive='password: do-not-store-this-synthetic-value';await assert.rejects(library.save({text:sensitive},{intent:intent(library,'save',sensitive)}),/sensitive|refused/i);assert.deepEqual(await library.list(),[]);
  }finally{await library.close();}
});
test('5.1 revise compares actual revision and does not accept stale update',async()=>{
  const library=await openMemoryLibrary({directory:await directory(),writable:true});
  try{const first=await library.save({text},{intent:intent(library,'save',text)});assert.equal(first.revision,1);const next='SYNTHETIC preference: include exact page identities.';const second=await library.revise(first.id,1,{text:next},{intent:intent(library,'revise',next,{entryId:first.id,expectedRevision:1})});assert.equal(second.revision,2);
    await assert.rejects(library.revise(first.id,1,{text},{intent:intent(library,'revise',text,{entryId:first.id,expectedRevision:1})}),/revision|conflict/i);assert.equal((await library.read(first.id)).text,next);
  }finally{await library.close();}
});
test('5.1 second writer refuses rather than stealing ownership and close releases it',async()=>{
  const dir=await directory();const first=await openMemoryLibrary({directory:dir,writable:true});let unexpected;
  try{await assert.rejects(async()=>{unexpected=await openMemoryLibrary({directory:dir,writable:true});},/writer|lock|owned/i);}finally{await unexpected?.close();await first.close();}
  const next=await openMemoryLibrary({directory:dir,writable:true});await next.close();
});
test('5.1 forget hides recall without erasing old revisions or allowing silent revival',async()=>{
  const dir=await directory();const library=await openMemoryLibrary({directory:dir,writable:true});
  try{const saved=await library.save({text},{intent:intent(library,'save',text)});assert.equal(saved.revision,1);const forgotten=await library.forget(saved.id,1,{intent:intent(library,'forget',undefined,{entryId:saved.id,expectedRevision:1})});assert.equal(forgotten.operation,'forgotten');assert.equal(forgotten.revision,2);
    assert.deepEqual(await library.list(),[]);assert.deepEqual(await library.search('cite'),[]);await assert.rejects(library.read(saved.id),/forgotten|unavailable/i);assert.ok((await readdir(join(dir,'entries',saved.id))).length>=2);
    await assert.rejects(library.revise(saved.id,2,{text},{intent:intent(library,'revise',text,{entryId:saved.id,expectedRevision:2})}),/forgotten|unavailable/i);
  }finally{await library.close();}
});

test('5.1 intent binds library and is consumed once even after reopen',async()=>{
  const dir=await directory();const library=await openMemoryLibrary({directory:dir,writable:true});const grant=intent(library,'save',text);
  try{await library.save({text},{intent:grant});await assert.rejects(library.save({text},{intent:grant}),/intent|consum|used/i);
    await assert.rejects(library.save({text},{intent:{...intent(library,'save',text),libraryId:'different-library'}}),/library|intent/i);assert.equal((await library.list()).length,1);
  }finally{await library.close();}
  const reopened=await openMemoryLibrary({directory:dir,writable:true});try{await assert.rejects(reopened.save({text},{intent:grant}),/intent|consum|used/i);}finally{await reopened.close();}
});
