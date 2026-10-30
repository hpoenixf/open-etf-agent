import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMemory} from '../src/memory-projection.mjs';
import {sha256} from '../src/source.mjs';
const secret='SYNTHETIC_FORGOTTEN_PREFERENCE_517';
const entry={kind:'memory-entry',libraryId:'library-fixture',id:'entry-fixture',revision:1,text:secret,sha256:sha256(secret)};
const pair=(id,name,args,value)=>[{role:'assistant',calls:[{id,name,arguments:args}]},{role:'tool',callId:id,result:{callId:id,status:'succeeded',dispatched:true,value}}];
test('5.2 forgotten typed payload and its historical save arguments disappear only from future view',async()=>{
  const messages=[{role:'user',content:'Use only explicitly selected memory.'},...pair('save','memory_save',{text:secret},{kind:'memory-write-receipt',libraryId:entry.libraryId,id:entry.id,revision:1,sha256:entry.sha256,operation:'saved'}),...pair('read','memory_read',{id:entry.id},entry)];
  const result=await projectMemory({messages,lookupState:async()=>({libraryId:entry.libraryId,id:entry.id,revision:2,active:false})});
  assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_FORGOTTEN_PREFERENCE_517/);assert.match(JSON.stringify(messages),/SYNTHETIC_FORGOTTEN_PREFERENCE_517/);assert.equal(result[2].result.status,'succeeded');assert.equal(result[1].calls[0].id,'save');assert.equal(result[4].callId,'read');assert.match(result[1].calls[0].arguments.text,/redact|forgotten/i);
});
test('5.2 derived note with forgotten dependency cannot revive its text; unavailable state fails closed',async()=>{
  const note={kind:'derived-working-note',text:secret,memoryRefs:[{libraryId:entry.libraryId,id:entry.id,revision:1}],sourceRefs:[]};const messages=[{role:'user',content:'Read working input.'},...pair('note','read_note',{},note)];
  const result=await projectMemory({messages,lookupState:async()=>({libraryId:entry.libraryId,id:entry.id,revision:2,active:false})});assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_FORGOTTEN_PREFERENCE_517/);
  await assert.rejects(projectMemory({messages,lookupState:async()=>{throw new Error('explicit library unavailable');}}),/unavailable/i);
});

test('5.2 search containers, revised write arguments and wrong identity cannot leak old typed text',async()=>{
  const receipt={kind:'memory-write-receipt',libraryId:entry.libraryId,id:entry.id,revision:1,sha256:entry.sha256,operation:'revised'};
  const messages=[{role:'user',content:'Keep my original question.'},...pair('revise','memory_revise',{id:entry.id,expectedRevision:0,text:secret},receipt),...pair('search','memory_search',{query:'preference'},{kind:'memory-search-results',entries:[entry]})];
  for(const state of [{libraryId:entry.libraryId,id:entry.id,revision:2,active:true,sha256:sha256('new text')},{libraryId:'another-library',id:entry.id,revision:1,active:true,sha256:entry.sha256},{libraryId:entry.libraryId,id:'another-entry',revision:1,active:true,sha256:entry.sha256}]){
    const projected=await projectMemory({messages,lookupState:async()=>state});assert.doesNotMatch(JSON.stringify(projected),/SYNTHETIC_FORGOTTEN_PREFERENCE_517/);assert.equal(projected.at(-1).callId,'search');assert.equal(projected[1].calls[0].name,'memory_revise');
  }
  assert.match(JSON.stringify(messages),/SYNTHETIC_FORGOTTEN_PREFERENCE_517/);
});

test('5.2 forgotten write text is also removed from actual Hook original/effective call metadata',async()=>{
  const messages=[{role:'user',content:'Explicit selected Memory only.'},...pair('save-hook','memory_save',{text:secret},{kind:'memory-write-receipt',libraryId:entry.libraryId,id:entry.id,revision:1,sha256:entry.sha256,operation:'saved'})];
  messages[2].result.original={id:'save-hook',name:'trusted_save_alias',arguments:{text:secret}};messages[2].result.effective={id:'save-hook',name:'memory_save',arguments:{text:secret}};
  const projected=await projectMemory({messages,lookupState:async()=>({libraryId:entry.libraryId,id:entry.id,revision:2,active:false})});assert.doesNotMatch(JSON.stringify(projected),/SYNTHETIC_FORGOTTEN_PREFERENCE_517/);assert.equal(projected[2].result.original.name,'trusted_save_alias');assert.equal(projected[2].result.effective.name,'memory_save');assert.match(JSON.stringify(messages),/SYNTHETIC_FORGOTTEN_PREFERENCE_517/);
});
