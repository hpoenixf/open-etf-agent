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
