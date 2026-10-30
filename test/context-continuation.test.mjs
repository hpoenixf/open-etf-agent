import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {sha256} from '../src/source.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
test('original Runtime Context compaction continues after A+B+A without repeating saved report',async()=>{
 await mkdir('test-output',{recursive:true});const outputRoot=await mkdtemp(resolve('test-output/latest-context-'));
 const docs=new Map(['a','b'].map((id,i)=>{const text=id.repeat(i?7391:7378);return [id,{sourceId:id+'@1:p1',documentId:id,name:'Synthetic acquired '+id,version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'}];}));
 let executed=0,main=0,summaries=0,aRef;
 const extension={name:'context_fixture_source',description:'Read authorized synthetic fixture.',parameters:{type:'object',properties:{documentId:{type:'string',enum:['a','b']}},required:['documentId'],additionalProperties:false},sourceResult:true,validate(args){assert.deepEqual(Object.keys(args),['documentId']);assert.ok(docs.has(args.documentId));},async execute(args){executed++;return structuredClone(docs.get(args.documentId));}};
 const call=(id,name,args)=>({id,name,arguments:args}),reads=prefix=>[call(prefix+'a','context_fixture_source',{documentId:'a'}),call(prefix+'b','context_fixture_source',{documentId:'b'})];
 const gateway={async next({messages}){
  const step=main++;
  if(step===0)return {kind:'calls',calls:reads('first-')};
  if(step===1){aRef=messages.find(m=>m.result?.value?.sourceId==='a@1:p1').result.value.resultRef;return {kind:'calls',calls:[call('save-once','save_report',{text:'# Synthetic report\n\nAcquired sources are preserved.',sourceIds:['a@1:p1','b@1:p1']})]};}
  if(step===2)return {kind:'calls',calls:[...reads('repeat-'),call('reread-a','read_result',{resultRef:aRef})]};
  if(step===3){
   const values=messages.filter(m=>m.role==='tool');assert.equal(values.find(m=>m.callId==='repeat-a').result.value.text,undefined);assert.equal(values.find(m=>m.callId==='repeat-b').result.value.text.length,7391);assert.equal(values.find(m=>m.callId==='reread-a').result.value.text.length,7378);
   const note=values.find(m=>m.result?.value?.kind==='derived-working-note');assert.ok(note,'real original compaction must publish a derived note');return {kind:'calls',calls:[call('reread-note','read_note',{resultRef:note.result.value.resultRef})]};
  }
  assert.equal(step,4);return {kind:'final',text:'Synthetic task completed after exact source and note rereads.'};
 }};
 const result=await run({question:'Use the explicitly allowed synthetic sources and save a report.',gateway,outputRoot,extensions:[extension],allowedTools:['context_fixture_source','read_result','read_note','save_report'],contextBytes:20000,rootBudget:createRootBudget({model:32,tool:16}),limits:{maxRounds:8,maxTools:16,timeoutMs:5000},workingInput:{compaction:{thresholdBytes:1500,summaryTimeoutMs:2000,summarize:async()=>{summaries++;return 'Derived note. Reread both acquired source references for exact original evidence.';}}}});
 assert.equal(result.status,'completed',result.code);assert.equal(main,5);assert.equal(executed,4);assert.ok(summaries>0);assert.equal(result.rootUsage.model,main+summaries);assert.equal(result.rootUsage.tool,7);assert.deepEqual(result.unknownEffects,[]);assert.deepEqual(result.partialEffects,[]);
 const logs=(await readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(logs.filter(e=>e.type==='file_saved').length,1);assert.ok(logs.some(e=>e.type==='working_note'&&e.status==='applied'));assert.equal(logs.filter(e=>e.type==='tool_result'&&e.name==='save_report').length,1);assert.equal(logs.filter(e=>e.type==='tool_result'&&e.name==='read_note'&&e.status==='succeeded').length,1);assert.equal(sha256(await readFile(join(result.directory,result.receipt.path))),result.receipt.sha256);
});
