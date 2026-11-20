import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {run} from '../src/runtime.mjs';
import {compactWorkingView} from '../src/compaction.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
import {sha256} from '../src/source.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/summary-lower-bound-'));}

test('an impossible net-saving note consumes no summary reservation through the actual Runtime',async()=>{
  let next=0,summaries=0;const gateway={mode:'fixture',async next({messages}){next++;if(next<=2)return{kind:'calls',calls:[{id:'read-'+next,name:'read_page',arguments:{documentId:next===1?'atlas-a':'atlas-b',page:1}}]};assert.ok(messages.filter(m=>m.role==='tool').every(m=>m.result.value.kind!=='derived-working-note'));return{kind:'final',text:'Original settled sources retained.'};}};
  const out=await run({question:'Keep original sources.',gateway,outputRoot:await directory(),requireReport:false,limits:{maxRounds:8,maxTools:4},contextBytes:32000,workingInput:{compaction:{thresholdBytes:1,summarize:async()=>{summaries++;return 'x';}}}});
  assert.equal(out.status,'completed',out.code);assert.equal(next,3);assert.equal(summaries,0);assert.equal(out.rootUsage.model,3);
  const log=(await readFile(out.directory+'/run.jsonl','utf8')).trim().split('\n').map(JSON.parse);assert.ok(log.some(e=>e.type==='working_note'&&e.status==='no-net-saving'&&e.noteRef===null));
});

test('a possible lower bound does not replace the real summary saving check',async()=>{
  const text='Original synthetic source. '.repeat(100);const source={sourceId:'lower@1:p1',documentId:'lower',name:'Synthetic lower-bound source',version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
  const ref={...Object.fromEntries(['sourceId','documentId','name','version','page','sha256','mediaType'].map(k=>[k,source[k]])),resultRef:'result:sha256:'+sha256('original-lower-bound')};
  const messages=[{role:'user',content:'Preserve exact original evidence.'},{role:'assistant',calls:[{id:'old',name:'read_page',arguments:{documentId:'lower',page:1}}]},{role:'tool',callId:'old',result:{callId:'old',status:'succeeded',dispatched:true,value:{...source,resultRef:ref.resultRef}}},{role:'assistant',calls:[{id:'latest',name:'read_page',arguments:{documentId:'lower',page:2}}]},{role:'tool',callId:'latest',result:{callId:'latest',status:'succeeded',dispatched:true,value:{text:'Latest complete group.'}}}];
  for(const text of ['Useful derived observation.','x'.repeat(3800)]){
    const rootBudget=createRootBudget({model:1,tool:1});let summaries=0,saves=0;
    const out=await compactWorkingView({messages,maxBytes:8000,lookupSource:async()=>ref,canCompactHistory:()=>true,rootBudget,summarize:async()=>{summaries++;return text;},saveNote:async note=>{saves++;return{resultRef:'note:sha256:'+sha256(JSON.stringify(note))};}});
    assert.equal(summaries,1);assert.equal(rootBudget.snapshot().model,1);assert.equal(out.observation.status,text.length<100?'applied':'no-net-saving');assert.equal(saves,text.length<100?1:0);assert.deepEqual(out.messages.at(-1),messages.at(-1));
  }
});

test('an unchanged settled no-gain basis is suppressed, while changed evidence or capacity is eligible',async()=>{
 const text='Exact source text. '.repeat(130);
 function original(id,page){
  const s={sourceId:'scoped@1:p'+page,documentId:'scoped',name:'Synthetic source',version:'1',page,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
  return [{role:'assistant',calls:[{id,name:'read_page',arguments:{documentId:'scoped',page}}]},{role:'tool',callId:id,result:{callId:id,status:'succeeded',dispatched:true,value:{...s,resultRef:'result:sha256:'+sha256(id)}}}];
 }
 const extra=id=>[{role:'assistant',calls:[{id,name:'unresolved',arguments:{}}]},{role:'tool',callId:id,result:{callId:id,status:'rejected',dispatched:false,error:'TEST_REJECTED'}}];
 const stable=original('owned-first',1),changed=original('owned-second',2);const lookup=new Map([stable,changed].map(pair=>[pair[1].result.value.sourceId,Object.fromEntries(Object.entries(pair[1].result.value).filter(([key])=>key!=='text'))]));
 const rootBudget=createRootBudget({model:6,tool:1});let summaries=0;
 const run=async({memo=null,scope='cap-1',suffix=extra('last-1')}={})=>{
  const messages=[{role:'user',content:'Keep the original answer.'},...stable,...suffix];const measure=v=>Buffer.byteLength(JSON.stringify({model:'fixture',tools:['read_note','read_page'],messages:v}));
  return compactWorkingView({messages,maxBytes:24000,lookupSource:async id=>lookup.get(id),additionalBudget:{maxBytes:24000,measure},canCompactHistory:call=>call.name==='read_page',pressure:{beforeBytes:measure(messages),noGainHash:memo,scope},rootBudget,summarize:async()=>{summaries++;return 'X'.repeat(4096);},saveNote:async()=>{throw Error('non-saving note cannot be committed');}});
 };
 const first=await run();assert.equal(first.observation.status,'no-net-saving');assert.match(first.noGainHash,/^[a-f0-9]{64}$/);assert.equal(summaries,1);
 const unchanged=await run({memo:first.noGainHash,suffix:[...extra('last-1'),...extra('last-2')]});assert.equal(unchanged.observation.status,'unchanged-no-net-saving');assert.equal(summaries,1);
 const newCap=await run({memo:first.noGainHash,scope:'cap-2'});assert.equal(newCap.observation.status,'no-net-saving');assert.notEqual(newCap.noGainHash,first.noGainHash);
 await run({memo:first.noGainHash,suffix:[...changed,...extra('last-3')]});assert.equal(summaries,3);
});

for(const encoded of [false,true])test(`managed compaction pins complete Memory groups; encoded=${encoded}`,async()=>{
 const page=(id,number)=>{
  const text='Original public synthetic evidence. '.repeat(110);
  const source={sourceId:'synthetic@1:p'+number,documentId:'synthetic',name:'Synthetic',version:'1',page:number,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8',resultRef:'result:sha256:'+sha256(id)};
  return {call:{id,name:'read_page',arguments:{documentId:'synthetic',page:number}},result:{role:'tool',callId:id,result:{callId:id,status:'succeeded',dispatched:true,value:source}}};
 };
 const [first,second,latest]=[page('first',1),page('second',2),page('latest',3)];
 const value={kind:'memory-entry',libraryId:'test',id:'memory',revision:1,sha256:sha256('synthetic text'),text:'synthetic text'};
 const memoryCall={id:'memory',name:'memory_read',arguments:{}};
 const memoryMessage={role:'tool',callId:'memory',result:{callId:'memory',status:'succeeded',dispatched:true,value}};
 const messages=[{role:'user',content:'Use exact provenance.'},{role:'assistant',calls:[first.call,memoryCall]},first.result,memoryMessage,{role:'assistant',calls:[second.call]},second.result,{role:'assistant',calls:[latest.call]},latest.result];
 const refs=new Map([first,second,latest].map(item=>{const {text,...ref}=item.result.result.value;return [ref.sourceId,ref];}));
 const measure=messages=>Buffer.byteLength(JSON.stringify({messages,tools:['read_page','memory_read']}));
 const out=await compactWorkingView({messages,maxBytes:32000,lookupSource:async id=>refs.get(id),additionalBudget:{maxBytes:32000,measure},canCompactHistory:()=>true,...(encoded?{pressure:{beforeBytes:measure(messages),scope:'encoded'}}:{}),lookupMemoryState:async()=>({...value,active:true}),rootBudget:createRootBudget({model:2,tool:1}),
  summarize:async({groups})=>{assert.deepEqual(groups.map(g=>g[0].calls.map(c=>c.id)),[['second']]);return 'Derived evidence.';},
  saveNote:async note=>{assert.deepEqual(note.memoryRefs,[]);return{resultRef:'note:sha256:'+sha256(JSON.stringify(note))};}});
 assert.equal(out.observation.status,'applied');
 assert.deepEqual(out.messages.slice(1,4),messages.slice(1,4));
});
