import {createHash} from 'node:crypto';
import {financialChartInputLimits,sealFinancialChartEvidence} from './financial-chart.mjs';
export const INPUT_CHART_SKILL='financial-chart-input@1';
export const INPUT_CHART_AUTO='financial-chart-input-auto@1';
export const inputChartChoice=v=>[INPUT_CHART_SKILL,INPUT_CHART_AUTO].includes(v);
export const LEGACY_INPUT_CHART_GUIDANCE='When a chart materially helps, call read_supplied_chart_data then build_financial_chart with the exact returned kind and receipt IDs. If the reader returns datasets, build each selection separately, at most once. Choose line for trends, grouped columns for comparable values, stacked for additive contributions, pie for one documented percentage denominator. Do not create a chart from estimates, unparsed prose, or URLs. Explain comparisons and limitations in the answer even without a chart. The user-provided chart data is not independently verified.';
export const INPUT_CHART_PROMPT_REVISION='supplied-chart-system@1';
export const INPUT_CHART_GUIDANCE='When a chart materially helps, call read_supplied_chart_data then build_financial_chart with the exact returned kind and receipt IDs. If the reader returns datasets, build each selection separately, at most once. Choose line or area for one dated trend, multi-line for comparable dated series, grouped columns for categorical comparison, stacked for additive contributions, pie for one documented percentage denominator, heatmap for a same-unit row by column matrix, or combo for two same-unit series (first bar, second line, one axis); candlesticks require explicitly supplied dated open/high/low/close bars, not closing prices alone. Use only offered selections, not a chart kind inferred from missing data. Do not invent values, missing periods or points, cite this data as verified, or emit renderer markers, raw charts, or protocol blocks in the answer. Do not create a chart from estimates, unparsed prose, or URLs. Explain comparisons and limitations in the answer even without a chart. The user-provided chart data is not independently verified.';
const source=/^\x60\x60\x60financial-chart-data[ \t]*\r?\n([\s\S]*?)\r?\n\x60\x60\x60[ \t]*(?=\r?$)/gm;
const exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===k;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Explicit Chinese category/percentage pairs, not general natural-language extraction.
// Every pair must be immediately adjacent, delimited and unit-qualified. Neither
// contextual figures nor model-computed/guessed values can enter this adapter.
function proseDatasets(text){
 if(text.includes('```'))return null;
 // A colon can introduce an enumerated list (“生成两张图：柱状图：…”).
 // Only a chart name followed by its own delimiter opens a data clause.
 const marker=/(?:^|[\n；;：:]|[①②③④⑤⑥⑦⑧⑨⑩])\s*(柱状图|饼图)[ 	]*[：:，,]/gm;
 const parts=[...text.matchAll(marker)];
 if(!parts.length||parts.length>2)return null;
 const kinds={'柱状图':'financial-columns','饼图':'financial-share'};
 const ds=parts.map((m,i)=>{
  const tail=text.slice(m.index+m[0].length,parts[i+1]?.index??text.length);
  const content=tail.split(/[。；;\n]/,1)[0].replace(/[ 	]+$/,'');
  const pairs=content.split(/[，,、]/).map(x=>x.trim());
  if(pairs.length<2||pairs.length>24)throw new Error('missing pairs');
  const rows=pairs.map(x=>{
   const match=x.match(/^([\p{L}][\p{L}\p{N} _-]{0,29})(?:[ \t]*[:：=＝][ \t]*|[ \t]+)([+-]?(?:\d{1,8}(?:\.\d{1,6})?))\s*[%％]$/u);
   if(!match)throw new Error('not an explicit percentage pair');
   return {key:match[1].trim(),value:Number(match[2])};
  });
  return {kind:kinds[m[1]],asOf:null,unit:'%',keys:rows.map(x=>x.key),
   series:[{label:'用户提供',values:rows.map(x=>x.value)}]};
 });
 return new Set(ds.map(d=>d.kind)).size===ds.length?ds:null;
}
export function sealDataset(d,runId,{prose=false,sourceText=null,position=0,modelCallId,sourceRefs=[],sourceChecked=false,allowUndatedModelCategory=false}={}){
 if(!exact(d,'asOf,keys,kind,series,unit')||typeof d.kind!=='string')throw new Error('invalid dataset');
 const limits=financialChartInputLimits(d.kind);
 if(!limits||!Array.isArray(d.keys)||!Array.isArray(d.series)||d.series.length<limits.minSeries||
    d.series.length>limits.maxSeries||d.keys.length<limits.minPoints||d.keys.length>limits.maxPoints||
    (!prose&&d.asOf===null&&!(modelCallId&&allowUndatedModelCategory&&limits.dimension==='category')))throw new Error('invalid dataset');
 if(d.kind==='financial-share'){
   const total=d.series[0]?.values?.reduce((a,v)=>a+(v??0),0);
   if(prose&&(!(total>0)||total>100+1e-9))throw new Error('invalid share');
 }
 if(new Set(d.series.map(s=>s?.label)).size!==d.series.length)throw new Error('duplicate series label');
 const origin=hash(prose?{d,sourceText,position}:d);
 const toolCallId=modelCallId??('operator-chart-'+origin);
 const receipts=d.series.map(s=>{
  if(!exact(s,'label,values')||!Array.isArray(s.values)||s.values.length!==d.keys.length)throw new Error('invalid series');
  return {...sealFinancialChartEvidence({
   schemaVersion:'chart-typed-evidence@1',runId,toolCallId,metric:d.kind,unit:d.unit,basis:modelCallId?(sourceChecked?'source-checked':'agent-supplied'):'user-supplied',
   dimension:limits.dimension,asOf:d.asOf,periodStart:null,label:s.label,
   provenance:modelCallId?(sourceChecked?'document-reported':'agent-supplied'):'user-supplied',originReceiptIds:[...sourceRefs.map(ref=>'typed-source:sha256:'+hash(ref)), 'typed-source:sha256:'+origin],rows:d.keys.map((key,i)=>({key,value:s.values[i]})),
  }),status:'succeeded',toolCallId};
 });
 return {kind:d.kind,receipts};
}
// Only the exact operator text frozen at admission is eligible; do not call on
// generated answers, tool results, retained documents or concatenated context.
export function suppliedChartDatasets(text,runId){
 if(typeof text!=='string'||Buffer.byteLength(text)>12000)return [];
 const matches=[...text.matchAll(source)];
 try{
  if(matches.length===1)return [sealDataset(JSON.parse(matches[0][1]),runId)];
  if(matches.length)return [];
  return proseDatasets(text)?.map((d,position)=>sealDataset(d,runId,{prose:true,sourceText:text,position}))??[];
 }catch{return [];}
}
export const suppliedChartReceipts=(text,runId)=>{
 const ds=suppliedChartDatasets(text,runId);
 return ds.length===1?ds[0]:null;
};
export const hasSuppliedChartData=text=>suppliedChartDatasets(text,'chart-admission').length>0;
