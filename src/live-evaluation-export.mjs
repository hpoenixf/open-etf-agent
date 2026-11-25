// Read-only projection of an operator-owned, frozen live campaign. No network, model, or artifact read.
import { constants, open, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { safeDirectory } from './storage-files.mjs';
const commitPattern=/^[a-f0-9]{40}$/;
const casePattern=/^(REG|TIME|WEB|PDF|ETFS|FIN|DEEP|LIFE|ACT|MAIL)-(0[1-9]|1[0-9]|20)$/;
const hashPattern=/^[a-f0-9]{64}$/;
const runPattern=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const tracePattern=/^(?!0+$)[a-f0-9]{32}$/;
const revisionPattern=/^revision:sha256:[a-f0-9]{64}$/;
const jaegerSpanNames=new Set(['Research Run','Model dispatch','Tool result','Delivery confirmed']);
const codePattern=/^[A-Z][A-Z0-9_]{0,95}$/;
const steps = new Set(['started','resumed','tool_prepare','tool_returned','tool_unavailable','synthesis','interrupted','completed','failed','cancelled']);
const sha = b => createHash('sha256').update(b).digest('hex');
const safeInteger = (n,max) => Number.isSafeInteger(n)&&n>=0&&n<=max?n:null;
async function readBounded(path,max) {
 const absolute=resolve(path);
 await safeDirectory(dirname(absolute));
 const file=await open(absolute,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try {
  const st=await file.stat();
  if(!st.isFile()||st.size>max)throw Error('INVALID_INPUT_FILE');
  const bytes=Buffer.alloc(max+1);let n=0;
  while(n<bytes.length){const part=await file.read(bytes,n,bytes.length-n);if(!part.bytesRead)break;n+=part.bytesRead;}
  if(n>max)throw Error('INVALID_INPUT_FILE');
  return bytes.subarray(0,n);
 } finally {await file.close();}
}
function collector(raw,submitted,delivery) {
 if(raw===undefined)return undefined;
 if(['not-read-back','unknown','transport-accepted','partial','rejected','not-dispatched'].includes(raw?.state))return {state:raw.state};
 if(raw?.state!=='query-verified'||!submitted||!tracePattern.test(raw.traceId)||!Array.isArray(raw.spanNames)||raw.spanNames.length<1||raw.spanNames.length>302||raw.spanNames.some(x=>!jaegerSpanNames.has(x))||raw.spanNames.filter(x=>x==='Research Run').length!==1||raw.spanNames.filter(x=>x==='Delivery confirmed').length>1)throw Error('RECEIPT_TRACE_BINDING_INVALID');
 if(delivery==='verified'&&!raw.spanNames.includes('Delivery confirmed'))throw Error('RECEIPT_TRACE_DELIVERY_MISSING');
 return {state:raw.state,traceId:raw.traceId,spanNames:[...raw.spanNames]};
}
function postRead(raw,r,collector,delivery) {
 if(raw===undefined)return undefined;
 if(raw?.schemaVersion!=='open-live-postread@1'||raw.caseId!==r.case||raw.sourceCommit!==r.source||raw.runId!==r.runId||collector?.state!=='query-verified'||raw.traceId!==collector.traceId||delivery.status!=='verified'||r.state!=='completed'||raw.bodySha256!==delivery.sha256)throw Error('POSTREAD_IDENTITY_MISMATCH');
 if(!Number.isSafeInteger(raw.publicationRevision)||raw.publicationRevision<1||!hashPattern.test(raw.publicationBindingHash)||!revisionPattern.test(raw.reportRevisionId))throw Error('POSTREAD_PUBLICATION_INVALID');
 const page=raw.checkedSource;
 if(!Number.isSafeInteger(page?.page)||page.page<1||page.page>100_000||!hashPattern.test(r.inputSha256)||page.originalSha256!==r.inputSha256||!hashPattern.test(page.sha256)||page.id!=='pdf:'+page.originalSha256+':p'+page.page||typeof raw.sourceClaimMatched!=='boolean')throw Error('POSTREAD_PAGE_BINDING_INVALID');
 return {runId:raw.runId,traceId:raw.traceId,bodySha256:raw.bodySha256,publicationRevision:raw.publicationRevision,publicationBindingHash:raw.publicationBindingHash,reportRevisionId:raw.reportRevisionId,
  checkedSource:{id:page.id,page:page.page,sha256:page.sha256,originalSha256:page.originalSha256},sourceClaimMatched:raw.sourceClaimMatched};
}
function reduce(r,id,postread,sourceCommit) {
 if(r.case!==id||!commitPattern.test(r.source)||r.provider!=='opencode-go')throw Error('RECEIPT_IDENTITY_INVALID');
 // Keep evidence for other candidate commits distinct. Never relabel a prior run as tested on this candidate.
 if(r.source!==sourceCommit) return {caseId:id,state:'not-run',priorSource:r.source};
 if(!hashPattern.test(r.questionSha256)||!['reserved','dispatching','submitted','completed','failed','canceled','cancelled','unknown','not-dispatched','submit-status'].includes(r.state))throw Error('RECEIPT_FORMAT_INVALID');
 const submitted=r.httpStatus===202&&typeof r.runId==='string'&&runPattern.test(r.runId);
 if(r.httpStatus===202&&!submitted)throw Error('RECEIPT_RUN_BINDING_MISSING');
 const localRuntime=r.runtime&&['completed','failed','cancelled'].includes(r.runtime.status)?r.runtime.status:null;
 if(localRuntime&&localRuntime!==r.state&&!(localRuntime==='cancelled'&&r.state==='canceled'))throw Error('RECEIPT_RUNTIME_MISMATCH');
 const evaluation=r.evaluation??{};
 const sha256=hashPattern.test(evaluation.bodySha256??r.bodySha256)?evaluation.bodySha256??r.bodySha256:null;
 const bodyBytes=safeInteger(evaluation.bodyBytes??r.bodyBytes,268_435_456);
 const bodyHttp=safeInteger(evaluation.bodyHttp??r.bodyHttp,599);
 const delivery=!submitted?'not-run':evaluation.exactColdBody===true&&evaluation.coldHttp===200&&bodyHttp===200&&sha256&&bodyBytes>0?'verified':bodyHttp===200&&sha256&&bodyBytes>0?'readback-only':bodyHttp===409||bodyHttp===404?'missing':'unknown';
 if(evaluation.exactColdBody===true&&delivery!=='verified')throw Error('RECEIPT_BODY_BINDING_INVALID');
 const observation=r.observation?.http===200&&r.observation.status==='available'&&Array.isArray(r.observation.stepCodes)?r.observation.stepCodes.filter(s=>steps.has(s)).slice(-80):[];
 const remote=collector(r.collector,submitted,delivery);
 const supplemental=postRead(postread,r,remote,{status:delivery,sha256});
 return {
  ...(remote?{jaeger:remote}:{}),
  ...(supplemental?{postRead:supplemental,inputSha256:r.inputSha256}:{}),
  caseId:id,state:r.state==='canceled'?'cancelled':r.state, questionSha256:r.questionSha256,
  runId:submitted?r.runId:null,runtimeStatus:localRuntime,runtimeCode:codePattern.test(r.runtime?.code??r.runtimeCode??r.code)?r.runtime?.code??r.runtimeCode??r.code:null,
  uses:{model:safeInteger(r.runtime?.modelUses,100_000),tool:safeInteger(r.runtime?.toolUses,100_000)},
  delivery:{status:delivery,sha256,bytes:bodyBytes},
  observation:{status:observation.length?'observed':'unavailable',stepCodes:observation},
  sourceReceiptCount:safeInteger(r.sourceReceiptCount??(r.evidence?.sourceHttp===200?r.evidence.count:undefined),100_000),
  objectiveNumeric:evaluation.semanticCheck==='numeric-component-only'&&typeof evaluation.numericMatch==='boolean'?(evaluation.numericMatch?'matched':'not-matched'):'not-reviewed',
  semanticStatus:'unreviewed',
 };
}
export async function exportLiveCampaign({casesPath,receiptDir,sourceCommit}) {
 if(typeof casesPath!=='string'||typeof receiptDir!=='string'||!commitPattern.test(sourceCommit))throw Error('INVALID_LIVE_EXPORT_ARGUMENTS');
 receiptDir=await safeDirectory(resolve(receiptDir));
 const original=await readBounded(casesPath,2_000_000), manifest=JSON.parse(original);
 if(!Array.isArray(manifest)||manifest.length!==200||new Set(manifest.map(x=>x?.id)).size!==200||manifest.some(x=>!casePattern.test(x?.id)||x.real_model!==true))throw Error('INVALID_CASE_MANIFEST');
 const files=new Set(await readdir(receiptDir));
 const cases=[];
 for(const {id} of manifest){
  const name=id+'-live-once.json';
  const side=id+'-postread.safe.json';
  if(files.has(side)&&!files.has(name))throw Error('POSTREAD_ORPHAN');
  const readSide=files.has(side)?JSON.parse(await readBounded(join(receiptDir,side),64_000)):undefined;
  cases.push(files.has(name)?reduce(JSON.parse(await readBounded(join(receiptDir,name),64_000)),id,readSide,sourceCommit):{caseId:id,state:'not-run'});
 }
 const seen = new Set(), traces = new Set();
 for(const r of cases)if(r.runId){
  if(seen.has(r.runId))throw Error('RECEIPT_SHARED_RUN_ID');
  seen.add(r.runId);
  if(r.jaeger?.traceId){
   if(traces.has(r.jaeger.traceId))throw Error('RECEIPT_SHARED_TRACE_ID');
   traces.add(r.jaeger.traceId);
  }
 }
 return {schemaVersion:'open-live-evaluation@1',candidateCommit:sourceCommit,manifestSha256:sha(original),denominator:200,cases};
}
