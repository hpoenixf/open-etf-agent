import {accessSync,constants} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const CHART_COMPUTE_MODE='financial-chart-agent-compute@1';
export const CHART_COMPUTE_DATE_MODE='financial-chart-agent-compute@2';
export const chartComputeMode=x=>x===CHART_COMPUTE_MODE||x===CHART_COMPUTE_DATE_MODE;
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
export const openChartCompute=()=>({
 name:'compute_chart_formula',recoveryVersion:'chart-formula@1',
 description:'Optional step of the Financial Chart Skill. Evaluate basic numeric formula syntax on explicit arrays already available in this turn. Supports + - * / sum avg pct growth coalesce; no files, commands, imports, network, or long programs. Use the returned number or array in the normal chart dataset. The result is computed, not independently verified.',
 parameters:{type:'object',required:['script','inputs'],additionalProperties:false,properties:{
  script:{type:'string',description:'e.g. growth(revenue)'},
  inputs:{type:'object',description:'Named numeric scalars or arrays; explicit nulls for missing points.'},
 }},
 validate(args){if(!args||Buffer.byteLength(JSON.stringify(args))>64000)throw Object.assign(new Error('FORMULA_INVALID'),{code:'FORMULA_INVALID'});},
 execute:(args,{signal})=>compute(args,signal),
 // A history read reconstructs stored chart output; it never invokes Python.
 // If the process disappeared before the result committed, keep that outcome unknown.
 reconcile:async()=>null,
 verifyResult(result,{call}){
  if(result?.schemaVersion!==resultSchema||result.status==='computed'&&
   (!validate(call.arguments)||!numeric(result.value)||result.formulaSha256!==hash(call.arguments.script)||
    result.inputSha256!==hash(call.arguments.inputs)||result.provenance!=='computed-unverified')||
    result.status==='unavailable'&&!/^FORMULA_[A-Z_]{1,40}$/.test(result.reason)||
    !['computed','unavailable'].includes(result.status))
   throw Object.assign(new Error('FORMULA_RESULT_INVALID'),{code:'FORMULA_RESULT_INVALID'});
 },
});
