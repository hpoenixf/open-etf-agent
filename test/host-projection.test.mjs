import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createResultStore} from '../src/results.mjs';
async function dir(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/host-projection-'));}
const input=()=>({runId:'parent',rootId:'root',call:{id:'delegate-1',name:'delegate_child',arguments:{}},value:{sources:[],child:{schemaVersion:'child-execution-handoff@1',parentRunId:'parent',rootId:'root',runId:'child',callId:'delegate-1',methodDescriptor:{id:'method',version:'1'},derived:true,summary:'中🙂é'.repeat(5000)}}});
test('typed derived complete immutable storage, Unicode pages, foreign owner rejection and source separation',async()=>{
 const directory=await dir(),store=await createResultStore({directory,derivedOwner:{runId:'parent',rootId:'root'}}),value=input();
 const ref=await store.addDerived(value);const canonical=JSON.parse(JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v));assert.equal((await store.addDerived(canonical)).resultRef,ref.resultRef);assert.match(ref.resultRef,/^derived:sha256:/);
 assert.deepEqual(await store.list(),[]);await assert.rejects(store.read(ref.resultRef));await assert.rejects(store.readDerived(ref.resultRef.replace('derived:','result:')));
 let text='';let offset=0;while(true){const page=await store.readDerivedSelection(ref.resultRef,{offset,limit:137});text+=page.text;if(page.coverage.nextOffset===null)break;offset=page.coverage.nextOffset;}
 assert.equal(text,value.value.child.summary);const end=await store.readDerivedSelection(ref.resultRef,{offset:Array.from(text).length,limit:1});assert.equal(end.text,'');assert.equal(end.coverage.nextOffset,null);await assert.rejects(store.readDerivedSelection(ref.resultRef,{offset:Array.from(text).length+1,limit:1}));assert.deepEqual(await store.readDerived(ref.resultRef),value);
 await assert.rejects(store.readDerivedSelection(ref.resultRef,{offset:-1,limit:2}));
 const reopened=await createResultStore({directory,derivedOwner:{runId:'parent',rootId:'root'},readOnly:true});assert.deepEqual(await reopened.readDerived(ref.resultRef),value);
 const foreign=await createResultStore({directory,derivedOwner:{runId:'other',rootId:'root'},readOnly:true});await assert.rejects(foreign.readDerived(ref.resultRef));
});
import {createToolHost} from '../src/tools.mjs';
import {projectContext} from '../src/context.mjs';
test('legacy Host definitions unchanged; only frozen new policy expands unified reader',async()=>{
 const directory=await dir(),old=await createToolHost({directory}),fresh=await createToolHost({directory,restore:old.snapshot()});assert.equal(old.snapshot().definitionsHash,'1cef3844467882db92b3b0da9d65b8f0d64cbcafaa9b6d1a1edd42f5fce67827');assert.deepEqual(fresh.definitions,old.definitions);assert.equal(fresh.snapshot().definitionsHash,old.snapshot().definitionsHash);
 const next=await createToolHost({directory,hostProjection:'host-results@1',projectionOwner:{runId:'parent',rootId:'root'},confirmDerivedConsumption:async()=>false});assert.notEqual(next.snapshot().definitionsHash,old.snapshot().definitionsHash);
 await assert.rejects(createToolHost({directory,restore:old.snapshot(),hostProjection:'host-results@1',projectionOwner:{runId:'parent',rootId:'root'},confirmDerivedConsumption:async()=>false}));
});
test('original owner verifies consumed receipt before typed reads; latest projection preserves durable bytes and source basis',async()=>{
 const directory=await dir(),record=input();let consumed=false;
 const binding={name:'delegate_child',description:'Synthetic original producer',parameters:{type:'object'},sourceResults:true,validate(){},async execute(){return structuredClone(record.value);},async verifyResult(value,{call}){assert.deepEqual(value,record.value);assert.deepEqual(call,record.call);}};
 const options={directory,extensions:[binding],allowedTools:['delegate_child','read_result','save_report'],hostProjection:'host-results@1',projectionOwner:{runId:'parent',rootId:'root'},confirmDerivedConsumption:async r=>consumed&&JSON.stringify(r)===JSON.stringify(record)};
 const host=await createToolHost(options),result=await host.execute(record.call);assert.equal(result.status,'succeeded',result.error);
 const ref=host.snapshot().results.find(r=>r.kind==='derived').resultRef;
 const read={id:'page',name:'read_result',arguments:{resultRef:ref,selection:{offset:0,limit:10}}};
 assert.equal((await host.execute(read)).status,'failed');consumed=true;
 const page=await host.execute(read);assert.equal(page.status,'succeeded',page.error);await host.verifyResult(read,page);
 await assert.rejects(host.verifyResult(read,{...page,value:{...page.value,text:'tamper'}}));
 const messages=[{role:'user',content:'Review'},{role:'assistant',calls:[record.call]},{role:'tool',callId:record.call.id,result}],saved=JSON.stringify(messages);
 const view=await projectContext({messages,maxBytes:3000,lookupSource:host.resolveSource,projectOwnedResult:host.projectOwnedResult,additionalBudget:{maxBytes:4000,measure:m=>Buffer.byteLength(JSON.stringify({messages:m,tools:host.definitions}))}});
 await host.verifyWorkingInput({messages:view});const tampered=structuredClone(view);tampered.at(-1).result.value.child.contentHash='0'.repeat(64);await assert.rejects(host.verifyWorkingInput({messages:tampered}));const fakeSource=structuredClone(view);fakeSource.at(-1).result.value.sources.push({sourceId:'forged'});await assert.rejects(host.verifyWorkingInput({messages:fakeSource}));const extra=structuredClone(view);extra.at(-1).result.value.authorized=true;await assert.rejects(host.verifyWorkingInput({messages:extra}));
 assert.equal(view.at(-1).result.value.child.kind,'stored-derived-ref');assert.equal(JSON.stringify(messages),saved);
 assert.deepEqual(await host.getResultRefs(),[]);
 const pageHistory=[...messages,{role:'assistant',calls:[read]},{role:'tool',callId:read.id,result:page}];
 await assert.rejects(projectContext({messages:pageHistory,maxBytes:100,lookupSource:host.resolveSource,projectOwnedResult:host.projectOwnedResult}),{code:'CONTEXT_CAPACITY_EXCEEDED'});
 const pageView=await projectContext({messages:pageHistory,maxBytes:2500,lookupSource:host.resolveSource,projectOwnedResult:host.projectOwnedResult});assert.equal(pageView.at(-1).result.value.text,page.value.text);
 const cold=await createToolHost({...options,restore:host.snapshot(),readOnly:true});await cold.verifyResult(read,page);assert.deepEqual(await cold.projectOwnedResult(record.call,result),await host.projectOwnedResult(record.call,result));
 consumed=false;await assert.rejects(cold.projectOwnedResult(record.call,result));
});
