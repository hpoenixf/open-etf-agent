import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResultStore} from '../src/results.mjs';
import {createToolHost} from '../src/tools.mjs';
import {calculateChange} from '../src/calculation.mjs';
import {sha256} from '../src/source.mjs';
const rows=()=>[
 {id:'baseline',value:100,unit:'amount',currency:'USD',dataAsOf:'2026-10-01'},
 {id:'unselected',value:999,unit:'amount',currency:'USD',dataAsOf:'2026-10-01'},
 {id:'tail-current',value:250,unit:'amount',currency:'USD',dataAsOf:'2026-10-01'}
];
const source=(data=rows(),documentId='synthetic-comparison')=>{const text=JSON.stringify({schemaVersion:'comparison-table@1',synthetic:true,rows:data});return{sourceId:documentId+'@1:p1',documentId,name:'Original synthetic comparison',version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};};
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/result-consumption-'));}
async function stored(data=rows()){const dir=await directory();const store=await createResultStore({directory:dir});const original=source(data);const ref=await store.add(original);return{dir,store,original,ref};}
const input=ref=>({resultRef:ref,selection:{offset:0,limit:3},baselineRow:0,currentRow:2});
async function hostFixture(data=rows()){
 const dir=await directory();const host=await createToolHost({directory:dir,extensions:[{name:'synthetic_table',description:'Original test-only table',parameters:{type:'object',properties:{},additionalProperties:false},sourceResult:true,validate:args=>assert.deepEqual(args,{}),execute:async()=>source(data)}]});
 const acquired=await host.execute({id:'read',name:'synthetic_table',arguments:{}});assert.equal(acquired.status,'succeeded');return{dir,host,ref:acquired.value.resultRef};
}
test('RC source selection retains actual tail row and original immutable identity',async()=>{
 const f=await stored();const selected=await f.store.readSelection(f.ref.resultRef,{offset:2,limit:1});assert.equal(selected.available,true);assert.deepEqual(selected.rows,[{index:2,row:rows()[2]}]);assert.equal(selected.resultRef,f.ref.resultRef);assert.equal(selected.contentHash,f.original.sha256);assert.deepEqual(selected.coverage,{offset:2,requested:1,total:3,returned:1,rowIndices:[2],complete:true,storedTableComplete:false});
 assert.deepEqual(await f.store.read(f.ref.resultRef),f.original);const fresh=await createResultStore({directory:f.dir});assert.deepEqual(await fresh.readSelection(f.ref.resultRef,{offset:2,limit:1}),selected);
});
test('RC missing tail operand cannot be supplied by a complete but partial window',async()=>{
 const f=await stored();const partial=await f.store.resolveComparison({...input(f.ref.resultRef),selection:{offset:0,limit:2}});assert.equal(partial.available,false);assert.equal(partial.code,'OPERAND_NOT_SELECTED');assert.equal(partial.coverage.complete,true);assert.equal(partial.coverage.storedTableComplete,false);assert.equal(partial.inputs,undefined);
 const full=await f.store.resolveComparison(input(f.ref.resultRef));assert.equal(full.available,true);assert.deepEqual(full.inputs,{baseline:100,current:250,baselineUnit:'amount',currentUnit:'amount'});assert.equal(full.binding.current.rowIndex,2);
});
test('RC bound Host calculation resolves original operands and persists exact binding',async()=>{
 const f=await hostFixture();const outcome=await f.host.execute({id:'calc',name:'calculate_change',arguments:input(f.ref)});assert.equal(outcome.status,'succeeded');assert.equal(outcome.value.difference,150);assert.equal(outcome.value.ratio,2.5);assert.equal(outcome.value.binding.sourceRef,f.ref);assert.equal(outcome.value.binding.currency,'USD');assert.equal(outcome.value.binding.dataAsOf,'2026-10-01');
 const reopened=await createResultStore({directory:f.dir});const persisted=await reopened.readCalculation(outcome.value.resultRef);const{resultRef,...value}=outcome.value;assert.deepEqual(persisted,value);
 const forged=await f.host.execute({id:'override',name:'calculate_change',arguments:{...input(f.ref),baseline:1,current:2}});assert.equal(forged.dispatched,false);assert.equal(forged.status,'rejected');
});
test('RC same unit does not hide currency or data-cutoff mismatch',async()=>{
 for(const [field,value,code] of [['currency','EUR','CURRENCY_MISMATCH'],['dataAsOf','2026-10-02','CUTOFF_MISMATCH'],['currency',null,'COMPARISON_METADATA_UNKNOWN']]){const data=rows();data[2][field]=value;const f=await stored(data);const valueResult=await f.store.resolveComparison(input(f.ref.resultRef));assert.equal(valueResult.available,false);assert.equal(valueResult.code,code);assert.equal(valueResult.inputs,undefined);}
});
test('RC unknown and zero denominators stay unavailable rather than becoming numeric success',async()=>{
 for(const [baseline,code] of [[null,'OPERAND_UNKNOWN'],[0,'ZERO_DENOMINATOR']]){const data=rows();data[0].value=baseline;const f=await hostFixture(data);const outcome=await f.host.execute({id:'calc',name:'calculate_change',arguments:input(f.ref)});assert.equal(outcome.status,'succeeded');assert.equal(outcome.value.available,false);assert.equal(outcome.value.code,code);assert.equal(outcome.value.resultRef,undefined);assert.equal(outcome.value.ratio,undefined);const store=await createResultStore({directory:f.dir});assert.equal((await store.listCalculations()).length,0);}
});
test('RC unacquired or out-of-scope source cannot obtain comparison bytes',async()=>{
 const f=await stored();const foreign=await createResultStore({directory:await directory()});assert.equal((await foreign.resolveComparison(input(f.ref.resultRef))).available,false);
 const scoped=await createResultStore({directory:f.dir,allowedDocuments:['another-document']});const denied=await scoped.resolveComparison(input(f.ref.resultRef));assert.equal(denied.available,false);assert.equal(denied.code,'SOURCE_UNAVAILABLE');assert.equal(denied.rows,undefined);assert.equal(denied.inputs,undefined);
});
test('RC bound result cannot be relabeled with a different source or selected value',async()=>{
 const f=await hostFixture();const outcome=await f.host.execute({id:'calc',name:'calculate_change',arguments:input(f.ref)});assert.equal(outcome.status,'succeeded');const store=await createResultStore({directory:f.dir});const{resultRef,...value}=outcome.value;
 await assert.rejects(store.addCalculation({...value,binding:{...value.binding,sourceRef:'result:sha256:'+'a'.repeat(64)}}));
 await assert.rejects(store.addCalculation({...value,inputs:{...value.inputs,baseline:50},difference:200,ratio:5,increaseRatio:4}));
 assert.deepEqual(await store.readCalculation(resultRef),value);
});
test('RC original explicit arithmetic remains unbound and does not invent provenance',async()=>{
 const host=await createToolHost({directory:await directory()});const result=await host.execute({id:'plain',name:'calculate_change',arguments:{baseline:100,current:250,baselineUnit:'amount',currentUnit:'amount'}});assert.equal(result.status,'succeeded');assert.equal(result.value.difference,150);assert.equal(result.value.binding,undefined);
});

test('RC corrupt original bytes remain an integrity failure, not ordinary optional absence',async()=>{
 const f=await stored();const path=join(f.dir,f.ref.recordPath);const original=await readFile(path);await writeFile(path,Buffer.concat([original,Buffer.from(' ')]));
 await assert.rejects(f.store.readSelection(f.ref.resultRef,{offset:0,limit:3}),/Corrupt record snapshot hash/);
 await assert.rejects(f.store.resolveComparison(input(f.ref.resultRef)),/Corrupt record snapshot hash/);
});
test('RC invalid or oversized tables and selections never gain numeric qualification',async()=>{
 for(const mutate of [data=>{data[2].id=data[0].id;},data=>{data[2].dataAsOf='2026-02-30';},data=>{data.push(...Array.from({length:30},(_,i)=>({...data[0],id:'extra'+i})));}]){
  const data=rows();mutate(data);const f=await stored(data);assert.equal((await f.store.resolveComparison(input(f.ref.resultRef))).code,'UNSUPPORTED_COMPARISON_SOURCE');
 }
 const f=await stored();for(const selection of [{offset:-1,limit:3},{offset:0,limit:33},{offset:0,limit:3,preview:true}])assert.equal((await f.store.readSelection(f.ref.resultRef,selection)).code,'INVALID_SELECTION');
 const end=await f.store.readSelection(f.ref.resultRef,{offset:2,limit:32});assert.deepEqual(end.coverage,{offset:2,requested:32,total:3,returned:1,rowIndices:[2],complete:true,storedTableComplete:false});
});
test('RC equal values in distinct originals do not merge source or derived identities',async()=>{
 const dir=await directory();const store=await createResultStore({directory:dir});const a=await store.add(source(rows(),'first'));const b=await store.add(source(rows(),'second'));assert.notEqual(a.resultRef,b.resultRef);assert.equal(a.sha256,b.sha256);
 const av=await store.resolveComparison(input(a.resultRef)),bv=await store.resolveComparison(input(b.resultRef));assert.deepEqual(av.inputs,bv.inputs);assert.notEqual(av.binding.sourceRef,bv.binding.sourceRef);
 const ac=await store.addCalculation(calculateChange(av.inputs,av.binding)),bc=await store.addCalculation(calculateChange(bv.inputs,bv.binding));assert.notEqual(ac.resultRef,bc.resultRef);
});
