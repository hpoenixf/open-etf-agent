import test from 'node:test';
import assert from 'node:assert/strict';
import {compactWorkingView} from '../src/compaction.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
import {sha256} from '../src/source.mjs';
function fixture(){
  const source={sourceId:'capacity@C1:p1',documentId:'capacity',name:'Original synthetic compaction fixture',version:'C1',page:1,text:'Original synthetic evidence. '.repeat(60),mediaType:'text/plain; charset=utf-8'};source.sha256=sha256(source.text);const ref={...Object.fromEntries(['sourceId','documentId','name','version','page','sha256','mediaType'].map(k=>[k,source[k]])),resultRef:'result:sha256:'+sha256('compaction-fixture-original')};
  const messages=[{role:'user',content:'Preserve my original question and restrictions.'},{role:'assistant',calls:[{id:'old-read',name:'read_page',arguments:{documentId:'capacity',page:1}}]},{role:'tool',callId:'old-read',result:{callId:'old-read',status:'succeeded',dispatched:true,value:{...source,resultRef:ref.resultRef}}},{role:'assistant',calls:[{id:'latest-read',name:'read_page',arguments:{documentId:'capacity',page:2}}]},{role:'tool',callId:'latest-read',result:{callId:'latest-read',status:'succeeded',dispatched:true,value:{text:'Current group must remain exact.'}}}];
  return{messages,lookupSource:async id=>id===source.sourceId?ref:null};
}
test('5.3 net-saving derived note keeps original history/latest group and consumes root model allowance',async()=>{
  const f=fixture();const original=structuredClone(f.messages);const budget=createRootBudget({model:2,tool:1});const notes=[];
  const result=await compactWorkingView({canCompactHistory:()=>true,...f,maxBytes:6000,rootBudget:budget,summarize:async()=> 'Derived synthetic observation; reread exact original for details.',saveNote:async note=>{notes.push(note);return{resultRef:'note:sha256:'+sha256(JSON.stringify(note))};}});
  assert.equal(result.observation.status,'applied');assert.equal(budget.snapshot().model,1);assert.equal(notes.length,1);assert.ok(notes[0].sourceRefs.length);assert.deepEqual(f.messages,original);assert.deepEqual(result.messages.at(-1),original.at(-1));assert.deepEqual(result.messages[0],original[0]);assert.ok(Buffer.byteLength(JSON.stringify(result.messages))<Buffer.byteLength(JSON.stringify(original)));
});
test('5.3 failure, no saving and missing budget preserve the reference baseline without publishing notes',async()=>{
  for(const mode of ['failure','no-saving','budget']){
    const f=fixture();const original=structuredClone(f.messages);const budget=createRootBudget({model:1,tool:1});if(mode==='budget')budget.claim('model');let saves=0,calls=0;
    const result=await compactWorkingView({canCompactHistory:()=>true,...f,maxBytes:6000,rootBudget:budget,summarize:async()=>{calls++;if(mode==='failure')throw new Error('synthetic summary failure');return 'x'.repeat(3800);},saveNote:async()=>{saves++;return{resultRef:'note:sha256:'+'a'.repeat(64)};}});
    assert.notEqual(result.observation.status,'unimplemented');assert.notEqual(result.observation.status,'applied');assert.equal(saves,0);assert.deepEqual(result.messages,original);assert.deepEqual(f.messages,original);if(mode==='budget')assert.equal(calls,0);
  }
});
test('5.3 stale basis abandons the generated note rather than replacing newer requirements',async()=>{
  const f=fixture();let saves=0;
  const result=await compactWorkingView({canCompactHistory:()=>true,...f,maxBytes:6000,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=>{f.messages[0].content='New explicit requirement arrived.';return 'Derived old-basis note.';},saveNote:async()=>{saves++;return{resultRef:'note:sha256:'+'b'.repeat(64)};}});
  assert.equal(result.observation.status,'stale');assert.equal(saves,0);assert.equal(result.messages[0].content,'New explicit requirement arrived.');
});

test('5.3 note must save bytes against an already reference-only baseline, not discarded raw text',async()=>{
  const f=fixture();const source=f.messages[2].result.value;const ref=await f.lookupSource(source.sourceId);
  f.messages[2].result.value={...ref,kind:'stored-source-ref',readWith:{name:'read_result',arguments:{resultRef:ref.resultRef}}};const baseline=structuredClone(f.messages);let saves=0;
  const result=await compactWorkingView({canCompactHistory:()=>true,...f,maxBytes:6000,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=> 'x'.repeat(1500),saveNote:async()=>{saves++;return{resultRef:'note:sha256:'+'c'.repeat(64)};}});
  assert.notEqual(result.observation.status,'applied');assert.notEqual(result.observation.status,'unimplemented');assert.equal(saves,0);assert.deepEqual(result.messages,baseline);
});
test('5.3 stale basis or cancellation during persistence leaves a note unadopted',async()=>{
  for(const mode of ['stale','cancel']){
    const f=fixture();const controller=new AbortController();let saves=0;
    const result=await compactWorkingView({canCompactHistory:()=>true,...f,maxBytes:6000,signal:controller.signal,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=> 'Derived short note.',saveNote:async()=>{saves++;if(mode==='stale')f.messages[0].content='Requirement changed while saving.';else controller.abort();return{resultRef:'note:sha256:'+'d'.repeat(64)};}});
    assert.equal(saves,1);assert.equal(result.observation.status,mode==='stale'?'stale':'cancelled');assert.deepEqual(result.messages,f.messages);
  }
});
