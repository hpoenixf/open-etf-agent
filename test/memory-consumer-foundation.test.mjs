import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,readdir,readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { run } from '../src/runtime.mjs';
import { openMemoryLibrary } from '../src/memory.mjs';
import { openMemoryConsumer } from '../src/memory-consumer.mjs';
import { createMemoryRecallGateway } from '../src/memory-recall-demo.mjs';
import { sha256 } from '../src/source.mjs';
async function inventory(directory){const rows=[];async function walk(path,prefix=''){for(const e of(await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=prefix+e.name;if(e.isDirectory())await walk(join(path,e.name),name+'/');else rows.push({path:name,sha256:sha256(await readFile(join(path,e.name)))});}}await walk(directory);return rows;}
async function setup(){await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/memory-foundation-')),directory=join(root,'library');const writer=await openMemoryLibrary({directory,writable:true});let current;try{const text='SYNTHETIC old preference',saved=await writer.save({text},{intent:{explicit:true,libraryId:writer.libraryId,operation:'save',intentId:'foundation-save',origin:'synthetic-test',approvedTextHash:sha256(text)}});const next='SYNTHETIC current preference: verify exact physical pages.';current=await writer.revise(saved.id,1,{text:next},{intent:{explicit:true,libraryId:writer.libraryId,operation:'revise',intentId:'foundation-revise',origin:'synthetic-test',entryId:saved.id,expectedRevision:1,approvedTextHash:sha256(next)}});}finally{await writer.close();}const selection=await openMemoryConsumer({directory});return{root,directory,selection,current,before:await inventory(directory)};}
const tools=selection=>[...selection.extensions.map(e=>e.name),'read_page','save_report'];

test('readonly Memory does not bypass selected original-result consumer admission',async()=>{
 const s=await setup();let calls=0;const outputRoot=join(s.root,'runs');await mkdir(outputRoot);const allowedTools=tools(s.selection);
 try{await assert.rejects(run({question:'Read current selected Memory only.',gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Must not execute.'};}},extensions:s.selection.extensions,workingInput:s.selection.workingInput,contextBytes:32000,allowedTools,outputRoot,requireReport:false}),e=>e.code==='WORKING_INPUT_TOOL_UNAVAILABLE');assert.equal(calls,0);assert.deepEqual(await readdir(outputRoot),[]);assert.deepEqual(allowedTools,tools(s.selection));assert.deepEqual(await inventory(s.directory),s.before);}finally{await s.selection.close();}
});

test('readonly Memory plus compaction requires explicit note reread without adding grants',async()=>{
 const s=await setup();let calls=0,summaries=0;const allowedTools=[...tools(s.selection),'read_result'];
 try{await assert.rejects(run({question:'No implicit derived-note grant.',gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Must not execute.'};}},extensions:s.selection.extensions,workingInput:{...s.selection.workingInput,compaction:{thresholdBytes:1,summarize:async()=>{summaries++;return'derived';}}},allowedTools,outputRoot:join(s.root,'runs'),requireReport:false}),e=>e.code==='WORKING_INPUT_TOOL_UNAVAILABLE');assert.equal(calls,0);assert.equal(summaries,0);assert.ok(!allowedTools.includes('read_note'));assert.deepEqual(await inventory(s.directory),s.before);}finally{await s.selection.close();}
});

test('one-hour configured Runtime consumes original readonly revision2 wire and report with the original five tools',async()=>{
 const s=await setup();const {gateway,observations}=createMemoryRecallGateway({query:'preference',selection:s.selection});
 try{const out=await run({question:'Use current readonly Memory as context, not source or authority.',gateway,extensions:s.selection.extensions,workingInput:s.selection.workingInput,allowedTools:tools(s.selection),outputRoot:join(s.root,'runs'),limits:{maxRounds:36,maxTools:72,timeoutMs:3600000}});assert.equal(out.status,'completed');assert.deepEqual(out.rootUsage,{model:5,tool:4});assert.equal(observations.requests.length,5);assert.ok(observations.consumed.some(ref=>ref.id===s.current.id&&ref.revision===2&&ref.sha256===s.current.sha256));assert.equal(sha256(await readFile(join(out.directory,out.receipt.path))),out.receipt.sha256);assert.deepEqual(await inventory(s.directory),s.before);assert.deepEqual(tools(s.selection).sort(),['memory_list','memory_read','memory_search','read_page','save_report']);assert.deepEqual(out.unknownEffects,[]);}finally{await s.selection.close();}
});
