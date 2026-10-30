import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';import {resolve} from 'node:path';
import {createChatGateway,projectProviderProtocolDiagnostic} from '../src/gateway.mjs';
import {readChatStream} from '../src/stream.mjs';
import {run} from '../src/runtime.mjs';
const frame=(parts,finish_reason=null)=>({choices:[{index:0,delta:{tool_calls:parts},finish_reason}]});
const event=value=>'data: '+JSON.stringify(value)+'\n\n';const done='data: [DONE]\n\n';
const first=id=>({index:0,id,type:'function',function:{name:'read_page',arguments:'{"documentId":"atlas-a","page":1}'}});
const grant={providerApproved:true,syntheticDataApproved:true,costApproved:true};
const gateway=(body,fetchImpl)=>createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'synthetic',apiKey:'synthetic-not-a-key',authorization:grant,stream:true,fetchImpl:fetchImpl??(async()=>new Response(body,{headers:{'content-type':'text/event-stream'}}))});
const input={messages:[{role:'user',content:'Synthetic identity diagnostics.'}],tools:[]};
async function rejected(body){let error;try{await gateway(body).next(input);}catch(e){error=e;}assert.equal(error?.code,'PROVIDER_PROTOCOL_INVALID');const d=projectProviderProtocolDiagnostic(error);assert.ok(d);assert.equal(JSON.stringify(d).includes('RAW_SENTINEL'),false);assert.match(d.bodySha256,/^[a-f0-9]{64}$/);return d;}
test('valid omitted continuation and identical repeated ID preserve original exact proposals',async()=>{
 for(const continuation of [{index:0,function:{arguments:''}},{index:0,id:'RAW_SENTINEL',function:{arguments:''}}]){
  const body=event(frame([first('RAW_SENTINEL')]))+event(frame([continuation],'tool_calls'))+done;
  const actual=await readChatStream(new Response(body).body);assert.deepEqual(actual,{kind:'calls',calls:[{id:'RAW_SENTINEL',name:'read_page',arguments:{documentId:'atlas-a',page:1}}],usage:null});assert.equal(actual.calls[0].id,'RAW_SENTINEL');assert.equal(projectProviderProtocolDiagnostic(actual),null);
 }
});
test('explicit non-string IDs classify only closed kind without leaking provider values',async()=>{
 for(const [value,kind] of [[null,'null'],[true,'boolean'],[7,'number'],[['RAW_SENTINEL'],'array'],[{raw:'RAW_SENTINEL'},'object']]){
  for(const previous of [false,true]){
   if(value===null&&previous)continue; // Legal no-update is covered by the portable Runtime and multi-index positives.
   const body=(previous?event(frame([first('RAW_SENTINEL')])):'')+event(frame([{index:0,id:value}],'tool_calls'))+done;
   const d=await rejected(body);
   assert.equal(d.reason,'TOOL_FRAGMENT_ID');assert.equal(d.idFailure,'non-string');assert.equal(d.incomingIdKind,kind);assert.equal(d.previousIdPresent,previous);assert.equal(Object.hasOwn(d,'incomingEmpty'),false);
  }
 }
});
test('changed or empty-after-existing strings remain conflicts; first empty remains final normalization failure',async()=>{
 for(const value of ['OTHER_RAW_SENTINEL','']){
  const body=event(frame([first('RAW_SENTINEL')]))+event(frame([{index:0,id:value}],'tool_calls'))+done;
  const d=await rejected(body);assert.equal(d.reason,'TOOL_FRAGMENT_ID');assert.equal(d.idFailure,'conflicting-string');assert.equal(d.incomingIdKind,'string');assert.equal(d.previousIdPresent,true);assert.equal(d.incomingEmpty,value==='');
 }
 const d=await rejected(event(frame([first('')],'tool_calls'))+done);assert.equal(d.phase,'normalization');assert.equal(d.reason,'CALL_IDENTITY_OR_ARGUMENTS_TYPE');for(const key of ['idFailure','incomingIdKind','previousIdPresent','incomingEmpty'])assert.equal(Object.hasOwn(d,key),false);
});
test('foreign and forged diagnostics are untrusted; identity failure cancels without extra drain',async()=>{
 const foreign=Object.assign(new Error('RAW_SENTINEL'),{code:'PROVIDER_PROTOCOL_INVALID',idFailure:'non-string'});await assert.rejects(gateway('',async()=>{throw foreign;}).next(input),e=>e===foreign&&projectProviderProtocolDiagnostic(e)===null);
 assert.equal(projectProviderProtocolDiagnostic({reason:'TOOL_FRAGMENT_ID',idFailure:'conflicting-string'}),null);
 let pulls=0,cancels=0;const stream=new ReadableStream({pull(c){pulls++;if(pulls===1)c.enqueue(new TextEncoder().encode(event({...frame([{index:0,id:null}]),idFailure:'RAW_SENTINEL'})));},cancel(){cancels++;}},{highWaterMark:0});
 let error;try{await gateway('',async()=>new Response(stream,{headers:{'content-type':'text/event-stream'}})).next(input);}catch(e){error=e;}
 const d=projectProviderProtocolDiagnostic(error);assert.equal(d.idFailure,'non-string');assert.equal(d.incomingIdKind,'null');assert.equal(d.hashScope,'consumed-prefix');assert.equal(d.doneObserved,false);assert.equal(pulls,1);assert.equal(cancels,1);assert.equal(JSON.stringify(d).includes('RAW_SENTINEL'),false);
});
test('original Gateway-to-Runtime identity rejection yields no proposal dispatch or publication',async(t)=>{
 await mkdir('test-output',{recursive:true});const outputRoot=await mkdtemp(resolve('test-output/tool-id-diagnostic-'));t.after(()=>rm(outputRoot,{recursive:true,force:true}));let posts=0;const diagnostics=[];
 const raw=gateway('',async()=>{posts++;return new Response(event(frame([first('RAW_SENTINEL')]))+event(frame([{index:0,id:'OTHER_RAW_SENTINEL'}],'tool_calls'))+done,{headers:{'content-type':'text/event-stream'}});});
 const observed={...raw,async next(input){try{return await raw.next(input);}catch(error){const d=projectProviderProtocolDiagnostic(error);if(d)diagnostics.push(d);throw error;}}};
 const result=await run({question:'Use only synthetic read tools.',gateway:observed,outputRoot,allowedTools:['read_page'],requireReport:false,limits:{maxRounds:1,maxTools:1,timeoutMs:1000}});
 assert.equal(result.status,'failed');assert.equal(result.code,'PROVIDER_PROTOCOL_INVALID');assert.equal(result.toolsDispatched,0);assert.equal(posts,1);assert.equal(result.receipt,null);assert.equal(result.publication,undefined);assert.deepEqual(result.unknownEffects,[]);assert.deepEqual(result.partialEffects,[]);assert.equal(diagnostics.length,1);assert.equal(diagnostics[0].idFailure,'conflicting-string');assert.equal(JSON.stringify(diagnostics).includes('RAW_SENTINEL'),false);
});
