import {mkdir,lstat,open} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {safeDirectory} from './storage-files.mjs';

export const receiptRetentionMs=7*24*60*60*1000;
const hour=60*60*1000,maxReceipts=50000;
const validTime=n=>Number.isSafeInteger(n)&&n>0;
const validId=s=>typeof s==='string'&&/^[0-9a-f]{32}$/.test(s);
const fileFor=async projectDir=>{
  const dir=join(await safeDirectory(projectDir),'jaeger-export');
  let created=false;
  try{await mkdir(dir,{mode:0o700});created=true;}
  catch(e){if(e.code!=='EEXIST')throw e;}
  await safeDirectory(dir);
  const file=join(dir,'receipts.sqlite');
  const accepted=s=>(!process.getuid||s.uid===process.getuid())&&(s.mode&0o077)===0;
  if(!accepted(await lstat(dir)))throw new Error('insecure telemetry directory');
  // A missing database in an existing telemetry directory is loss, not a new
  // installation. Never silently recreate it and lose the replay horizon.
  if(created){const handle=await open(file,'wx',0o600);await handle.close();}
  else if(!(await lstat(file)).size)throw new Error('empty telemetry store');
  for(const name of [file,file+'-journal',file+'-wal',file+'-shm']){
    const stat=await lstat(name).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
    if(stat&&(!stat.isFile()||stat.nlink!==1||!accepted(stat)))throw new Error('insecure telemetry store');
  }
  return file;
};
function inStore(file,time,act){
  if(!validTime(time))throw new Error('invalid telemetry clock');
  const db=new DatabaseSync(file);
  try{
    db.exec(`PRAGMA secure_delete=ON; PRAGMA auto_vacuum=INCREMENTAL; BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS clock (id INTEGER PRIMARY KEY CHECK (id=1), started INTEGER NOT NULL, high INTEGER NOT NULL, swept INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS receipt (trace_id TEXT PRIMARY KEY, recorded INTEGER NOT NULL, state TEXT NOT NULL) STRICT;
      CREATE INDEX IF NOT EXISTS receipt_age ON receipt(recorded);`);
    db.prepare('INSERT OR IGNORE INTO clock VALUES (1,?,?,0)').run(time,time);
    const prior=db.prepare('SELECT started,high,swept FROM clock WHERE id=1').get(),high=Math.max(prior.high,time);
    if(!validTime(prior.started)||!validTime(prior.high)||prior.started>prior.high||(prior.swept!==0&&!validTime(prior.swept))||prior.swept>prior.high)throw new Error('invalid telemetry clock state');
    db.prepare('UPDATE clock SET high=? WHERE id=1').run(high);
    const sweeps=act===null||high-prior.swept>=hour;
    if(sweeps){
      db.prepare('DELETE FROM receipt WHERE recorded<=?').run(high-receiptRetentionMs);
      db.prepare('UPDATE clock SET swept=? WHERE id=1').run(high);
    }
    const result=act?.(db,{trusted:time===high,started:prior.started,high});
    db.exec('COMMIT');if(sweeps)db.exec('PRAGMA incremental_vacuum(256)');return result;
  }finally{db.close();}
}
export function jaegerReceipts(now){
  return {
    async sweep(dir){const path=await fileFor(dir);inStore(path,now(),null);},
    async begin(dir,traceId,admittedAt){
      if(!validId(traceId)||!validTime(admittedAt))return false;
      const path=await fileFor(dir);
      return inStore(path,now(),(db,{trusted,started,high})=>{
        // Age uses the frozen admitted run definition, never the current observation's
        // time. Advancing the water mark happens in the same transaction as purging.
        if(!trusted||admittedAt<started||admittedAt>high||admittedAt<=high-receiptRetentionMs)return false;
        if(db.prepare('SELECT count(*) n FROM receipt').get().n>=maxReceipts)return false;
        return db.prepare("INSERT OR IGNORE INTO receipt VALUES (?,?,'unknown')").run(traceId,high).changes===1;
      });
    },
    async settle(dir,traceId,state){
      if(!validId(traceId)||!['transport-accepted','rejected','partial'].includes(state))return;
      const path=await fileFor(dir);
      inStore(path,now(),(db,{high})=>{
        db.prepare("UPDATE receipt SET state=? WHERE trace_id=? AND state='unknown' AND recorded>?")
          .run(state,traceId,high-receiptRetentionMs);
      });
    },
  };
}
