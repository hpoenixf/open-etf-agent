import {responseFields, responseId, responseText, responseHash, responseCanonical, validateResponseCall, responseResult} from './human-response.mjs';
export const INTERACTION_PROFILE='human-interaction@1';
export const INTERACTION_BINDING=Object.freeze({id:'ordinary-response',version:'3'});
export function hasInteractionBinding(bindings){return bindings?.adapters?.some(x=>responseCanonical(x)===responseCanonical(INTERACTION_BINDING))===true;}
const fail=()=>{throw Object.assign(new Error('INVALID_HUMAN_INTERACTION'),{code:'INVALID_HUMAN_INTERACTION'});};
export function validateInteractionConfig(config){responseFields(config,['schemaVersion','maxQuestions']);if(config.schemaVersion!==INTERACTION_PROFILE||!Number.isSafeInteger(config.maxQuestions)||config.maxQuestions<1||config.maxQuestions>8)fail();return config;}
export function validateInteractionDefinition(definition){if(!hasInteractionBinding(definition.bindings)||definition.config.ordinaryResponse!==INTERACTION_PROFILE||definition.config.taskId!=null||definition.config.documentProtection!==undefined)fail();validateInteractionConfig(definition.config.interaction);}
export function interactionResult(fact){return {...responseResult(fact),value:{...responseResult(fact).value,kind:INTERACTION_PROFILE}};}
export function interactionAdoptionHash(fact){return responseHash(responseCanonical({phase:'result-committed',proposal:{kind:'calls',calls:[fact.call]},cursor:0,result:interactionResult(fact),questionId:fact.questionId}));}
export function validateInteractionCheckpoint(state,maxQuestions=8){
 const groups=(state.messages??[]).filter(m=>m.role==='assistant'&&m.calls?.some(c=>c.name==='ask_response'));
 if(groups.length>maxQuestions+1)fail();
 for(const group of groups){if(group.calls.length!==1)fail();validateResponseCall(group.calls[0]);}
 if(state.phase==='awaiting-response'){if(state.proposal?.kind!=='calls'||state.proposal.calls.length!==1||state.cursor!==0||state.result!==null||!state.usedIds.includes(state.proposal.calls[0].id))fail();validateResponseCall(state.proposal.calls[0]);responseId(state.responseQuestion);}
}
export function validateInteractionFacts(facts,run){
 const {snapshot:s,definition}=run,max=validateInteractionConfig(definition.config.interaction).maxQuestions;
 validateInteractionCheckpoint(s,max);
 if(run.parentRunId!==null||run.runId!==run.rootId||!Array.isArray(facts)||facts.length>max)fail();
 const calls=(s.messages??[]).flatMap(m=>m.calls??[]).filter(c=>c.name==='ask_response'),known=new Map(),ids=new Set();
 let previousTime=0;
 for(let i=0;i<facts.length;i++){
  const f=facts[i];responseFields(f,['schemaVersion','ordinal','runId','rootId','questionId','call','questionHash','createdAt','deadlineAt','receipt','adoption']);
  if(f.schemaVersion!==INTERACTION_PROFILE||f.ordinal!==i+1||f.runId!==run.runId||f.rootId!==run.rootId||f.deadlineAt!==definition.deadlineAt||!Number.isSafeInteger(f.createdAt)||f.createdAt<previousTime||f.createdAt>=f.deadlineAt)fail();previousTime=f.createdAt;if(i>0&&f.createdAt<facts[i-1].adoption?.adoptedAt)fail();
  responseId(f.questionId);validateResponseCall(f.call);if(ids.has(f.questionId)||known.has(f.call.id)||f.questionHash!==responseHash(f.call.arguments.question))fail();ids.add(f.questionId);known.set(f.call.id,f);
  const found=calls.filter(c=>c.id===f.call.id);if(found.length!==1||responseCanonical(found[0])!==responseCanonical(f.call)||!s.usedIds?.includes(f.call.id)||s.toolsDispatched<facts.length)fail();
  if(f.receipt!==null){const r=f.receipt;responseFields(r,['responseId','text','responseHash','receivedAt']);responseId(r.responseId);responseText(r.text);if(r.responseHash!==responseHash(r.text)||!Number.isSafeInteger(r.receivedAt)||r.receivedAt<f.createdAt||r.receivedAt>=f.deadlineAt)fail();}
  if(f.adoption!==null){const a=f.adoption;responseFields(a,['adoptedAt','checkpointHash']);if(!f.receipt||!Number.isSafeInteger(a.adoptedAt)||a.adoptedAt<f.receipt.receivedAt||a.adoptedAt>=f.deadlineAt||a.checkpointHash!==interactionAdoptionHash(f))fail();}
  if(i<facts.length-1&&!f.adoption)fail();
  const paired=(s.messages??[]).filter(m=>m.role==='tool'&&m.callId===f.call.id),pending=s.result?.callId===f.call.id?s.result:null;
  if(f.adoption){const expected=interactionResult(f);if(paired.length>1||paired.length===1&&responseCanonical(paired[0])!==responseCanonical({role:'tool',callId:f.call.id,result:expected}))fail();if(!paired.length&&(!pending||!['result-committed','terminal'].includes(s.phase)||responseCanonical(pending)!==responseCanonical(expected)))fail();}
  else{if(paired.length||pending)fail();if(s.phase!=='terminal'&&(s.phase!=='awaiting-response'||s.cursor!==0||s.proposal?.calls?.length!==1||responseCanonical(s.proposal.calls[0])!==responseCanonical(f.call)))fail();}
 }
 if(facts.length?s.responseQuestion!==facts.at(-1).questionId:s.responseQuestion!==undefined)fail();
 const unrecorded=calls.filter(c=>!known.has(c.id));if(unrecorded.length>1)fail();
 for(const c of unrecorded){if(!['proposal-sealed','terminal'].includes(s.phase)||s.cursor!==0||s.proposal?.calls?.length!==1||responseCanonical(c)!==responseCanonical(s.proposal.calls[0])||s.usedIds.includes(c.id)||s.result!==null)fail();}
 const checkResult=r=>{if(r?.value?.kind===INTERACTION_PROFILE){const f=known.get(r.callId);if(!f?.adoption||responseCanonical(r)!==responseCanonical(interactionResult(f)))fail();}else if(r?.value?.kind==='ordinary-response@1')fail();};
 for(const m of s.messages??[])checkResult(m.result);checkResult(s.result);
 if(s.working){const expected=facts.filter(f=>f.adoption),projected=s.working.messages?.flatMap(m=>m.calls??[]).filter(c=>c.name==='ask_response')??[];if(projected.length!==expected.length||projected.some((c,i)=>responseCanonical(c)!==responseCanonical(expected[i].call)))fail();for(const f of expected){const replies=s.working.messages.filter(m=>m.role==='tool'&&m.callId===f.call.id);if(replies.length!==1||responseCanonical(replies[0])!==responseCanonical({role:'tool',callId:f.call.id,result:interactionResult(f)}))fail();}for(const m of s.working.messages??[])checkResult(m.result);}
 return facts;
}
