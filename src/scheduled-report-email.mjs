// Delivery only: no scheduler, model, deployment credential, SMTP or vendor client.
import {renderFullDailyDigestHtml} from './daily-digest-render.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureSafeDirectory, publishImmutable, safeDirectory } from './storage-files.mjs';

const PURPOSE='scheduled-research-email@1';
const MAX_ATTEMPTS=2;
const SUBJECT='Scheduled research report';
export const WATCH_FULL_EMAIL_TEMPLATE='watch-full-report@1';
function watchOrigin(origin){
 let url;
 try{url=new URL(origin);}catch{fail('WATCH_FULL_EMAIL_ORIGIN');}
 if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail('WATCH_FULL_EMAIL_ORIGIN');
 return origin;
}
export function prepareFullWatchEmail({recipient,origin}){
 const target=destinationBinding(recipient);
 return {ownerOrigin:watchOrigin(origin),destination:Object.freeze({...recipient,
  version:'watch-full-'+hash(JSON.stringify([target.version,WATCH_FULL_EMAIL_TEMPLATE,origin]))})};
}
function fullReportDetails({ownerOrigin,date,scheduledAt,briefLabel},ref){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(scheduledAt))||
  !/^daily-w[a-f0-9]{24}-\d{4}$/.test(ref.conversationId)||ref.messageId!=='day-'+date)fail('WATCH_FULL_EMAIL_SLOT');
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(Date.parse(scheduledAt));
 const f=Object.fromEntries(parts.map(({type,value})=>[type,value]));
 if(f.year+'-'+f.month+'-'+f.day!==date)fail('WATCH_FULL_EMAIL_SLOT');
 const time=f.hour+':'+f.minute;
 const label=['早报','晚报'].includes(briefLabel)?briefLabel:'定时研究';
 const subject=label+' · '+date+' '+time+'（北京时间）';
 const link=watchOrigin(ownerOrigin)+'/#'+ref.conversationId+'~'+ref.messageId;
 return {label,subject,link};
}
function fullEnvelope({subject,label,link},body){
 const html=renderFullDailyDigestHtml({subject,intro:'完整报告',rows:[{label,detail:'按计划时段留存的原始正文。',link,body}],
  footer:'原报告链接需要工作台登录。'});
 return {subject,text:body,html};
}
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const token=(value, max=200)=>typeof value==='string'&&value.length<=max&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const refKeys=['conversationId','messageId','runId','revisionId','sha256'];
function reportBinding(value){
 if(!value||!refKeys.slice(0,-1).every(k=>token(value[k]))||!digest(value.sha256)) fail('EMAIL_REPORT_IDENTITY_REQUIRED');
 return Object.fromEntries(refKeys.map(k=>[k,value[k]]));
}
function destinationBinding(value){
 if(value?.enabled!==true||value.verified!==true||!token(value.version)||typeof value.address!=='string'
   ||value.address.length>254||!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value.address)) fail('EMAIL_DESTINATION_NOT_ENABLED');
 return {address:value.address,version:value.version};
}
function occurrenceKey(id){
 if(!token(id)) fail('EMAIL_OCCURRENCE_REQUIRED');
 return hash(JSON.stringify([PURPOSE,id]));
}
async function read(directory, name){
 let file;
 try {
  file=await open(join(directory,name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const info=await file.stat();
  if(!info.isFile()||info.size>16384) fail('EMAIL_LEDGER_UNSAFE');
  const record=JSON.parse(await file.readFile('utf8'));
  const {integrity,...body}=record;
  if(integrity!==hash(JSON.stringify(body)))fail('EMAIL_LEDGER_CHANGED');
  return body;
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
 finally{await file?.close();}
}
async function record(directory,name,value){
 try {
  await publishImmutable(directory,name,Buffer.from(JSON.stringify({...value,integrity:hash(JSON.stringify(value))})));
  return true;
 }catch(error){if(error.code==='EEXIST')return false;throw error;}
}
function matches(a,b){return JSON.stringify(a)===JSON.stringify(b);}
async function locate(directory, occurrenceId, create){
 const key=occurrenceKey(occurrenceId), path=join(directory,key);
 if(create)return {key,path:await ensureSafeDirectory(path)};
 try{return {key,path:await safeDirectory(path)};}catch(error){if(error.code==='ENOENT')return {key,path:null};throw error;}
}
async function journal(path,key){
 const intent=path&&await read(path,'intent.json');
 if(!intent)return {status:'not-started',attempts:0};
 if(intent.schema!==PURPOSE||intent.occurrenceKey!==key||!digest(intent.bindingHash)||!digest(intent.idempotencyKey))fail('EMAIL_LEDGER_CHANGED');
 for(let n=1;n<=MAX_ATTEMPTS;n++){
  const claim=await read(path,`attempt-${n}.json`);
  if(!claim)return {status:n===1?'not-started':'not-dispatched',attempts:n-1,canRetry:n>1,intent};
  if(claim.number!==n||!token(claim.generation)||claim.idempotencyKey!==intent.idempotencyKey)fail('EMAIL_LEDGER_CHANGED');
  const last=await read(path,`settlement-${n}.json`);
  // An unresolved claim may still be in flight or have survived a crash.
  // Neither observation permits another POST.
  if(!last)return {status:'unknown',attempts:n,intent};
  if(last.generation!==claim.generation||!['accepted','not-dispatched','unknown'].includes(last.status)
   ||last.status==='accepted'&&!token(last.receiptId))fail('EMAIL_LEDGER_CHANGED');
  if(last.status!=='not-dispatched')return {status:last.status,attempts:n,...(last.status==='accepted'?{receiptId:last.receiptId}:{}),intent};
 }
 return {status:'not-dispatched',attempts:MAX_ATTEMPTS,canRetry:false,intent};
}
function publicView({status,attempts,canRetry,receiptId}){
 return {status,attempts,...(canRetry===undefined?{}:{canRetry}),...(receiptId===undefined?{}:{receiptId})};
}
export async function inspectScheduledEmailDelivery({directory,occurrenceId}){
 const {key,path}=await locate(directory,occurrenceId,false);
 return publicView(await journal(path,key));
}

// The trusted caller resolves destination from the *confirmed schedule revision*
// and supplies fresh owner verification. Never call with browser-controlled To.
export async function deliverScheduledReportEmail({directory,occurrenceId,reportRef,destination,readCompletedReport,transport,retryNotDispatched=false,recheckDestination,fullReport}){
 const key=occurrenceKey(occurrenceId), target=destinationBinding(destination), ref=reportBinding(reportRef);
 const previous=await locate(directory,occurrenceId,false);
 const view=await journal(previous.path,key);
 // Existing per-watch receipts keep the exact legacy binding. On the native
 // full path the date, slot and template are trusted frozen inputs, not a new occurrence.
 const template=fullReport?fullReportDetails(fullReport,ref):null;
 const bindingHash=hash(JSON.stringify([PURPOSE,key,target.address,target.version,ref,template?.subject??SUBJECT,
  ...(fullReport?[WATCH_FULL_EMAIL_TEMPLATE,fullReport.ownerOrigin,fullReport.scheduledAt]:[])]));
 const idempotencyKey=hash(JSON.stringify([PURPOSE,key,bindingHash]));
 const intent={schema:PURPOSE,occurrenceKey:key,bindingHash,idempotencyKey};
 if(view.intent&&!matches(view.intent,intent))fail('EMAIL_OCCURRENCE_BINDING_CHANGED');
 if(view.status!=='not-started'&&!(view.status==='not-dispatched'&&view.canRetry&&retryNotDispatched===true))return publicView(view);
 if(typeof transport!=='function'||typeof readCompletedReport!=='function'
    ||recheckDestination!==undefined&&typeof recheckDestination!=='function')fail('EMAIL_TRANSPORT_NOT_CONFIGURED');
 const verified=await readCompletedReport(ref);
 if(verified?.status!=='completed'||!matches(reportBinding(verified),ref)||
    typeof verified.text!=='string'||!verified.text.trim()||Buffer.byteLength(verified.text)>128000||
    Buffer.from(verified.text).toString('utf8')!==verified.text||hash(verified.text)!==ref.sha256)fail('EMAIL_REPORT_NOT_VERIFIED');
 const payload=template?fullEnvelope(template,verified.text):{subject:SUBJECT,text:verified.text};
 const {path}=await locate(directory,occurrenceId,true);
 if(!await record(path,'intent.json',intent)&&!matches(await read(path,'intent.json'),intent))fail('EMAIL_OCCURRENCE_BINDING_CHANGED');
 const fresh=await journal(path,key);
 if(fresh.attempts!==view.attempts||fresh.status!==view.status)return publicView(fresh);
 const attempt=fresh.attempts+1,generation=randomUUID();
 if(!await record(path,`attempt-${attempt}.json`,{number:attempt,idempotencyKey,generation}))return publicView(await journal(path,key));
 let settlement={generation,status:'unknown'};
 let enabled=true;
 if(recheckDestination){
  try{enabled=matches(destinationBinding(await recheckDestination()),target);}catch{enabled=false;}
 }
 if(!enabled)settlement={generation,status:'not-dispatched'};
 else try{
  const outcome=await transport({to:target.address,...payload,idempotencyKey});
  if(outcome?.status==='accepted'&&token(outcome.receiptId))settlement={generation,status:'accepted',receiptId:outcome.receiptId};
  // Only the trusted transport can assert there was definitively no dispatch.
  else if(outcome?.status==='not-dispatched')settlement={generation,status:'not-dispatched'};
 }catch{/* A thrown network or adapter error does not prove non-dispatch. */}
 if(!await record(path,`settlement-${attempt}.json`,settlement))fail('EMAIL_SETTLEMENT_CONFLICT');
 return publicView(await journal(path,key));
}

// Optional projection for Open's unchanged, read-only Conversation owner.
// The checked lookup derives Run identity from the original message journal,
// never from a caller-provided arbitrary path, report text, or artifact ID.
export async function readCompletedConversationEmailReport({projectDir,conversationId,messageId,runId}){
 const {readConversationMessage}=await import('./conversation.mjs');
 const {output}=await readConversationMessage({projectDir,conversationId,messageId});
 if(output?.runId!==runId||output.status!=='completed')fail('EMAIL_REPORT_NOT_VERIFIED');
 const isArtifact=output.kind==='report';
 if(!isArtifact&&(output.kind!=='published-answer'||output.publicationStatus!=='published'||output.reportStatus!=='not-created'))
  fail('EMAIL_REPORT_NOT_VERIFIED');
 const body=isArtifact?output.report:output.answer;
 const revisionId=isArtifact?output.revision?.revisionId:'publication:'+body?.sha256;
 return {status:'completed',...reportBinding({conversationId,messageId,runId,revisionId,sha256:body?.sha256}),text:body?.text};
}

// Host composition for the existing daily worker. The resolver must read the
// server's confirmed per-watch opt-in and account verification, not a request
// body. Absence of configuration has no side effects.
export function createScheduledReportEmailHook({resolveConfirmedDestination,transport,fullReportOrigin}){
 if(typeof resolveConfirmedDestination!=='function'||typeof transport!=='function')fail('EMAIL_TRANSPORT_NOT_CONFIGURED');
 return async ({projectDir,watchId,date,conversationId,messageId,runId,scheduledAt,briefLabel,signal})=>{
  if(!token(watchId,128)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('EMAIL_OCCURRENCE_REQUIRED');
  const selector={projectDir,watchId,date};
  const destination=await resolveConfirmedDestination(selector);
  if(destination?.enabled!==true||destination.verified!==true||signal?.aborted)return {status:'not-configured',attempts:0};
  const ref=await readCompletedConversationEmailReport({projectDir,conversationId,messageId,runId});
  return deliverScheduledReportEmail({
   directory:join(projectDir,'scheduled-email'),occurrenceId:watchId+':'+date,reportRef:ref,destination,
   readCompletedReport:value=>readCompletedConversationEmailReport({projectDir,...value}),
   recheckDestination:()=>signal?.aborted?null:resolveConfirmedDestination(selector),
   transport,...(fullReportOrigin?{fullReport:{ownerOrigin:fullReportOrigin,date,scheduledAt,briefLabel}}:{}),
  });
 };
}
