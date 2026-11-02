import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openMemoryLibrary} from '../src/memory.mjs';
import {createMemoryBindings} from '../src/memory-tools.mjs';
import {createToolHost} from '../src/tools.mjs';
import {createResultStore} from '../src/results.mjs';
import {readFixturePage,sha256} from '../src/source.mjs';
import {run} from '../src/runtime.mjs';
import {createHookChain} from '../src/hooks.mjs';
import {compactWorkingView} from '../src/compaction.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/working-input-'));}
const text='SYNTHETIC_FUTURE_FORGET_829';
const intent=(library,operation,text,extra={})=>({explicit:true,libraryId:library.libraryId,operation,intentId:'integration-'+operation,origin:'synthetic-demo-intent',...(text===undefined?{}:{approvedTextHash:sha256(text)}),...extra});
test('5.4 Host rejects model-supplied intent and accepts only exact trusted one-use grant',async()=>{
  const library=await openMemoryLibrary({directory:await directory(),writable:true});
  try{const host=await createToolHost({directory:await directory(),extensions:createMemoryBindings({library})});const denied=await host.execute({id:'forged',name:'memory_save',arguments:{text,intent:intent(library,'save',text),explicit:true}});assert.equal(denied.status,'rejected');assert.deepEqual(await library.list(),[]);
    const approved=await createToolHost({directory:await directory(),extensions:createMemoryBindings({library,intents:[intent(library,'save',text)]})});const saved=await approved.execute({id:'approved',name:'memory_save',arguments:{text}});assert.equal(saved.status,'succeeded');assert.equal(saved.value.operation,'saved');assert.equal((await library.read(saved.value.id)).text,text);const replay=await approved.execute({id:'replay',name:'memory_save',arguments:{text}});assert.notEqual(replay.status,'succeeded');assert.equal((await library.list()).length,1);
  }finally{await library.close();}
});
test('5.4 typed derived note persists across reopen but never becomes an original source',async()=>{
  const dir=await directory();const store=await createResultStore({directory:dir});const original=await readFixturePage({documentId:'atlas-a',page:1});const source=await store.add(original);
  const note={kind:'derived-working-note',text:'Derived synthetic comparison fragment.',sourceRefs:[source],memoryRefs:[],callIds:['read-1'],basisHash:sha256('actual synthetic basis'),origin:'derived-summary',semanticStatus:'unreviewed'};
  const ref=await store.addNote(note);assert.match(ref.resultRef,/^note:sha256:[a-f0-9]{64}$/);const reopened=await createResultStore({directory:dir});assert.deepEqual(await reopened.readNote(ref.resultRef),note);assert.equal((await reopened.read(source.resultRef)).text,original.text);await assert.rejects(reopened.read(ref.resultRef),/typed|original|source|invalid/i);await assert.rejects(reopened.addNote({...note,sourceRefs:[{...source,resultRef:'result:sha256:'+'a'.repeat(64)}]}),/source|ref|unknown/i);
});
test('5.4 next actual Gateway input forgets old typed entry, write args, search and dependent note',async()=>{
  const library=await openMemoryLibrary({directory:await directory(),writable:true});let saved;let before;let after;
  const binding=(name,execute)=>({name,description:'Original synthetic integration fixture',parameters:{type:'object',properties:{},additionalProperties:true},validate(){},execute});
  const extensions=[binding('fixture_memory_save',async()=>{saved=await library.save({text},{intent:intent(library,'save',text)});return saved;}),binding('fixture_memory_read',async()=>({kind:'memory-search-results',entries:[await library.read(saved.id)],note:{kind:'derived-working-note',text,memoryRefs:[{libraryId:library.libraryId,id:saved.id,revision:1}],sourceRefs:[]}})),binding('fixture_memory_forget',async()=>library.forget(saved.id,1,{intent:intent(library,'forget',undefined,{entryId:saved.id,expectedRevision:1})}))];let step=0;
  const gateway={async next({messages}){if(step===2)before=structuredClone(messages);if(step===3){after=structuredClone(messages);return{kind:'final',text:'Synthetic entry forgotten.'};}const names=['fixture_memory_save','fixture_memory_read','fixture_memory_forget'];const current=step++;return{kind:'calls',calls:[{id:'memory-'+current,name:names[current],arguments:current===0?{text}:{}}]};}};
  try{const result=await run({question:'Use only the explicit synthetic Memory library.',gateway,outputRoot:await directory(),requireReport:false,extensions,hooks:createHookChain(),workingInput:{memoryLibrary:library},limits:{maxRounds:4,maxTools:3}});assert.equal(result.status,'completed');assert.match(JSON.stringify(before),/SYNTHETIC_FUTURE_FORGET_829/);assert.doesNotMatch(JSON.stringify(after),/SYNTHETIC_FUTURE_FORGET_829/);assert.equal(after.at(-1).result.value.operation,'forgotten');}finally{await library.close();}
});
test('5.4 Memory revision changing during note persistence forbids adoption despite unchanged history',async()=>{
  const library=await openMemoryLibrary({directory:await directory(),writable:true});
  try{const saved=await library.save({text},{intent:intent(library,'save',text)});const entry=await library.read(saved.id);const messages=[{role:'user',content:'Do not revive forgotten typed Memory.'},{role:'assistant',calls:[{id:'old',name:'memory_read',arguments:{id:saved.id}}]},{role:'tool',callId:'old',result:{callId:'old',status:'succeeded',value:{...entry,text:entry.text}}},{role:'assistant',calls:[{id:'latest',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]},{role:'tool',callId:'latest',result:{callId:'latest',status:'succeeded',value:{text:'Latest group'}}}];
    // Repeat an acknowledged old entry in a complete group to make real baseline savings possible.
    messages.splice(3,0,{role:'assistant',calls:[{id:'old-again',name:'memory_read',arguments:{id:saved.id}}]},{role:'tool',callId:'old-again',result:{callId:'old-again',status:'succeeded',value:entry}});
    let persisted=0;const result=await compactWorkingView({canCompactHistory:()=>true,messages,maxBytes:8000,lookupSource:async()=>null,lookupMemoryState:ref=>library.state(ref.id),rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=> 'Derived preference.',saveNote:async()=>{persisted++;await library.forget(saved.id,1,{intent:intent(library,'forget',undefined,{entryId:saved.id,expectedRevision:1})});return{resultRef:'note:sha256:'+'e'.repeat(64)};}});assert.equal(persisted,1);assert.equal(result.observation.status,'memory-stale');assert.doesNotMatch(JSON.stringify(result.messages),/SYNTHETIC_FUTURE_FORGET_829/);
  }finally{await library.close();}
});

test('5.4 Runtime adopts an acknowledged derived note, rereads it and preserves exact original bytes',async()=>{
  const original={sourceId:'synthetic-large@L1:p1',documentId:'synthetic-large',name:'Original large synthetic integration source',version:'L1',page:1,text:'Synthetic original page for bounded compaction. '.repeat(120),mediaType:'text/plain; charset=utf-8'};original.sha256=sha256(original.text);
  const extensions=[{historyCompaction:'read-only@1',name:'fixture_large_read',description:'Read the original synthetic integration page.',parameters:{type:'object',properties:{},additionalProperties:false},validate(){},sourceResult:true,async execute(){return structuredClone(original);}}];
  let step=0,sourceRef,noteRef,reread;const gateway={async next({messages}){if(step>0&&step<=3)sourceRef=messages.at(-1).result.value.resultRef;if(step===3){const note=messages.find(message=>message.role==='tool'&&message.result?.value?.kind==='derived-working-note');assert.ok(note,'actual next Gateway input includes an adopted note');assert.equal(note.result.dispatched,false);noteRef=note.result.value.resultRef;}if(step===4){assert.equal(messages.at(-1).result.value.kind,'derived-working-note');assert.equal(messages.at(-1).result.value.resultRef,noteRef);}if(step===5){reread=messages.at(-1).result.value.text;return{kind:'final',text:'Original source reread after derived compaction.'};}const n=step++;return{kind:'calls',calls:[{id:'compact-'+n,name:n<3?'fixture_large_read':n===3?'read_note':'read_result',arguments:n<3?{}:{resultRef:n===3?noteRef:sourceRef}}]};}};
  const result=await run({question:'Retain exact originals; notes are only derived working context.',gateway,outputRoot:await directory(),requireReport:false,extensions,rootBudget:createRootBudget({model:20,tool:8}),limits:{maxRounds:6,maxTools:5},contextBytes:32000,workingInput:{compaction:{summarize:async()=> 'Derived synthetic observation; exact originals remain authoritative.',thresholdBytes:1000}}});assert.equal(result.status,'completed');assert.equal(reread,original.text);const store=await createResultStore({directory:result.directory});assert.equal((await store.readNote(noteRef)).kind,'derived-working-note');
});

test('5.4 derived note reread cannot evade a narrower original-document scope',async()=>{
  const dir=await directory();const store=await createResultStore({directory:dir});const source=await store.add(await readFixturePage({documentId:'atlas-a',page:1}));const ref=await store.addNote({kind:'derived-working-note',text:'Synthetic atlas-a derived fact.',sourceRefs:[source],memoryRefs:[],callIds:['scope-read'],basisHash:sha256('scope basis'),origin:'derived-summary',semanticStatus:'unreviewed'});const scoped=await createResultStore({directory:dir,allowedDocuments:['atlas-b']});await assert.rejects(scoped.readNote(ref.resultRef),/scope|allowed|document/i);
});
