export const AUTO_RESEARCH_INTENT='auto-intent@1';
export const DEEP_RESEARCH_CONTRACT='deep-evidence@1';
export const STANDARD_RESEARCH_CONTRACT='standard-research@1';
export const RESEARCH_INTENT_TOOL='select_research_intent';
export function researchProfileFor(mode){
 return mode==='deep'?DEEP_RESEARCH_CONTRACT:mode==='auto'?AUTO_RESEARCH_INTENT:mode==='standard'?STANDARD_RESEARCH_CONTRACT:undefined;
}
const EVIDENCE_NAMES=new Set(['read_page','read_pdf_page','public_web_read','wind_fund_daily_close']);
export const hasResearchEvidence=tools=>tools.some(tool=>EVIDENCE_NAMES.has(typeof tool==='string'?tool:tool?.name));
export const validResearchProfile=profile=>profile===AUTO_RESEARCH_INTENT||profile===DEEP_RESEARCH_CONTRACT||profile===STANDARD_RESEARCH_CONTRACT;
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
