export const ORIGINAL_READ_CORRECTION = 'builtin-original-read-validation@1';

export function matchesOriginalReadCorrection(proposal,resultRef) {
 const call=proposal?.kind==='calls'&&proposal.calls?.length===1?proposal.calls[0]:null;
 return typeof resultRef==='string'&&call?.name==='read_result'&&call.arguments?.resultRef===resultRef&&
   Object.hasOwn(call.arguments,'resultRef')&&Object.keys(call.arguments).length===1;
}

export function controlErrorCode(error, fallback='EXECUTION_FAILED'){try{const code=error?.code;return typeof code==='string'&&code.length>0&&code.length<=200&&!/[\u0000-\u001f\u007f]/.test(code)?code:fallback;}catch{return fallback;}}
// Runtime's decision owner. This is not an authority, budget, execution or storage
// service: only the original owners may validate facts and perform their effects.
// No caller-supplied error string is evidence of settlement or retry permission.
export function decideRunControl(fact, context = {}) {
 const stop = reason => ({action:'stop',reason});
 if(fact.kind==='failure')return stop(fact.code || 'EXECUTION_FAILED');
 if(fact.kind==='group-refusal'){if(!fact.proved)return stop('TOOL_REJECTED');return context.corrections>=1?stop('CORRECTION_LIMIT'):{action:'continue',reason:'LOCAL_GROUP_CORRECTION'};}
 if(fact.kind==='tool-result'){
  if(fact.answerProved && context.singleCall && !context.hooks && !context.partial && !context.unknown)return {action:'publish-answer',reason:'REPORT_CITATIONS_DEGRADED'};
  if(fact.succeeded)return {action:'continue',reason:'TOOL_SETTLED'};
  if(fact.correctionProved && context.singleCall && !context.hooks && !context.partial && !context.unknown){
   return context.corrections>=1?stop('CORRECTION_LIMIT'):{action:'continue',reason:'LOCAL_CORRECTION'};
  }
  // Keep a proved public read refusal in the original tool group. This is
  // neither a retry nor permission to fetch; the model may use other results
  // within its existing budget and normal Publication rules.
  if(fact.ownerWebUrlRefusalProved===true && fact.dispatched===false && !context.hooks && !context.partial && !context.unknown)
   return {action:'continue',reason:'LOCAL_WEB_URL_REFUSAL'};
  if(fact.budgetRefusalProved===true&&fact.dispatched===false&&!context.hooks&&!context.partial&&!context.unknown)
   return {action:'continue',reason:'LOCAL_RESEARCH_TOOL_LIMIT'};
  return stop(fact.dispatched?'TOOL_FAILED':'TOOL_REJECTED');
 }
 if(fact.kind==='sealed-final'){
  if(context.unknown)return stop('OUTCOME_UNKNOWN');
  if(context.reportDelivery==='artifact-required@1'&&!fact.reportPresent)return stop('REPORT_ARTIFACT_REQUIRED');
  if(context.requireReport&&!fact.reportPresent&&!fact.publicationCommitted)return stop('REPORT_REQUIRED');
  return {action:'finalize',reason:'SEALED_FINAL'};
 }
 if(fact.kind==='publication-ack-missing'){
  return fact.proof?.kind==='same-fence-initial-publication-committed'
   ?{action:'continue',reason:'PUBLICATION_COMMIT_VERIFIED'}:{action:'unconfirmed',reason:'PUBLICATION_COMMIT_UNCONFIRMED'};
 }
 if(fact.kind==='finish-ack-missing'){
  return fact.proof?.kind==='same-fence-finish-committed'&&fact.proof.status==='completed'
   ?{action:'preserve',reason:'FINISH_COMMIT_VERIFIED'}:{action:'unconfirmed',reason:'FINISH_COMMIT_UNCONFIRMED'};
 }
 if(fact.kind==='post-publication-checkpoint-deadline'){
  return fact.proof?.kind==='same-fence-publication-and-settled-effects'
   ?{action:'return-without-finish',status:'unconfirmed',reason:'POST_PUBLICATION_CHECKPOINT_TIMEOUT'}
   :{action:'legacy',reason:'POST_PUBLICATION_CHECKPOINT_UNPROVEN'};
 }
 if(fact.kind==='operator-cancel-at-model-reservation'){
  return fact.proof?.kind==='same-fence-persisted-cancellation'
   ?{action:'return-without-finish',status:'cancelled',reason:'CANCELLED'}
   :{action:'retain-reservation',status:'unconfirmed',reason:'CANCEL_COMMIT_UNCONFIRMED'};
 }
 if(fact.kind==='committed-notification')return {action:'continue',reason:'COMMIT_PRESERVED_NOTIFICATION_UNCONFIRMED'};
 if(fact.kind==='secondary-failure'){
  // An observed cleanup failure must never replace cancellation, unknown, or the
  // original failure. Required readback still gates nonpublished/Child outcomes,
  // but cannot retract a Root answer already committed by Publication.
  return context.status==='completed'&&fact.required&&!context.publicationCommitted?stop(fact.code):{action:'continue',reason:'PRIMARY_CAUSE_PRESERVED'};
 }
 throw Object.assign(new Error('INVALID_CONTROL_FACT'),{code:'INVALID_CONTROL_FACT'});
}
export function validateControlObservations(state, runId) {
 const codes={'child-cleanup':'CHILD_CLEANUP_FAILED','publication-notification':'PUBLICATION_NOTIFICATION_UNCONFIRMED','pdf-cleanup':'PDF_CLEANUP_FAILED','result-readback':'RESULT_READBACK_FAILED',log:'LOG_WRITE_FAILED','hook-release':'HOOK_RELEASE_FAILED'};
 if(state.controlObservations===undefined)return;
 if(!Array.isArray(state.controlObservations)||state.controlObservations.length>32)throw new Error('INVALID_CONTROL_OBSERVATIONS');
 for(const f of state.controlObservations)if(!f||Object.keys(f).sort().join(',')!=='code,owner,runId,status'||typeof f.runId!=='string'||!f.runId||typeof f.owner!=='string'||!Object.hasOwn(codes,f.owner)||typeof f.code!=='string'||!/^[A-Z][A-Z0-9_]{0,79}$/.test(f.code)||f.status!=='unconfirmed'||codes[f.owner]!==f.code||runId!==undefined&&f.runId!==runId)throw new Error('INVALID_CONTROL_OBSERVATIONS');
}
