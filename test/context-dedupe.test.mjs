import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256} from '../src/source.mjs';
import {projectContext} from '../src/context.mjs';
function fixture(){
 const known=new Map();
 const source=(id,n)=>{const v={sourceId:id,documentId:id,name:'Public synthetic source',version:'1',page:1,text:id.repeat(n),mediaType:'text/plain; charset=utf-8'};v.sha256=sha256(v.text);const r=Object.fromEntries(['sourceId','documentId','name','version','page','sha256','mediaType'].map(k=>[k,v[k]]));r.resultRef='result:sha256:'+sha256(JSON.stringify(r));known.set(id,r);return {...v,resultRef:r.resultRef};};
 const a=source('a',7378),b=source('b',7391),ids=['a1','b1','a2'];
 const messages=[{role:'user',content:'Read allowed sources and report with original references.'},{role:'assistant',calls:ids.map((id,i)=>({id,name:i===2?'read_result':'context_fixture_source',arguments:i===2?{resultRef:a.resultRef}:{documentId:i===0?'a':'b'}}))},...[a,b,a].map((value,i)=>({role:'tool',callId:ids[i],result:{callId:ids[i],status:'succeeded',dispatched:true,value:structuredClone(value)}}))];
 return {a,b,known,messages,lookupSource:async id=>known.get(id)};
}
const run=f=>projectContext({messages:f.messages,maxBytes:20000,lookupSource:f.lookupSource});
test('latest duplicate acquired body fits without splitting pairs',async()=>{
 const f=fixture();f.messages[2].result.value.mcp={server:'synthetic-first'};f.messages[4].result.value.mcp={server:'synthetic-last'};const before=structuredClone(f.messages);assert.equal([f.a,f.b,f.a].reduce((n,v)=>n+Buffer.byteLength(v.text),0),22147);
 const out=await run(f);assert.ok(Buffer.byteLength(JSON.stringify(out))<=20000);assert.deepEqual(f.messages,before);assert.deepEqual(out.slice(0,2),before.slice(0,2));
 assert.equal(out[2].result.value.text,undefined);assert.deepEqual(out[2].result.value.acquisition,{server:'synthetic-first'});assert.equal(out[2].result.value.resultRef,f.a.resultRef);assert.deepEqual(out[2].result.value.readWith,{name:'read_result',arguments:{resultRef:f.a.resultRef}});assert.deepEqual(out.slice(3),before.slice(3));
 assert.deepEqual({...out[2],result:{...out[2].result,value:null}},{...before[2],result:{...before[2].result,value:null}});
});
test('nested sources retain last body and each unique source',async()=>{
 const f=fixture();f.messages=[f.messages[0],{role:'assistant',calls:[f.messages[1].calls[0]]},{role:'tool',callId:'a1',result:{callId:'a1',status:'succeeded',dispatched:true,value:{sources:[f.a,f.b,f.a]}}}];const out=await run(f);assert.equal(out[2].result.value.sources[0].text,undefined);assert.deepEqual(out[2].result.value.sources.slice(1),[f.b,f.a]);
});
test('altered acquired identity never launders duplicate body',async()=>{
 for(const alter of [v=>v.text+='forged',v=>v.version='other',v=>v.resultRef='result:sha256:'+'0'.repeat(64)]){const f=fixture();alter(f.messages[2].result.value);await assert.rejects(run(f),/identity|snapshot|budget/);}
});
test('missing acquisition unique sources and oversized user remain bounded failures',async()=>{
 const f=fixture();f.known.clear();await assert.rejects(run(f),/budget/);
 const g=fixture();g.messages[0].content='q'.repeat(20001);await assert.rejects(run(g),/budget/);
 const h=fixture(),r={...h.known.get('a'),sourceId:'c',documentId:'c',resultRef:'result:sha256:'+'c'.repeat(64)};h.known.set('c',r);h.messages[4].result.value={...h.a,...r};await assert.rejects(run(h),/budget/);
});
test('failed partial unknown and memory-effect results cannot authorize deduplication',async()=>{
 for(const extra of [{status:'failed'},{status:'unknown'},{status:'rejected'},{partialPaths:['synthetic']},{error:{code:'SYNTHETIC'}},{hookErrors:['synthetic']},{partialEffects:[{kind:'synthetic'}]},{unknownEffects:[{kind:'synthetic'}]},{memoryEffect:{kind:'synthetic'}}]){const f=fixture();Object.assign(f.messages[2].result,extra);await assert.rejects(run(f),/budget/);}
});
test('invalid pairing rejects and within-budget input stays unchanged',async()=>{
 const f=fixture();[f.messages[2],f.messages[3]]=[f.messages[3],f.messages[2]];await assert.rejects(run(f),/pair/);
 const g=fixture();assert.deepEqual(await projectContext({messages:g.messages,maxBytes:30000,lookupSource:g.lookupSource}),g.messages);
});
