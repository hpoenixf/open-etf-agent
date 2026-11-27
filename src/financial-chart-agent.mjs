import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {sealDataset} from './financial-chart-input.mjs';
import {compileFinancialChart} from './financial-chart.mjs';

export const AGENT_CHART_SKILL='financial-chart-agent@1';
export const AGENT_CHART_TOOL='render_financial_chart';
export const AGENT_CHART_GUIDANCE='When the user requests a chart or it materially explains researched or computed data, call render_financial_chart before publishing. Pass the numeric dataset directly, including unit, as-of date, keys and series. This works with web, PDF, data supplied by the user, and calculations. Add exact citation references and quotes where available. Never use Mermaid or code blocks as a substitute for requested financial graphics. Do not invent missing numbers; use null and deliver the supported prose even if a chart is unavailable.';
const ha=s=>createHash('sha256').update(s).digest('hex');
const exact=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===fields;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const refPattern=/^(?:WEB:[a-f0-9]{64}:[1-9][0-9]{0,2}|PDF:web-pdf-page:sha256:[a-f0-9]{64})$/;
const clean=s=>s.normalize('NFC').replace(/\s+/gu,' ').trim();
const boundedQuote=s=>typeof s==='string'&&s.isWellFormed()&&Buffer.byteLength(s)>=4&&Buffer.byteLength(s)<=460;
const unavailable=()=>({schemaVersion:'agent-financial-chart@1',status:'unavailable',reason:'CHART_DATA_INVALID'});
const sourceKinds={
 public_web_read:['public-web-page@1','public-web-page@2'],
 public_web_continue:['public-web-page@2'],
 public_web_linked_pdf_page:['web-pdf-original-page'],
};
function originalSources(run,messages){
 const calls=new Map(),sources=new Map(),seen=new Set(),duplicates=new Set();
 for(const m of messages){
  if(m.role==='assistant')for(const c of m.calls??[]){if(calls.has(c.id))duplicates.add(c.id);else calls.set(c.id,c);}
  if(m.role!=='tool')continue;
  if(seen.has(m.callId)){duplicates.add(m.callId);continue;} seen.add(m.callId);
  const c=calls.get(m.callId),r=m.result,v=r?.value;
  if(!Object.hasOwn(sourceKinds,c?.name)||!sourceKinds[c.name].includes(v?.kind)||r.callId!==c.id||r.status!=='succeeded'||r.dispatched!==true||
   (r.effective&&!isDeepStrictEqual(r.effective,c))||typeof v.text!=='string'||!Number.isSafeInteger(v.page)||v.page<1)continue;
  const pdf=c.name==='public_web_linked_pdf_page';
  const ref=pdf?'PDF:'+v.sourceRef:'WEB:'+v.manifestSha256+':'+v.page;
  if(!refPattern.test(ref)||ha(v.text)!==(pdf?v.sha256:v.textSha256))continue;
  let url;try{url=new URL(v.url);}catch{continue;}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)continue;
  if(pdf)url.hash='page='+v.page;
  if(!sources.has(ref))sources.set(ref,{callId:c.id,ref,url:url.href,page:v.page,pdf,text:clean(v.text)});
 }
 for(const [ref,s] of sources)if(duplicates.has(s.callId))sources.delete(ref);
 return sources;
}
function containsNumeric(quote,value){
 // Match a numeric token, never a substring of a larger amount or date.
 const nums=[...quote.matchAll(/(?<![\p{L}\p{N}.,])(?:\([0-9][0-9,.]*\)|[+\-]?[0-9][0-9,.]*)(?![\p{L}\p{N}.,])/gu)];
 return nums.some(([n])=>Number(n.replaceAll(',','').replace(/^\((.*)\)$/,'-$1'))===value);
}
function provePoint(source,q,d,series,key,value){
 if(!boundedQuote(q)||typeof value!=='number'||!source)return false;
 const quote=clean(q), lower=quote.toLowerCase();
 // Deliberately strict. Exact same-passage metric, period, unit and a single
 // numeric observation; more complex tables may still be shown as unverified.
 const has=s=>lower.includes(clean(s).toLowerCase());
 const tokens=quote.replace(clean(key),'').match(/(?<![\p{L}\p{N}.,])(?:\([0-9][0-9,.]*\)|[+\-]?[0-9][0-9,.]*)(?![\p{L}\p{N}.,])/gu)??[];
 return source.text.includes(quote)&&has(series)&&has(key)&&has(d.unit)&&tokens.length===1&&containsNumeric(tokens[0],value);
}
async function makeProjection(args,run,callId,messages){
 const absent=unavailable();
 if(!exact(args,'dataset')&&!exact(args,'dataset,evidence'))return absent;
 if(args.evidence!==undefined&&(!Array.isArray(args.evidence)||args.evidence.length>64))return absent;
 try{
  const sealed=sealDataset(args.dataset,run.runId,{modelCallId:callId});
  const d=args.dataset;
  const candidates=originalSources(run,messages);
  const refs=new Set(), verified=new Set();
  for(const e of args.evidence??[]){
   if(!exact(e,'key,quote,ref,series')||!refPattern.test(e.ref)||!boundedQuote(e.quote)||
      !Number.isInteger(e.key)||!Number.isInteger(e.series)||e.key<0||e.key>=d.keys.length||e.series<0||e.series>=d.series.length)continue;
   const doc=candidates.get(e.ref);
   if(doc?.text.includes(clean(e.quote))&&(refs.has(e.ref)||refs.size<7)){refs.add(e.ref);
    if(provePoint(doc,e.quote,d,d.series[e.series].label,d.keys[e.key],d.series[e.series].values[e.key]))verified.add(e.series+':'+e.key);}
  }
  const present=d.series.reduce((n,s)=>n+s.values.filter(x=>x!==null).length,0);
  const x=refs.size?sealDataset(d,run.runId,{modelCallId:callId,sourceRefs:[...refs],sourceChecked:present===verified.size}):sealed;
  const lookup=({receiptId})=>x.receipts.find(r=>r.receiptId===receiptId)??null;
  const spec=await compileFinancialChart({runId:run.runId,selection:{kind:x.kind,receiptIds:x.receipts.map(r=>r.receiptId)},readCommittedEvidence:lookup});
  const {schemaVersion,runId,sha256,...view}=spec;
  return {schemaVersion:'agent-financial-chart@1',status:'saved',view:{schemaVersion:'financial-chart-view@1',...view,integrity:sha256,
   sources:[...refs].map(ref=>{const {url,page,pdf}=candidates.get(ref);return {ref,url,page,pdf};})}};
 }catch{return absent;}
}
const shape={
 type:'object',additionalProperties:false,required:['dataset'],properties:{
  dataset:{type:'object',additionalProperties:false,required:['kind','asOf','unit','keys','series'],properties:{
   kind:{type:'string'},asOf:{type:'string',description:'YYYY-MM-DD cutoff for the data.'},unit:{type:'string',description:'Examples: CNY million, %, count.'},
   keys:{type:'array',items:{type:'string'}},series:{type:'array',items:{type:'object',additionalProperties:false,required:['label','values'],
    properties:{label:{type:'string'},values:{type:'array',items:{anyOf:[{type:'number'},{type:'null'},{type:'object',additionalProperties:false,required:['open','high','low','close'],properties:{open:{type:'number'},high:{type:'number'},low:{type:'number'},close:{type:'number'}}}]}}}}},
  }},
  evidence:{type:'array',items:{type:'object',additionalProperties:false,required:['series','key','ref','quote'],properties:{
   series:{type:'integer'},key:{type:'integer'},ref:{type:'string',description:'Exact WEB or PDF citation reference from a previously committed original read in this run, without brackets.'},quote:{type:'string',description:'Exact source passage for this point, no invented wording. Indexes are zero-based.'},
  }}},
 },
};
export function openAgentChart({readRun}){
 const project=(args,callId)=>{const r=readRun(),ms=r.snapshot.messages;
  const at=ms.findIndex(m=>m.role==='assistant'&&m.calls?.some(c=>c.id===callId));
  return makeProjection(args,r,callId,at<0?[]:ms.slice(0,at));};
 return {name:AGENT_CHART_TOOL,recoveryVersion:'owner-agent-financial-chart@1',description:AGENT_CHART_GUIDANCE,parameters:shape,
  validate(args){if(!args||Buffer.byteLength(JSON.stringify(args))>28000)fail('CHART_DATA_INVALID');},
  execute:(args,{callId})=>project(args,callId),reconcile:(args,{callId})=>project(args,callId),
  async verifyResult(value,{call}){if(!isDeepStrictEqual(value,await project(call.arguments,call.id)))fail('CHART_RESULT_CHANGED');},
 };
}
export async function readAgentChartViews(run){
 const calls=new Map(),seen=new Set(),verified=new Map(),dup=new Set(),messages=run.snapshot.messages;
 for(let i=0;i<messages.length;i++){
  const m=messages[i];
  if(m.role==='assistant')for(const c of m.calls??[]){if(calls.has(c.id))dup.add(c.id);else calls.set(c.id,{c,at:i});}
  if(m.role!=='tool')continue;
  if(seen.has(m.callId)){dup.add(m.callId);continue;}seen.add(m.callId);
  const selected=calls.get(m.callId),c=selected?.c,r=m.result;
  if(c?.name!==AGENT_CHART_TOOL||r?.callId!==c.id||r.status!=='succeeded'||r.dispatched!==true||r.value?.status!=='saved'||
   (r.effective&&!isDeepStrictEqual(r.effective,c)))continue;
  const v=await makeProjection(c.arguments,run,c.id,messages.slice(0,selected.at));
  if(v.status==='saved'&&isDeepStrictEqual(v,r.value))verified.set(c.id,v.view);
 }
 return [...verified].filter(([id])=>!dup.has(id)).map(([,v])=>v).slice(0,8);
}
