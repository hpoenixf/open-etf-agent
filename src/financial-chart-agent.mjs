import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {CHART_COMPUTE_DATE_MODE,chartComputeMode} from './financial-chart-compute.mjs';
import {sealDataset} from './financial-chart-input.mjs';
import {compileFinancialChart} from './financial-chart.mjs';

export const AGENT_CHART_SKILL='financial-chart-agent@1';
export const agentChartChoice=x=>x===AGENT_CHART_SKILL||chartComputeMode(x);
export const AGENT_CHART_TOOL='render_financial_chart';
export const AGENT_CHART_GUIDANCE=readFileSync(new URL('./owner-skills/financial-chart/SKILL.md',import.meta.url),'utf8').trim();
const dateGuidance=readFileSync(new URL('./owner-skills/financial-chart/reporting-date.md',import.meta.url),'utf8').trim();
export const agentChartGuidance=mode=>mode===CHART_COMPUTE_DATE_MODE?AGENT_CHART_GUIDANCE+'\n\n'+dateGuidance:AGENT_CHART_GUIDANCE;
const renderDescription='Render one validated numeric dataset using the Financial Chart Skill. Send the dataset; attach original same-run source quotations where available. View options are not arguments.';
const ha=s=>createHash('sha256').update(s).digest('hex');
const exact=(o,fields)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===fields;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const refPattern=/^(?:WEB:[a-f0-9]{64}:[1-9][0-9]{0,2}|PDF:web-pdf-page:sha256:[a-f0-9]{64})$/;
const clean=s=>s.normalize('NFC').replace(/\s+/gu,' ').trim();
const boundedQuote=s=>typeof s==='string'&&s.isWellFormed()&&Buffer.byteLength(s)>=4&&Buffer.byteLength(s)<=460;
const names={
 'financial-columns':['bar','bar-chart','column','column-chart','柱状图','条形图'],
 'financial-trend':['line','line-chart','trend','折线图'],
 'financial-stacked':['stacked-bar','stacked-column','stacked','堆叠图','堆叠柱状图'],
 'financial-share':['pie','pie-chart','donut','doughnut','饼图','环形图'],
 'financial-heatmap':['heatmap','heat-map','热力图'],
 'financial-combo':['combo','combo-bar-line','bar-line','柱线联动图','柱线组合图'],
 'financial-multi-line':['multi-line','multiline','多折线图'],
 'financial-area':['area','area-chart','折线面积图','面积图'],
 'financial-ohlc':['ohlc','candlestick','k-line','k线图'],
};
const units={
 'CNY':['人民币元','元人民币','rmb'],
 'CNY million':['百万元人民币','人民币百万元','百万元','rmb million','rmb in millions','cny millions'],
 'CNY 100 million':['亿元人民币','人民币亿元','亿元','rmb 100 million','rmb hundred million','cny hundred million'],
 'CNY billion':['十亿元人民币','人民币十亿元','十亿元','rmb billion','rmb in billions','cny billions'],
 'USD':['美元','us$'],'USD million':['百万美元','美元百万'],'USD billion':['十亿美元','美元十亿'],
 'HKD':['港元','港币'],'HKD million':['百万港元','港元百万'],'HKD billion':['十亿港元','港元十亿'],
 'CNY/share':['元/股','人民币元/股','rmb/share'],'USD/share':['美元/股'],'HKD/share':['港元/股'],
 '%':['percent','百分比','百分数','％'],'x':['倍'],'count':['数量','个'],
};
const norm=s=>typeof s==='string'?s.normalize('NFKC').trim().toLowerCase().replace(/[_\s]+/g,' '):'';
const choose=(entries,raw)=>Object.entries(entries).find(([a,b])=>[a,...b].some(v=>norm(v)===norm(raw)))?.[0];
const hints={
 CHART_KIND_UNSUPPORTED:'Use financial-columns for bars, financial-share for pie, or choose a listed kind.',
 CHART_UNIT_UNSUPPORTED:'Use one shared unit. Do not mix money and percentages; make two separate charts.',
 CHART_DATA_INVALID:'Use one as-of date (YYYY-MM-DD), labels and matching finite arrays; use null for missing data. Pie needs percentages; date-axis charts need ISO dates.',
};
const unavailable=(reason='CHART_DATA_INVALID')=>({schemaVersion:'agent-financial-chart@1',status:'unavailable',reason,hint:hints[reason]});
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
 const unitFound=[d.unit,...(units[d.unit]??[])].some(u=>has(u))&&!Object.entries(units).some(([u,aliases])=>u!==d.unit&&[u,...aliases].some(x=>clean(x).length>clean(d.unit).length&&has(x)));
 const tokens=quote.replace(clean(key),'').match(/(?<![\p{L}\p{N}.,])(?:\([0-9][0-9,.]*\)|[+\-]?[0-9][0-9,.]*)(?![\p{L}\p{N}.,])/gu)??[];
 return source.text.includes(quote)&&has(series)&&has(key)&&unitFound&&tokens.length===1&&containsNumeric(tokens[0],value);
}
const shortMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fullMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
function observedDate(date,body){
 if(typeof body!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date??''))return false;
 const [y,m,d]=date.split('-'), day=String(Number(d)), month=String(Number(m));
 const i=Number(m)-1;
 const forms=[date,y+'年'+month+'月'+day+'日',y+'年'+m+'月'+d+'日',
  ...[shortMonths[i],fullMonths[i]].filter(Boolean).flatMap(n=>[n+' '+day+', '+y,day+' '+n+' '+y])];
 const text=clean(body).toLowerCase();
 return forms.some(f=>{const x=f.toLowerCase();let offset=text.indexOf(x);while(offset>=0){
  if(!/[0-9]/.test(text[offset-1]??'')&&!/[0-9]/.test(text[offset+x.length]??''))return true;
  offset=text.indexOf(x,offset+1);
 }return false;});
}
async function makeProjection(args,run,callId,messages,{dateSafe=false,operatorText}={}){
 const absent=unavailable();
 if(!exact(args,'dataset')&&!exact(args,'dataset,evidence'))return absent;
 if(args.evidence!==undefined&&(!Array.isArray(args.evidence)||args.evidence.length>64))return absent;
 try{
  if(!exact(args.dataset,'asOf,keys,kind,series,unit'))return absent;
  let kind=choose(names,args.dataset.kind);
  if(!kind)return unavailable('CHART_KIND_UNSUPPORTED');
  const unit=choose(units,args.dataset.unit);
  if(!unit)return unavailable('CHART_UNIT_UNSUPPORTED');
  // A common display shorthand can preserve category order without guessing
  // calendar dates for fiscal quarters. Explicit canonical time plots stay strict.
  if(kind==='financial-trend'&&norm(args.dataset.kind)!==kind&&Array.isArray(args.dataset.keys)&&
     args.dataset.keys.some(k=>typeof k==='string'&&!/^\d{4}-\d{2}-\d{2}$/.test(k)))kind='financial-columns';
  const d={...args.dataset,kind,unit};
  const candidates=originalSources(run,messages);
  const refs=new Set(), verified=new Set();
  for(const e of args.evidence??[]){
   if(typeof e==='string'){
    if(refPattern.test(e)&&candidates.has(e)&&refs.size<7)refs.add(e);
    continue;
   }
   if(!exact(e,'key,quote,ref,series')||!refPattern.test(e.ref)||!boundedQuote(e.quote)||
      !Number.isInteger(e.key)||!Number.isInteger(e.series)||e.key<0||e.key>=d.keys.length||e.series<0||e.series>=d.series.length)continue;
   const doc=candidates.get(e.ref);
   if(doc?.text.includes(clean(e.quote))&&(refs.has(e.ref)||refs.size<7)){refs.add(e.ref);
    if(provePoint(doc,e.quote,d,d.series[e.series].label,d.keys[e.key],d.series[e.series].values[e.key]))verified.add(e.series+':'+e.key);}
  }
  if(dateSafe&&d.asOf!==null&&!observedDate(d.asOf,operatorText)&&
     ![...refs].some(ref=>observedDate(d.asOf,candidates.get(ref).text)))d.asOf=null;
  const present=d.series.reduce((n,s)=>n+s.values.filter(x=>x!==null).length,0);
  const x=sealDataset(d,run.runId,{modelCallId:callId,sourceRefs:[...refs],sourceChecked:refs.size>0&&present===verified.size,allowUndatedModelCategory:dateSafe});
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
   kind:{type:'string',enum:Object.keys(names),description:'financial-columns (bar), financial-share (pie), financial-stacked, financial-trend, financial-combo, financial-multi-line, financial-area, financial-heatmap, financial-ohlc.'},asOf:{type:'string',description:'YYYY-MM-DD cutoff for the data.'},unit:{type:'string',description:'One common unit, e.g. CNY million, CNY 100 million (亿元人民币), %, count. Do not combine money and percent in the same chart.'},
   keys:{type:'array',items:{type:'string'}},series:{type:'array',items:{type:'object',additionalProperties:false,required:['label','values'],
    properties:{label:{type:'string'},values:{type:'array',items:{anyOf:[{type:'number'},{type:'null'},{type:'object',additionalProperties:false,required:['open','high','low','close'],properties:{open:{type:'number'},high:{type:'number'},low:{type:'number'},close:{type:'number'}}}]}}}}},
  }},
  evidence:{type:'array',description:'Usually an array of exact citation references from this run. Optional point-level proofs are more specific.',items:{anyOf:[{type:'string',description:'WEB:<manifestSha256>:<page> or PDF:<sourceRef>'},{type:'object',additionalProperties:false,required:['series','key','ref','quote'],properties:{
   series:{type:'integer'},key:{type:'integer'},ref:{type:'string',description:'Exact WEB or PDF citation reference from a previously committed original read in this run, without brackets.'},quote:{type:'string',description:'Exact source passage for this point, no invented wording. Indexes are zero-based.'},
  }}]}},
 },
};
const dateSafeShape=structuredClone(shape);
dateSafeShape.properties.dataset.properties.asOf={anyOf:[{type:'string'},{type:'null'}],description:'Use the exact source-backed YYYY-MM-DD cutoff. Use null when a category chart has no known cutoff. Do not guess.'};
export function openAgentChart({readRun,dateSafe=false,operatorText}){
 const project=(args,callId)=>{const r=readRun(),ms=r.snapshot.messages;
  const at=ms.findIndex(m=>m.role==='assistant'&&m.calls?.some(c=>c.id===callId));
  return makeProjection(args,r,callId,at<0?[]:ms.slice(0,at),{dateSafe,operatorText});};
 return {name:AGENT_CHART_TOOL,recoveryVersion:dateSafe?'owner-agent-financial-chart@2':'owner-agent-financial-chart@1',description:renderDescription,parameters:dateSafe?dateSafeShape:shape,
  validate(args){if(!args||Buffer.byteLength(JSON.stringify(args))>28000)fail('CHART_DATA_INVALID');},
  execute:(args,{callId})=>project(args,callId),reconcile:(args,{callId})=>project(args,callId),
  async verifyResult(value,{call}){if(!isDeepStrictEqual(value,await project(call.arguments,call.id)))fail('CHART_RESULT_CHANGED');},
 };
}
export async function readAgentChartViews(run,options){
 const calls=new Map(),seen=new Set(),verified=new Map(),dup=new Set(),messages=run.snapshot.messages;
 for(let i=0;i<messages.length;i++){
  const m=messages[i];
  if(m.role==='assistant')for(const c of m.calls??[]){if(calls.has(c.id))dup.add(c.id);else calls.set(c.id,{c,at:i});}
  if(m.role!=='tool')continue;
  if(seen.has(m.callId)){dup.add(m.callId);continue;}seen.add(m.callId);
  const selected=calls.get(m.callId),c=selected?.c,r=m.result;
  if(c?.name!==AGENT_CHART_TOOL||r?.callId!==c.id||r.status!=='succeeded'||r.dispatched!==true||r.value?.status!=='saved'||
   (r.effective&&!isDeepStrictEqual(r.effective,c)))continue;
  const v=await makeProjection(c.arguments,run,c.id,messages.slice(0,selected.at),options);
  if(v.status==='saved'&&isDeepStrictEqual(v,r.value))verified.set(c.id,v.view);
 }
 return [...verified].filter(([id])=>!dup.has(id)).map(([,v])=>v).slice(0,8);
}
