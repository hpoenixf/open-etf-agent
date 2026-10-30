import { DatabaseSync } from 'node:sqlite';
import { openSession } from '../../src/session.mjs';
const [mode, directory, rawHold] = process.argv.slice(2);
if (mode === 'lock') {
 const hold = Number(rawHold); if (!Number.isInteger(hold) || hold < 50 || hold > 2000) throw new Error('Invalid synthetic hold');
 const db = new DatabaseSync(directory + '/session.sqlite'); db.exec('BEGIN EXCLUSIVE'); process.send?.({ kind: 'locked' });
 process.once('message', () => setTimeout(() => { db.exec('ROLLBACK'); db.close(); process.send?.({ kind: 'released' }); process.disconnect(); }, hold));
} else if (mode === 'spill') {
 const db = new DatabaseSync(directory + '/session.sqlite');
 db.exec('PRAGMA cache_size=1; PRAGMA synchronous=FULL; BEGIN IMMEDIATE; CREATE TABLE interrupted(payload BLOB); INSERT INTO interrupted VALUES(zeroblob(2097152))');
 process.send?.({ kind: 'spilled' }); setInterval(() => {}, 1000);
} else if (mode === 'open') {
 process.send?.({ kind: 'ready' });
 process.once('message', async () => {
  try { const store = await openSession({ directory }); store.close(); process.send?.({ kind: 'opened', ok: true }); }
  catch (error) { process.send?.({ kind: 'opened', ok: false, code: error.code, errcode: error.errcode, path: error.path, causeCode: error.cause?.code, causeErrcode: error.cause?.errcode }); }
  process.disconnect();
 });
} else throw new Error('Unknown synthetic fixture mode');
