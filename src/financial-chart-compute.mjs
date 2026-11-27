import {accessSync,constants} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validPdfCellText} from './pdf-table-evidence.mjs';
export const CHART_COMPUTE_MODE='financial-chart-agent-compute@1';
export const CHART_COMPUTE_DATE_MODE='financial-chart-agent-compute@2';
export const CHART_PDF_COMPUTE_MODE='financial-chart-agent-compute@3';
export const CHART_PDF_COMPUTE_CANONICAL='financial-chart-agent-compute@4';
export const linkedChartComputeMode=x=>x===CHART_PDF_COMPUTE_MODE||x===CHART_PDF_COMPUTE_CANONICAL;
export const chartComputeMode=x=>x===CHART_COMPUTE_MODE||x===CHART_COMPUTE_DATE_MODE||linkedChartComputeMode(x);
const interpreter='/usr/bin/python3';
const script=fileURLToPath(new URL('./owner-skills/financial-chart/controlled-chart-compute.py',import.meta.url));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const resultSchema='chart-formula@1';
const maximum=1_000_000_000;
const scalar=v=>v===null||typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=maximum;
const numeric=v=>Array.isArray(v)?v.length>=1&&v.length<=180&&v.every(scalar):scalar(v);
let workers=0;
export function chartComputeAvailable(){
 try{accessSync(interpreter,constants.X_OK);accessSync(script,constants.R_OK);return true;}catch{return false;}
}
function validate(v){
 return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='inputs,script'&&
  typeof v.script==='string'&&Buffer.byteLength(v.script)>0&&Buffer.byteLength(v.script)<=4096&&
  v.inputs&&typeof v.inputs==='object'&&!Array.isArray(v.inputs)&&Object.keys(v.inputs).length<=12&&
  Object.entries(v.inputs).every(([k,x])=>/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(k)&&numeric(x));
}
async function compute(v,signal){
 const no=reason=>({schemaVersion:resultSchema,status:'unavailable',reason});
 if(!validate(v))return no('FORMULA_INVALID');
 if(signal?.aborted||!chartComputeAvailable())return no('FORMULA_UNAVAILABLE');
 if(workers>=2)return no('FORMULA_BUSY');
 workers++;
 try{return await new Promise(resolve=>{
  let closed=false,code=null,size=0;
  const chunks=[];
  // The only executable is this versioned, trusted AST interpreter.
  // Neither the program path nor any flag or environment comes from the model.
  const child=spawn(interpreter,['-I','-S','-B',script],{stdio:['pipe','pipe','ignore'],env:{LC_ALL:'C'}});
  const kill=why=>{code??=why;child.kill('SIGKILL');};
  const timer=setTimeout(()=>kill('FORMULA_TIMEOUT'),1250);
  const stop=()=>kill('FORMULA_CANCELLED');
  signal?.addEventListener('abort',stop,{once:true});
  if(signal?.aborted)stop();
  const done=reply=>{if(closed)return;closed=true;clearTimeout(timer);signal?.removeEventListener('abort',stop);resolve(reply);};
  child.stdout.on('data',b=>{size+=b.length;if(size>8192)kill('FORMULA_RESULT_LIMIT');else chunks.push(b);});
  child.stdin.on('error',()=>{});
  child.on('error',()=>done(no('FORMULA_UNAVAILABLE')));
  child.on('close',status=>{
   if(code)return done(no(code));
   try{const d=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(status===0&&Object.keys(d).join(',')==='value'&&numeric(d.value))
     return done({schemaVersion:resultSchema,status:'computed',value:d.value,formulaSha256:hash(v.script),inputSha256:hash(v.inputs),provenance:'computed-unverified'});
    if(status===2&&/^FORMULA_[A-Z_]{1,40}$/.test(d.error))return done(no(d.error));
   }catch{/* A malformed child result is not a chart value. */}
   done(no('FORMULA_RESULT_INVALID'));
  });
  child.stdin.end(JSON.stringify(v)+'\n');
 });}finally{workers--;}
}
const cellRef=/^PDF:web-pdf-cell:sha256:[a-f0-9]{64}$/;
function normalizedCellRef(ref,canonical){
 if(typeof ref!=='string')return null;
 if(cellRef.test(ref))return ref;
 if(!canonical)return null;
 const raw=ref.startsWith('[[PDF:')&&ref.endsWith(']]')?ref.slice(2,-2):
  ref.startsWith('web-pdf-cell:')?'PDF:'+ref:ref;
 return cellRef.test(raw)?raw:null;
}
async function resolveFormula(args,resolveCell,callId,canonical){
 if(!resolveCell||!Object.hasOwn(args,'cells'))return {input:args,refs:[]};
 if(Object.keys(args).sort().join(',')!=='cells,script'||!args.cells||typeof args.cells!=='object'||Array.isArray(args.cells))return null;
 const entries=Object.entries(args.cells);
 if(!entries.length||entries.length>12||entries.some(([name,refs])=>!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name)||
     !Array.isArray(refs)||!refs.length||!refs.every(r=>r===null||normalizedCellRef(r,canonical)!==null))||
     entries.reduce((n,[,refs])=>n+refs.length,0)>16)return null;
 const observed=new Map(), refs=new Set(), inputs=Object.create(null);
 for(const [name,list] of entries){
  const values=[];let unit;
  for(const raw of list){
   if(raw===null){values.push(null);continue;}
   const ref=normalizedCellRef(raw,canonical);
   if(!observed.has(ref))observed.set(ref,await resolveCell(ref,callId));
   const record=observed.get(ref);
   if(!record?.cell?.unit||!validPdfCellText(record.text)||unit&&unit!==record.cell.unit)return null;
   const value=Number(record.text.replaceAll(',','').replace(/^\((.*)\)$/,'-$1'));
   if(!scalar(value))return null;
   unit=record.cell.unit;values.push(value);refs.add(ref);
  }
  inputs[name]=values;
 }
 return {input:{script:args.script,inputs},refs:[...refs]};
}
const formulaShape={type:'object',required:['script','inputs'],additionalProperties:false,properties:{
 script:{type:'string',description:'e.g. growth(revenue)'},
 inputs:{type:'object',description:'Named numeric scalars or arrays; explicit nulls for missing points.'},
}};
export const openChartCompute=({resolveCell,canonical=false}={})=>({
 name:'compute_chart_formula',recoveryVersion:canonical?'chart-formula@3':resolveCell?'chart-formula@2':'chart-formula@1',
 description:'Optional step of the Financial Chart Skill. Evaluate basic numeric formula syntax on explicit arrays already available in this turn. Supports + - * / sum avg pct growth coalesce; no files, commands, imports, network, or long programs. Use the returned number or array in the normal chart dataset. The result is computed, not independently verified.'+(resolveCell?' For retained PDF values, send cells instead of inputs; for each variable give an array of exact PDF:<cell sourceRef> references (or null). Use the formula tool call ID as formulaCallId in a chart series, not copied values.':'')+(canonical?' You may copy each cell sourceRef directly, without adding a prefix. Copy the returned formulaCallId for the chart.':''),
 parameters:resolveCell?{...formulaShape,required:['script'],properties:{...formulaShape.properties,cells:{type:'object',description:canonical?'Named ordered arrays of previously read exact sourceRef values or null. Copy the cell sourceRef verbatim; no prefix needed. Do not send inputs with cells.':'Named ordered arrays of exact previously read PDF cell references or null. Do not send inputs with cells.'}}}:formulaShape,
 validate(args){if(!args||Buffer.byteLength(JSON.stringify(args))>64000)throw Object.assign(new Error('FORMULA_INVALID'),{code:'FORMULA_INVALID'});},
 async execute(args,{signal,callId}){
  const resolved=await resolveFormula(args,resolveCell,callId,canonical);
  if(!resolved)return {schemaVersion:resultSchema,status:'unavailable',reason:'FORMULA_SOURCE_UNAVAILABLE'};
  const result=await compute(resolved.input,signal);
  return result.status==='computed'?{...result,...(resolved.refs.length?{sourceRefs:resolved.refs}:{}),...(canonical?{formulaCallId:callId}:{})}:result;
 },
 // A history read reconstructs stored chart output; it never invokes Python.
 // If the process disappeared before the result committed, keep that outcome unknown.
 reconcile:async()=>null,
 verifyResult(result,{call}){
  const check=resolved=>{
   if(result?.schemaVersion!==resultSchema||result.status==='computed'&&
    (!resolved||!validate(resolved.input)||!numeric(result.value)||result.formulaSha256!==hash(resolved.input.script)||
     result.inputSha256!==hash(resolved.input.inputs)||result.provenance!=='computed-unverified'||
     JSON.stringify(result.sourceRefs??[])!==JSON.stringify(resolved.refs)||canonical&&result.formulaCallId!==call.id)||
     result.status==='unavailable'&&!/^FORMULA_[A-Z_]{1,40}$/.test(result.reason)||
     !['computed','unavailable'].includes(result.status))
    throw Object.assign(new Error('FORMULA_RESULT_INVALID'),{code:'FORMULA_RESULT_INVALID'});
  };
  if(resolveCell&&result?.status==='computed')return resolveFormula(call.arguments,resolveCell,call.id,canonical).then(check);
  return check({input:call.arguments,refs:[]});
 },
});
