import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { lstatSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureSafeDirectory } from './storage-files.mjs';
import { projectProviderProtocolDiagnostic } from './gateway.mjs';
import { projectModelReservation } from './runtime.mjs';

const APP_ID = 0x4f454144;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const active = "('admitted','dispatched','unknown')";
const reservationId = ({ rootId, modelOrdinal }) => createHash('sha256').update(JSON.stringify([rootId, 'model', modelOrdinal])).digest('hex');
function reserved(session, runId, initial = false) {
  const value = session.inspect(runId);
  if (!value || value.runId !== runId || typeof value.rootId !== 'string' || typeof value.owner !== 'string'
    || !Number.isSafeInteger(value.fence) || value.fence < 1) fail('ADMISSION_RESERVATION_REQUIRED');
  const round = value.snapshot?.rounds;
  if (initial && (value.status !== 'active' || value.rootStatus !== 'active' || value.snapshot?.phase !== 'model-reserved'
    || value.snapshot.purpose !== undefined || !Number.isSafeInteger(round) || round < 1 || value.rootUsage?.model < 1)) fail('ADMISSION_RESERVATION_REQUIRED');
  return { rootId: value.rootId, runId, round, owner: value.owner, fence: value.fence, leaseUntil: value.leaseUntil };
}

// One local capacity group, not a provider registry or a billing owner.
// A dispatched request stays occupied until its original Gateway returns.
export async function createSharedAdmission({ directory, routeId, maxQueue = 8, pollMs = 20, queueTimeoutMs = 30000 }) {
  if (typeof routeId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(routeId)
    || !Number.isSafeInteger(maxQueue) || maxQueue < 1 || maxQueue > 64
    || !Number.isSafeInteger(pollMs) || pollMs < 1 || pollMs > 1000
    || !Number.isSafeInteger(queueTimeoutMs) || queueTimeoutMs < 1 || queueTimeoutMs > 300000) fail('INVALID_ADMISSION_CONFIG');
  const root = await ensureSafeDirectory(directory);
  const filename = join(root, 'admission.sqlite');
  for (const path of [filename, `${filename}-journal`, `${filename}-wal`, `${filename}-shm`]) {
    try { const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('UNSAFE_ADMISSION_FILE'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  try { closeSync(openSync(filename, 'wx', 0o600)); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA busy_timeout=1000');
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  try {
    transaction(() => {
      const app = db.prepare('PRAGMA application_id').get().application_id;
      if (app === 0 && db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().n === 0) {
        db.exec(`PRAGMA application_id=${APP_ID};
          CREATE TABLE capacity (id INTEGER PRIMARY KEY CHECK(id=1), route_id TEXT NOT NULL, max_queue INTEGER NOT NULL) STRICT;
          CREATE TABLE requests (sequence INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL UNIQUE, reservation_id TEXT NOT NULL UNIQUE, root_id TEXT NOT NULL, run_id TEXT NOT NULL, model_ordinal INTEGER NOT NULL, round INTEGER NOT NULL, input_hash TEXT NOT NULL, owner TEXT NOT NULL, fence INTEGER NOT NULL, deadline_at INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','admitted','dispatched','completed','cancelled','unknown')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;`);
        db.prepare('INSERT INTO capacity VALUES (1,?,?)').run(routeId, maxQueue);
      } else if (app !== APP_ID) fail('FOREIGN_ADMISSION_DATABASE');
      const group = db.prepare('SELECT route_id,max_queue FROM capacity WHERE id=1').get();
      if (group?.route_id !== routeId || group?.max_queue !== maxQueue) fail('ADMISSION_GROUP_MISMATCH');
    });
  } catch (error) { db.close(); throw error; }

  const transition = (requestId, reservation, from, to) => transaction(() => {
    const result = db.prepare(`UPDATE requests SET state=?,updated_at=? WHERE request_id=? AND state=? AND owner=? AND fence=? AND reservation_id=?${to === 'dispatched' ? ' AND deadline_at>?' : ''}`)
      .run(to, Date.now(), requestId, from, reservation.owner, reservation.fence, reservationId(reservation), ...(to === 'dispatched' ? [Date.now()] : []));
    if (result.changes !== 1 && !(to === 'cancelled' && db.prepare('SELECT state FROM requests WHERE request_id=?').get(requestId)?.state === 'cancelled')) fail('ADMISSION_STATE_CONFLICT');
  });
  // Only work proven not dispatched expires. Unknown remote work has no TTL.
  const expireWaiting = () => db.prepare("UPDATE requests SET state='cancelled',updated_at=? WHERE state IN ('queued','admitted') AND deadline_at<=?").run(Date.now(), Date.now());
  const enqueue = reservation => transaction(() => {
    expireWaiting();
    const identity = reservationId(reservation);
    const existing = db.prepare('SELECT request_id FROM requests WHERE reservation_id=?').get(identity);
    if (existing) throw Object.assign(new Error('ADMISSION_ALREADY_RECORDED'), { code: 'ADMISSION_ALREADY_RECORDED', ticketId: existing.request_id });
    if (db.prepare("SELECT count(*) AS n FROM requests WHERE state='queued'").get().n >= maxQueue) fail('ADMISSION_QUEUE_FULL');
    const requestId = randomUUID(); const now = Date.now();
    db.prepare("INSERT INTO requests(request_id,reservation_id,root_id,run_id,model_ordinal,round,input_hash,owner,fence,deadline_at,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'queued',?,?)")
      .run(requestId, identity, reservation.rootId, reservation.runId, reservation.modelOrdinal, reservation.round, reservation.inputHash, reservation.owner, reservation.fence, now + queueTimeoutMs, now, now);
    return { requestId, deadline: now + queueTimeoutMs };
  });
  const acquire = requestId => transaction(() => {
    expireWaiting();
    if (db.prepare(`SELECT count(*) AS n FROM requests WHERE state IN ${active}`).get().n !== 0) return false;
    const first = db.prepare("SELECT request_id FROM requests WHERE state='queued' ORDER BY sequence LIMIT 1").get();
    if (first?.request_id !== requestId) return false;
    db.prepare("UPDATE requests SET state='admitted',updated_at=? WHERE request_id=? AND state='queued'").run(Date.now(), requestId);
    return true;
  });
  const row = ticketId => db.prepare('SELECT sequence,request_id AS ticketId,reservation_id AS reservationId,root_id AS rootId,run_id AS runId,model_ordinal AS modelOrdinal,round,input_hash AS inputHash,owner,fence,deadline_at AS deadlineAt,state,created_at AS createdAt,updated_at AS updatedAt FROM requests WHERE request_id=?').get(ticketId) ?? null;
  return {
    snapshot() { return { routeId, capacity: 1, maxQueue, requests: db.prepare('SELECT request_id FROM requests ORDER BY sequence').all().map(x => row(x.request_id)) }; },
    inspect(ticketId) { return row(ticketId); },
    inspectReservation(identity) { const value = db.prepare('SELECT request_id FROM requests WHERE reservation_id=?').get(reservationId(identity)); return value ? row(value.request_id) : null; },
    close() { db.close(); },
    wrap(gateway, { session, runId }) {
      if (typeof gateway?.next !== 'function' || typeof session?.inspect !== 'function') fail('INVALID_ADMISSION_GATEWAY');
      return {
        mode: gateway.mode,
        admission: 'shared-admission@1',
        async next(input) {
          const signal = input?.signal;
          signal?.throwIfAborted();
          const reservation = projectModelReservation(input?.reservation);
          if (!reservation || reservation.runId !== runId) fail('ADMISSION_RESERVATION_REQUIRED');
          const original = reserved(session, runId, true);
          if (original.rootId !== reservation.rootId || original.round !== reservation.round
            || original.owner !== reservation.owner || original.fence !== reservation.fence
            || session.inspect(runId).snapshot.working?.hash !== reservation.inputHash
            || createHash('sha256').update(JSON.stringify(input.messages)).digest('hex') !== reservation.inputHash) fail('ADMISSION_RESERVATION_MISMATCH');
          const { requestId, deadline } = enqueue(reservation);
          const currentFence = (dispatch = false) => {
            const current = reserved(session, runId, dispatch);
            if (current.owner !== reservation.owner || current.fence !== reservation.fence
              || dispatch && (current.leaseUntil <= Date.now() || current.round !== reservation.round
                || session.inspect(runId).snapshot.working?.hash !== reservation.inputHash)) fail('ADMISSION_FENCE_STALE');
          };
          try {
            for (;;) {
              signal?.throwIfAborted();
              if (Date.now() >= deadline) fail('ADMISSION_QUEUE_TIMEOUT');
              if (acquire(requestId)) break;
              await delay(pollMs, undefined, { signal });
            }
          } catch (error) { transition(requestId, reservation, 'queued', 'cancelled'); throw error; }
          // Cancellation before dispatch is known not to have reached the provider.
          try { signal?.throwIfAborted(); currentFence(true); }
          catch (error) { transition(requestId, reservation, 'admitted', 'cancelled'); throw error; }
          transition(requestId, reservation, 'admitted', 'dispatched');
          try {
            const result = await gateway.next(input);
            currentFence();
            transition(requestId, reservation, 'dispatched', 'completed');
            return result;
          } catch (error) {
            // Only the original Gateway's branded complete finish is termination evidence.
            // A caller-invented error.code or local AbortSignal is never such evidence.
            const diagnostic = projectProviderProtocolDiagnostic(error);
            let terminal = diagnostic?.reason === 'NON_SUCCESS_FINISH' && diagnostic.hashScope === 'complete-body';
            try { currentFence(); } catch { terminal = false; }
            transition(requestId, reservation, 'dispatched', terminal ? (diagnostic.finishKind === 'aborted' ? 'cancelled' : 'completed') : 'unknown');
            throw error;
          }
        }
      };
    }
  };
}
