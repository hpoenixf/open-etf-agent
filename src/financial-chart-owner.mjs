import { createHash } from 'node:crypto';
import { CHART_TOOL_NAME, createFinancialChartSkill, projectFinancialChart, sealFinancialChartEvidence } from './financial-chart.mjs';

import {agentChartChoice,readAgentChartViews} from './financial-chart-agent.mjs';
import {inputChartChoice,suppliedChartDatasets} from './financial-chart-input.mjs';

export const OWNER_CHART_SKILL='financial-chart@1';
export const OWNER_CHART_AUTO='financial-chart-auto@1';
export const ownerChartChoice=value=>agentChartChoice(value)||value===OWNER_CHART_SKILL||value===OWNER_CHART_AUTO||inputChartChoice(value);
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
const suppliedSelections=ds=>ds.map(d=>({kind:d.kind,receiptIds:d.receipts.map(x=>x.receiptId)}));
const suppliedResult=selections=>selections.length===1?selections[0]:{datasets:selections};
export function openSuppliedChartTools({runId,readRun,operatorText}){
 const datasets=suppliedChartDatasets(operatorText,runId);
 if(!datasets.length)fail('CHART_INPUT_INVALID');
 const selections=suppliedSelections(datasets), readerResult=suppliedResult(selections);
 const receipts=datasets.flatMap(d=>d.receipts);
 const readCommittedEvidence=({runId:id,receiptId},run=readRun())=>{
  if(id!==runId||run?.runId!==runId||!committed(run,'read_supplied_chart_data').some(c=>digest(c.value)===digest(readerResult)))return null;
  return receipts.find(x=>x.receiptId===receiptId)??null;
 };
 const chart=createFinancialChartSkill({runId,readCommittedEvidence});
 return [{
  name:'read_supplied_chart_data',
  description:'Resolve the explicitly supplied chart evidence for this turn. For multiple datasets, each entry is a separate chart selection. Does not read outside this Run.',
  parameters:{type:'object',additionalProperties:false,properties:{}},
  validate(args){if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)fail('CHART_REQUEST_INVALID');},
  async execute(){return structuredClone(readerResult);},
  async verifyResult(result){if(digest(result)!==digest(readerResult))fail('CHART_RESULT_CHANGED');},
 },{
  ...chart,
  description:'Compile one operator-provided dataset. Pass the exact kind and ordered receiptIds from one selection returned by read_supplied_chart_data.',
  parameters:{...chart.parameters,properties:{...chart.parameters.properties,kind:{type:'string',enum:selections.map(s=>s.kind)}}},
  validate(selection){
   chart.validate(selection);
   const selected=digest(selection);
   if(!selections.some(s=>digest(s)===selected)||!readCommittedEvidence({runId,receiptId:selection.receiptIds[0]}))fail('CHART_UNVERIFIED_SOURCE');
   if(committed(readRun(),CHART_TOOL_NAME).some(c=>digest(c.arguments)===selected))fail('CHART_ALREADY_BUILT');
  },
  async verifyResult(value,{call}){
   if(digest(value)!==digest(await chart.execute(call.arguments)))fail('CHART_RESULT_CHANGED');
  },
 }];
}
export async function readOwnerChartViews(run,{operatorText,chartSkill}={}){
 if(run?.status!=='completed'||run.rootStatus!=='completed'||run.snapshot.gatewayOutcome==='unknown'||run.snapshot.inFlight||
    run.snapshot.unknownEffects?.length||run.snapshot.partialEffects?.length)return [];
 if(agentChartChoice(chartSkill)){
  const agent=await readAgentChartViews(run);
  let wind=[];try{wind=await readOwnerChartViews(run,{operatorText,chartSkill:OWNER_CHART_AUTO});}catch{/* Separately verified view. */}
  return [...agent,...wind];
 }
 const supplied=inputChartChoice(chartSkill);
 const datasets=supplied?suppliedChartDatasets(operatorText,run.runId):[];
 const selections=suppliedSelections(datasets), readerResult=suppliedResult(selections);
 const accepted=committed(run,CHART_TOOL_NAME);
 if(!supplied&&accepted.length!==1)return [];
 const views=[],seen=new Set();
 const {messages}=run.snapshot;
 for(const chart of accepted){
  const selection=supplied?selections.find(s=>digest(s)===digest(chart.arguments)):null;
  if(supplied&&(!selection||seen.has(selection.kind)))continue;
  // A prior, accepted current-Run read must precede each accepted chart call.
  const at=messages.findIndex(m=>m.role==='tool'&&m.callId===chart.callId);
  if(at<0)continue;
  const prefix={...run,snapshot:{...run.snapshot,messages:messages.slice(0,at)}};
  const source=selection&&committed(prefix,'read_supplied_chart_data').some(c=>digest(c.value)===digest(readerResult))
   ?datasets.find(d=>d.kind===selection.kind):null;
  if(supplied&&!source)continue;
  try{
   views.push(await projectFinancialChart({runId:run.runId,callId:chart.callId,
    readCommittedChartResult:()=>chart,readCommittedEvidence:({runId,receiptId})=>runId!==prefix.runId?null:supplied?source.receipts.find(x=>x.receiptId===receiptId)??null:readWindEvidence(prefix,receiptId)}));
   if(selection)seen.add(selection.kind);
  }catch(error){if(!supplied)throw error;}
 }
 return views;
}
