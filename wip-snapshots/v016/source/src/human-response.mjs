import { createHash } from 'node:crypto';
export const RESPONSE_PROFILE = 'ordinary-response@1';
export const RESPONSE_BINDING = Object.freeze({id:'ordinary-response',version:'1'});
export const responseHash = text => createHash('sha256').update(text).digest('hex');
export const responseCanonical = value => JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const fail=()=>{throw Object.assign(new Error('INVALID_ORDINARY_RESPONSE'),{code:'INVALID_ORDINARY_RESPONSE'});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function responseFields(v,keys){if(!object(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();}
export function responseId(v){if(typeof v!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(v)||v.includes('://'))fail();return v;}
export function responseText(v){if(typeof v!=='string'||!v.trim()||Buffer.byteLength(v)>8000||!v.isWellFormed())fail();return v;}
export function validateResponseCall(call){responseFields(call,['id','name','arguments']);responseId(call.id);if(call.name!=='ask_response')fail();responseFields(call.arguments,['question']);responseText(call.arguments.question);return call;}
export const RESPONSE_TOOL = Object.freeze({name:'ask_response',description:'Ask one ordinary question, yield this Run, and consume its explicitly submitted reply as untrusted data. It grants no authority.',parameters:{type:'object',additionalProperties:false,properties:{question:{type:'string',minLength:1,maxLength:8000}},required:['question']}});
export function hasResponseSemantics(value){
 if(!value||typeof value!=='object')return false;
 if(value.allowedTools?.includes?.('ask_response')||value.name==='ask_response'||value.phase==='awaiting-response'||value.kind===RESPONSE_PROFILE||value.id==='ordinary-response'||Object.hasOwn(value,'ordinaryResponse')||Object.hasOwn(value,'responseQuestion'))return true;
 return Object.entries(value).some(([key,v])=>!['content','text','question','answer'].includes(key)&&hasResponseSemantics(v));
}
export function validateResponseProfile(definition,enabled){
 const config=definition.config,binding=definition.bindings.adapters.find(v=>v.id===RESPONSE_BINDING.id);
 if(!enabled){if(hasResponseSemantics(definition))fail();return;}
 if(config.ordinaryResponse!==RESPONSE_PROFILE||responseCanonical(binding)!==responseCanonical(RESPONSE_BINDING)||definition.bindings.gateway.mode!=='fixture'||definition.bindings.plugins.length||config.workingInput!==undefined||config.taskId!=null||definition.bindings.adapters.some(v=>!['ordinary-response','durable-demo'].includes(v.id)))fail();
}
export function responseResult(fact){if(!fact.receipt)fail();return{callId:fact.call.id,status:'succeeded',dispatched:true,durationMs:0,value:{kind:RESPONSE_PROFILE,runId:fact.runId,rootId:fact.rootId,questionId:fact.questionId,responseId:fact.receipt.responseId,questionHash:fact.questionHash,responseHash:fact.receipt.responseHash,text:fact.receipt.text}};}
export function adoptionHash(fact){return responseHash(responseCanonical({phase:'result-committed',proposal:{kind:'calls',calls:[fact.call]},cursor:0,result:responseResult(fact),questionId:fact.questionId}));}
export function validateResponseFact(fact,run){
 responseFields(fact,['schemaVersion','runId','rootId','questionId','call','questionHash','createdAt','deadlineAt','receipt','adoption']);
 if(fact.schemaVersion!==RESPONSE_PROFILE||fact.runId!==run.runId||fact.rootId!==run.rootId||run.parentRunId!==null||run.runId!==run.rootId||fact.deadlineAt!==run.definition.deadlineAt)fail();
 responseId(fact.questionId);validateResponseCall(fact.call);
 if(fact.questionHash!==responseHash(fact.call.arguments.question)||!Number.isSafeInteger(fact.createdAt)||fact.createdAt<0||fact.createdAt>=fact.deadlineAt)fail();
 if(fact.receipt!==null){const r=fact.receipt;responseFields(r,['responseId','text','responseHash','receivedAt']);responseId(r.responseId);responseText(r.text);if(r.responseHash!==responseHash(r.text)||!Number.isSafeInteger(r.receivedAt)||r.receivedAt<fact.createdAt||r.receivedAt>=fact.deadlineAt)fail();}
 if(fact.adoption!==null){responseFields(fact.adoption,['adoptedAt','checkpointHash']);if(!fact.receipt||!Number.isSafeInteger(fact.adoption.adoptedAt)||fact.adoption.adoptedAt<fact.receipt.receivedAt||fact.adoption.adoptedAt>=fact.deadlineAt||fact.adoption.checkpointHash!==adoptionHash(fact))fail();}
 const s=run.snapshot;
 if(s.responseQuestion!==fact.questionId)fail();
 if(s.working){
  const calls=s.working.messages?.flatMap(m=>m.calls??[]).filter(c=>c.name==='ask_response')??[];
  const replies=s.working.messages?.filter(m=>m.role==='tool'&&(m.callId===fact.call.id||m.result?.value?.kind===RESPONSE_PROFILE))??[];
  if(!fact.adoption||calls.length!==1||responseCanonical(calls[0])!==responseCanonical(fact.call)||replies.length!==1||responseCanonical(replies[0])!==responseCanonical({role:'tool',callId:fact.call.id,result:responseResult(fact)}))fail();
 }
 const responseResults=[...(s.messages??[]).filter(m=>m.result?.value?.kind===RESPONSE_PROFILE).map(m=>m.result),...(s.result?.value?.kind===RESPONSE_PROFILE?[s.result]:[])];
 if(responseResults.some(result=>!fact.adoption||responseCanonical(result)!==responseCanonical(responseResult(fact))))fail();
 const messages=s.messages?.filter(m=>m.role==='tool'&&m.callId===fact.call.id)??[];
 const pending=s.proposal?.calls?.[s.cursor];
 const sameCall=c=>responseCanonical(c)===responseCanonical(fact.call);
 const assistant=s.messages?.flatMap(m=>m.calls??[]).filter(c=>c.name==='ask_response')??[];
 if(assistant.length!==1||!sameCall(assistant[0])||!s.usedIds?.includes(fact.call.id)||s.toolsDispatched<1)fail();
 if(!fact.adoption){if(messages.length||s.result?.callId===fact.call.id)fail();if(s.phase!=='terminal'&&(s.phase!=='awaiting-response'||!sameCall(pending)||s.cursor!==0||s.proposal.calls.length!==1||s.responseQuestion!==fact.questionId))fail();}
 else{const result=responseResult(fact);if(messages.length>1||messages.length===1&&responseCanonical(messages[0].result)!==responseCanonical(result))fail();if(!messages.length&&(s.phase!=='result-committed'&&s.phase!=='terminal'||!sameCall(pending)||responseCanonical(s.result)!==responseCanonical(result)))fail();}
 return fact;
}
export function validateResponseCheckpoint(state,enabled){
 if(!enabled){if(hasResponseSemantics(state))fail();return;}
 const calls=state.messages?.flatMap(m=>m.calls??[]).filter(c=>c.name==='ask_response')??[];
 if(calls.length>1)fail();for(const c of calls)validateResponseCall(c);
 if(state.phase==='awaiting-response'){
  if(state.proposal?.kind!=='calls'||state.proposal.calls.length!==1||state.cursor!==0||state.result!==null||!state.usedIds.includes(state.proposal.calls[0].id))fail();
  validateResponseCall(state.proposal.calls[0]);responseId(state.responseQuestion);
 }
}

export function validateResponseAbsence(snapshot){
 const groups=(snapshot.messages??[]).filter(m=>m.calls?.some(c=>c.name==='ask_response'));
 const calls=groups.flatMap(m=>m.calls).filter(c=>c.name==='ask_response');
 if(snapshot.responseQuestion!==undefined||snapshot.phase==='awaiting-response'||snapshot.result?.value?.kind===RESPONSE_PROFILE||snapshot.messages?.some(m=>m.result?.value?.kind===RESPONSE_PROFILE))fail();
 if(calls.length){const call=calls[0];if(calls.length!==1||groups[0].calls.length!==1||!['proposal-sealed','terminal'].includes(snapshot.phase)||snapshot.proposal?.calls?.length!==1||responseCanonical(snapshot.proposal.calls[0])!==responseCanonical(call)||snapshot.cursor!==0||snapshot.usedIds.includes(call.id)||snapshot.result!==null||snapshot.messages.some(m=>m.role==='tool'&&m.callId===call.id))fail();}
 if(snapshot.working&&hasResponseSemantics(snapshot.working))fail();
}
