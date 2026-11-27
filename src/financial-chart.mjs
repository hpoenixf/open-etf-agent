import {createHash} from 'node:crypto';
import {isProxy} from 'node:util/types';

export const CHART_TOOL_NAME='build_financial_chart';
const CHART_SCHEMA='financial-chart@1';
const WIRE_SCHEMA='financial-chart-view@1';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const maxPoints=180,maxSeries=4,maxBars=24;
const string=(v,r)=>typeof v==='string'&&r.test(v);
const id=v=>string(v,/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/);
const day=v=>string(v,/^\d{4}-\d{2}-\d{2}$/)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const label=v=>typeof v==='string'&&v.trim()&&Buffer.byteLength(v)<=120&&!/[\p{C}]/u.test(v);
const safeObject=v=>v&&typeof v==='object'&&!Array.isArray(v)&&!isProxy(v)
 && [Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v,keys)=>safeObject(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')&&keys.every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));
const list=(v,max)=>Array.isArray(v)&&!isProxy(v)&&v.length>0&&v.length<=max&&
 Object.keys(v).length===v.length&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,i)).every(d=>d&&Object.hasOwn(d,'value'));
const digest=v=>string(v,/^[a-f0-9]{64}$/);
const rcp=v=>string(v,/^chart-evidence:sha256:[a-f0-9]{64}$/);
const originReceipt=v=>string(v,/^(?:result|calculation|artifact|typed-source):sha256:[a-f0-9]{64}$/);

const financialMoneyUnits=['CNY','CNY million','CNY billion','HKD','HKD million','HKD billion','USD','USD million','USD billion'];
const profiles={
 'exchange-close-line':{chart:'line',title:'场内基金未复权日收盘价',units:['exchange-price-unit'],bases:['exchange-daily-close-unadjusted'],dim:'date'},
 'nav-series':{chart:'line',title:'单位净值走势',units:['CNY/unit','USD/unit','HKD/unit'],bases:['fund-nav-per-unit'],dim:'date'},
 'return-comparison':{chart:'bar',title:'同口径收益率',units:['%'],bases:['total-return','price-return'],dim:'fund'},
 'expense-comparison':{chart:'bar',title:'同口径费率',units:['%'],bases:['annual-expense-ratio'],dim:'fund'},
 'holdings-weight':{chart:'bar',title:'已披露持仓权重',units:['%'],bases:['percent-of-fund-net-assets'],dim:'holding'},
 'holdings-pie':{chart:'pie',title:'已披露持仓占比',units:['%'],bases:['percent-of-fund-net-assets'],dim:'holding'},
 'financial-trend':{chart:'line',title:'财务指标走势',units:[...financialMoneyUnits,'%','x','count'],bases:['user-supplied'],dim:'date'},
 'financial-columns':{chart:'bar',title:'财务指标对比',units:[...financialMoneyUnits,'%','x','count'],bases:['user-supplied'],dim:'category'},
 'financial-stacked':{chart:'stacked',title:'财务指标分项贡献',units:[...financialMoneyUnits,'%','count'],bases:['user-supplied'],dim:'category'},
 'financial-share':{chart:'pie',title:'财务构成占比',units:['%'],bases:['user-supplied'],dim:'category'},
 'ohlc-candlestick':{chart:'candlestick',title:'日开盘、最高、最低、收盘',units:['CNY/share','USD/share','HKD/share'],bases:['exchange-daily-ohlc-unadjusted','exchange-daily-ohlc-adjusted'],dim:'date'},
};
function request(v){
 if(!exact(v,['kind','receiptIds'])||typeof v.kind!=='string'||!Object.hasOwn(profiles,v.kind)||!list(v.receiptIds,maxSeries)
   ||!v.receiptIds.every(rcp)||new Set(v.receiptIds).size!==v.receiptIds.length)fail('CHART_REQUEST_INVALID');
 if(!['line','stacked'].includes(profiles[v.kind].chart)&&v.kind!=='financial-columns'&&v.receiptIds.length!==1)fail('CHART_REQUEST_INVALID');
 return {kind:v.kind,receiptIds:[...v.receiptIds]};
}

function ohlc(value){
 const keys=['open','high','low','close'];
 return exact(value,keys)&&keys.every(k=>typeof value[k]==='number'&&Number.isFinite(value[k])&&value[k]>0&&value[k]<=1e9)
  &&value.low<=Math.min(value.open,value.close)&&value.high>=Math.max(value.open,value.close);
}
function range(metric,n){
 if(metric==='ohlc-candlestick') return ohlc(n);
 return typeof n==='number'&&Number.isFinite(n)&&
  (metric.startsWith('financial-')&&metric!=='financial-share'?Math.abs(n)<=1e9:['nav-series','exchange-close-line'].includes(metric)?n>0&&n<=1e9:metric==='return-comparison'?n>=-100&&n<=1e6:n>=0&&n<=100);
}

// Normalized source receipt must come from a trusted typed ToolResult reader.
// The digest binds exact normalized numeric rows, dimensions and provenance;
// this is not a signature. Untrusted model text must never reach this seam.
function normalizeEvidence(data){
 const keys=['schemaVersion','runId','toolCallId','metric','unit','basis','dimension','asOf','periodStart','label','provenance','originReceiptIds','rows'];
 if(!exact(data,keys)||data.schemaVersion!=='chart-typed-evidence@1'||!id(data.runId)||!id(data.toolCallId)||typeof data.metric!=='string'||!Object.hasOwn(profiles,data.metric))fail('CHART_EVIDENCE_INVALID');
 const p=profiles[data.metric];
 if(!p.units.includes(data.unit)||!p.bases.includes(data.basis)||data.dimension!==p.dim||!(day(data.asOf)||data.asOf===null&&p.dim==='category'&&data.provenance==='user-supplied')||!label(data.label)
   ||(data.metric==='return-comparison'?(!day(data.periodStart)||data.periodStart>=data.asOf):data.periodStart!==null)
   ||!(p.bases.includes('user-supplied')?data.provenance==='user-supplied':['synthetic','provider-reported','document-reported'].includes(data.provenance))
   ||!list(data.originReceiptIds,8)||!data.originReceiptIds.every(originReceipt)||new Set(data.originReceiptIds).size!==data.originReceiptIds.length
   ||!list(data.rows,p.dim==='date'?maxPoints:maxBars))fail('CHART_EVIDENCE_INVALID');
 const rows=data.rows.map(item=>{
  if(!exact(item,['key','value'])||!(p.dim==='date'?day(item.key)&&item.key<=data.asOf:label(item.key))
   ||!(item.value===null||range(data.metric,item.value)))fail('CHART_EVIDENCE_INVALID');
  const value=item.value!==null&&p.chart==='candlestick'?Object.fromEntries(['open','high','low','close'].map(k=>[k,item.value[k]])):Object.is(item.value,-0)?0:item.value;
  return {key:item.key,value};
 });
 if(new Set(rows.map(x=>x.key)).size!==rows.length||!rows.some(x=>x.value!==null))fail('CHART_EVIDENCE_INVALID');
 if(p.dim==='date'&&rows.some((row,i)=>i>0&&row.key<=rows[i-1].key))fail('CHART_EVIDENCE_INVALID');
 return {...Object.fromEntries(keys.filter(x=>x!=='rows').map(x=>[x,data[x]])),rows};
}
export function sealFinancialChartEvidence(source){
 const data=normalizeEvidence(source);
 return {receiptId:'chart-evidence:sha256:'+hash(JSON.stringify(data)),data};
}
export async function compileFinancialChart({runId,selection,readCommittedEvidence}){
 if(!id(runId)||typeof readCommittedEvidence!=='function')fail('CHART_EVIDENCE_REQUIRED');
 const wanted=request(selection),records=[];
 for(const receiptId of wanted.receiptIds){
  const original=await readCommittedEvidence({runId,receiptId});
  if(!original||original.status!=='succeeded'||original.receiptId!==receiptId)fail('CHART_UNVERIFIED_SOURCE');
  const {data,receiptId:recomputed}=sealFinancialChartEvidence(original.data);
  if(recomputed!==receiptId||data.runId!==runId||data.metric!==wanted.kind||data.toolCallId!==original.toolCallId)fail('CHART_UNVERIFIED_SOURCE');
  records.push({receiptId,data});
 }
 const first=records[0].data;
 if(records.some(({data})=>['unit','basis','dimension','asOf','periodStart','provenance'].some(k=>data[k]!==first[k])))fail('CHART_NONCOMPARABLE');
 if(new Set(records.map(x=>x.data.label)).size!==records.length)fail('CHART_NONCOMPARABLE');
 const axis=profiles[wanted.kind], keys=axis.dim==='date'?[...new Set(records.flatMap(({data})=>data.rows.map(r=>r.key)))].sort():first.rows.map(r=>r.key);
 if(keys.length>(axis.dim==='date'?maxPoints:maxBars))fail('CHART_POINT_LIMIT');
 if(wanted.kind.startsWith('financial-')&&axis.dim!=='date'&&records.some(({data})=>JSON.stringify(data.rows.map(r=>r.key))!==JSON.stringify(keys)))fail('CHART_NONCOMPARABLE');
 const series=records.map(({receiptId,data})=>{
  const index=new Map(data.rows.map(({key,value})=>[key,value]));
  return {label:data.label,receiptId,originReceiptIds:[...data.originReceiptIds],values:keys.map(k=>index.get(k)??null)};
 });
 let coverage;
 if(axis.chart==='pie'){
  const values=series[0].values;
  const total=values.reduce((sum,x)=>sum+(x??0),0);
  if(total<=0||total>100+1e-9||(total>=100-1e-9&&values.includes(null)))fail('CHART_PIE_COVERAGE');
  coverage={total:100,remainder:Math.max(0,100-total),remainderLabel:'未列出或未核实'};
 }
 const spec={schemaVersion:CHART_SCHEMA,runId,kind:wanted.kind,chart:axis.chart,title:axis.title,
  dimension:axis.dim,unit:first.unit,basis:first.basis,asOf:first.asOf,periodStart:first.periodStart,
  provenance:first.provenance,keys,series,...(coverage?{coverage}:{})};
 return {...spec,sha256:hash(JSON.stringify(spec))};
}

// Tool registrations can use this descriptor, but must supply the same
// Run's committed typed-evidence reader, not a model-controlled loader.
export function createFinancialChartSkill({runId,readCommittedEvidence}){
 if(!id(runId)||typeof readCommittedEvidence!=='function')fail('CHART_EVIDENCE_REQUIRED');
 return {
  name:CHART_TOOL_NAME,
  description:'Produce a financial chart only from original verified typed receipt IDs previously obtained in this Run. Do not pass values, labels, dates, or citations. ETF exchange close is not fund NAV.',
  parameters:{type:'object',additionalProperties:false,required:['kind','receiptIds'],properties:{
   kind:{type:'string',enum:Object.keys(profiles)},
   receiptIds:{type:'array',minItems:1,maxItems:maxSeries,uniqueItems:true,items:{type:'string',pattern:'^chart-evidence:sha256:[a-f0-9]{64}$'}},
  }},
  validate:request,
  execute:selection=>compileFinancialChart({runId,selection,readCommittedEvidence}),
 };
}

// The view reader must obtain this record from accepted ToolResult storage
// for the selected original Run. A prose/code-block parse or a raw timeline
// event is not an accepted value source.
export async function projectFinancialChart({
 runId,callId,readCommittedChartResult,readCommittedEvidence,
}){
 if(!id(runId)||!id(callId)||typeof readCommittedChartResult!=='function')fail('CHART_RESULT_REQUIRED');
 const result=await readCommittedChartResult({runId,callId});
 const spec=result?.value;
 if(result?.runId!==runId||result.callId!==callId||result.name!==CHART_TOOL_NAME||result.status!=='succeeded'
   ||result.dispatched!==true||!safeObject(spec)||spec.schemaVersion!==CHART_SCHEMA||spec.runId!==runId||!digest(spec.sha256)||!list(spec.series,maxSeries))fail('CHART_RESULT_NOT_ACCEPTED');
 // Selection comes from the checked native effective ToolCall intent, not
 // from values found in an answer or interpreted from source text.
 const expected=await compileFinancialChart({runId,selection:result.arguments,readCommittedEvidence});
 if(JSON.stringify(canonical(spec))!==JSON.stringify(canonical(expected)))fail('CHART_RESULT_CHANGED');
 const {schemaVersion:_,runId:__,sha256,...view}=expected;
 return {schemaVersion:WIRE_SCHEMA,...view,integrity:sha256};
}
