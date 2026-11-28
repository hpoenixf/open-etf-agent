import {CHAT_REQUEST_MAX_BYTES, DEFAULT_PROVIDER_RESPONSE_BYTES, normalizeChatCompletion, isProviderIdleTransport, runProviderIdleTransport} from './gateway.mjs';

export const OPENAI_RESPONSES_MODEL='gpt-6.1-terra';
export const OPENAI_RESPONSES_ENDPOINT='https://api.openai.com/v1/responses';
const TEXT_LIMIT=262144;
const KEY_NAME='ETF_OPENAI_API_KEY';
const callId=v=>typeof v==='string'&&/^call_[a-zA-Z0-9_-]{1,128}$/.test(v);
const opaqueId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(v);
const bounded=(v,max)=>typeof v==='string'&&Buffer.byteLength(v)<=max;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const closed=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nativeGateways=new WeakSet();
export const isOpenAIResponsesGateway=gateway=>nativeGateways.has(gateway);

export function openAIResponsesCredential(env){
  const key=Object.hasOwn(env,KEY_NAME)?env[KEY_NAME]:null;
  if(typeof key!=='string'||!key.trim()||key!==key.trim()||/[\r\n]/.test(key))fail('OPENAI_RESPONSES_KEY_MISSING');
  return key;
}

// Native Responses output stays separate from the model-readable transcript.
// The opaque reasoning fragments belong only to same-route tool continuation;
// they must never be logged, published or transferred to another provider.
export function validateOpenAIReasoning(items) {
  if(!Array.isArray(items)||items.length>16||items.some(i=>!closed(i)||Object.keys(i).sort().join(',')!=='encrypted_content,id,summary,type'||
      i.type!=='reasoning'||!opaqueId(i.id)||!Array.isArray(i.summary)||i.summary.length!==0||
      !bounded(i.encrypted_content,TEXT_LIMIT)||!i.encrypted_content||!/^[a-zA-Z0-9_=+/-]+$/.test(i.encrypted_content))||
      Buffer.byteLength(JSON.stringify(items))>TEXT_LIMIT||new Set(items.map(i=>i.id)).size!==items.length)fail('OPENAI_RESPONSES_REASONING_INVALID');
}

function encode({messages,tools,reasoningByCall={},finalOnly=false},maxOutputTokens){
  const input=[];
  const seenCalls=new Set(), seenOutputs=new Set();let pending=null;
  for(const m of messages){
    if(m.role==='assistant'&&m.calls){
      if(pending?.size)fail('OPENAI_RESPONSES_INPUT_INVALID');
      if(!Array.isArray(m.calls)||!m.calls.length)fail('OPENAI_RESPONSES_INPUT_INVALID');
      pending=new Set();
      const items=m.openAIReasoning??reasoningByCall[m.calls[0]?.id];
      if(items!==undefined){validateOpenAIReasoning(items);input.push(...items);}
      for(const c of m.calls){
        if(!opaqueId(c.id)||seenCalls.has(c.id)||typeof c.name!=='string'||!closed(c.arguments))fail('OPENAI_RESPONSES_INPUT_INVALID');
        seenCalls.add(c.id);pending.add(c.id);
        input.push({type:'function_call',call_id:c.id,name:c.name,arguments:JSON.stringify(c.arguments)});
      }
    }else if(m.role==='tool'){
      if(!pending?.has(m.callId)||seenOutputs.has(m.callId)||!closed(m.result))fail('OPENAI_RESPONSES_INPUT_INVALID');
      seenOutputs.add(m.callId);pending.delete(m.callId);
      input.push({type:'function_call_output',call_id:m.callId,output:JSON.stringify(m.result)});
    }else if(['user','system','assistant'].includes(m.role)&&typeof m.content==='string'){
      if(pending?.size)fail('OPENAI_RESPONSES_INPUT_INVALID');
      input.push({role:m.role,content:m.content});
    }else fail('OPENAI_RESPONSES_INPUT_INVALID');
  }
  if(pending?.size)fail('OPENAI_RESPONSES_INPUT_INVALID');
  return JSON.stringify({model:OPENAI_RESPONSES_MODEL,store:false,stream:false,include:['reasoning.encrypted_content'],
    max_output_tokens:maxOutputTokens,input,...(finalOnly?{tool_choice:'none'}:{}),tools:(finalOnly?[]:tools).map(({name,description,parameters})=>({type:'function',name,description,parameters,strict:false}))});
}

function project(reply,key){
  if(reply?.object!=='response'||reply.model!==OPENAI_RESPONSES_MODEL||reply.status!=='completed'||reply.error!=null||reply.incomplete_details!=null||
     !Array.isArray(reply.output)||!reply.output.length||reply.output.length>32)fail('OPENAI_RESPONSES_OUTPUT_INVALID');
  const calls=[],texts=[],reasoning=[];
  for(const i of reply.output){
    if(i.type==='reasoning'){
      if(calls.length)fail('OPENAI_RESPONSES_REASONING_ORDER');
      reasoning.push({type:'reasoning',id:i.id,summary:[],encrypted_content:i.encrypted_content});
    }else if(i.type==='function_call'){
      if(i.status!=='completed'||!callId(i.call_id))fail('OPENAI_RESPONSES_OUTPUT_INVALID');
      calls.push({id:i.call_id,type:'function',function:{name:i.name,arguments:i.arguments}});
    }else if(i.type==='message'&&i.role==='assistant'&&i.status==='completed'&&Array.isArray(i.content)&&i.content.length){
      for(const c of i.content){if(c?.type!=='output_text'||!bounded(c.text,TEXT_LIMIT))fail('OPENAI_RESPONSES_OUTPUT_INVALID');texts.push(c.text);}
    }else fail('OPENAI_RESPONSES_OUTPUT_INVALID');
  }
  if(calls.length&&texts.some(x=>x.trim())||!calls.length&&!texts.join('').trim())fail('OPENAI_RESPONSES_MIXED_OR_EMPTY');
  if(calls.length)validateOpenAIReasoning(reasoning);
  const scalar=(v)=>Number.isSafeInteger(v)&&v>=0?v:null;
  const usage=reply.usage?{prompt_tokens:scalar(reply.usage.input_tokens),completion_tokens:scalar(reply.usage.output_tokens),total_tokens:scalar(reply.usage.total_tokens)}:null;
  const proposal=normalizeChatCompletion({choices:[{finish_reason:calls.length?'tool_calls':'stop',
    message:{role:'assistant',content:texts.join(''),...(calls.length?{tool_calls:calls}:{})}}],usage});
  if(JSON.stringify({proposal,reasoning}).includes(key))fail('OPENAI_RESPONSES_CREDENTIAL_ECHO');
  if(calls.length&&reasoning.length)proposal.openAIReasoning=reasoning;
  return proposal;
}

export function createOpenAIResponsesGateway({apiKey, authorization, maxOutputTokens, maxInputBytes=CHAT_REQUEST_MAX_BYTES, ownerIdleTimeout=false, fetchImpl=globalThis.fetch, observeTransport}={}){
  if(authorization?.providerApproved!==true||!(authorization?.syntheticDataApproved===true||authorization?.dataApproved===true)||authorization?.costApproved!==true)
    fail('OPENAI_RESPONSES_BLOCKED');
  if(typeof apiKey!=='string'||!apiKey||/[\r\n]/.test(apiKey)||!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<256||maxOutputTokens>32768||
     !Number.isSafeInteger(maxInputBytes)||maxInputBytes<1||maxInputBytes>CHAT_REQUEST_MAX_BYTES)fail('OPENAI_RESPONSES_CONFIG_INVALID');
  const gateway={
    mode:'live',
    inputBudget:Object.freeze({maxBytes:maxInputBytes,measure:input=>Buffer.byteLength(encode(input,maxOutputTokens))}),
    async next({messages,tools,signal:callerSignal,reservation,reasoningByCall,finalOnly}){
      const at=Date.now();let response;
      try{return await runProviderIdleTransport(async(signal,progress)=>{
        signal?.throwIfAborted();
        const body=encode({messages,tools,reasoningByCall,finalOnly},maxOutputTokens);
        if(body.includes(apiKey))fail('OPENAI_RESPONSES_CREDENTIAL_ECHO');
        if(Buffer.byteLength(body)>maxInputBytes)fail('PROVIDER_INPUT_BYTE_LIMIT');
        response=await fetchImpl(new URL(OPENAI_RESPONSES_ENDPOINT),{method:'POST',redirect:'error',signal,headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body},reservation);
        signal?.throwIfAborted();progress();
        if(!response.ok)fail('OPENAI_RESPONSES_HTTP_'+response.status);
        if(!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type')??''))fail('OPENAI_RESPONSES_CONTENT_TYPE');
        const reader=response.body?.getReader();if(!reader)fail('OPENAI_RESPONSES_OUTPUT_INVALID');
        const chunks=[];let size=0;
        try{for(;;){const {done,value}=await reader.read();if(done)break;signal?.throwIfAborted();if(value.some(b=>![9,10,13,32].includes(b)))progress();if((size+=value.byteLength)>DEFAULT_PROVIDER_RESPONSE_BYTES){await reader.cancel();fail('PROVIDER_RESPONSE_TOO_LARGE');}chunks.push(value);}}finally{reader.releaseLock();}
        signal?.throwIfAborted();
        let reply;try{reply=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{fail('OPENAI_RESPONSES_OUTPUT_INVALID');}
        const proposal=project(reply,apiKey);
        try{observeTransport?.({type:'model-transport',model:OPENAI_RESPONSES_MODEL,ordinal:reservation?.modelOrdinal,at,end:Date.now(),status:'responded',usage:proposal.usage});}catch{}
        return proposal;
        },callerSignal,ownerIdleTimeout);
      }catch(error){
        if(isProviderIdleTransport(error))throw error;
        const code=typeof error?.code==='string'&&/^(OPENAI_RESPONSES_[A-Z0-9_]+|PROVIDER_(INPUT_BYTE_LIMIT|RESPONSE_TOO_LARGE|PROTOCOL_INVALID))$/.test(error.code)?error.code:'OPENAI_RESPONSES_OUTCOME_UNKNOWN';
        try{observeTransport?.({type:'model-transport',model:OPENAI_RESPONSES_MODEL,ordinal:reservation?.modelOrdinal,at,end:Date.now(),status:response?'response-error':'unknown',code});}catch{}
        fail(code);
      }
    }
  };
  nativeGateways.add(gateway);
  return Object.freeze(gateway);
}
