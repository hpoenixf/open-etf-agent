import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpenAIResponsesGateway,openAIResponsesCredential,OPENAI_RESPONSES_MODEL,OPENAI_RESPONSES_ENDPOINT} from '../src/openai-responses-gateway.mjs';
const authorization={providerApproved:true,dataApproved:true,costApproved:true};
const apiKey='synthetic-not-a-credential';
const typed=(output,override={})=>Response.json({object:'response',model:OPENAI_RESPONSES_MODEL,status:'completed',output,...override});
const message=(text='Synthetic result.')=>({type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text}]});
const tool={name:'get_sample',description:'Synthetic.',parameters:{type:'object',properties:{name:{type:'string'}}}};
const messages=[{role:'user',content:'Synthetic question.'}];
const options={apiKey,authorization,maxOutputTokens:3072};
test('exact Responses transport, separate key, stateless reasoning and original tool-output call identity',async()=>{
 const payloads=[];const reasoning={type:'reasoning',id:'rs_secure',summary:[],encrypted_content:'XQ_-=='};
 const g=createOpenAIResponsesGateway({...options,fetchImpl:async(url,opts)=>{
   assert.equal(url.href,OPENAI_RESPONSES_ENDPOINT);assert.equal(opts.headers.authorization,'Bearer '+apiKey);assert.equal(opts.redirect,'error');
   const body=JSON.parse(opts.body);payloads.push(body);assert.equal(body.model,OPENAI_RESPONSES_MODEL);assert.equal(body.store,false);assert.equal(body.max_output_tokens,3072);assert.equal(body.previous_response_id,undefined);
   assert.deepEqual(body.tools,[{type:'function',...tool,strict:false}]);
   return payloads.length===1?typed([reasoning,{type:'function_call',status:'completed',call_id:'call_sample',name:tool.name,arguments:'{"name":"example"}'}]):typed([message()]);
 }});
 const selected=await g.next({messages,tools:[tool]});
 assert.equal(selected.kind,'calls');assert.deepEqual(selected.openAIReasoning,[reasoning]);
 const retrieved=await g.next({messages:[...messages,{role:'assistant',calls:selected.calls},{role:'tool',callId:'call_sample',result:{callId:'call_sample',status:'succeeded',value:'example'}}],
   tools:[tool],reasoningByCall:{call_sample:structuredClone(selected.openAIReasoning)}});
 assert.equal(retrieved.text,'Synthetic result.');
 assert.deepEqual(payloads[1].input.slice(1),[reasoning,{type:'function_call',call_id:'call_sample',name:tool.name,arguments:'{"name":"example"}'},
   {type:'function_call_output',call_id:'call_sample',output:'{"callId":"call_sample","status":"succeeded","value":"example"}'}]);
});
test('insufficient or externally configured identity, skipped call outputs and secret echo fail closed',async()=>{
 assert.throws(()=>openAIResponsesCredential({OPENAI_API_KEY:apiKey}),{code:'OPENAI_RESPONSES_KEY_MISSING'});
 assert.equal(openAIResponsesCredential({ETF_OPENAI_API_KEY:apiKey}),apiKey);
 assert.throws(()=>createOpenAIResponsesGateway({...options,maxOutputTokens:32769}),{code:'OPENAI_RESPONSES_CONFIG_INVALID'});
 let calls=0;const g=createOpenAIResponsesGateway({...options,fetchImpl:async()=>{calls++;return typed([message(apiKey)]);}});
 await assert.rejects(g.next({messages:[...messages,{role:'tool',callId:'call_unbound',result:{}}],tools:[]}),{code:'OPENAI_RESPONSES_INPUT_INVALID'});
 assert.equal(calls,0);
 await assert.rejects(g.next({messages,tools:[]}),{code:'OPENAI_RESPONSES_CREDENTIAL_ECHO'});
});
test('incomplete, canceled, mixed or unverifiable output cannot become a tool proposal',async()=>{
 const call={type:'function_call',status:'completed',call_id:'call_sample',name:tool.name,arguments:'{}'};
 for(const fetchImpl of [
   async()=>typed([message()],{status:'incomplete'}),
   async()=>typed([message(),call]),
   async()=>typed([{type:'reasoning',id:'rs1',summary:[]},call]),
   async()=>typed([message()],{model:'other'}),
   async()=>{throw new Error('network');}
 ]){
   const g=createOpenAIResponsesGateway({...options,fetchImpl});
   await assert.rejects(g.next({messages,tools:[tool]}),{code:/OPENAI_RESPONSES_/});
 }
});

test('native Responses watchdog preserves branded three-minute idle failure and does not resend',async t=>{
 const {isProviderIdleTransport,PROVIDER_IDLE_CODE}=await import('../src/gateway.mjs');
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,notified;
 const ready=new Promise(resolve=>{notified=resolve;});
 const g=createOpenAIResponsesGateway({...options,ownerIdleTimeout:true,fetchImpl:async(_u,{signal})=>{
   calls++;notified(signal);return new Promise(()=>{});
 }});
 const running=g.next({messages,tools:[]});
 const first=await ready;t.mock.timers.tick(179_999);assert.equal(first.aborted,false);
 const rejected=assert.rejects(running,e=>e.code===PROVIDER_IDLE_CODE&&isProviderIdleTransport(e));
 t.mock.timers.tick(1);await rejected;assert.equal(first.aborted,true);assert.equal(calls,1);
});
