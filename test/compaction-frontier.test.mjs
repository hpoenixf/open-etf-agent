import test from 'node:test';import assert from 'node:assert/strict';
import {compactWorkingView} from '../src/compaction.mjs';import {sha256} from '../src/source.mjs';import {noteRef} from '../src/working-note.mjs';
function fixture(){
 const sources=new Map(),notes=new Map();let reservations=0;
 const source=id=>{const text=('Synthetic original '+id+' ').repeat(100),v={sourceId:id+'@1:p1',documentId:id,name:id,version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'},ref={...v,resultRef:'result:sha256:'+sha256(id)};sources.set(v.sourceId,Object.fromEntries(Object.entries(ref).filter(([k])=>k!=='text')));return ref;};
 const a=source('a'),b=source('b');
 const group=(id,value,name='read_page',status='succeeded')=>[{role:'assistant',calls:[{id,name,arguments:{}}]},{role:'tool',callId:id,result:{callId:id,status,dispatched:true,value}}];
 const messages=[{role:'user',content:'Keep exact original constraints.'},...group('a1',a),...group('last',{text:'Latest exact group'})];
 const options={messages,maxBytes:30000,lookupSource:async id=>sources.get(id),canCompactHistory:async call=>call.name==='read_page'||call.name==='memory_read',rootBudget:{claim(){reservations++;}},summarize:async()=> 'Derived note; use original sources.',saveNote:async note=>{const ref=noteRef(note);notes.set(ref,structuredClone(note));return{resultRef:ref};},readNote:async ref=>structuredClone(notes.get(ref))};
 return {a,b,group,messages,options,notes,sources,reservations:()=>reservations};
}
test('verified frontier reuses notes for repeated same evidence and preserves effectful/latest groups exactly',async()=>{
 const f=fixture(),first=await compactWorkingView(f.options);assert.equal(first.observation.status,'applied');assert.equal(f.reservations(),1);
 f.messages.push(...f.group('reread',f.a),...f.group('effect',{fileId:'original-report'},'save_report'),...f.group('last2',{text:'Keep latest exact'}));
 const before=structuredClone(f.messages),again=await compactWorkingView({...f.options,frontier:first.frontier});assert.equal(again.observation.status,'reused');assert.equal(f.reservations(),1);assert.deepEqual(f.messages,before);assert.deepEqual(again.messages.slice(-4),before.slice(-4));assert.deepEqual(again.frontier,first.frontier);
});
test('new original evidence permits a new bounded summary and advances the verified frontier',async()=>{
 const f=fixture(),first=await compactWorkingView(f.options);f.messages.push(...f.group('b1',f.b),...f.group('tail',{text:'Current tail'}));const second=await compactWorkingView({...f.options,frontier:first.frontier});assert.equal(second.observation.status,'applied');assert.equal(f.reservations(),2);assert.notEqual(second.noteRef,first.noteRef);assert.equal(second.frontier.messageCount,f.messages.length);
});
test('forged note identity rejects; changed original prefix never reuses its old note',async()=>{
 const f=fixture(),first=await compactWorkingView(f.options);const forged=structuredClone(f.notes.get(first.noteRef));forged.text='Forged summary';await assert.rejects(compactWorkingView({...f.options,frontier:first.frontier,readNote:async()=>forged}),/identity/);
 f.messages[0].content='New original requirement';const changed=await compactWorkingView({...f.options,frontier:first.frontier});assert.equal(changed.observation.status,'frontier-stale');assert.equal(changed.frontier,null);assert.equal(f.reservations(),1);
});
test('summary allowance is checked before reservation and does not compact unknown or effectful groups',async()=>{
 const f=fixture();let reserved=0;const no=await compactWorkingView({...f.options,allowSummary:false,reserveSummary:async()=>{reserved++;}});assert.equal(no.observation.status,'summary-budget-exhausted');assert.equal(reserved,0);assert.equal(f.reservations(),0);
 f.messages[2].result.status='unknown';const unknown=await compactWorkingView(f.options);assert.equal(unknown.observation.status,'no-eligible-group');assert.deepEqual(unknown.messages,f.messages);assert.equal(f.reservations(),0);
});
test('Memory dependency invalidation drops prior frontier instead of reusing stale content',async()=>{
 const f=fixture();let current=true;const memory={kind:'memory-entry',libraryId:'library',id:'entry',revision:1,sha256:sha256('preference'),text:'Synthetic preference '.repeat(80)};
 f.messages.splice(3,0,...f.group('memory',memory,'memory_read'));const options={...f.options,lookupMemoryState:async()=>({libraryId:'library',id:'entry',revision:current?1:2,sha256:memory.sha256,active:true})};const first=await compactWorkingView(options);assert.equal(first.observation.status,'applied');current=false;const stale=await compactWorkingView({...options,frontier:first.frontier});assert.equal(stale.frontier,null);assert.notEqual(stale.observation.status,'reused');assert.equal(f.reservations(),1);
});

test('changed source identity drops frontier without another reservation',async()=>{
 const f=fixture(),first=await compactWorkingView(f.options);f.sources.get(f.a.sourceId).sha256=sha256('changed original');const result=await compactWorkingView({...f.options,frontier:first.frontier});assert.equal(result.observation.status,'source-stale');assert.equal(result.frontier,null);assert.equal(f.reservations(),1);
});
