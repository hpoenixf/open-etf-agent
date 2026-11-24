import { openDailyDigestSchedule } from './gui-daily-digest.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { lstat, chmod } from 'node:fs/promises';
import { ensureSafeDirectory } from './storage-files.mjs';

export const DAILY_TIME_ZONE='Asia/Shanghai';
const clock=new Intl.DateTimeFormat('sv-SE',{timeZone:DAILY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const zone=new Intl.DateTimeFormat('en',{timeZone:DAILY_TIME_ZONE,timeZoneName:'longOffset'});
const pickDay=now=>clock.format(now);
const watchId=/^w[0-9a-f]{24}$/;
const timeInput=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const statusMap=new Set(['submitted','completed','failed','cancelled','unknown']);
const reject=(status,code)=>{throw Object.assign(new Error(code),{status,code});};

export function dailySlot(now,localTime){
 const date=pickDay(now);
 const offset=zone.formatToParts(now).find(p=>p.type==='timeZoneName')?.value;
 if(!/^GMT[+-]\d\d:\d\d$/.test(offset)||!timeInput.test(localTime))reject(400,'GUI_DAILY_TIME_INVALID');
 return {date,instant:Date.parse(date+'T'+localTime+':00'+offset.slice(3))};
}

function watchInput(value){
 if(!value||Array.isArray(value)||!['enabled,localTime,question','emailEnabled,enabled,localTime,question','emailEnabled,enabled,localTime,question,requestId','enabled,localTime,question,requestId','digestEnabled,enabled,localTime,question','digestEnabled,enabled,localTime,question,requestId'].includes(Object.keys(value).sort().join(','))||
   value.digestEnabled!==undefined&&typeof value.digestEnabled!=='boolean'||
   value.emailEnabled!==undefined&&typeof value.emailEnabled!=='boolean'||
   value.requestId!==undefined&&(typeof value.requestId!=='string'||!watchId.test(value.requestId))||
   typeof value.localTime!=='string'||!timeInput.test(value.localTime)||typeof value.enabled!=='boolean'||
   typeof value.question!=='string'||!value.question.trim()||Buffer.byteLength(value.question)>12000||
   value.question.includes('\0')||Buffer.from(value.question).toString('utf8')!==value.question)reject(400,'GUI_DAILY_WATCH_INVALID');
 return value;
}
function show(row){
 return {id:row.id,question:row.question,localTime:row.local_time,timeZone:DAILY_TIME_ZONE,enabled:row.enabled===1,emailEnabled:row.email_enabled===1};
}
function occurrence(row){
 return {date:row.day,scheduledAt:new Date(row.instant).toISOString(),conversationId:row.conversation_id,messageId:row.message_id,
  runId:row.run_id,...(row.baseline?{baseline:JSON.parse(row.baseline)}:{}),emailStatus:row.email_state,status:row.status==='claimed'?'unknown':row.status};
}

export async function openGuiDailyWatch(projectDir,{now=Date.now}={}){
 const directory=await ensureSafeDirectory(join(projectDir,'gui-daily-watch'));
 const file=join(directory,'watch.sqlite');
 try{const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())reject(500,'GUI_DAILY_STORAGE_INVALID');}
 catch(error){if(error.code!=='ENOENT')throw error;}
 const db=new DatabaseSync(file);
 try{
  await chmod(file,0o600);
  db.exec(`PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS watch(id TEXT PRIMARY KEY,question TEXT NOT NULL,local_time TEXT NOT NULL,enabled INTEGER NOT NULL,after_ms INTEGER NOT NULL,email_enabled INTEGER NOT NULL,email_version TEXT,config_version TEXT,question_revision INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE IF NOT EXISTS occurrence(watch_id TEXT NOT NULL REFERENCES watch(id),day TEXT NOT NULL,instant INTEGER NOT NULL,question TEXT NOT NULL,conversation_id TEXT NOT NULL,message_id TEXT NOT NULL,run_id TEXT,status TEXT NOT NULL,email_state TEXT NOT NULL,email_version TEXT,question_revision INTEGER,baseline TEXT,PRIMARY KEY(watch_id,day));`);
  // 0.42 watch-v1 rows remain readable. Their earlier snapshots did not
  // freeze definition revisions, so they cannot confer baseline authority.
  db.exec('BEGIN IMMEDIATE');
  try{
   const watchColumns=new Set(db.prepare('PRAGMA table_info(watch)').all().map(x=>x.name));
   const occurrenceColumns=new Set(db.prepare('PRAGMA table_info(occurrence)').all().map(x=>x.name));
   if(!watchColumns.has('email_confirmed_at_ms'))db.exec('ALTER TABLE watch ADD COLUMN email_confirmed_at_ms INTEGER');
   if(!watchColumns.has('digest_version'))db.exec('ALTER TABLE watch ADD COLUMN digest_version TEXT');
   if(!watchColumns.has('question_revision'))db.exec('ALTER TABLE watch ADD COLUMN question_revision INTEGER NOT NULL DEFAULT 1');
   if(!occurrenceColumns.has('question_revision'))db.exec('ALTER TABLE occurrence ADD COLUMN question_revision INTEGER');
   if(!occurrenceColumns.has('baseline'))db.exec('ALTER TABLE occurrence ADD COLUMN baseline TEXT');
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }catch(error){db.close();throw error;}
 const byId=db.prepare('SELECT * FROM watch WHERE id=?');
 const latest=db.prepare('SELECT * FROM occurrence WHERE watch_id=? ORDER BY day DESC LIMIT 14');
 const pending=db.prepare("SELECT * FROM occurrence WHERE status IN ('claimed','submitted') ORDER BY day");
 return {
  digest:openDailyDigestSchedule(db,{now,dailySlot}),
  list:({emailVersion=null,configVersion=null,digestVersion=null}={})=>db.prepare('SELECT * FROM watch ORDER BY rowid').all().map(row=>({...show(row),
   digestEnabled:row.digest_version!=null,digestConfirmed:digestVersion!==null&&row.digest_version===digestVersion,
   emailConfirmed:emailVersion!==null&&row.email_version===emailVersion,requiresReview:row.enabled===1&&row.config_version!==configVersion,
   history:latest.all(row.id).map(occurrence)})),
  save(value,id,{emailVersion:confirmedVersion=null,configVersion=null,digestVersion:confirmedDigest=null,fullWatchEmail=false}={}){
   const {question,localTime,enabled,requestId}=watchInput(value),time=Number(now());
   let emailEnabled=value.emailEnabled,emailVersion=emailEnabled===true?confirmedVersion??null:null;
   let digestVersion=value.digestEnabled===true?confirmedDigest:null;
   if(id===undefined){
    emailEnabled??=false;
    id=requestId??'w'+randomUUID().replaceAll('-','').slice(0,24);
    db.prepare('INSERT OR IGNORE INTO watch (id,question,local_time,enabled,after_ms,email_enabled,email_version,config_version,digest_version,email_confirmed_at_ms) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,question,localTime,Number(enabled),time,Number(emailEnabled),emailVersion,configVersion,digestVersion,fullWatchEmail&&emailEnabled===true&&emailVersion?time:null);
    const saved=byId.get(id);
    if(saved.question!==question||saved.local_time!==localTime||saved.enabled!==Number(enabled)||saved.email_enabled!==Number(emailEnabled)||saved.email_version!==emailVersion||saved.config_version!==configVersion||saved.digest_version!==digestVersion)reject(409,'GUI_DAILY_ID_CONFLICT');
   }else{
    if(requestId!==undefined)reject(400,'GUI_DAILY_WATCH_INVALID');
    const before=watchId.test(id)&&byId.get(id);
    if(!before)reject(404,'NOT_FOUND');
    const emailConfirmedAt=value.emailEnabled===undefined?before.email_confirmed_at_ms:
     fullWatchEmail&&emailEnabled&&emailVersion?(before.email_enabled===1&&before.email_version===emailVersion?before.email_confirmed_at_ms??time:time):null;
    if(value.digestEnabled===undefined)digestVersion=before.digest_version;
    if(emailEnabled===undefined){emailEnabled=before.email_enabled===1;emailVersion=before.email_version;}
    if(before.local_time!==localTime||before.question!==question||before.enabled!==Number(enabled)||before.config_version!==configVersion)
     db.prepare('UPDATE watch SET question=?,local_time=?,enabled=?,after_ms=?,email_enabled=?,email_version=?,email_confirmed_at_ms=?,config_version=?,question_revision=question_revision+? WHERE id=?').run(question,localTime,Number(enabled),time,Number(emailEnabled),emailVersion,emailConfirmedAt,configVersion,Number(before.question!==question),id);
    else if(before.email_enabled!==Number(emailEnabled)||before.email_version!==emailVersion||before.email_confirmed_at_ms!==emailConfirmedAt)
     db.prepare('UPDATE watch SET email_enabled=?,email_version=?,email_confirmed_at_ms=? WHERE id=?').run(Number(emailEnabled),emailVersion,emailConfirmedAt,id);
    if(before.digest_version!==digestVersion)db.prepare('UPDATE watch SET digest_version=? WHERE id=?').run(digestVersion,id);
   }
   return show(byId.get(id));
  },
  claim(configVersion=null,{perWatchEmail=true,fullWatchEmail=false,emailVersion=null}={}){
   db.exec('BEGIN IMMEDIATE');
   try{
    const time=Number(now());
    for(const row of db.prepare('SELECT * FROM watch WHERE enabled=1 ORDER BY local_time,rowid').all()){
     const {date,instant}=dailySlot(time,row.local_time);
     // No catch-up for earlier calendar days or when first enabling/editing a
     // watch after the slot. Keep one occurrence identity even after edits.
     if(instant>time||instant<row.after_ms||row.config_version!==configVersion)continue;
     const conversationId='daily-'+row.id+'-'+date.slice(0,4),messageId='day-'+date;
     const emailAllowed=perWatchEmail&&row.email_enabled&&(!fullWatchEmail||(emailVersion!==null&&row.email_version===emailVersion&&row.email_confirmed_at_ms!==null&&row.email_confirmed_at_ms<=instant));
     const inserted=db.prepare("INSERT OR IGNORE INTO occurrence (watch_id,day,instant,question,conversation_id,message_id,run_id,status,email_state,email_version,question_revision) VALUES(?,?,?,?,?,?,NULL,'claimed',?,?,?)").run(row.id,date,instant,row.question,conversationId,messageId,emailAllowed?'pending':'off',row.email_version,row.question_revision);
     if(inserted.changes){db.exec('COMMIT');return {watchId:row.id,date,question:row.question,revision:row.question_revision,conversationId,messageId};}
    }
    db.exec('COMMIT');return null;
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  baselineCandidates({watchId:id,date,revision}){
   return db.prepare("SELECT day AS date,conversation_id AS conversationId,message_id AS messageId,run_id AS runId FROM occurrence WHERE watch_id=? AND day<? AND question_revision=? AND status='completed' ORDER BY day DESC").all(id,date,revision);
  },
  freezeBaseline({watchId:id,date},baseline){
   const encoded=JSON.stringify(baseline);
   const row=db.prepare('SELECT baseline FROM occurrence WHERE watch_id=? AND day=?').get(id,date);
   if(!row||row.baseline!==null&&row.baseline!==encoded)reject(500,'GUI_DAILY_BASELINE_CHANGED');
   db.prepare('UPDATE occurrence SET baseline=? WHERE watch_id=? AND day=? AND baseline IS NULL').run(encoded,id,date);
  },
  settlement({watchId:id,date},status,runId=null){
   if(!statusMap.has(status))reject(500,'GUI_DAILY_SETTLEMENT_INVALID');
   db.prepare("UPDATE occurrence SET status=?, run_id=COALESCE(run_id,?) WHERE watch_id=? AND day=? AND status IN ('claimed','submitted')").run(status,runId,id,date);
  },
  emailConfirmed(id,date,version,{fullWatchEmail=false}={}){
   const binding=db.prepare("SELECT o.email_version AS old,w.email_version AS current,w.enabled,w.email_confirmed_at_ms AS consentAt,o.instant FROM occurrence o JOIN watch w ON w.id=o.watch_id WHERE o.watch_id=? AND o.day=? AND o.status='completed' AND o.email_state='pending' AND w.email_enabled=1").get(id,date);
   return version!==null&&binding?.old===version&&binding.current===version&&
    (!fullWatchEmail||(binding.enabled===1&&binding.consentAt!==null&&binding.consentAt<=binding.instant));
  },
  pendingEmail:()=>db.prepare("SELECT * FROM occurrence WHERE status='completed' AND email_state='pending' ORDER BY day LIMIT 8").all().map(row=>{
   const label=/^(?:【(早报|晚报)】|(早报|晚报)(?:[：:]|\r?\n|$))/u.exec(row.question);
   return {...occurrence(row),watchId:row.watch_id,...(label?{briefLabel:label[1]??label[2]}:{})};
  }),
  emailSettlement({watchId:id,date},state){
   if(!['accepted','not-dispatched','unknown','unavailable'].includes(state))reject(500,'GUI_DAILY_EMAIL_SETTLEMENT_INVALID');
   db.prepare("UPDATE occurrence SET email_state=? WHERE watch_id=? AND day=? AND email_state='pending'").run(state,id,date);
  },
  pending:()=>pending.all().map(row=>({...occurrence(row),watchId:row.watch_id})),
  close:()=>db.close(),
 };
}
