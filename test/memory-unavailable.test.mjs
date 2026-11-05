import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {openMemoryLibrary} from '../src/memory.mjs';
import {openDurableMemory} from '../src/durable-memory.mjs';
import {createMemoryBindings} from '../src/memory-tools.mjs';
import {createToolHost} from '../src/tools.mjs';
import {openSession} from '../src/session.mjs';
import {run} from '../src/runtime.mjs';
import {sha256} from '../src/source.mjs';
import {projectMemory} from '../src/memory-projection.mjs';
import {compactWorkingView} from '../src/compaction.mjs';

const missing='11111111-1111-1111-1111-111111111111';
const other='22222222-2222-2222-2222-222222222222';
const text='SYNTHETIC optional preference, never original research evidence.';
const grant=(library,operation,extra={})=>({explicit:true,libraryId:library.libraryId,operation,intentId:'optional-'+operation,origin:'synthetic-test',...(operation==='save'?{approvedTextHash:sha256(text)}:{}),...extra});
async function fixture(t){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/memory-unavailable-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
async function forgotten(directory){const library=await openMemoryLibrary({directory,writable:true});try{const receipt=await library.save({text},{intent:grant(library,'save')});await library.forget(receipt.id,1,{intent:grant(library,'forget',{entryId:receipt.id,expectedRevision:1})});return receipt.id;}finally{await library.close();}}

test('22.Memory original owner distinguishes optional absence from strict read and preserves tombstone',async t=>{
 const directory=await fixture(t),id=await forgotten(join(directory,'memory')),library=await openMemoryLibrary({directory:join(directory,'memory')});
 try{
  const absent=await library.readOptional(missing);assert.deepEqual(absent,{kind:'memory-unavailable',libraryId:library.libraryId,id:missing,revision:0,reason:'not-found',recordHash:null});assert.equal(await library.verifyReadObservation(absent,missing),true);
  const removed=await library.readOptional(id);assert.equal(removed.reason,'forgotten');assert.equal(removed.revision,2);assert.match(removed.recordHash,/^[a-f0-9]{64}$/);assert.equal(Object.hasOwn(removed,'text'),false);assert.equal(await library.verifyReadObservation(removed,id),true);
  await assert.rejects(library.read(missing),/forgotten|unavailable/);await assert.rejects(library.read(id),/forgotten|unavailable/);assert.deepEqual(await library.list(),[]);
 }finally{await library.close();}
});

test('22.Memory original Host cold verification rejects altered local observations and original argument drift',async t=>{
 const directory=await fixture(t),library=await openMemoryLibrary({directory:join(directory,'memory'),writable:true});
 try{
  const host=await createToolHost({directory:await fixture(t),extensions:createMemoryBindings({library})});
  const call={id:'optional-read',name:'memory_read',arguments:{id:missing}},result=await host.execute(call);
  assert.equal(result.status,'succeeded');assert.equal(result.dispatched,true);assert.equal(result.value.kind,'memory-unavailable');await host.verifyResult(call,result);
  for(const patch of [{id:other},{libraryId:other},{revision:1},{reason:'forgotten'},{recordHash:'0'.repeat(64)},{text:'forged preference'},{kind:'memory-entry'},{kind:'other'}])await assert.rejects(host.verifyResult(call,{...result,value:{...result.value,...patch}}),/Memory/);
  const withoutKind={...result.value};delete withoutKind.kind;
  for(const value of [withoutKind,null,[],{kind:'memory-entry',libraryId:library.libraryId,id:missing,revision:1,text,sha256:sha256(text),provenance:{intentId:'forged',origin:'synthetic-test',operation:'save'}}])await assert.rejects(host.verifyResult(call,{...result,value}),/Memory/);
  await assert.rejects(host.verifyResult({...call,arguments:{id:other}},result),/Memory/);
  assert.deepEqual(await library.list(),[]);
 }finally{await library.close();}
});

test('22.Memory active bytes, tombstone bytes, and library identity failures are never ordinary absence',async t=>{
 const directory=await fixture(t),memory=join(directory,'memory'),library=await openMemoryLibrary({directory:memory,writable:true});
 try{
  const receipt=await library.save({text},{intent:grant(library,'save')}),path=join(memory,'entries',receipt.id,'1.json'),original=await readFile(path);
  await writeFile(path,original.toString().replace('optional','modified'));await assert.rejects(library.readOptional(receipt.id),/Corrupt Memory/);await writeFile(path,original);
  await library.forget(receipt.id,1,{intent:grant(library,'forget',{entryId:receipt.id,expectedRevision:1})});const tombstone=join(memory,'entries',receipt.id,'2.json');await writeFile(tombstone,'{}');await assert.rejects(library.readOptional(receipt.id),/Corrupt Memory tombstone/);
  const index=join(memory,'memory-index.json'),value=JSON.parse(await readFile(index));value.libraryId=other;await writeFile(index,JSON.stringify(value));await assert.rejects(library.readOptional(missing),/identity changed/);
 }finally{await library.close();}
});

test('22.Memory historical entry verifies after forget while its redacted projection is not treated as an original compactable result',async t=>{
 const directory=await fixture(t),library=await openMemoryLibrary({directory:join(directory,'memory'),writable:true});
 try{
  const saved=await library.save({text},{intent:grant(library,'save')}),host=await createToolHost({directory:await fixture(t),extensions:createMemoryBindings({library}),enableNotes:true});
  const call={id:'prior-read',name:'memory_read',arguments:{id:saved.id}},result=await host.execute(call);await host.verifyResult(call,result);
  await library.forget(saved.id,1,{intent:grant(library,'forget',{entryId:saved.id,expectedRevision:1})});await host.verifyResult(call,result);
  const messages=[{role:'user',content:'Keep the optional preference forgotten.'},{role:'assistant',calls:[call]},{role:'tool',callId:call.id,result},{role:'assistant',calls:[{id:'latest',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]},{role:'tool',callId:'latest',result:await host.execute({id:'latest',name:'read_page',arguments:{documentId:'atlas-a',page:1}})}];
  const projected=await projectMemory({messages,lookupState:ref=>library.state(ref.id)});assert.equal(projected[2].result.value.kind,'unavailable-memory-projection');assert.doesNotMatch(JSON.stringify(projected),/SYNTHETIC optional preference/);
  await assert.rejects(host.verifyResult(call,projected[2].result),/Memory/);assert.equal(await host.canCompactHistory(call,projected[2].result),false);
  let summaries=0;const compacted=await compactWorkingView({messages:projected,maxBytes:20000,lookupSource:host.resolveSource,rootBudget:{claim(){throw Error('No summary request required');}},canCompactHistory:host.canCompactHistory,lookupMemoryState:ref=>library.state(ref.id),summarize(){summaries++;throw Error('Forbidden forgotten summary');},saveNote:host.persistWorkingNote});
  assert.equal(summaries,0);assert.doesNotMatch(JSON.stringify(compacted.messages),/SYNTHETIC optional preference/);
 }finally{await library.close();}
});

async function runtimeFixture(t,{removed=false,phase}={}){
 const directory=await fixture(t),memory=join(directory,'memory');let id=missing;if(removed)id=await forgotten(memory);
 const adapter=await openDurableMemory({directory:memory}),store=await openSession({directory:join(directory,'session')}),stop=new AbortController();let calls=0,reads=0,interrupted=false;
 t.after(()=>store.close());
 const extensions=adapter.extensions.filter(b=>['memory_read','memory_list','memory_search'].includes(b.name)).map(b=>b.name==='memory_read'?{...b,execute(...args){reads++;return b.execute(...args);}}:b);
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'optional-memory',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'},{id:'durable-memory',version:'1',contentSha256:adapter.intentDigest}]};
 const options={question:'Finish the research even if the selected optional preference is unavailable.',outputRoot:join(directory,'runs'),requireReport:true,publication:true,extensions,workingInput:{memoryLibrary:adapter},gateway:{mode:'fixture',next({messages}){calls++;if(!messages.some(m=>m.role==='tool'))return{kind:'calls',calls:[{id:'read-optional',name:'memory_read',arguments:{id}}]};assert.equal(messages.at(-1).result.value.kind,'memory-unavailable');return{kind:'final',text:'The optional preference was unavailable. The ordinary answer is still delivered.'};}},limits:{maxRounds:3,maxTools:3,timeoutMs:10000},durable:{store,grantId:'synthetic-memory-owner',bindings,rootLimits:{model:3,tool:3}}};
 const first=await run({...options,hostSignal:stop.signal,durable:{...options.durable,onCheckpoint:e=>{if(phase&&!interrupted&&e.phase===phase){interrupted=true;stop.abort();}}}});
 return{first,store,options,calls:()=>calls,reads:()=>reads};
}
for(const removed of [false,true])test('22.Memory '+(removed?'forgotten':'missing')+' preference does not veto Main Publication',async t=>{
 const f=await runtimeFixture(t,{removed});assert.equal(f.first.status,'completed');assert.equal(f.first.code,null);assert.equal(f.first.receipt,null);assert.ok(f.first.publication);assert.equal(f.calls(),2);assert.equal(f.reads(),1);assert.deepEqual(f.first.rootUsage,{model:2,tool:1});
 const again=await run({...f.options,durable:{...f.options.durable,runId:f.first.runId}});assert.equal(again.status,'completed');assert.deepEqual(again.publication,f.first.publication);assert.equal(f.calls(),2);assert.equal(f.reads(),1);
});
for(const phase of ['result-committed','result-consumed'])test('22.Memory same Run resumes '+phase+' without replaying the optional read',async t=>{
 const f=await runtimeFixture(t,{removed:true,phase});assert.equal(f.first.status,'interrupted');assert.equal(f.calls(),1);assert.equal(f.reads(),1);
 const again=await run({...f.options,durable:{...f.options.durable,runId:f.first.runId}});assert.equal(again.status,'completed');assert.equal(f.calls(),2);assert.equal(f.reads(),1);assert.deepEqual(again.rootUsage,{model:2,tool:1});assert.equal(f.store.publicationRevisions(f.first.runId).length,1);
});

test('22.Memory invalid input and unapproved writes retain their original rejection',async t=>{
 const directory=await fixture(t),library=await openMemoryLibrary({directory:join(directory,'memory'),writable:true});
 try{const host=await createToolHost({directory:await fixture(t),extensions:createMemoryBindings({library})});for(const call of [{id:'bad-id',name:'memory_read',arguments:{id:'not-a-memory-id'}},{id:'write',name:'memory_save',arguments:{text}}]){const result=await host.execute(call);assert.equal(result.status,'rejected');assert.equal(result.dispatched,false);assert.equal(result.value,undefined);}assert.deepEqual(await library.list(),[]);}finally{await library.close();}
});
