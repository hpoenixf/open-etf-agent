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
const memoryText='Synthetic preference '.repeat(80);
const memory={kind:'memory-entry',libraryId:'library',id:'entry',revision:1,sha256:sha256(memoryText),text:memoryText};
const memoryState=(active=true)=>async()=>({libraryId:memory.libraryId,id:memory.id,revision:memory.revision,sha256:memory.sha256,active});

test('whole Memory-bearing groups stay typed in Main, including metadata and nested entries',async()=>{
 for(const [name,value] of [['memory_search',{kind:'memory-search-results',entries:[memory]}],['memory_list',{kind:'memory-metadata-list',entries:[]}],['read_page',{nested:{entries:[memory]}}]]){
  const f=fixture(),mixed=f.group('memory',value,name),other=f.group('sibling',f.b);
  mixed[0].calls.push(other[0].calls[0]);mixed.push(other[1]);f.messages.splice(3,0,...mixed);
  let summary;const result=await compactWorkingView({...f.options,canCompactHistory:()=>true,lookupMemoryState:memoryState(),summarize:async({groups})=>{summary=groups;return 'Safe summary of the original source.';}});
  assert.equal(result.observation.status,'applied');
  assert.deepEqual(summary,[f.messages.slice(1,3)]);
  const i=result.messages.findIndex(m=>m.calls?.[0]?.id==='memory');
  assert.ok(i>=0);assert.deepEqual(result.messages.slice(i,i+3),mixed);
  assert.deepEqual(f.notes.get(result.noteRef).memoryRefs,[]);
 }
});

test('settled Memory alone never reserves a summary and stale entries are redacted in Main',async()=>{
 const f=fixture(),mixed=f.group('memory',memory,'memory_read');f.messages.splice(1,2,...mixed);
 const result=await compactWorkingView({...f.options,lookupMemoryState:memoryState(false)});
 assert.equal(result.observation.status,'no-eligible-group');
 assert.equal(f.reservations(),0);assert.equal(result.messages[2].result.value.kind,'unavailable-memory-projection');
 assert.ok(!JSON.stringify(result.messages).includes(memoryText));
});

test('a valid old Memory-bearing frontier is not reused even while the entry is active',async()=>{
 const f=fixture();f.messages.splice(3,0,...f.group('memory',memory,'memory_read'));
 const basisHash=sha256(JSON.stringify(f.messages));
 const stored={kind:'derived-working-note',text:'Prior opaque synthetic preference.',sourceRefs:[f.sources.get(f.a.sourceId)],memoryRefs:[{libraryId:memory.libraryId,id:memory.id,revision:memory.revision,sha256:memory.sha256}],callIds:['a1','memory'],basisHash,origin:'derived-summary',semanticStatus:'unreviewed'};
 const previous=noteRef(stored);f.notes.set(previous,stored);
 const frontier={schemaVersion:'compaction-frontier@1',noteRef:previous,messageCount:f.messages.length,basisHash};
 const result=await compactWorkingView({...f.options,lookupMemoryState:memoryState(),frontier});
 assert.equal(result.frontier,null);assert.equal(result.noteRef,null);assert.notEqual(result.observation.status,'reused');
 assert.ok(!JSON.stringify(result.messages).includes(stored.text));assert.equal(f.reservations(),0);
 const next=await compactWorkingView({...f.options,lookupMemoryState:memoryState(),frontier:result.frontier});
 assert.equal(next.observation.status,'applied');assert.deepEqual(f.notes.get(next.noteRef).memoryRefs,[]);
});

test('an old mixed frontier cannot reuse notes that name a Memory tool but have no Memory refs',async()=>{
 const f=fixture();f.messages.splice(3,0,...f.group('list',{kind:'memory-metadata-list',entries:[]},'memory_list'));
 const basisHash=sha256(JSON.stringify(f.messages));
 const note={kind:'derived-working-note',text:'Prior synthetic metadata summary.',sourceRefs:[f.sources.get(f.a.sourceId)],memoryRefs:[],callIds:['a1','list'],basisHash,origin:'derived-summary',semanticStatus:'unreviewed'};
 const previous=noteRef(note);f.notes.set(previous,note);
 const result=await compactWorkingView({...f.options,canCompactHistory:()=>true,frontier:{schemaVersion:'compaction-frontier@1',noteRef:previous,messageCount:f.messages.length,basisHash}});
 assert.equal(result.observation.status,'frontier-ineligible');assert.equal(result.frontier,null);assert.equal(result.noteRef,null);assert.equal(f.reservations(),0);
});

test('changed source identity drops frontier without another reservation',async()=>{
 const f=fixture(),first=await compactWorkingView(f.options);f.sources.get(f.a.sourceId).sha256=sha256('changed original');const result=await compactWorkingView({...f.options,frontier:first.frontier});assert.equal(result.observation.status,'source-stale');assert.equal(result.frontier,null);assert.equal(f.reservations(),1);
});
