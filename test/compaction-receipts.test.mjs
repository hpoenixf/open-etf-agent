import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {run} from '../src/runtime.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
import {sha256} from '../src/source.mjs';

// Real original Host/Report/Runtime, controlled model and summary callbacks only.
// Receipt preservation is independent from the strict capacity gate.
test('older successful save receipt remains exact in next Gateway input after compaction',async()=>{
  await mkdir('test-output',{recursive:true});
  const outputRoot=await mkdtemp(resolve('test-output/compaction-receipt-'));
  const reportText='Synthetic immutable report. '.repeat(180);
  const captured=[];let sourceId;let savedPair;let summaries=0;
  const gateway={async next({messages}){
    captured.push(structuredClone(messages));
    if(captured.length===1)return{kind:'calls',calls:[{id:'read-one',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};
    if(captured.length===2){sourceId=messages.at(-1).result.value.sourceId;return{kind:'calls',calls:[{id:'save-once',name:'save_report',arguments:{text:reportText,sourceIds:[sourceId]}}]};}
    if(captured.length===3){const at=messages.findIndex(m=>m.role==='assistant'&&m.calls?.some(c=>c.id==='save-once'));assert.ok(at>=0);savedPair=structuredClone(messages.slice(at,at+2));return{kind:'calls',calls:[{id:'read-latest',name:'read_page',arguments:{documentId:'atlas-a',page:2}}]};}
    assert.equal(captured.length,4);return{kind:'final',text:'The synthetic report has been saved.'};
  }};
  const result=await run({question:'Read the synthetic page, save exactly once, then read another page. Preserve authoritative operation receipts.',gateway,outputRoot,allowedTools:['read_page','save_report'],allowedDocuments:['atlas-a'],contextBytes:32000,rootBudget:createRootBudget({model:16,tool:3}),limits:{maxRounds:4,maxTools:3},workingInput:{compaction:{thresholdBytes:1000,summarize:async()=>{summaries++;return 'Derived source observation, not an operation receipt.';}}}});
  assert.equal(result.status,'completed');assert.equal(captured.length,4);assert.ok(summaries>0);
  assert.equal(result.toolsDispatched,3);assert.equal(savedPair[1].result.status,'succeeded');
  const bytes=await readFile(resolve(result.directory,'report.md'));
  assert.equal(sha256(bytes),savedPair[1].result.value.sha256);
  assert.equal(bytes.length,savedPair[1].result.value.bytes);
  // Retaining the effect may correctly eliminate net savings; original RED separately proves adoption caused loss.
  // Successful adoption with explicit read extensions remains covered by the original integration case.
  const at=captured[3].findIndex(m=>m.role==='assistant'&&m.calls?.some(c=>c.id==='save-once'));
  assert.ok(at>=0,'complete authoritative save pair disappeared from actual next Gateway input');
  assert.deepEqual(captured[3].slice(at,at+2),savedPair);
});

import {createToolHost} from '../src/tools.mjs';
import {readFixturePage} from '../src/source.mjs';
import {compactWorkingView} from '../src/compaction.mjs';
import {createHookChain} from '../src/hooks.mjs';
async function dir(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/history-capability-'));}
const sourceBinding=(extra={})=>({name:'trusted_read',description:'Explicit synthetic read-only binding',parameters:{type:'object',properties:{},additionalProperties:false},validate(){},sourceResult:true,execute:()=>readFixturePage({documentId:'atlas-a',page:1}),...extra});
const call={id:'cap-read',name:'trusted_read',arguments:{}};
test('only explicit trusted read capability selects history; effects, hooks and spoofed results retain',async()=>{
  for(const extra of [{},{historyCompaction:'read-only@1'},{historyCompaction:'read-only@1',artifactEffects:true},{historyCompaction:'read-only@1',memoryEffect:true}]){
    const host=await createToolHost({directory:await dir(),enableNotes:true,extensions:[sourceBinding(extra)]});
    const result=await host.execute(call);assert.equal(result.status,'succeeded');
    const expected=extra.historyCompaction==='read-only@1'&&!extra.artifactEffects&&!extra.memoryEffect;
    assert.equal(await host.canCompactHistory(call,result),expected);
    if(expected){
      for(const patch of [{error:'synthetic'},{partialPaths:['report.md']},{artifactEffects:[{}]},{memoryEffect:{}},{unknownEffects:[{}]},{hookErrors:['synthetic']},{effective:call},{status:'failed'},{status:'unknown'},{dispatched:false},{callId:'foreign'}])assert.equal(await host.canCompactHistory(call,{...result,...patch}),false);
      await assert.rejects(host.canCompactHistory(call,{...result,value:{...result.value,text:'Unbound replacement'}}),/source payload mismatch/);
    }else assert.equal(await host.canCompactHistory(call,{...result,value:{...result.value,historyCompaction:'read-only@1'}}),false);
  }
  const hooked=await createToolHost({directory:await dir(),enableNotes:true,hooks:createHookChain(),extensions:[sourceBinding({historyCompaction:'read-only@1'})]});
  assert.equal(await hooked.canCompactHistory(call,await hooked.execute(call)),false);
});

test('mixed read and unknown effect group stays complete; absent direct policy does not summarize',async()=>{
  let effects=0;const host=await createToolHost({directory:await dir(),enableNotes:true,extensions:[sourceBinding({historyCompaction:'read-only@1'}),{name:'opaque_effect',description:'Synthetic acknowledged effect',parameters:{type:'object'},validate(){},execute(){effects++;return{acknowledged:true};}}]});
  const effect={id:'effect-once',name:'opaque_effect',arguments:{}};
  const latest={id:'latest',name:'read_page',arguments:{documentId:'atlas-a',page:2}};
  const messages=[{role:'user',content:'Keep complete effect groups.'},{role:'assistant',calls:[call,effect]},{role:'tool',callId:call.id,result:await host.execute(call)},{role:'tool',callId:effect.id,result:await host.execute(effect)},{role:'assistant',calls:[latest]},{role:'tool',callId:latest.id,result:await host.execute(latest)}];
  for(const policy of [undefined,host.canCompactHistory]){
    let summaries=0;const result=await compactWorkingView({messages,maxBytes:32000,lookupSource:host.resolveSource,canCompactHistory:policy,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=>{summaries++;return'Derived.';},saveNote:host.persistWorkingNote});
    assert.equal(summaries,0);assert.equal(result.observation.status,'no-eligible-group');assert.deepEqual(result.messages,messages);
  }
  assert.equal(effects,1);
});

test('history policy is stable on reopen, rejects old or changed capabilities, and leaves no-notes snapshots unchanged',async()=>{
  const directory=await dir();const extension=sourceBinding({historyCompaction:'read-only@1'});
  const host=await createToolHost({directory,enableNotes:true,extensions:[extension]});
  const result=await host.execute(call);const snapshot=host.snapshot();assert.equal(snapshot.historyCompaction.version,'history-compaction@1');
  const reopened=await createToolHost({directory,enableNotes:true,extensions:[sourceBinding({historyCompaction:'read-only@1'})],restore:snapshot});
  assert.deepEqual(reopened.snapshot(),snapshot);assert.equal(await reopened.canCompactHistory(call,result),true);
  await assert.rejects(createToolHost({directory,enableNotes:true,extensions:[sourceBinding()],restore:snapshot}),/compaction policy mismatch/);
  const old=structuredClone(snapshot);delete old.historyCompaction;
  await assert.rejects(createToolHost({directory,enableNotes:true,extensions:[extension],restore:old}),/compaction policy mismatch/);
  const plainDir=await dir();const plain=await createToolHost({directory:plainDir});const ps=plain.snapshot();assert.equal(Object.hasOwn(ps,'historyCompaction'),false);
  assert.deepEqual((await createToolHost({directory:plainDir,restore:ps})).snapshot(),ps);
  const unknown=sourceBinding();const immutable=await createToolHost({directory:await dir(),enableNotes:true,extensions:[unknown]});unknown.historyCompaction='read-only@1';
  assert.equal(await immutable.canCompactHistory(call,await immutable.execute(call)),false);
  extension.execute=()=>{throw new Error('Caller replaced trusted execute');};extension.sourceResult=false;
  assert.equal((await host.execute({...call,id:'captured-function'})).status,'succeeded');
  const legacy=await createToolHost({directory:await dir(),extensions:[sourceBinding({historyCompaction:'unrelated-legacy-extra'})]});
  assert.equal((await legacy.execute(call)).status,'succeeded');
});

import {openMemoryLibrary} from '../src/memory.mjs';
import {createMemoryBindings} from '../src/memory-tools.mjs';
test('real acknowledged Memory write pair remains; only original factory read bindings opt in',async()=>{
  const library=await openMemoryLibrary({directory:await dir(),writable:true});
  try{
    const text='Synthetic durable preference. '.repeat(80);
    const extensions=createMemoryBindings({library,intents:[{explicit:true,libraryId:library.libraryId,operation:'save',intentId:'receipt-preservation-save',origin:'synthetic-test',approvedTextHash:sha256(text)}]});
    for(const binding of extensions)assert.equal(binding.historyCompaction,['memory_read','memory_search','memory_list'].includes(binding.name)?'read-only@1':undefined);
    const host=await createToolHost({directory:await dir(),enableNotes:true,extensions});
    const read={id:'original-source',name:'read_page',arguments:{documentId:'atlas-a',page:1}};
    const write={id:'memory-once',name:'memory_save',arguments:{text}};
    const latest={id:'latest-source',name:'read_page',arguments:{documentId:'atlas-a',page:2}};
    const messages=[{role:'user',content:'Preserve the explicitly granted synthetic Memory write receipt.'}];
    for(const c of [read,write,latest]){const result=await host.execute(c);assert.equal(result.status,'succeeded');messages.push({role:'assistant',calls:[c]},{role:'tool',callId:c.id,result});}
    const result=await compactWorkingView({messages,maxBytes:32000,lookupSource:host.resolveSource,lookupMemoryState:ref=>library.state(ref.id),canCompactHistory:host.canCompactHistory,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=> 'Derived read observation.',saveNote:host.persistWorkingNote});
    const at=result.messages.findIndex(m=>m.role==='assistant'&&m.calls?.[0]?.id===write.id);
    assert.ok(at>=0);assert.deepEqual(result.messages.slice(at,at+2),messages.slice(3,5));
    assert.equal((await library.list()).length,1);assert.equal((await library.read(messages[4].result.value.id)).text,text);
  }finally{await library.close();}
});
