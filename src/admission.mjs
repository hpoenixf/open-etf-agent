import {withTerminalAdmissionOwner,revokeActiveAdmissionOwner,fenceExpiredAdmissionOwner} from './session.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { lstatSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureSafeDirectory, safeDirectory } from './storage-files.mjs';
import { projectProviderProtocolDiagnostic } from './gateway.mjs';
import { projectModelReservation } from './runtime.mjs';

const APP_ID = 0x4f454144;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
const active = "('admitted','dispatched','unknown')";
const reservationId = ({ rootId, modelOrdinal }) => createHash('sha256').update(JSON.stringify([rootId, 'model', modelOrdinal])).digest('hex');
function reserved(session, runId, initial = false) {
  const value = session.inspect(runId);
  if (!value || value.runId !== runId || typeof value.rootId !== 'string' || typeof value.owner !== 'string'
    || !Number.isSafeInteger(value.fence) || value.fence < 1) fail('ADMISSION_RESERVATION_REQUIRED');
  const round = value.snapshot?.rounds;
  const purpose = value.snapshot?.purpose;
  const input = purpose === 'compaction' ? value.snapshot.summaryRequest : value.snapshot?.working;
  if (purpose !== undefined && purpose !== 'compaction') fail('ADMISSION_RESERVATION_REQUIRED');
  if (purpose === 'compaction' && (input?.schemaVersion !== 'summary-request@1'
    || !Array.isArray(input.messages) || input.hash !== createHash('sha256').update(JSON.stringify(input.messages)).digest('hex'))) fail('ADMISSION_RESERVATION_MISMATCH');
  if (initial && (value.status !== 'active' || value.rootStatus !== 'active' || value.snapshot?.phase !== 'model-reserved'
    || !Number.isSafeInteger(round) || round < (purpose === 'compaction' ? 0 : 1) || value.rootUsage?.model < 1)) fail('ADMISSION_RESERVATION_REQUIRED');
  return { rootId: value.rootId, runId, round, purpose, inputHash: input?.hash, owner: value.owner, fence: value.fence, leaseUntil: value.leaseUntil };
}

// One local capacity group, not a provider registry or a billing owner.
// A dispatched request stays occupied until its original Gateway returns.
export async function createSharedAdmission({ directory, routeId, maxQueue = 8, pollMs = 20, queueTimeoutMs = 30000, readOnly = false, existingOnly = false }) {
  if (typeof readOnly !== 'boolean' || typeof existingOnly !== 'boolean' || typeof routeId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(routeId)
    || !Number.isSafeInteger(maxQueue) || maxQueue < 1 || maxQueue > 64
    || !Number.isSafeInteger(pollMs) || pollMs < 1 || pollMs > 1000
    || !Number.isSafeInteger(queueTimeoutMs) || queueTimeoutMs < 1 || queueTimeoutMs > 300000) fail('INVALID_ADMISSION_CONFIG');
  const root = await (readOnly || existingOnly ? safeDirectory(directory) : ensureSafeDirectory(directory));
  const filename = join(root, 'admission.sqlite');
  for (const path of [filename, `${filename}-journal`, `${filename}-wal`, `${filename}-shm`]) {
    try { const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('UNSAFE_ADMISSION_FILE'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; if (existingOnly && path === filename) fail('ADMISSION_OWNER_MISSING'); }
  }
  if (!readOnly && !existingOnly) { try { closeSync(openSync(filename, 'wx', 0o600)); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
  const db = new DatabaseSync(filename, {readOnly});
  if (readOnly) db.exec('PRAGMA query_only=ON');
  db.exec('PRAGMA busy_timeout=1000');
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  try {
    const initialize = () => {
      const app = db.prepare('PRAGMA application_id').get().application_id;
      if (!readOnly && !existingOnly && app === 0 && db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().n === 0) {
        db.exec(`PRAGMA application_id=${APP_ID};
          CREATE TABLE capacity (id INTEGER PRIMARY KEY CHECK(id=1), route_id TEXT NOT NULL, max_queue INTEGER NOT NULL) STRICT;
          CREATE TABLE requests (sequence INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL UNIQUE, reservation_id TEXT NOT NULL UNIQUE, root_id TEXT NOT NULL, run_id TEXT NOT NULL, model_ordinal INTEGER NOT NULL, round INTEGER NOT NULL, input_hash TEXT NOT NULL, owner TEXT NOT NULL, fence INTEGER NOT NULL, deadline_at INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','admitted','dispatched','completed','cancelled','unknown')), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;`);
        db.prepare('INSERT INTO capacity VALUES (1,?,?)').run(routeId, maxQueue);
      } else if (app !== APP_ID) fail('FOREIGN_ADMISSION_DATABASE');
      const group = db.prepare('SELECT route_id,max_queue FROM capacity WHERE id=1').get();
      if (group?.route_id !== routeId || group?.max_queue !== maxQueue) fail('ADMISSION_GROUP_MISMATCH');
    };
    if(readOnly) initialize(); else transaction(initialize);
  } catch (error) { db.close(); throw error; }

  const hasReleaseTable=()=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='local_releases'").get());
  const releaseFor=ticketId=>hasReleaseTable()?db.prepare('SELECT * FROM local_releases WHERE ticket_id=?').get(ticketId):null;
  const identityFor=ticket=>({routeId,...Object.fromEntries(['ticketId','reservationId','rootId','runId','modelOrdinal','inputHash','owner','fence'].map(k=>[k,ticket[k]]))});
  const validateRelease=(ticket,record)=>{
    if(!record)return null;
    let e;try{e=JSON.parse(record.event);}catch{fail('ADMISSION_RELEASE_CORRUPT');}
    const automatic=e?.policy==='two-hour-local-release@1';
    const fields=[...(automatic?['expiry']:[]),'schemaVersion','policy','operationId','identity','expectedTicketSha256','reason','acknowledgements','terminalProof','releasedAt','remoteOutcome','businessOutcome','billingOutcome','refund','replay'];
    if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).sort().join(',')!==fields.sort().join(',')||!ticket||ticket.state!=='unknown'||e.schemaVersion!=='admission-local-release@1'||!['manual-local-release','two-hour-local-release@1'].includes(e.policy)||record.ticket_id!==ticket.ticketId||record.operation_id!==e.operationId||typeof e.operationId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(e.operationId)||typeof e.reason!=='string'||!e.reason.trim()||Buffer.byteLength(e.reason)>1000||canonical(e.identity)!==canonical(identityFor(ticket))||e.expectedTicketSha256!==digest({routeId,...ticket})||canonical(e.acknowledgements)!==canonical({preserveUnknown:true,noReplay:true,noRefund:true})||e.remoteOutcome!=='unknown'||e.businessOutcome!=='unknown'||e.billingOutcome!=='unknown'||e.refund!==false||e.replay!==false||!Number.isSafeInteger(e.releasedAt)||e.releasedAt<1)fail('ADMISSION_RELEASE_CORRUPT');
    const p=e.terminalProof;if(!p||Object.keys(p).sort().join(',')!==['runId','rootId','fence','modelOrdinal','snapshotSha256','status','rootStatus','leaseUntil','gatewayOutcome'].sort().join(',')||p.runId!==ticket.runId||p.rootId!==ticket.rootId||p.fence!==ticket.fence||p.modelOrdinal!==ticket.modelOrdinal||!['completed','failed','cancelled'].includes(p.status)||!['completed','failed','cancelled'].includes(p.rootStatus)||p.leaseUntil!==0||p.gatewayOutcome!=='unknown'||typeof p.snapshotSha256!=='string'||!/^[a-f0-9]{64}$/.test(p.snapshotSha256))fail('ADMISSION_RELEASE_CORRUPT');
    if(automatic){const x=e.expiry;if(!x||Object.keys(x).sort().join(',')!==['origin','createdAt','dueAt','observedAt'].sort().join(',')||x.origin!=='createdAt-includes-queue'||!Number.isSafeInteger(x.createdAt)||x.createdAt<1||!Number.isSafeInteger(x.dueAt)||x.dueAt<1||x.createdAt!==ticket.createdAt||x.dueAt!==ticket.createdAt+7200000||!Number.isSafeInteger(x.observedAt)||x.observedAt<=x.dueAt||e.releasedAt!==x.observedAt||e.operationId!=='two-hour-'+digest({routeId,ticketId:ticket.ticketId,createdAt:ticket.createdAt}))fail('ADMISSION_RELEASE_CORRUPT');}
    const intent=Object.fromEntries(['operationId','identity','expectedTicketSha256','reason','acknowledgements',...(automatic?['policy','expiry']:[])].map(k=>[k,e[k]]));if(record.intent_hash!==digest(intent))fail('ADMISSION_RELEASE_CORRUPT');return e;
  };
  const hasStopTable=()=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='expiry_stops'").get());
  const stopFor=ticket=>{
    const record=hasStopTable()?db.prepare('SELECT * FROM expiry_stops WHERE ticket_id=?').get(ticket.ticketId):null;if(!record)return null;
    let event;try{event=JSON.parse(record.event);}catch{fail('ADMISSION_STOP_CORRUPT');}
    const original=event?.ticket;const stable=value=>Object.fromEntries(Object.entries(value??{}).filter(([k])=>!['state','updatedAt'].includes(k)));
    if(!event||Object.keys(event).sort().join(',')!==['schemaVersion','policy','ticket','originalTicketSha256','createdAt','dueAt','observedAt','localEffect','remoteOutcome'].sort().join(',')||event.schemaVersion!=='admission-expiry-stop@1'||event.policy!=='two-hour-local-revocation@1'||event.localEffect!=='logical-adoption-revocation'||event.remoteOutcome!=='unknown'||record.ticket_id!==ticket.ticketId||record.event_hash!==digest(event)||!original||original.state!=='dispatched'||ticket.state!=='unknown'||canonical(stable(original))!==canonical(stable(ticket))||event.originalTicketSha256!==digest({routeId,...original})||event.createdAt!==ticket.createdAt||!Number.isSafeInteger(event.createdAt)||event.createdAt<1||!Number.isSafeInteger(event.dueAt)||event.dueAt!==event.createdAt+7200000||!Number.isSafeInteger(event.observedAt)||event.observedAt<=event.dueAt)fail('ADMISSION_STOP_CORRUPT');return event;
  };
  const revokeExpired=(session,ticketId,observedAt)=>{
    const ticket=row(ticketId);if(!ticket||ticket.state!=='dispatched')fail('ADMISSION_STOP_STATE');
    if(!Number.isSafeInteger(observedAt)||!Number.isSafeInteger(ticket.createdAt)||ticket.createdAt<1||!Number.isSafeInteger(ticket.createdAt+7200000)||observedAt<=ticket.createdAt+7200000)fail('ADMISSION_STOP_NOT_DUE');
    return revokeActiveAdmissionOwner(session,ticket,()=>transaction(()=>{
      const current=row(ticketId);if(canonical(current)!==canonical(ticket))fail('ADMISSION_STOP_CAS');
      const prior=stopFor(current);if(prior)return prior;
      if(!hasStopTable())db.exec('CREATE TABLE expiry_stops (ticket_id TEXT PRIMARY KEY REFERENCES requests(request_id),event_hash TEXT NOT NULL,event TEXT NOT NULL) STRICT');
      const event={schemaVersion:'admission-expiry-stop@1',policy:'two-hour-local-revocation@1',ticket:current,originalTicketSha256:digest({routeId,...current}),createdAt:current.createdAt,dueAt:current.createdAt+7200000,observedAt,localEffect:'logical-adoption-revocation',remoteOutcome:'unknown'};
      db.prepare('INSERT INTO expiry_stops VALUES (?,?,?)').run(ticketId,digest(event),canonical(event));
      db.prepare("UPDATE requests SET state='unknown',updated_at=? WHERE request_id=? AND state='dispatched'").run(observedAt,ticketId);return event;
    }));
  };
  const activeCount=()=>{
    if(hasStopTable())for(const x of db.prepare('SELECT ticket_id FROM expiry_stops').all()){const ticket=row(x.ticket_id);if(!ticket)fail('ADMISSION_STOP_CORRUPT');stopFor(ticket);}
    if(!hasReleaseTable())return db.prepare(`SELECT count(*) AS n FROM requests WHERE state IN ${active}`).get().n;
    const releases=db.prepare('SELECT * FROM local_releases').all();const released=new Set();for(const r of releases){validateRelease(row(r.ticket_id),r);released.add(r.ticket_id);}
    return db.prepare(`SELECT request_id,state FROM requests WHERE state IN ${active}`).all().filter(r=>!(r.state==='unknown'&&released.has(r.request_id))).length;
  };
  const transition = (requestId, reservation, from, to) => transaction(() => {
    const original=row(requestId);if(original&&stopFor(original))fail('ADMISSION_EXPIRED_LOCAL');
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
    if (activeCount() !== 0) return false;
    const first = db.prepare("SELECT request_id FROM requests WHERE state='queued' ORDER BY sequence LIMIT 1").get();
    if (first?.request_id !== requestId) return false;
    db.prepare("UPDATE requests SET state='admitted',updated_at=? WHERE request_id=? AND state='queued'").run(Date.now(), requestId);
    return true;
  });
  const row = ticketId => db.prepare('SELECT sequence,request_id AS ticketId,reservation_id AS reservationId,root_id AS rootId,run_id AS runId,model_ordinal AS modelOrdinal,round,input_hash AS inputHash,owner,fence,deadline_at AS deadlineAt,state,created_at AS createdAt,updated_at AS updatedAt FROM requests WHERE request_id=?').get(ticketId) ?? null;
  const projectRow=ticketId=>{const ticket=row(ticketId);if(!ticket)return null;const release=releaseFor(ticketId),expiryStop=stopFor(ticket);return {...ticket,...(expiryStop?{expiryStop}:{}),ticketSha256:digest({routeId,...ticket}),...(release?{localRelease:validateRelease(ticket,release)}:{})};};
  const appendRelease=({session,operationId,identity,expectedTicketSha256,reason,acknowledgements,policy='manual-local-release',expiry})=>{
      if(readOnly)fail('ADMISSION_READ_ONLY');
      if(typeof operationId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(operationId)||typeof reason!=='string'||!reason.trim()||Buffer.byteLength(reason)>1000||typeof expectedTicketSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedTicketSha256)||canonical(acknowledgements)!==canonical({preserveUnknown:true,noReplay:true,noRefund:true}))fail('ADMISSION_RELEASE_CONFIRMATION_REQUIRED');
      const ticket=row(identity?.ticketId);if(!ticket)fail('ADMISSION_TICKET_MISSING');
      const expectedIdentity=identityFor(ticket);
      if(canonical(identity)!==canonical(expectedIdentity)||ticket.state!=='unknown'||digest({routeId,...ticket})!==expectedTicketSha256)fail('ADMISSION_RELEASE_CAS');
      const intent={operationId,identity:expectedIdentity,expectedTicketSha256,reason,acknowledgements,...(policy==='two-hour-local-release@1'?{policy,expiry}:{})};
      return withTerminalAdmissionOwner(session,ticket,proof=>transaction(()=>{
        const current=row(ticket.ticketId);if(canonical(current)!==canonical(ticket))fail('ADMISSION_RELEASE_CAS');
        if(!hasReleaseTable())db.exec('CREATE TABLE local_releases (ticket_id TEXT PRIMARY KEY REFERENCES requests(request_id),operation_id TEXT NOT NULL UNIQUE,intent_hash TEXT NOT NULL,event TEXT NOT NULL) STRICT');
        const prior=db.prepare('SELECT * FROM local_releases WHERE ticket_id=? OR operation_id=?').get(ticket.ticketId,operationId);
        if(prior){const event=validateRelease(row(prior.ticket_id),prior);const replayIntent=policy==='two-hour-local-release@1'&&event.policy===policy?{...intent,expiry:{...expiry,observedAt:event.expiry.observedAt}}:intent;if(prior.intent_hash!==digest(replayIntent))fail('ADMISSION_RELEASE_CONFLICT');return event;}
        const event={schemaVersion:'admission-local-release@1',policy,...intent,terminalProof:proof,releasedAt:expiry?.observedAt??Date.now(),remoteOutcome:'unknown',businessOutcome:'unknown',billingOutcome:'unknown',refund:false,replay:false};
        db.prepare('INSERT INTO local_releases VALUES (?,?,?,?)').run(ticket.ticketId,operationId,digest(intent),canonical(event));return event;
      }));
  };
  return {
    // Explicit operator recovery. A durable stop is NOT a release. Lock order
    // is Session -> Admission; a failed Session commit leaves unknown held.
    recoverExpiredOwner({session,ticketId,expectedTicketSha256}={}){
      if(readOnly)fail("ADMISSION_READ_ONLY");
      const current=row(ticketId);if(!current)fail("ADMISSION_TICKET_MISSING");
      const prior=stopFor(current),original=prior?.ticket??current,observedAt=Date.now();
      if(original.state!=="dispatched"||digest({routeId,...original})!==expectedTicketSha256)fail("ADMISSION_STOP_CAS");
      if(!Number.isSafeInteger(observedAt)||observedAt<=original.createdAt+7200000)fail("ADMISSION_STOP_NOT_DUE");
      const persist=()=>transaction(()=>{
        const actual=row(ticketId);if(canonical(actual)!==canonical(current))fail("ADMISSION_STOP_CAS");
        if(prior)return prior;
        if(!hasStopTable())db.exec("CREATE TABLE expiry_stops (ticket_id TEXT PRIMARY KEY REFERENCES requests(request_id),event_hash TEXT NOT NULL,event TEXT NOT NULL) STRICT");
        const event={schemaVersion:"admission-expiry-stop@1",policy:"two-hour-local-revocation@1",ticket:original,originalTicketSha256:expectedTicketSha256,createdAt:original.createdAt,dueAt:original.createdAt+7200000,observedAt,localEffect:"logical-adoption-revocation",remoteOutcome:"unknown"};
        db.prepare("INSERT INTO expiry_stops VALUES (?,?,?)").run(ticketId,digest(event),canonical(event));
        db.prepare("UPDATE requests SET state='unknown',updated_at=? WHERE request_id=? AND state='dispatched'").run(observedAt,ticketId);return event;
      });
      let stop;
      if(prior&&session.inspect(original.runId).status!=="active")stop=withTerminalAdmissionOwner(session,original,()=>prior);
      else stop=fenceExpiredAdmissionOwner(session,original,persist);
      const ticket=row(ticketId);
      const release=appendRelease({session,operationId:"lost-owner-"+digest({routeId,ticketId}),identity:identityFor(ticket),expectedTicketSha256:digest({routeId,...ticket}),reason:"Explicit expired-owner fence; local capacity only; remote result and billing remain unknown.",acknowledgements:{preserveUnknown:true,noReplay:true,noRefund:true}});
      return JSON.parse(canonical({stop,release}));
    },
    releaseUnknown({session,operationId,identity,expectedTicketSha256,reason,acknowledgements}={}){return appendRelease({session,operationId,identity,expectedTicketSha256,reason,acknowledgements});},
    maintainUnknown({session,rootId}={}){
      if(readOnly)fail('ADMISSION_READ_ONLY');if(typeof rootId!=='string'||!rootId)fail('ADMISSION_MAINTENANCE_ROOT_REQUIRED');
      const observedAt=Date.now();if(!Number.isSafeInteger(observedAt)||observedAt<1)fail('ADMISSION_POLICY_CLOCK_INVALID');
      const items=[];
      for(const record of db.prepare("SELECT request_id FROM requests WHERE root_id=? AND state='unknown' ORDER BY sequence").all(rootId)){
        const ticket=row(record.request_id),stop=stopFor(ticket),effectiveAt=Math.max(observedAt,stop?.observedAt??0),prior=validateRelease(ticket,releaseFor(ticket.ticketId));
        if(prior){items.push({ticketId:ticket.ticketId,state:'already-released',event:prior});continue;}
        if(!Number.isSafeInteger(ticket.createdAt)||ticket.createdAt<1||ticket.createdAt>effectiveAt){items.push({ticketId:ticket.ticketId,state:'blocked',code:'ADMISSION_POLICY_CLOCK_INVALID'});continue;}
        const dueAt=ticket.createdAt+7200000;if(!Number.isSafeInteger(dueAt)){items.push({ticketId:ticket.ticketId,state:'blocked',code:'ADMISSION_POLICY_CLOCK_INVALID'});continue;}if(effectiveAt<=dueAt){items.push({ticketId:ticket.ticketId,state:'not-due',dueAt,observedAt});continue;}
        try{
          const event=appendRelease({session,operationId:'two-hour-'+digest({routeId,ticketId:ticket.ticketId,createdAt:ticket.createdAt}),identity:identityFor(ticket),expectedTicketSha256:digest({routeId,...ticket}),reason:'Standing two-hour local capacity policy; no remote settlement, replay or refund.',acknowledgements:{preserveUnknown:true,noReplay:true,noRefund:true},policy:'two-hour-local-release@1',expiry:{origin:'createdAt-includes-queue',createdAt:ticket.createdAt,dueAt,observedAt:effectiveAt}});
          items.push({ticketId:ticket.ticketId,state:'released',event});
        }catch(error){if(!['ADMISSION_RUN_NOT_TERMINAL','ADMISSION_RELEASE_SCOPE_UNSUPPORTED','ADMISSION_TERMINAL_RESERVATION_MISMATCH','ADMISSION_RELEASE_CAS','ADMISSION_RELEASE_CONFLICT'].includes(error.code))throw error;items.push({ticketId:ticket.ticketId,state:'blocked',code:error.code,dueAt,observedAt});}
      }
      return {policy:'two-hour-local-release@1',origin:'createdAt-includes-queue',observedAt,items};
    },
    snapshot() { return { routeId, capacity: 1, maxQueue, occupied:activeCount(),requests: db.prepare('SELECT request_id FROM requests ORDER BY sequence').all().map(x => projectRow(x.request_id)) }; },
    inspect(ticketId) { return projectRow(ticketId); },
    inspectReservation(identity) { const value = db.prepare('SELECT request_id FROM requests WHERE reservation_id=?').get(reservationId(identity)); return value ? projectRow(value.request_id) : null; },
    close() { db.close(); },
    wrap(gateway, { session, runId }) {
      if (readOnly) fail('ADMISSION_READ_ONLY');
      if (typeof gateway?.next !== 'function' || typeof session?.inspect !== 'function') fail('INVALID_ADMISSION_GATEWAY');
      const bind = selectedRunId => ({
        mode: gateway.mode,
        ...(gateway.inputBudget?{inputBudget:gateway.inputBudget}:{}),
        admission: 'shared-admission@1',
        // Rebind the same route/capacity owner only after Session created the Run.
        // A Child receives its own Runtime receipt; a parent's ticket is never reusable.
        bindRun({ session: selectedSession, runId: childRunId } = {}) {
          if (selectedSession !== session || typeof childRunId !== 'string') fail('ADMISSION_BINDING_MISMATCH');
          const parent = session.inspect(selectedRunId), child = session.inspect(childRunId);
          if (!parent || !child || parent.rootStatus !== 'active' || child.rootStatus !== 'active'
            || parent.status !== 'active' || child.status !== 'active'
            || child.rootId !== parent.rootId
            || (childRunId !== selectedRunId && (parent.parentRunId !== null || child.parentRunId !== selectedRunId))) fail('ADMISSION_BINDING_MISMATCH');
          return childRunId === selectedRunId ? bind(selectedRunId) : bind(childRunId);
        },
        async next(input) {
          const runId = selectedRunId;
          const signal = input?.signal;
          signal?.throwIfAborted();
          const reservation = projectModelReservation(input?.reservation);
          if (!reservation || reservation.runId !== runId) fail('ADMISSION_RESERVATION_REQUIRED');
          const original = reserved(session, runId, true);
          if (original.rootId !== reservation.rootId || original.round !== reservation.round
            || original.owner !== reservation.owner || original.fence !== reservation.fence
            || original.purpose !== reservation.purpose || original.inputHash !== reservation.inputHash
            || createHash('sha256').update(JSON.stringify(input.messages)).digest('hex') !== reservation.inputHash) fail('ADMISSION_RESERVATION_MISMATCH');
          if (reservation.purpose === 'compaction' && (!Array.isArray(input.tools) || input.tools.length !== 0)) fail('ADMISSION_RESERVATION_MISMATCH');
          const { requestId, deadline } = enqueue(reservation);
          const currentFence = (dispatch = false) => {
            const current = reserved(session, runId, dispatch);
            if (current.owner !== reservation.owner || current.fence !== reservation.fence
              || dispatch && (current.leaseUntil <= Date.now() || current.round !== reservation.round
                || current.purpose !== reservation.purpose || current.inputHash !== reservation.inputHash
                || createHash('sha256').update(JSON.stringify(input.messages)).digest('hex') !== reservation.inputHash
                || reservation.purpose === 'compaction' && (!Array.isArray(input.tools) || input.tools.length !== 0))) fail('ADMISSION_FENCE_STALE');
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
          const dispatchTicket=row(requestId),monotonicStart=performance.now(),wallStart=Date.now(),localAbort=new AbortController();let expiryTimer,stopReject;
          const stopped=new Promise((_,reject)=>{stopReject=reject;});
          const expiryError=()=>Object.assign(new Error('ADMISSION_EXPIRED_LOCAL'),{code:'ADMISSION_EXPIRED_LOCAL'});
          const armExpiry=()=>{const observedAt=Math.max(Date.now(),wallStart+Math.floor(performance.now()-monotonicStart));
            const remaining=dispatchTicket.createdAt+7200001-observedAt;
            if(remaining>0){expiryTimer=setTimeout(armExpiry,Math.min(remaining,1000));expiryTimer.unref?.();return;}
            try{revokeExpired(session,requestId,observedAt);localAbort.abort(expiryError());stopReject(expiryError());}
            catch(error){
              // Unsupported/active-sibling cases stay held. A persistent stop
              // committed before a later Session failure still blocks adoption.
              if(['ADMISSION_RELEASE_SCOPE_UNSUPPORTED','ADMISSION_ACTIVE_OWNER_MISMATCH','ADMISSION_ACTIVE_CHILD_BLOCKED','ADMISSION_TERMINAL_RESERVATION_MISMATCH'].includes(error.code))return;
              localAbort.abort(error);stopReject(error);
            }
          };
          try {
            // Install both race handlers before the first arm can synchronously
            // revoke an already-overdue ticket. Never dispatch after that stop.
            const pending=Promise.resolve().then(()=>{
              armExpiry();
              if(stopFor(row(requestId)))throw expiryError();
              return gateway.next({...input,signal:signal?AbortSignal.any([signal,localAbort.signal]):localAbort.signal});
            });
            const result = await Promise.race([pending,stopped]);
            if(stopFor(row(requestId)))throw expiryError();
            currentFence();
            transition(requestId, reservation, 'dispatched', 'completed');
            return result;
          } catch (error) {
            if(stopFor(row(requestId)))throw error;
            // Only the original Gateway's branded complete finish is termination evidence.
            // A caller-invented error.code or local AbortSignal is never such evidence.
            const diagnostic = projectProviderProtocolDiagnostic(error);
            let terminal = diagnostic?.reason === 'NON_SUCCESS_FINISH' && diagnostic.hashScope === 'complete-body';
            try { currentFence(); } catch { terminal = false; }
            transition(requestId, reservation, 'dispatched', terminal ? (diagnostic.finishKind === 'aborted' ? 'cancelled' : 'completed') : 'unknown');
            throw error;
          }finally{clearTimeout(expiryTimer);}
        }
      });
      return bind(runId);
    }
  };
}
