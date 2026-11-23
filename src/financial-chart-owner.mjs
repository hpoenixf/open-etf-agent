import { createHash } from 'node:crypto';
import { CHART_TOOL_NAME, createFinancialChartSkill, projectFinancialChart, sealFinancialChartEvidence } from './financial-chart.mjs';

export const OWNER_CHART_SKILL='financial-chart@1';
export const OWNER_CHART_AUTO='financial-chart-auto@1';
export const ownerChartChoice=value=>value===OWNER_CHART_SKILL||value===OWNER_CHART_AUTO;
export const OWNER_CHART_AUTO_GUIDANCE='If a supported daily exchange-close chart materially assists this question, you may invoke the Financial Chart Skill. Use only the evidence receipt returned by prior Wind tool work in this Run. Do not force a chart or claim NAV or OHLC from a close-only source.';
export const OWNER_CHART_GUIDANCE='The operator selected the Financial Chart Skill for this turn. When appropriate, first acquire Wind exchange closes, then call build_financial_chart using the chartEvidenceReceiptId on the accepted result, not values in text. This adapter supports only unadjusted exchange close, not NAV or candlesticks. If no usable evidence, say so; never emit chart markup in your answer.';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(x);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');

function windEvidence(runId,toolCallId,value){
 if(!id(toolCallId)||value?.schemaVersion!=='wind-fund-daily-close@1'||value.source?.provider!=='Wind'||value.source?.priceField!=='MATCH'
  ||value.source?.period!=='1d'||value.source?.adjustment!=='unadjusted'||!Array.isArray(value.rows)
  ||!/^\d{6}\.(SH|SZ)$/.test(value.windCode)||!['request-only','response-column'].includes(value.identityConfirmation))fail('CHART_WIND_RESULT_INVALID');
 const closes=new Map(value.rows.map(v=>[v.date,v.close]));
 const from=Date.parse(value.beginDate),at=Date.parse(value.asOf),span=(at-from)/86400000+1;
 if(!Number.isSafeInteger(span)||span<1||span>31||closes.size!==value.rows.length)fail('CHART_WIND_RESULT_INVALID');
 const rows=Array.from({length:span},(_,i)=>{
  const key=new Date(from+i*86400000).toISOString().slice(0,10);
  return {key,value:closes.get(key)??null};
 });
 if(rows.filter(x=>x.value!==null).length!==value.rows.length)fail('CHART_WIND_RESULT_INVALID');
 const data={schemaVersion:'chart-typed-evidence@1',runId,toolCallId,metric:'exchange-close-line',
  unit:'exchange-price-unit',basis:'exchange-daily-close-unadjusted',dimension:'date',asOf:value.asOf,periodStart:null,
  label:value.windCode+(value.identityConfirmation==='request-only'?'（标的按请求识别）':''),provenance:'provider-reported',
  originReceiptIds:['typed-source:sha256:'+digest([runId,toolCallId,value])],rows};
 return sealFinancialChartEvidence(data);
}
export function windChartExtension(tool,runId){
 const extended={
  ...tool,
  description:tool.description+' A chartEvidenceReceiptId is available for the selected Financial Chart Skill.',
  async execute(args,context){
   const original=await tool.execute(args,context);
   return {...original,chartEvidenceReceiptId:windEvidence(runId,context.callId,original).receiptId};
  },
  async verifyResult(value,{call}){
   const {chartEvidenceReceiptId,...original}=value;
   await tool.verifyResult(original,{call});
   if(windEvidence(runId,call.id,original).receiptId!==chartEvidenceReceiptId)fail('CHART_WIND_RESULT_INVALID');
  },
 };
 return extended;
}
// Native snapshot messages are not the compacted/model working view. Pair
// each committed tool result with precisely one original call and its order.
function committed(run,name){
 if(!run||!id(run.runId)||!Array.isArray(run.snapshot?.messages))return [];
 const list=[],calls=new Map(),dups=new Set(),results=new Set();
 for(const message of run.snapshot.messages){
  if(message.role==='assistant'&&Array.isArray(message.calls)){
   for(const call of message.calls){
    if(calls.has(call.id))dups.add(call.id);
    else calls.set(call.id,call);
   }
  }else if(message.role==='tool'){
   const call=calls.get(message.callId);
   if(results.has(message.callId))dups.add(message.callId);
   results.add(message.callId);
   if(call?.name!==name||message.result?.callId!==call.id||message.result.status!=='succeeded'||message.result.dispatched!==true
     ||(message.result.effective&&digest(message.result.effective)!==digest(call)))continue;
   list.push({runId:run.runId,callId:call.id,name,status:'succeeded',dispatched:true,arguments:call.arguments,value:message.result.value});
  }
 }
 return list.filter(x=>!dups.has(x.callId));
}
function readWindEvidence(run,receiptId){
 for(const result of committed(run,'wind_fund_daily_close')){
  if(result.value?.chartEvidenceReceiptId!==receiptId)continue;
  const {chartEvidenceReceiptId,...value}=result.value;
  const receipt=windEvidence(run.runId,result.callId,value);
  if(receipt.receiptId!==chartEvidenceReceiptId)fail('CHART_WIND_RESULT_INVALID');
  return {...receipt,status:'succeeded',toolCallId:result.callId};
 }
 return null;
}
export function openOwnerChartSkill({runId,readRun}){
 const readCommittedEvidence=({runId:id,receiptId})=>{
  const run=readRun();
  return run?.runId===id?readWindEvidence(run,receiptId):null;
 };
 const chart=createFinancialChartSkill({runId,readCommittedEvidence});
 return {
  ...chart,
  description:'Use build_financial_chart explicitly for an unadjusted daily exchange close line. Input is only the chart kind and a chartEvidenceReceiptId from an earlier committed Wind tool call in this Run.',
  parameters:{...chart.parameters,properties:{...chart.parameters.properties,kind:{type:'string',enum:['exchange-close-line']},receiptIds:{...chart.parameters.properties.receiptIds,maxItems:1}}},
  validate(selection){
   chart.validate(selection);
   if(selection.kind!=='exchange-close-line'||selection.receiptIds.length!==1)fail('CHART_UNSUPPORTED_EVIDENCE');
   if(!readCommittedEvidence({runId,receiptId:selection.receiptIds[0]}))fail('CHART_UNVERIFIED_SOURCE');
   if(committed(readRun(),CHART_TOOL_NAME).length)fail('CHART_ALREADY_BUILT');
  },
  async verifyResult(value,{call}){
   const exact=await chart.execute(call.arguments);
   if(digest(exact)!==digest(value))fail('CHART_RESULT_CHANGED');
  },
 };
}
export async function readOwnerChartViews(run){
 if(run?.status!=='completed'||run.rootStatus!=='completed'||run.snapshot.gatewayOutcome==='unknown'||run.snapshot.inFlight||
    run.snapshot.unknownEffects?.length||run.snapshot.partialEffects?.length)return [];
 const accepted=committed(run,CHART_TOOL_NAME);
 if(accepted.length!==1)return [];
 const [chart]=accepted;
 // A chart can only use data preceding that chart call, not data acquired
 // afterward. The native result-consumed ordering defines this cutoff.
 const {messages}=run.snapshot;
 const at=messages.findIndex(m=>m.role==='tool'&&m.callId===chart.callId);
 if(at<0)return [];
 const prefix={...run,snapshot:{...run.snapshot,messages:messages.slice(0,at)}};
 return [await projectFinancialChart({runId:run.runId,callId:chart.callId,
  readCommittedChartResult:()=>chart,readCommittedEvidence:({runId,receiptId})=>runId===prefix.runId?readWindEvidence(prefix,receiptId):null})];
}
