import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {run} from '../src/runtime.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
import {sha256} from '../src/source.mjs';
test('actual long B structure stops with capacity code before new summary or Main and preserves saved report',async()=>{
 const input=JSON.parse(await readFile(new URL('./fixtures/context-capacity.synthetic.json',import.meta.url),'utf8'));
 const groups=input.messages.filter(m=>m.role==='assistant').map(m=>m.calls);assert.equal(groups.length,4);assert.equal(Buffer.byteLength(input.messages[0].content),571);
 const docs=new Map(input.messages.filter(m=>m.role==='tool'&&m.result.value?.sourceId).map(m=>{const v=structuredClone(m.result.value);delete v.resultRef;return [v.documentId,v];}));assert.equal(docs.size,2);
 let main=0,summary=0,sourceDispatch=0;
 const ext={name:'context_fixture_source',historyCompaction:'read-only@1',description:'Only the two granted public synthetic sources.',parameters:{type:'object',properties:{documentId:{type:'string',enum:[...docs.keys()]}},required:['documentId'],additionalProperties:false},sourceResult:true,validate(a){assert.deepEqual(Object.keys(a),['documentId']);assert.ok(docs.has(a.documentId));},async execute(a){sourceDispatch++;return structuredClone(docs.get(a.documentId));}};
 await mkdir('test-output',{recursive:true});const outputRoot=await mkdtemp(resolve('test-output/capacity-'));
 const result=await run({question:input.messages[0].content,outputRoot,extensions:[ext],allowedTools:['context_fixture_source','read_result','read_note','save_report'],contextBytes:20000,rootBudget:createRootBudget({model:32,tool:16}),limits:{maxRounds:8,maxTools:16,timeoutMs:5000},workingInput:{compaction:{thresholdBytes:1500,summaryTimeoutMs:30000,summarize:async()=>{summary++;assert.ok(summary<=2,'no post-capacity summary');return summary===1?'s'.repeat(4096):'s'.repeat(373);}}},gateway:{next:async()=>{assert.ok(main<4,'no post-capacity Main call');return {kind:'calls',calls:structuredClone(groups[main++])};}}});
 assert.equal(result.status,'failed');assert.equal(result.code,'CONTEXT_CAPACITY_EXCEEDED');assert.equal(main,4);assert.equal(summary,2);assert.equal(sourceDispatch,4);assert.deepEqual(result.rootUsage,{model:6,tool:7});assert.deepEqual(result.unknownEffects,[]);assert.deepEqual(result.partialEffects,[]);
 const logs=(await readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(logs.filter(e=>e.type==='file_saved').length,1);assert.equal(logs.filter(e=>e.type==='tool_result'&&e.name==='save_report').length,1);assert.equal(logs.filter(e=>e.type==='model_proposal').length,4);assert.equal(logs.filter(e=>e.type==='working_note'&&e.status==='applied').length,1);assert.equal(logs.at(-1).code,result.code);
 const actual=await readFile(join(result.directory,result.receipt.path));const original=input.messages.find(m=>m.role==='tool'&&m.result.value?.path==='report.md').result.value;assert.equal(sha256(actual),original.sha256);assert.equal(actual.length,original.bytes);assert.equal(result.receipt.sha256,original.sha256);
});
