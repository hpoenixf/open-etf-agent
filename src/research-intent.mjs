export const AUTO_RESEARCH_INTENT='auto-intent@1';
export const DEEP_RESEARCH_CONTRACT='deep-evidence@1';
export const STANDARD_RESEARCH_CONTRACT='standard-research@1';
export const DEEP_EVIDENCE_REVISION='evidence-milestones@1';
export const RESEARCH_NEEDS_REVISION='research-needs@1';
const DEEP_NEEDS_PROFILE='deep-evidence@3';
const AUTO_NEEDS_PROFILE='auto-intent@3';
export const ANALYSIS_RESEARCH_REVISION='research-analysis@1';
const DEEP_ANALYSIS_PROFILE='deep-evidence@4';
const AUTO_ANALYSIS_PROFILE='auto-intent@4';
export const usesResearchAnalysis=profile=>profile===DEEP_ANALYSIS_PROFILE||profile===AUTO_ANALYSIS_PROFILE;
export const usesResearchNeeds=profile=>profile===DEEP_NEEDS_PROFILE||profile===AUTO_NEEDS_PROFILE||usesResearchAnalysis(profile);
export const isDeepResearchNeedsActive=(profile,messages)=>(profile===DEEP_NEEDS_PROFILE||profile===DEEP_ANALYSIS_PROFILE)||((profile===AUTO_NEEDS_PROFILE||profile===AUTO_ANALYSIS_PROFILE)&&readResearchIntent(messages)==='deep');
const DEEP_EVIDENCE_PROFILE='deep-evidence@2';
const AUTO_EVIDENCE_PROFILE='auto-intent@2';
export const isAutoResearchProfile=profile=>profile===AUTO_RESEARCH_INTENT||profile===AUTO_EVIDENCE_PROFILE||profile===AUTO_NEEDS_PROFILE||profile===AUTO_ANALYSIS_PROFILE;
export const usesDeepEvidenceMilestones=profile=>profile===DEEP_EVIDENCE_PROFILE||profile===AUTO_EVIDENCE_PROFILE||usesResearchNeeds(profile);
export const isDeepResearchProfile=profile=>profile===DEEP_RESEARCH_CONTRACT||profile===DEEP_EVIDENCE_PROFILE||profile===DEEP_NEEDS_PROFILE||profile===DEEP_ANALYSIS_PROFILE;
export const RESEARCH_INTENT_TOOL='select_research_intent';
export function researchProfileFor(mode,revision){
 if(revision!==undefined){
  if(revision===ANALYSIS_RESEARCH_REVISION)return mode==='deep'?DEEP_ANALYSIS_PROFILE:mode==='auto'?AUTO_ANALYSIS_PROFILE:undefined;
  if(revision===RESEARCH_NEEDS_REVISION)return mode==='deep'?DEEP_NEEDS_PROFILE:mode==='auto'?AUTO_NEEDS_PROFILE:undefined;
  if(revision!==DEEP_EVIDENCE_REVISION)return undefined;
  return mode==='deep'?DEEP_EVIDENCE_PROFILE:mode==='auto'?AUTO_EVIDENCE_PROFILE:undefined;
 }
 return mode==='deep'?DEEP_RESEARCH_CONTRACT:mode==='auto'?AUTO_RESEARCH_INTENT:mode==='standard'?STANDARD_RESEARCH_CONTRACT:undefined;
}
const EVIDENCE_NAMES=new Set(['read_page','read_pdf_page','public_web_read','wind_fund_daily_close']);
export const hasResearchEvidence=tools=>tools.some(tool=>EVIDENCE_NAMES.has(typeof tool==='string'?tool:tool?.name));
export const validResearchProfile=profile=>isAutoResearchProfile(profile)||isDeepResearchProfile(profile)||profile===STANDARD_RESEARCH_CONTRACT;
const firstCalls=messages=>messages.find(m=>m.role==='assistant')?.calls;
function selection(value){return value==='research'||value==='deep';}
// Only a matching actual first Host result, not model prose or source text, can promote.
export function readResearchIntent(messages){
 const calls=firstCalls(messages);
 if(!Array.isArray(calls)||calls.length!==1||calls[0].name!==RESEARCH_INTENT_TOOL)return 'direct';
 const {id,arguments:args}=calls[0];
 const matches=messages.filter(m=>m.role==='tool'&&m.callId===id);
 const result=matches.length===1?matches[0].result:null;
 const value=result?.value;
 return result?.status==='succeeded'&&result.callId===id&&value?.kind===AUTO_RESEARCH_INTENT&&selection(value.intent)&&value.intent===args?.intent?value.intent:'direct';
}
export function researchIntentTool(readSnapshot){
 function result(args,callId){
  const snapshot=readSnapshot();
  const first=firstCalls(snapshot?.messages??[]);
  if(first?.length!==1||first[0]?.id!==callId||first[0]?.name!==RESEARCH_INTENT_TOOL||!selection(args?.intent)||Object.keys(args).length!==1)return {kind:'research-intent-unapplied@1'};
  return {kind:AUTO_RESEARCH_INTENT,intent:args.intent};
 }
 return {
  name:RESEARCH_INTENT_TOOL,recoveryVersion:AUTO_RESEARCH_INTENT,
  description:'Optional first-round choice only for a current source lookup or a substantial multi-source synthesis. Use alone, with no other tool calls. For simple, ambiguous, or unsupported requests, skip it and continue normally. This does not change permissions or limits.',
  parameters:{type:'object',properties:{intent:{type:'string',enum:['research','deep']}},required:['intent'],additionalProperties:false},
  validate(){}, // Malformed optional semantic selection remains unapplied; normal work can continue.
  async execute(args,{callId}){return result(args,callId);},
  async reconcile(args,{callId}){return result(args,callId);},
  async verifyResult(value,{call}){
   if(JSON.stringify(value)!==JSON.stringify(result(call.arguments,call.id)))throw Object.assign(new Error('RESEARCH_INTENT_RECEIPT_CHANGED'),{code:'RESEARCH_INTENT_RECEIPT_CHANGED'});
  }
 };
}

const originalDigest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const textPresent=value=>typeof value==='string'&&value.trim().length>0;
// A bounded projection of original, paired Host outcomes, not an assessment of
// whether evidence supports the conclusion. No search snippets or prose count.
export function readDeepResearchProgress(profile,snapshot,{deliveryReadback=false}={}){
 const messages=snapshot?.messages??[];
 if(profile!==DEEP_EVIDENCE_PROFILE&&(profile!==AUTO_EVIDENCE_PROFILE||readResearchIntent(messages)!=='deep')&&!isDeepResearchNeedsActive(profile,messages))return null;
 const originals=new Set();
 let unavailable=0, attempts=0;
 for(let i=0;i<messages.length;i++){
  const group=messages[i];
  if(group.role!=='assistant'||!Array.isArray(group.calls))continue;
  for(const [offset,call] of group.calls.entries()){
   if(!['public_web_read','read_pdf_page','read_page'].includes(call.name))continue;
   const reply=messages[i+1+offset];
   if(reply?.role!=='tool'||reply.callId!==call.id||reply.result?.callId!==call.id)continue;
   const {status,dispatched,value}=reply.result;
   if(dispatched!==true||status!=='succeeded')continue;
   if(call.name==='public_web_read'){
    if(['public-web-page@1','public-web-page@2'].includes(value?.kind)&&originalDigest(value.originalSha256)&&originalDigest(value.manifestSha256)&&
      originalDigest(value.textSha256)&&textPresent(value.text)&&typeof value.url==='string'&&value.url.startsWith('https://')&&
      value.page===1&&Number.isSafeInteger(value.pages)&&value.pages>=1){
      attempts++;originals.add('web:'+JSON.stringify([value.url,value.originalSha256]));
    }else if(value?.kind==='public-web-page-unavailable@1'&&value.requestOutcome==='no-unobserved-dispatch'){
      attempts++;unavailable++;
    }
   }else if(typeof value?.sourceId==='string'&&typeof value.documentId==='string'&&
     Number.isSafeInteger(value.page)&&value.page>0&&originalDigest(value.sha256)&&textPresent(value.text)&&
     (call.name!=='read_pdf_page'||originalDigest(value.pdf?.originalSha256))){
    attempts++;originals.add('local:'+value.sourceId);
   }
  }
 }
 const phase=snapshot?.phase==='terminal'
  ? snapshot.status==='completed'&&deliveryReadback?'delivered':snapshot.status==='completed'?'delivery-unverified':'stopped'
  : originals.size?'originals-read':attempts?'sources-checked':snapshot?.rounds?'collecting':'awaiting-first-proposal';
 return {schemaVersion:DEEP_EVIDENCE_REVISION,phase,originalsRead:originals.size,settledSourceChecks:attempts,unavailableSourceChecks:unavailable};
}
export function deepResearchInstruction(observed,lastOpportunity){
 if(!observed)return null;
 const fact=observed.originalsRead
  ? 'Original sources have been acquired. Compare their dates and scope, resolve the material gaps, and distinguish evidence from inference.'
  : observed.unavailableSourceChecks
    ? 'An original-source check settled without readable content. Do not cite that source as read. Use an authorized alternative only if it helps a material gap.'
    : 'No original source is recorded yet. Check material claims against available authorized originals; do not substitute discovery snippets for originals.';
 const mixed=observed.originalsRead&&observed.unavailableSourceChecks?' Other original-source checks settled without readable material; do not cite unread sources.':'';
 return '[Deep research evidence state] '+fact+mixed+(lastOpportunity?' This is the last remaining Main round under the current counters. Synthesize the best supported final answer now and state gaps.':' Return a coherent answer when usable evidence is sufficient; do not wait to spend the balance.');
}
