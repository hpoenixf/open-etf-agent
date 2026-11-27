import {isProviderIdleTransport,runProviderIdleTransport} from './gateway.mjs';
// Isolated Gemini Developer API adapter for fresh public/synthetic, text-only work.
// The owner must approve exactly publicPrompt before constructing this Gateway.
// Do not pass a synthesized conversation, attachment, tool result, or memory.
export const GEMINI_FREE_MODEL='gemini-4-hydrogen';
export const GEMINI_FREE_MODEL_ALTERNATE='gemini-3.8-flash';
const supportedModels=new Set([GEMINI_FREE_MODEL,GEMINI_FREE_MODEL_ALTERNATE]);
const pinnedEndpoint=model=>`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
export const GEMINI_FREE_ENDPOINT=pinnedEndpoint(GEMINI_FREE_MODEL);
const MAX_INPUT=16_384,MAX_RESPONSE=262_144;
const instances=new WeakSet();
const exists=x=>typeof x==='object'&&x!==null;
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const isGeminiFreeGateway=value=>instances.has(value);

export function createGeminiFreeGateway({apiKey,publicPrompt,authorization,model=GEMINI_FREE_MODEL,maxOutputTokens=2048,ownerIdleTimeout=false,fetchImpl=globalThis.fetch,observeTransport}={}){
 if(authorization?.approvedPublicOnly!==true||authorization?.freeProjectVerified!==true)fail('GEMINI_FREE_APPROVAL_REQUIRED');
 if(typeof apiKey!=='string'||!/^(?:AIza[A-Za-z0-9_-]{20,120}|AQ\.[A-Za-z0-9_-]{26,175})$/.test(apiKey)||typeof fetchImpl!=='function'||!supportedModels.has(model)||
   !Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<256||maxOutputTokens>4096)fail('GEMINI_FREE_CONFIG_INVALID');
 if(typeof publicPrompt!=='string'||!publicPrompt.trim()||publicPrompt.includes(apiKey)||publicPrompt.includes('\0')||
    Buffer.from(publicPrompt).toString('utf8')!==publicPrompt||Buffer.byteLength(publicPrompt)>MAX_INPUT)fail('GEMINI_FREE_INPUT_INVALID');
 const body=JSON.stringify({contents:[{role:'user',parts:[{text:publicPrompt}]}],generationConfig:{maxOutputTokens,candidateCount:1}});
 let attempted=false;
 const gateway=Object.freeze({
  mode:'live',
  async next({messages,tools,signal:callerSignal,reservation}={}){
   callerSignal?.throwIfAborted();
   if(!Array.isArray(tools)||tools.length||!Array.isArray(messages)||messages.length!==1||messages[0]?.role!=='user'||
      messages[0].content!==publicPrompt||Object.keys(messages[0]).some(k=>k!=='role'&&k!=='content'))fail('GEMINI_FREE_INPUT_SCOPE');
   if(attempted)fail('GEMINI_FREE_NO_REPLAY');
   attempted=true;const at=Date.now();let response;
   function emit(fact){try{observeTransport?.({type:'model-transport',model,ordinal:reservation?.modelOrdinal,at,end:Date.now(),...fact});}catch{}}
   try{return await runProviderIdleTransport(async(signal,progress)=>{
    response=await fetchImpl(new URL(pinnedEndpoint(model)),{method:'POST',redirect:'error',signal,
      headers:{'x-goog-api-key':apiKey,'content-type':'application/json'},body},reservation);
    signal?.throwIfAborted();progress();
    if(!response.ok)fail('GEMINI_FREE_HTTP_'+response.status);
    if(!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type')??''))fail('GEMINI_FREE_CONTENT_TYPE');
    const reader=response.body?.getReader();if(!reader)fail('GEMINI_FREE_OUTPUT_INVALID');
    const chunks=[];let count=0;
    try{
     const abort=()=>{void reader.cancel().catch(()=>{});};
     signal?.addEventListener('abort',abort,{once:true});
     try{for(;;){signal?.throwIfAborted();const {done,value}=await reader.read();if(done)break;
       if(value.some(b=>![9,10,13,32].includes(b)))progress();if((count+=value.byteLength)>MAX_RESPONSE){await reader.cancel();fail('GEMINI_FREE_RESPONSE_LIMIT');}chunks.push(value);}}
     finally{signal?.removeEventListener('abort',abort);}
    }finally{reader.releaseLock();}
    signal?.throwIfAborted();
    let raw,reply;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));reply=JSON.parse(raw);}
    catch{fail('GEMINI_FREE_OUTPUT_INVALID');}
    if(raw.includes(apiKey)||!exists(reply))fail('GEMINI_FREE_OUTPUT_INVALID');
    const version=reply.modelVersion;
    // Refuse unbound or auto-upgraded aliases: stage acceptance freezes one wire model.
    if(version!==model||reply.promptFeedback?.blockReason||!Array.isArray(reply.candidates)||reply.candidates.length!==1)fail('GEMINI_FREE_OUTPUT_INVALID');
    const candidate=reply.candidates[0],parts=candidate?.content?.parts;
    if(candidate?.finishReason!=='STOP'||candidate?.content?.role!=='model'||!Array.isArray(parts)||!parts.length)fail('GEMINI_FREE_OUTPUT_INVALID');
    let text='';
    for(const p of parts){
     if(!exists(p)||Object.keys(p).some(k=>!['text','thought','thoughtSignature'].includes(k))||typeof p.text!=='string'||
      p.thought!==undefined&&typeof p.thought!=='boolean')fail('GEMINI_FREE_OUTPUT_INVALID');
     if(p.thought!==true)text+=p.text;
    }
    if(!text.trim()||text.includes(apiKey)||text.includes('\0'))fail('GEMINI_FREE_OUTPUT_INVALID');
    const u=reply.usageMetadata, nonneg=x=>Number.isSafeInteger(x)&&x>=0;
    const usage=nonneg(u?.promptTokenCount)&&nonneg(u?.candidatesTokenCount)&&nonneg(u?.thoughtsTokenCount??0)&&
       Number.isSafeInteger(u.candidatesTokenCount+(u.thoughtsTokenCount??0))
      ?{promptTokens:u.promptTokenCount,completionTokens:u.candidatesTokenCount+(u.thoughtsTokenCount??0)}:null;
    emit({status:'responded',usage});return {kind:'final',text,usage};
   },callerSignal,ownerIdleTimeout);
   }catch(error){
    if(isProviderIdleTransport(error))throw error;
    const code=typeof error?.code==='string'&&/^GEMINI_FREE_(?:HTTP_[1-5]\d\d|OUTPUT_INVALID|CONTENT_TYPE|RESPONSE_LIMIT)$/.test(error.code)
     ? error.code:'GEMINI_FREE_OUTCOME_UNKNOWN';
    emit({status:response?'response-error':'unknown',code});fail(code);
   }
  }
 });
 instances.add(gateway);return gateway;
}
