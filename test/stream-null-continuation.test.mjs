import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {createChatGateway,projectProviderProtocolDiagnostic} from '../src/gateway.mjs';
import {run} from '../src/runtime.mjs';
import {readChatStream} from '../src/stream.mjs';
const grant={providerApproved:true,syntheticDataApproved:true,costApproved:true};
const event=x=>'data: '+JSON.stringify(x)+'\n\n';
function fixture(nullable){let requests=0;const diagnostics=[];const raw=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'synthetic',apiKey:'synthetic-not-a-key',authorization:grant,stream:true,fetchImpl:async(_url,options)=>{
 const body=JSON.parse(options.body);requests++;let call;
 if(requests===1)call={id:'read-one',name:'read_page',arguments:{documentId:'atlas-a',page:1}};
 if(requests===2){const v=body.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value).find(v=>v?.sourceId);assert.ok(v);call={id:'save-one',name:'save_report',arguments:{text:'# Synthetic report\n\nOriginal acquired source.',sourceIds:[v.sourceId]}};}
 let frames;if(call){const args=JSON.stringify(call.arguments),cut=Math.floor(args.length/2);frames=[{choices:[{index:0,delta:{role:'assistant',tool_calls:[{index:0,id:call.id,type:'function',function:{name:call.name,arguments:args.slice(0,cut)}}]},finish_reason:null}]},{choices:[{index:0,delta:{tool_calls:[{index:0,...(nullable?{id:null}:{}),function:{arguments:args.slice(cut)}}]},finish_reason:'tool_calls'}]}];}
 else frames=[{choices:[{index:0,delta:{role:'assistant',content:'Report saved.'},finish_reason:'stop'}]}];
 return new Response(frames.map(event).join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 }});return{gateway:{...raw,async next(input){try{return await raw.next(input);}catch(error){const d=projectProviderProtocolDiagnostic(error);if(d)diagnostics.push(d);throw error;}}},requests:()=>requests,diagnostics};}
test('same-index null continuation preserves established identity through original Runtime report',async t=>{
 const outputRoot=await mkdtemp(join(import.meta.dirname,'owned-null-red-'));t.after(()=>rm(outputRoot,{recursive:true,force:true}));
 const execute=async nullable=>{const f=fixture(nullable),result=await run({question:'Read atlas-a page1 and save a synthetic report.',gateway:f.gateway,outputRoot,allowedTools:['read_page','save_report'],allowedDocuments:['atlas-a'],requireReport:true,limits:{maxRounds:3,maxTools:2,timeoutMs:2000}});return{...f,result};};
 const baseline=await execute(false);assert.equal(baseline.result.status,'completed');assert.equal(baseline.result.toolsDispatched,2);assert.equal(baseline.requests(),3);assert.equal((await readFile(join(baseline.result.directory,'report.md'),'utf8')).startsWith('# Synthetic report'),true);
 const actual=await execute(true);assert.equal(actual.result.status,'completed','NULL_CONTINUATION_MUST_NOT_REJECT_ESTABLISHED_ID');assert.equal(actual.result.toolsDispatched,2);assert.equal(actual.requests(),3);assert.deepEqual(actual.diagnostics,[]);assert.equal(actual.result.receipt.sha256,baseline.result.receipt.sha256);
});

const first=(index,id)=>({index,id,type:'function',function:{name:'read_page',arguments:'{"documentId":"atlas-a","page":'}});
const end=(index,id)=>({index,...(id===undefined?{}:{id}),function:{arguments:'1}'}});
const wire=(parts)=>parts.map((p,i)=>'data: '+JSON.stringify({choices:[{index:0,delta:{tool_calls:p},finish_reason:i===parts.length-1?'tool_calls':null}]})+'\n\n').join('')+'data: [DONE]\n\n';
const raw=parts=>readChatStream(new Response(wire(parts)).body);
const via=parts=>createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'synthetic',apiKey:'synthetic-only',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},stream:true,fetchImpl:async()=>new Response(wire(parts),{headers:{'content-type':'text/event-stream'}})}).next({messages:[{role:'user',content:'Synthetic.'}],tools:[]});
test('null no-update preserves separate established indices and repeated null exactly as omitted',async()=>{
 const start=[first(0,'one'),first(1,'two')],omitted=[[...start],[end(0,undefined),end(1,undefined)]],nullable=[[...start],[{index:0,id:null},{index:1,id:null}],[end(0,null),end(1,null)]];
 assert.deepEqual(await raw(nullable),await raw(omitted));assert.deepEqual((await via(nullable)).calls.map(c=>c.id),['one','two']);
 // Empty first-ID replacement by a valid ID is a pre-existing accepted path, not newly forbidden.
 const a=await raw([[first(0,'')],[end(0,'fixed')]]);assert.equal(a.calls[0].id,'fixed');
});
test('null never creates or clears identity and cannot bypass final arguments or duplicate-ID validation',async()=>{
 for(const parts of [[[first(0,null)]],[[first(0,'')],[end(0,null)]],[[first(0,'one')],[end(1,null)]],[[first(0,'one')],[end(0,'')]]])await assert.rejects(via(parts),e=>projectProviderProtocolDiagnostic(e)?.reason==='TOOL_FRAGMENT_ID');
 await assert.rejects(via([[first(0,'one')],[{index:0,id:null,function:{arguments:'not-json'}}]]),e=>projectProviderProtocolDiagnostic(e)?.reason==='ARGUMENTS_JSON');
 await assert.rejects(via([[first(0,'same'),first(1,'same')],[end(0,null),end(1,null)]]),e=>projectProviderProtocolDiagnostic(e)?.reason==='CALL_IDENTITY_OR_ARGUMENTS_TYPE');
});
