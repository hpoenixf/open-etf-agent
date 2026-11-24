// One outbound delivery per owner-local date. The Scheduler selects the day
// and approved rows; this host seam neither runs research nor wakes itself.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {open} from 'node:fs/promises';
import {join} from 'node:path';
import {ensureSafeDirectory,publishImmutable,safeDirectory} from './storage-files.mjs';
import {readCompletedConversationEmailReport} from './scheduled-report-email.mjs';
import {renderFullDailyDigestHtml} from './daily-digest-render.mjs';

const SCHEMA='daily-research-digest-email@1';
const MODES=['links-only','full-report'];
const verifiedText=original=>typeof original.text==='string'&&original.text.trim()&&
 Buffer.byteLength(original.text)<=128000&&Buffer.from(original.text).toString('utf8')===original.text&&hash(original.text)===original.sha256;
export const MAX_DAILY_DIGEST_ROWS=24;
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const id=(v,re)=>typeof v==='string'&&re.test(v);
const date=v=>id(v,/^\d{4}-\d{2}-\d{2}$/)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const receiptId=v=>id(v,/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/);
const validTime=v=>id(v,/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const states=Object.freeze({
 completed:'已完成；原始结果可查看',pending:'待开始或待处理',submitted:'已排队，结果尚未确认',
 active:'正在研究，结果尚未确认',unknown:'结果未知，不代表没有变化',missing:'没有可确认的执行记录',
 'not-run':'未执行',missed:'错过执行',failed:'执行失败，无法确认结果',error:'执行异常，无法确认结果',
 cancelled:'已取消',unavailable:'未核实完成结果',
});
function originFor(raw){
 let u;try{u=new URL(raw);}catch{fail('DIGEST_ORIGIN_INVALID');}
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.origin!==raw)fail('DIGEST_ORIGIN_INVALID');
 return u.origin;
}
function dayKey(ownerId,day){
 if(!id(ownerId,/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/)||!date(day))fail('DIGEST_DAY_INVALID');
 return hash(JSON.stringify([SCHEMA,ownerId,day]));
}
function targetFor(value){
 if(value?.enabled!==true||value.verified!==true||!id(value.version,/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/)
   ||typeof value.address!=='string'||value.address.length>254||!/^[^@\s,;<>]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value.address))return null;
 return {address:value.address,version:value.version};
}
function safeRows(rows){
 if(!Array.isArray(rows)||rows.length>MAX_DAILY_DIGEST_ROWS)fail('DIGEST_ROWS_INVALID');
 const seen=new Set();
 return rows.map(row=>{
  if(!row||!id(row.watchId,/^w[0-9a-f]{24}$/)||!validTime(row.localTime)||!Object.hasOwn(states,row.status)||seen.has(row.watchId))fail('DIGEST_ROWS_INVALID');
  seen.add(row.watchId);
  return row;
 }).sort((a,b)=>a.localTime.localeCompare(b.localTime)||a.watchId.localeCompare(b.watchId));
}

export async function composeDailyDigest({projectDir,date:day,rows,ownerOrigin,mode='links-only',readOriginal=readCompletedConversationEmailReport}){
 if(!date(day))fail('DIGEST_DAY_INVALID');
 if(!MODES.includes(mode))fail('DIGEST_MODE_INVALID');
 const full=mode==='full-report';
 const origin=originFor(ownerOrigin), ordered=safeRows(rows), summaries=[];
 for(const item of ordered){
  let status=item.status,link=null,evidenceDate=null,body=null;
  if(status==='completed'){
   const conversationId='daily-'+item.watchId+'-'+day.slice(0,4),messageId='day-'+day;
   if(item.conversationId===conversationId&&item.messageId===messageId&&id(item.runId,/^conversation-[a-f0-9]{40}$/)){
    try{
     const original=await readOriginal({projectDir,conversationId,messageId,runId:item.runId});
     if(original?.status==='completed'&&original.conversationId===conversationId&&original.messageId===messageId&&original.runId===item.runId&&(!full||verifiedText(original))){
      if(full)body=original.text;
      link=origin+'/#'+conversationId+'~'+messageId;
      // Called only with a typed fact from the Scheduler's trusted projection;
      // do not extract a date from generated prose or substitute the Run date.
      if(date(item.evidenceDate)&&item.evidenceDate<=day)evidenceDate=item.evidenceDate;
     }
    }catch{/* unavailable reports remain visibly unverified */}
   }
   if(!link)status='unavailable';
  }
  summaries.push({status,localTime:item.localTime,link,evidenceDate,body});
 }
 if(full){
  const subject='每日研究报告 · '+day, heading=subject+'（北京时间）';
  const intro='计划事项：'+summaries.length+'；已核实完成：'+summaries.filter(x=>x.status==='completed').length+'。';
  const footer='已核实完成的报告均完整展示。未完成或无法核实正文的项目只显示状态；这不代表市场没有变化。原报告链接需要登录。';
  const rows=summaries.map(({status,localTime,link,evidenceDate,body},i)=>({
   label:(i+1)+'. '+localTime+' · '+(status==='completed'?'已完成':states[status])+'。',
   detail:link?'证据日期：'+(evidenceDate??'未记录')+'。':null,link,body,
  }));
  const text=[heading,intro,...rows.map(r=>[r.label,r.detail,r.link,r.body].filter(x=>x!==null).join('\n')),footer].join('\n\n');
  return {subject,text,html:renderFullDailyDigestHtml({subject:heading,intro,rows,footer}),count:rows.length};
 }
 const subject='每日研究摘要 · '+day;
 const text=[subject+'（北京时间）','',
  '计划事项：'+summaries.length+'；已核实完成：'+summaries.filter(x=>x.status==='completed').length+'。',
  ...summaries.map(({status,localTime,link,evidenceDate},i)=>
    (i+1)+'. '+localTime+' · '+states[status]+'。'+(link?' 证据日期：'+(evidenceDate??'未记录')+'。\n   '+link:'')),
  '', '这里只汇总执行情况；缺失或失败不代表市场或研究结论没有变化。链接需登录工作台。'].join('\n');
 return {subject,text,count:summaries.length};
}

async function read(root,file){
 let f;
 try{
  f=await open(join(root,file),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const s=await f.stat();
  if(!s.isFile()||s.size>32000)fail('DIGEST_LEDGER_INVALID');
  const {integrity,...r}=JSON.parse(await f.readFile('utf8'));
  if(integrity!==hash(JSON.stringify(r)))fail('DIGEST_LEDGER_INVALID');
  return r;
 }catch(error){if(error.code==='ENOENT')return null;throw error;}
 finally{await f?.close();}
}
async function write(root,file,r){
 try{await publishImmutable(root,file,Buffer.from(JSON.stringify({...r,integrity:hash(JSON.stringify(r))})));return true;}
 catch(error){if(error.code==='EEXIST')return false;throw error;}
}
async function inspect(root,key){
 let path;
 try{path=await safeDirectory(join(root,key));}catch(error){if(error.code==='ENOENT')return {status:'not-started'};throw error;}
 const frozen=await read(path,'digest.json');
 if(!frozen)return {status:'not-started'};
 if(frozen.schema!==SCHEMA||frozen.key!==key||
     (frozen.mode==='full-report'?frozen.subject!==undefined||frozen.text!==undefined||frozen.html!==undefined||!id(frozen.payloadSha256,/^[a-f0-9]{64}$/):
        frozen.mode!==undefined||frozen.payloadSha256!==hash(JSON.stringify([frozen.subject,frozen.text])))
     ||!id(frozen.idempotencyKey,/^[a-f0-9]{64}$/)||!id(frozen.destinationHash,/^[a-f0-9]{64}$/))fail('DIGEST_LEDGER_INVALID');
 const claim=await read(path,'claim.json');
 if(!claim)return {status:'not-started',frozen};
 if(claim.key!==key||claim.payloadSha256!==frozen.payloadSha256||claim.idempotencyKey!==frozen.idempotencyKey)fail('DIGEST_LEDGER_INVALID');
 const settlement=await read(path,'settlement.json');
 if(!settlement)return {status:'unknown',attempts:1};
 if(settlement.key!==key||!['accepted','unknown','not-dispatched'].includes(settlement.status)
    ||(settlement.status==='accepted'?!receiptId(settlement.receiptId):settlement.receiptId!==undefined))fail('DIGEST_LEDGER_INVALID');
 return {status:settlement.status,attempts:1};
}

export async function inspectDailyDigestEmail({projectDir,ownerId,date:day}){
 const state=await inspect(join(projectDir,'daily-digest-email'),dayKey(ownerId,day));
 return {status:state.status,attempts:state.attempts??0};
}

// resolveConfirmedDestination reads the current server confirmation, never a
// browser-controlled address. No attempt, including unknown, is retried here.
export function createDailyDigestHook({resolveConfirmedDestination,ownerOrigin,transport,readOriginal,mode='links-only'}){
 const origin=originFor(ownerOrigin),full=mode==='full-report';
 if(!MODES.includes(mode))fail('DIGEST_MODE_INVALID');
 if(typeof resolveConfirmedDestination!=='function'||typeof transport!=='function')fail('DIGEST_TRANSPORT_NOT_CONFIGURED');
 return async ({projectDir,ownerId,date:day,rows,signal})=>{
  const key=dayKey(ownerId,day),root=join(await safeDirectory(projectDir),'daily-digest-email');
  const previous=await inspect(root,key);
  if(previous.attempts)return {status:previous.status,attempts:1};
  const destinationSelector={projectDir,ownerId,date:day};
  const target=targetFor(await resolveConfirmedDestination(destinationSelector));
  if(!target||signal?.aborted)return {status:'not-configured',attempts:0};
  const destinationHash=hash(JSON.stringify([target.address,target.version,origin,...(full?[mode]:[])]));
  let plan=previous.frozen;
  const matchesTarget=p=>p?.destinationHash===destinationHash&&(full?p.mode===mode:p.mode===undefined);
  if(plan&&!matchesTarget(plan))return {status:'not-configured',attempts:0};
  const path=join(root,key);
  let payload;
  if(!plan||full){
   const {subject,text,html,count}=await composeDailyDigest({projectDir,date:day,rows,ownerOrigin:origin,readOriginal,mode});
   if(!count)return {status:'empty',attempts:0};
   payload={subject,text,...(full?{html}:{})};
   // Do not silently truncate the complete report. Reconstruct full payloads
   // from canonical History rather than persist another copy in the ledger.
   if(full&&Buffer.byteLength(JSON.stringify({to:target.address,...payload,idempotencyKey:'0'.repeat(64)}))>800000)
    return {status:'unavailable',attempts:0};
  }
  const payloadHash=p=>hash(JSON.stringify([p.subject,p.text,...(full?[p.html]:[])]));
  if(!plan){
   const payloadSha256=payloadHash(payload);
   const idempotencyKey=hash(JSON.stringify([SCHEMA,key,destinationHash,payloadSha256]));
   const next={schema:SCHEMA,key,...(full?{mode}:{subject:payload.subject,text:payload.text}),payloadSha256,idempotencyKey,destinationHash};
   await ensureSafeDirectory(path);
   await write(path,'digest.json',next);
   const state=await inspect(root,key);
   if(state.attempts)return {status:state.status,attempts:1};
   plan=state.frozen;
  }
  if(!matchesTarget(plan))return {status:'not-configured',attempts:0};
  if(full&&plan.payloadSha256!==payloadHash(payload))return {status:'unavailable',attempts:0};
  if(!full)payload={subject:plan.subject,text:plan.text};
  // Serialize claim before any possible external dispatch. Re-check opt-in
  // afterward; a crash during either gap is conservatively unknown.
  if(!await write(path,'claim.json',{key,payloadSha256:plan.payloadSha256,idempotencyKey:plan.idempotencyKey}))return inspectDailyDigestEmail({projectDir,ownerId,date:day});
  let status='not-dispatched',receipt;
  try{
   const fresh=targetFor(await resolveConfirmedDestination(destinationSelector));
   if(!signal?.aborted&&fresh?.address===target.address&&fresh.version===target.version){
    status='unknown';
    const outcome=await transport({to:target.address,...payload,idempotencyKey:plan.idempotencyKey});
    if(outcome?.status==='accepted'&&receiptId(outcome.receiptId)){status='accepted';receipt=outcome.receiptId;}
    else if(outcome?.status==='not-dispatched')status='not-dispatched';
   }
  }catch{/* retain unknown if transport started; do not expose adapter errors */}
  if(!await write(path,'settlement.json',{key,status,...(receipt===undefined?{}:{receiptId:receipt})}))fail('DIGEST_SETTLEMENT_CONFLICT');
  return {status,attempts:1};
 };
}
