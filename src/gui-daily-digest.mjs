// Persistent control plane for one Owner digest slot. No model or mail provider
// is called here. SQLite claims the local-day identity and freezes its rows.
const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const fail=(status,code)=>{throw Object.assign(new Error(code),{status,code});};

export function openDailyDigestSchedule(db,{now,dailySlot}){
 db.exec(`
  CREATE TABLE IF NOT EXISTS digest_config(id INTEGER PRIMARY KEY CHECK(id=1),local_time TEXT NOT NULL,enabled INTEGER NOT NULL,after_ms INTEGER NOT NULL,recipient_version TEXT);
  CREATE TABLE IF NOT EXISTS digest_day(day TEXT PRIMARY KEY,instant INTEGER NOT NULL,status TEXT NOT NULL,recipient_version TEXT NOT NULL,rows_json TEXT NOT NULL);
 `);
 const config=()=>db.prepare('SELECT * FROM digest_config WHERE id=1').get();
 function describe(version){
  const row=config();
  return {localTime:row?.local_time??null,enabled:row?.enabled===1,requiresConfirmation:row?.enabled===1&&version!==row.recipient_version,
   history:db.prepare('SELECT day,status FROM digest_day ORDER BY day DESC LIMIT 14').all().map(x=>({date:x.day,status:x.status==='claimed'?'unknown':x.status}))};
 }
 return {
  describe,
  save(input,recipientVersion){
   if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='enabled,localTime'||
     typeof input.enabled!=='boolean'||typeof input.localTime!=='string'||!time.test(input.localTime))fail(400,'GUI_DIGEST_INVALID');
   if(input.enabled&&!recipientVersion)fail(409,'GUI_DIGEST_NOT_CONFIGURED');
   const old=config(),enabled=Number(input.enabled),version=input.enabled?recipientVersion:null;
   if(!old||old.local_time!==input.localTime||old.enabled!==enabled||old.recipient_version!==version)
    db.prepare('INSERT INTO digest_config VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET local_time=excluded.local_time,enabled=excluded.enabled,after_ms=excluded.after_ms,recipient_version=excluded.recipient_version')
      .run(input.localTime,enabled,Number(now()),version);
   return describe(recipientVersion);
  },
  confirmed(date,recipientVersion){
   const current=config(),day=db.prepare('SELECT * FROM digest_day WHERE day=?').get(date);
   if(current?.enabled!==1||recipientVersion==null||current.recipient_version!==recipientVersion||
    day?.recipient_version!==recipientVersion||day.status!=='claimed'||day.instant<current.after_ms)return false;
   const lookup=db.prepare('SELECT digest_version FROM watch WHERE id=?');
   return JSON.parse(day.rows_json).every(row=>lookup.get(row.watchId)?.digest_version===recipientVersion);
  },
  claim(recipientVersion,profileVersion,autorun){
   db.exec('BEGIN IMMEDIATE');
   try{
    const finish=value=>{db.exec('COMMIT');return value;};
    const setting=config();
    if(!setting?.enabled||!recipientVersion||setting.recipient_version!==recipientVersion)return finish(null);
    const current=Number(now()),{date,instant}=dailySlot(current,setting.local_time);
    if(instant>current||instant<setting.after_ms||db.prepare('SELECT 1 FROM digest_day WHERE day=?').get(date))return finish(null);
    const rows=db.prepare(`SELECT w.id,w.local_time,w.enabled,w.config_version,w.after_ms,
     o.status,o.conversation_id,o.message_id,o.run_id
     FROM watch w LEFT JOIN occurrence o ON o.watch_id=w.id AND o.day=?
     WHERE w.digest_version=? ORDER BY w.local_time,w.rowid`).all(date,recipientVersion).map(x=>{
      const start=dailySlot(current,x.local_time).instant;
      let status=x.status;
      if(status==='claimed')status='unknown';
      if(!status)status=!x.enabled||!autorun||x.config_version!==profileVersion||start<x.after_ms?'not-run':start>current?'not-run':'pending';
      const row={watchId:x.id,localTime:x.local_time,status};
      if(status==='completed'){
       if(x.conversation_id&&x.message_id&&x.run_id)Object.assign(row,{conversationId:x.conversation_id,messageId:x.message_id,runId:x.run_id});
       else row.status='missing';
      }
      return row;
     });
    db.prepare("INSERT INTO digest_day VALUES(?,?,'claimed',?,?)").run(date,instant,recipientVersion,JSON.stringify(rows));
    return finish({date,rows});
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  settle(date,status){
   if(!['accepted','not-dispatched','unknown','unavailable','empty'].includes(status))fail(500,'GUI_DIGEST_SETTLEMENT_INVALID');
   db.prepare("UPDATE digest_day SET status=? WHERE day=? AND status='claimed'").run(status,date);
  },
  pending:()=>db.prepare("SELECT day AS date FROM digest_day WHERE status='claimed' ORDER BY day DESC").all(),
 };
}
