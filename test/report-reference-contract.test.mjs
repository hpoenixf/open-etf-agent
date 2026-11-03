import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createToolHost} from '../src/tools.mjs';
test('publication contract separates original sources from derived calculations without widening acceptance',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/report-contract-'));t.after(()=>rm(directory,{recursive:true,force:true}));const host=await createToolHost({directory});
 const tool=host.definitions.find(t=>t.name==='save_report');assert.match(tool.description,/Only Host-registered calculate_change/);assert.match(tool.description,/generic plugin result is not a registered calculation/);assert.match(tool.parameters.properties.sourceIds.description,/not calculation\/result\/artifact/);
 const invoke=(id,name,args)=>host.execute({id,name,arguments:args});const source=await invoke('read','read_page',{documentId:'atlas-a',page:1});assert.equal(source.status,'succeeded');const calc=await invoke('calc','calculate_change',{baseline:120,current:150,baselineUnit:'units',currentUnit:'units'});assert.equal(calc.status,'succeeded');
 const rejected=await invoke('bad','save_report',{text:'Change [C1].',sourceIds:[source.value.sourceId,calc.value.resultRef]});assert.equal(rejected.status,'rejected');assert.equal(rejected.dispatched,false);assert.match(rejected.error,/Unknown acquired source ID/);assert.equal(host.snapshot().saveAttempted,false);
 // Direct Host assertion only: this does not retry a failed Runtime or reopen its grant.
 const saved=await invoke('good','save_report',{text:'Source [1]; derived increase 25% [C1].',sourceIds:[source.value.sourceId]});assert.equal(saved.status,'succeeded');assert.equal(host.snapshot().saveAttempted,true);const report=await readFile(join(directory,'report.md'),'utf8');assert.match(report,/25%/);assert.match(report,/calculate_change/);assert.match(report,/120/);assert.match(report,/150/);
});

test('generic trusted arithmetic output never acquires a numbered calculation citation',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/plugin-report-contract-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const host=await createToolHost({directory,extensions:[{name:'inventory_balance',description:'Trusted derived arithmetic, not source evidence.',parameters:{type:'object',properties:{},additionalProperties:false},validate(args){assert.deepEqual(args,{});},execute(){return{kind:'derived-inventory-arithmetic',sourceEvidence:false,balance:18};}}]});
 const invoke=(id,name,args)=>host.execute({id,name,arguments:args});const source=await invoke('read','read_page',{documentId:'atlas-a',page:1});assert.equal(source.status,'succeeded');const derived=await invoke('plugin','inventory_balance',{});assert.equal(derived.status,'succeeded');assert.equal(derived.value.resultRef,undefined);
 const rejected=await invoke('bad','save_report',{text:'Derived inventory 18 [C1], input [1].',sourceIds:[source.value.sourceId]});assert.equal(rejected.status,'rejected');assert.equal(rejected.dispatched,false);assert.match(rejected.error,/Unknown numbered acquired-result citation/);assert.equal(host.snapshot().saveAttempted,false);
 // A direct Host contract check, not a retry of a failed Runtime or a repaired real sample.
 const saved=await invoke('good','save_report',{text:'Trusted inventory_balance returned a derived balance of 18; it is not original evidence. Original input [1].',sourceIds:[source.value.sourceId]});assert.equal(saved.status,'succeeded');const report=await readFile(join(directory,'report.md'),'utf8');assert.match(report,/derived balance of 18/);assert.doesNotMatch(report,/\[C1\]/);
});
