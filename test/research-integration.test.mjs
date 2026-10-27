import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { createToolHost,readFixturePage } from '../src/tools.mjs';
import { createResultStore } from '../src/results.mjs';
import { readChildSources } from '../src/child-results.mjs';
import { prepareRetrieval } from '../src/retrieval-demo.mjs';
import { createChatGateway } from '../src/gateway.mjs';
import { run } from '../src/runtime.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/research-'));}
test('4.4 ordinary Host reads and rereads the sole persistent source owner',async()=>{
  const dir=await directory();const host=await createToolHost({directory:dir});const read=await host.execute({id:'r',name:'read_page',arguments:{documentId:'atlas-a',page:1}});
  assert.match(read.value?.resultRef||'',/^result:sha256:/);const reread=await host.execute({id:'rr',name:'read_result',arguments:{resultRef:read.value.resultRef}});assert.equal(reread.status,'succeeded');assert.equal(reread.value.text,read.value.text);
  const store=await createResultStore({directory:dir});assert.equal((await store.read(read.value.resultRef)).text,read.value.text);
  const saved=await host.execute({id:'s',name:'save_report',arguments:{text:'An acquired claim [1].',sourceIds:[read.value.sourceId]}});assert.equal(saved.status,'succeeded');
  const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));assert.equal(manifest.resultRefs[0].resultRef,read.value.resultRef);assert.deepEqual(manifest.sources[0],await store.read(read.value.resultRef));
});
test('4.4 invalid numbered source or calculation references cannot be saved',async()=>{
  for(const text of ['Unknown source [9]','Unknown numeric derivation [C9]']){
    const host=await createToolHost({directory:await directory()});const read=await host.execute({id:'r',name:'read_page',arguments:{documentId:'atlas-a',page:1}});
    const result=await host.execute({id:'s',name:'save_report',arguments:{text,sourceIds:[read.value.sourceId]}});assert.equal(result.status,'rejected');assert.equal(result.dispatched,false);
  }
});
test('4.4 actual numeric derivation remains distinct from original source snapshots',async()=>{
  const dir=await directory();const host=await createToolHost({directory:dir});const page=await host.execute({id:'r',name:'read_page',arguments:{documentId:'atlas-a',page:1}});
  const calc=await host.execute({id:'c',name:'calculate_change',arguments:{baseline:120,current:300,baselineUnit:'rows',currentUnit:'rows'}});assert.match(calc.value?.resultRef||'',/^calculation:sha256:/);
  const saved=await host.execute({id:'s',name:'save_report',arguments:{text:'The increase is 180 rows [C1]. Source [1].',sourceIds:[page.value.sourceId]}});assert.equal(saved.status,'succeeded');const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
  assert.equal(manifest.sources.length,1);assert.equal(manifest.calculations[0].value.inputs.baseline,120);assert.equal(manifest.calculations[0].value.unit,'rows');assert.equal(manifest.calculations[0].value.calculation,'calculate_change@1');
});
test('4.4 Main child import rereads only granted original refs, never paths or summary text',async()=>{
  const dir=await directory();const store=await createResultStore({directory:dir});const source=await readFixturePage({documentId:'atlas-a',page:1});const ref=await store.add(source);
  const imported=await readChildSources({directory:dir,refs:[ref.resultRef],allowedDocuments:['atlas-a']});assert.deepEqual(imported,[source]);
  await assert.rejects(readChildSources({directory:dir,refs:[ref.resultRef],allowedDocuments:['atlas-b']}),/scope|allowed/i);
  await assert.rejects(readChildSources({directory:dir,refs:['../secret'],allowedDocuments:['atlas-a']}),/ref|unknown|invalid/i);
});
test('4.2 final Chat encoding includes schema/wrapper bytes before any HTTP dispatch',async()=>{
  let requests=0;const gateway=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'synthetic',apiKey:'not-a-real-key',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},maxInputBytes:1024,fetchImpl:async()=>{requests++;throw new Error('unexpected dispatch');}});
  await assert.rejects(gateway.next({messages:[{role:'user',content:'small'}],tools:[{name:'oversized',description:'x'.repeat(2000),parameters:{type:'object'}}]}),/INPUT.*LIMIT|input.*byte|encoded/i);assert.equal(requests,0);
});
test('4.3 actual Gateway proposals follow query candidates into ordinary read_page',async()=>{
  const observed=[];
  for(const query of ['Markdown','offline editing']){
    const prepared=prepareRetrieval({query});const result=await run({question:query,outputRoot:await directory(),gateway:prepared.gateway,extensions:prepared.extensions,requireReport:true});assert.equal(result.status,'completed');
    const manifest=JSON.parse(await readFile(join(result.directory,'manifest.json'),'utf8'));observed.push(manifest.sources.map(s=>[s.documentId,s.page]));
    const log=(await readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.ok(log.some(e=>e.type==='tool_result'&&e.name==='read_page'));
  }
  assert.ok(observed[0].every(([id,page])=>id==='atlas-b'&&page===1));assert.ok(observed[1].every(([,page])=>page===2));assert.notDeepEqual(observed[0],observed[1]);
});
test('4.2 Runtime projects old acquired bytes into actionable refs while retaining latest group',async()=>{
  const {sha256}=await import('../src/source.mjs');let step=0,projected;
  const extensions=[{name:'large_page',description:'Original large synthetic page fixture',parameters:{type:'object',properties:{page:{type:'integer'}},required:['page'],additionalProperties:false},sourceResult:true,validate:args=>{assert.ok([1,2].includes(args.page));},execute:async({page})=>{const text=(page===1?'x':'y').repeat(6000);return{sourceId:`large@L1:p${page}`,documentId:'large',name:'Original synthetic capacity fixture',version:'L1',page,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};}}];
  const result=await run({question:'Preserve this original question.',outputRoot:await directory(),requireReport:false,contextBytes:8192,extensions,gateway:{mode:'fixture',async next({messages,tools}){assert.ok(tools.some(t=>t.name==='read_result'));if(step<2){const page=++step;return{kind:'calls',calls:[{id:`large-${page}`,name:'large_page',arguments:{page}}]};}projected=messages;return{kind:'final',text:'capacity mechanism only'};}}});
  assert.equal(result.status,'completed');assert.equal(projected[0].content,'Preserve this original question.');const old=projected.find(m=>m.callId==='large-1').result.value;const latest=projected.find(m=>m.callId==='large-2').result.value;assert.equal(old.text,undefined);assert.equal(old.readWith.name,'read_result');assert.equal(latest.text.length,6000);
  const store=await createResultStore({directory:result.directory});assert.equal((await store.read(old.resultRef)).text,'x'.repeat(6000));
});
test('4.4 repeat source acquisitions retain each call identity while the original record stays fixed',async()=>{
  const source=await readFixturePage({documentId:'atlas-a',page:1});let protocolId=0;const dir=await directory();
  const host=await createToolHost({directory:dir,extensions:[{name:'observed_read',description:'Original synthetic adapter identity fixture',parameters:{type:'object'},sourceResult:true,validate:()=>{},execute:async(_, {callId})=>({...source,mcp:{serverName:'synthetic-adapter-fixture',protocolVersion:'2025-11-25',protocolRequestId:++protocolId,modelCallId:callId}})}]});
  const first=await host.execute({id:'first',name:'observed_read',arguments:{}});const second=await host.execute({id:'second',name:'observed_read',arguments:{}});
  assert.equal(first.value.resultRef,second.value.resultRef);assert.equal(second.value.mcp.modelCallId,'second');assert.equal(second.value.mcp.protocolRequestId,2);
  const stored=await (await createResultStore({directory:dir})).read(first.value.resultRef);assert.equal(stored.mcp.modelCallId,'first');assert.equal(stored.mcp.protocolRequestId,1);
});
