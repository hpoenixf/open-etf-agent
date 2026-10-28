import { validateRuntimeCheckpoint } from './runtime.mjs';
import { RESPONSE_PROFILE, validateResponseAbsence, hasResponseSemantics, validateResponseProfile, validateResponseCheckpoint, validateResponseFact, validateResponseCall, responseCanonical, responseHash, responseText, responseId, responseResult, adoptionHash } from './human-response.mjs';
import { validateTaskTime } from './temporal.mjs';
import { DatabaseSync } from 'node:sqlite';
import { lstatSync, realpathSync, openSync, closeSync, readSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { PUBLICATION_BINDING, validatePublication, validatePublicationReceipt, committedPublicationEvent } from './publication.mjs';
import { ensureSafeDirectory } from './storage-files.mjs';
import { prepareSessionRecovery } from './session-recovery.mjs';

const APP_ID = 0x4f455446;
const SCHEMA_VERSION = 2;
const MAX_JSON = 3 * 1048576;
const phases = new Set(['ready', 'working-input', 'model-reserved', 'proposal-sealed', 'tool-dispatched', 'result-committed', 'result-consumed', 'terminal']);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(value) && !value.includes('://');
const digest = value => createHash('sha256').update(value).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const canonical = value => JSON.stringify(value, function(key, item) { return object(item) ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item; });
function fields(value, required, optional = [], code = 'INVALID_DEFINITION') {
 if (!object(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail(code);
}
function json(value, maximum = MAX_JSON) {
 let nodes = 0;
 function check(item, depth) {
  if (++nodes > 100000 || depth > 64) fail('JSON_BOUND');
  if (item === null || typeof item === 'boolean') return;
  if (typeof item === 'string') { if (Buffer.byteLength(item) > maximum) fail('JSON_BOUND'); return; }
  if (typeof item === 'number') { if (!Number.isFinite(item)) fail('INVALID_JSON'); return; }
  if (!object(item) && !Array.isArray(item)) fail('INVALID_JSON');
  if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== Array.prototype && Object.getPrototypeOf(item) !== null) fail('INVALID_JSON');
  for (const key of Object.keys(item)) { if (['__proto__', 'prototype', 'constructor'].includes(key)) fail('INVALID_JSON'); check(item[key], depth + 1); }
  if (Array.isArray(item) && Object.keys(item).length !== item.length) fail('INVALID_JSON');
 }
 check(value, 0); const text = JSON.stringify(value); if (Buffer.byteLength(text) > maximum) fail('JSON_BOUND'); return text;
}
function parsed(text, maximum = MAX_JSON) {
 if (typeof text !== 'string' || Buffer.byteLength(text) > maximum) fail('JSON_BOUND');
 let value; try { value = JSON.parse(text); } catch { fail('INVALID_JSON'); }
 json(value, maximum); return value;
}
function validateBindings(value) {
 fields(value, ['gateway', 'plugins', 'adapters'], [], 'INVALID_BINDING');
 fields(value.gateway, ['mode', 'provider', 'protocol', 'model', 'version'], [], 'INVALID_BINDING');
 if (!['fixture', 'live', 'test'].includes(value.gateway.mode) || Object.values(value.gateway).some(v => !identifier(v))) fail('INVALID_BINDING');
 for (const kind of ['plugins', 'adapters']) {
  if (!Array.isArray(value[kind]) || value[kind].length > 32) fail('INVALID_BINDING'); const seen = new Set();
  for (const item of value[kind]) {
   fields(item, kind === 'plugins' ? ['id', 'version', 'schemaVersion', 'contentSha256'] : ['id', 'version'], kind === 'plugins' ? [] : ['contentSha256'], 'INVALID_BINDING');
   if (!identifier(item.id) || !identifier(item.version) || seen.has(item.id) || (kind === 'plugins' && item.schemaVersion !== 'trusted-plugin@1') || (item.contentSha256 !== undefined && !hash(item.contentSha256))) fail('INVALID_BINDING'); seen.add(item.id);
  }
 }
}
function validateConfig(value, ordinary = false) {
 fields(value, [], ['requireReport', 'allowedTools', 'allowedDocuments', 'contextBytes', 'taskId', 'workingInput', 'publication', 'taskTime', ...(ordinary ? ['ordinaryResponse'] : [])]);
 if (value.taskTime !== undefined) validateTaskTime(value.taskTime);
 if (value.publication !== undefined && value.publication !== 'publication@1') fail('INVALID_DEFINITION');
 if (value.requireReport !== undefined && typeof value.requireReport !== 'boolean') fail('INVALID_DEFINITION');
 for (const key of ['allowedTools', 'allowedDocuments']) if (value[key] !== undefined && (!Array.isArray(value[key]) || !value[key].length || value[key].length > 64 || new Set(value[key]).size !== value[key].length || value[key].some(v => !identifier(v)))) fail('INVALID_DEFINITION');
 if (value.contextBytes !== undefined && (!Number.isSafeInteger(value.contextBytes) || value.contextBytes < 1 || value.contextBytes > 1048576)) fail('INVALID_DEFINITION');
 if (value.taskId !== undefined && value.taskId !== null && !identifier(value.taskId)) fail('INVALID_DEFINITION');
 if (value.workingInput !== undefined) {
  fields(value.workingInput, [], ['memoryLibraryId', 'compaction']);
  if (value.workingInput.memoryLibraryId !== undefined && !identifier(value.workingInput.memoryLibraryId)) fail('INVALID_DEFINITION');
  if (value.workingInput.compaction !== undefined) {
   const c = value.workingInput.compaction; fields(c, ['thresholdBytes', 'version'], ['summaryTimeoutMs']);
   if (!Number.isSafeInteger(c.thresholdBytes) || c.thresholdBytes < 1 || c.thresholdBytes > 1048576 || !identifier(c.version) || (c.summaryTimeoutMs !== undefined && (!Number.isSafeInteger(c.summaryTimeoutMs) || c.summaryTimeoutMs < 1 || c.summaryTimeoutMs > 30000))) fail('INVALID_DEFINITION');
  }
 }
}
function definitionBytes(value, ordinary = false) {
 fields(value, ['question', 'grantId', 'bindings', 'limits', 'rootLimits', 'deadlineAt', 'config']);
 if (typeof value.question !== 'string' || !value.question.trim() || Buffer.byteLength(value.question) > 16000 || !identifier(value.grantId) || !Number.isSafeInteger(value.deadlineAt) || value.deadlineAt < 1) fail('INVALID_DEFINITION');
 fields(value.limits, ['maxRounds', 'maxTools', 'timeoutMs']); fields(value.rootLimits, ['model', 'tool']);
 for (const [key, n] of Object.entries(value.limits)) if (!Number.isSafeInteger(n) || n < 1 || n > (key === 'timeoutMs' ? 300000 : 1000)) fail('INVALID_DEFINITION');
 for (const n of Object.values(value.rootLimits)) if (!Number.isSafeInteger(n) || n < 1 || n > 1000) fail('INVALID_DEFINITION');
 validateBindings(value.bindings); validateConfig(value.config, ordinary); validateResponseProfile(value, ordinary); return json(value, 65536);
}
function checkpointBytes(value, terminal = false, ordinary = false) {
 validateResponseCheckpoint(value, ordinary);
 if (!object(value) || value.schemaVersion !== 'runtime-checkpoint@1' || !(phases.has(value.phase) || ordinary && value.phase === 'awaiting-response') || (terminal ? value.phase !== 'terminal' || !['completed', 'failed', 'cancelled'].includes(value.status) : value.phase === 'terminal')) fail('INVALID_CHECKPOINT');
 return json(value);
}
function validateRunRoot(row, root, definition, snapshot) {
 if(!root) fail('CORRUPT_ROOT');
  if (!['active', 'completed', 'failed', 'cancelled'].includes(row.status) || !['active', 'completed', 'failed', 'cancelled'].includes(root.status) || (row.status === 'active') === (snapshot.phase === 'terminal') || (snapshot.phase === 'terminal' && snapshot.status !== row.status) || definition.grantId !== root.grant_id || definition.deadlineAt > root.deadline_at || definition.rootLimits.model !== root.model_limit || definition.rootLimits.tool !== root.tool_limit || !Number.isSafeInteger(root.model_used) || !Number.isSafeInteger(root.tool_used) || root.model_used < 0 || root.tool_used < 0 || root.model_used > root.model_limit || root.tool_used > root.tool_limit) fail('CORRUPT_SESSION_STATE');
}
function safeExistingDirectory(directory) {
 const path = resolve(directory); const stat = lstatSync(path);
 if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(path) !== path) fail('UNSAFE_SESSION_DIRECTORY'); return path;
}
function safeFile(path, required = false) {
 try { const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('UNSAFE_SESSION_FILE'); return stat; }
 catch (error) { if (!required && error.code === 'ENOENT') return null; throw error; }
}
const schemas = [
 `CREATE TABLE roots (root_id TEXT PRIMARY KEY, grant_id TEXT NOT NULL, model_limit INTEGER NOT NULL, tool_limit INTEGER NOT NULL, model_used INTEGER NOT NULL DEFAULT 0, tool_used INTEGER NOT NULL DEFAULT 0, deadline_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active') STRICT`,
 `CREATE TABLE runs (run_id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES roots(root_id), parent_run_id TEXT REFERENCES runs(run_id), directory TEXT NOT NULL, definition TEXT NOT NULL, snapshot TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', owner TEXT, fence INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL) STRICT`,
 `CREATE TABLE publication_versions (run_id TEXT NOT NULL REFERENCES runs(run_id), root_id TEXT NOT NULL REFERENCES roots(root_id), revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 3), body TEXT NOT NULL, payload_hash TEXT NOT NULL, binding TEXT NOT NULL, binding_hash TEXT NOT NULL, PRIMARY KEY(run_id,revision)) STRICT`,
 `CREATE TABLE publication_events (run_id TEXT PRIMARY KEY REFERENCES runs(run_id), event TEXT NOT NULL) STRICT`
];

const responseSchema = `CREATE TABLE ordinary_responses (run_id TEXT PRIMARY KEY REFERENCES runs(run_id), question_id TEXT NOT NULL UNIQUE, response_id TEXT UNIQUE, fact TEXT NOT NULL) STRICT`;

// Synchronous short transactions own facts only. No tool/model callback enters a transaction.
export async function openSession({ directory, clock = Date.now, leaseMs = 1000, profile } = {}) {
 if (typeof directory !== 'string' || typeof clock !== 'function' || !Number.isSafeInteger(leaseMs) || leaseMs < 20 || leaseMs > 30000) fail('INVALID_SESSION_OPTIONS');
 if (profile !== undefined && profile !== RESPONSE_PROFILE) fail('INVALID_SESSION_PROFILE');
 let ordinary = profile === RESPONSE_PROFILE;
 const encodeDefinition = value => definitionBytes(value, ordinary);
 const encodeCheckpoint = (value, terminal = false) => checkpointBytes(value, terminal, ordinary);
 directory = await ensureSafeDirectory(directory); const filename = join(directory, 'session.sqlite');
 const paths = ['', '-journal', '-wal', '-shm'].map(suffix => filename + suffix);
 for (const path of paths) safeFile(path);
 let fresh = false;
 if (!safeFile(filename)) {
  if (paths.slice(1).some(path => safeFile(path))) fail('ORPHAN_SESSION_SIDECAR');
  const handle = openSync(filename, 'wx', 0o600); closeSync(handle); fresh = true;
 }
 else {
  const handle = openSync(filename, 'r'); try { const bytes = Buffer.alloc(16); if (readSync(handle, bytes, 0, 16, 0) !== 16 || bytes.toString() !== 'SQLite format 3\0') fail('UNSUPPORTED_SESSION_SCHEMA'); } finally { closeSync(handle); }
 }
 function validateSchema(connection) {
  const version = connection.prepare('PRAGMA user_version').get().user_version; const app = connection.prepare('PRAGMA application_id').get().application_id;
  const actual = connection.prepare("SELECT sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.sql);
  if (![2,3].includes(version) || (profile !== undefined && version !== 3) || app !== APP_ID || JSON.stringify(actual) !== JSON.stringify([...(version === 3 ? [...schemas,responseSchema] : schemas)].sort())) fail('UNSUPPORTED_SESSION_SCHEMA');
  ordinary = version === 3;
  // Admission (including a hot-journal isolated copy) rejects cross-profile semantics.
  for (const row of connection.prepare('SELECT * FROM runs').iterate()) {
   if(!ordinary){
    // Preserve v2's existing deferred malformed-state rejection; only the new
    // profile's semantic markers are excluded at admission.
    for(const text of [row.definition,row.snapshot]){let value;try{value=JSON.parse(text);}catch{continue;}if(hasResponseSemantics(value))fail('INVALID_ORDINARY_RESPONSE');}
    continue;
   }
   const definition=parsed(row.definition,65536),snapshot=parsed(row.snapshot);encodeDefinition(definition);encodeCheckpoint(snapshot,snapshot.phase==='terminal');
   if(ordinary){
    validateRuntimeCheckpoint(snapshot,definition);
    validateRunRoot(row,connection.prepare('SELECT * FROM roots WHERE root_id=?').get(row.root_id),definition,snapshot);
    if(row.parent_run_id!==null||row.root_id!==row.run_id)fail('INVALID_ORDINARY_RESPONSE');
    const slot=connection.prepare('SELECT * FROM ordinary_responses WHERE run_id=?').get(row.run_id);
    if(slot){const fact=parsed(slot.fact);validateResponseFact(fact,{runId:row.run_id,rootId:row.root_id,parentRunId:row.parent_run_id,definition,snapshot});if(slot.question_id!==fact.questionId||slot.response_id!==(fact.receipt?.responseId??null))fail('INVALID_ORDINARY_RESPONSE');}
    else validateResponseAbsence(snapshot);
   }
  }
  if(ordinary&&connection.prepare('SELECT 1 FROM ordinary_responses o LEFT JOIN runs r ON r.run_id=o.run_id WHERE r.run_id IS NULL').get())fail('INVALID_ORDINARY_RESPONSE');
 }
 let db; let closed = false; let identity; let recovery;
 try {
  // An unrelated database must not undergo writable recovery before schema admission.
  if (!fresh) {
   try { const reader = new DatabaseSync(filename, { readOnly: true, timeout: 1000 }); try { validateSchema(reader); } finally { reader.close(); } }
   catch (error) { if (error.errcode !== 776) throw error; recovery = prepareSessionRecovery({ filename, validateSchema }); }
  }
  recovery?.assertCurrent(); recovery?.originalStarting();
  db = new DatabaseSync(filename, { timeout: 1000 }); safeExistingDirectory(directory); identity = safeFile(filename, true);
  if (fresh) {
   db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; BEGIN IMMEDIATE');
   try { for (const schema of ordinary ? [...schemas,responseSchema] : schemas) db.exec(schema); db.exec(`PRAGMA application_id=${APP_ID}; PRAGMA user_version=${ordinary ? 3 : SCHEMA_VERSION}; COMMIT`); }
   catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  validateSchema(db);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000; PRAGMA synchronous=FULL');
  recovery?.complete(); recovery = undefined;
 } catch (error) { db?.close(); throw recovery ? recovery.failed(error) : error; }
 function ready() { if (closed) fail('SESSION_CLOSED'); safeExistingDirectory(directory); for (const path of paths) safeFile(path, path === filename); const current = safeFile(filename, true); if (current.ino !== identity.ino || current.dev !== identity.dev) fail('SESSION_FILE_REPLACED'); }
 function now() { const value = clock(); if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_CLOCK'); return value; }
 function transaction(operation) {
  ready(); db.exec('BEGIN IMMEDIATE');
  try { const value = operation(); if (value && typeof value.then === 'function') fail('ASYNC_TRANSACTION_REFUSED'); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
 }
 const getRun = runId => { if (!identifier(runId)) fail('INVALID_RUN_ID'); const row = db.prepare('SELECT * FROM runs WHERE run_id=?').get(runId); if (!row) fail('UNKNOWN_RUN'); return row; };
 const getRoot = rootId => { const row = db.prepare('SELECT * FROM roots WHERE root_id=?').get(rootId); if (!row) fail('CORRUPT_ROOT'); return row; };
 function view(row) {
  const root = getRoot(row.root_id); const definition = parsed(row.definition, 65536); encodeDefinition(definition); const snapshot = parsed(row.snapshot); encodeCheckpoint(snapshot, snapshot.phase === 'terminal');
  validateRunRoot(row, root, definition, snapshot);
  const state = { runId: row.run_id, rootId: row.root_id, parentRunId: row.parent_run_id, directory: row.directory, definition, snapshot, status: row.status, rootStatus: root.status, owner: row.owner, fence: row.fence, leaseUntil: row.lease_until, rootUsage: { model: root.model_used, tool: root.tool_used } };
  if(ordinary){validateRuntimeCheckpoint(snapshot,definition);responseFacts(row,state);}
  return state;
 }
 function responseFacts(row, state) {
  if(!ordinary) fail('ORDINARY_PROFILE_REQUIRED');
  const slot=db.prepare('SELECT * FROM ordinary_responses WHERE run_id=?').get(row.run_id);
  const current=state??view(row);
  if(!slot){validateResponseAbsence(current.snapshot);return null;}
  const fact=validateResponseFact(parsed(slot.fact),current);
  if(slot.question_id!==fact.questionId||slot.response_id!==(fact.receipt?.responseId??null))fail('INVALID_ORDINARY_RESPONSE');
  return fact;
 }
 function originalResponseState(row, expected, phase) {
  const state=view(row);
  if(state.snapshot.phase!==phase||responseCanonical(state.snapshot)!==responseCanonical(expected))fail('STALE_RESPONSE_CHECKPOINT');
  return state;
 }
 function active(row) { const root = getRoot(row.root_id); if (row.status === 'cancelled' || root.status === 'cancelled') fail('RUN_CANCELLED'); if (row.status !== 'active' || root.status !== 'active') fail('RUN_TERMINAL'); return root; }
 function writer(runId, owner, fence, checkDeadline = true) {
  const row = getRun(runId); const root = active(row); const time = now();
  if (row.owner !== owner || row.fence !== fence || row.lease_until <= time) fail('STALE_WRITER');
  if (checkDeadline && Math.min(root.deadline_at, parsed(row.definition, 65536).deadlineAt) <= time) fail('DEADLINE_EXPIRED'); return row;
 }
 // Publication remains a narrow body owner inside the existing Session transaction.
 function publicationScope(row) {
  const state = view(row);
  if (row.parent_run_id !== null || row.root_id !== row.run_id) fail('PUBLICATION_SCOPE_MISMATCH');
  const bound = state.definition.bindings.adapters.find(item => item.id === PUBLICATION_BINDING.id);
  if (canonical(bound) !== canonical(PUBLICATION_BINDING)) fail('PUBLICATION_BINDING_MISMATCH');
  return state;
 }
 function publicationFacts(row) {
  publicationScope(row);
  const versions = db.prepare('SELECT * FROM publication_versions WHERE run_id=? ORDER BY revision').all(row.run_id);
  const slot = db.prepare('SELECT event FROM publication_events WHERE run_id=?').get(row.run_id);
  if (!versions.length) { if (slot) fail('PUBLICATION_IDENTITY_UNAVAILABLE'); return []; }
  try {
   if (versions.length > 3 || !slot) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
   const values = versions.map((version, index) => {
    if (version.root_id !== row.root_id || version.revision !== index + 1) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
    const content = parsed(version.body, 512000);
    const prepared = validatePublication({ schemaVersion: 'publication@1', runId: row.run_id, rootId: row.root_id, blockId: 'answer', content, payloadHash: version.payload_hash });
    const binding = parsed(version.binding, 1024); fields(binding, ['definitionHash', 'hostHash']);
    if (binding.definitionHash !== digest(row.definition) || !hash(binding.hostHash) || digest(canonical(binding)) !== version.binding_hash) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
    const receipt = validatePublicationReceipt({ schemaVersion: 'publication-receipt@1', runId: row.run_id, rootId: row.root_id, blockId: 'answer', revision: version.revision, deliveryOrdinal: 1, payloadHash: prepared.payloadHash, bindingHash: version.binding_hash });
    return { receipt, content: structuredClone(prepared.content) };
   });
   if (canonical(parsed(slot.event, 512000)) !== canonical(committedPublicationEvent(values.at(-1)))) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
   return values;
  } catch { fail('PUBLICATION_IDENTITY_UNAVAILABLE'); }
 }
 function commitPublication(row, proposed, expectedRevision) {
  publicationScope(row);
  const prepared = validatePublication(proposed);
  if (prepared.runId !== row.run_id || prepared.rootId !== row.root_id) fail('PUBLICATION_SCOPE_MISMATCH');
  const replacing = expectedRevision !== undefined;
  if (replacing && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision > 3)) fail('INVALID_PUBLICATION_REVISION');
  const versions = publicationFacts(row); const current = versions.at(-1);
  if (replacing && !current) fail('PUBLICATION_NOT_FOUND');
  if (replacing && current.receipt.revision !== expectedRevision) fail('PUBLICATION_REVISION_MISMATCH');
  const binding = { definitionHash: digest(row.definition), hostHash: digest(canonical(parsed(row.snapshot).host ?? null)) };
  const bindingHash = digest(canonical(binding));
  if (current && current.content.text === prepared.content.text && current.receipt.bindingHash === bindingHash) return { receipt: structuredClone(current.receipt), idempotent: true };
  if (current && !replacing) fail('PUBLICATION_REPLACE_REQUIRED');
  if (current?.receipt.revision >= 3) fail('PUBLICATION_MODIFICATION_LIMIT');
  const receipt = validatePublicationReceipt({ schemaVersion: 'publication-receipt@1', runId: row.run_id, rootId: row.root_id, blockId: 'answer', revision: (current?.receipt.revision ?? 0) + 1, deliveryOrdinal: 1, payloadHash: prepared.payloadHash, bindingHash });
  const event = committedPublicationEvent({ receipt, content: prepared.content });
  db.prepare('INSERT INTO publication_versions(run_id,root_id,revision,body,payload_hash,binding,binding_hash) VALUES(?,?,?,?,?,?,?)').run(row.run_id, row.root_id, receipt.revision, json(prepared.content, 512000), receipt.payloadHash, json(binding, 1024), bindingHash);
  if (current) {
   const changed = db.prepare('UPDATE publication_events SET event=? WHERE run_id=?').run(json(event, 512000), row.run_id);
   if (changed.changes !== 1) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
  } else db.prepare('INSERT INTO publication_events(run_id,event) VALUES(?,?)').run(row.run_id, json(event, 512000));
  return { receipt: structuredClone(receipt), idempotent: false };
 }
 function cancelRoot(rootId) {
  const root = getRoot(rootId); if (root.status !== 'active') return;
  for (const row of db.prepare("SELECT * FROM runs WHERE root_id=? AND status='active'").all(rootId)) {
   const snapshot = parsed(row.snapshot); snapshot.phase = 'terminal'; snapshot.status = 'cancelled'; snapshot.code = 'CANCELLED';
   db.prepare("UPDATE runs SET snapshot=?,status='cancelled',owner=NULL,lease_until=0 WHERE run_id=?").run(encodeCheckpoint(snapshot, true), row.run_id);
  }
  db.prepare("UPDATE roots SET status='cancelled' WHERE root_id=?").run(rootId);
 }
 const store = {
  directory, leaseMs, schemaVersion: ordinary ? 3 : 2,
  create({ runId = 'run-' + randomUUID(), rootId, parentRunId = null, parentClaim, directory: runDirectory, definition, snapshot }) {
   const encodedDefinition = encodeDefinition(definition); const encodedSnapshot = encodeCheckpoint(snapshot); if (ordinary && parentRunId !== null) fail('ORDINARY_CHILD_UNSUPPORTED'); if (snapshot.phase !== 'ready' || !identifier(runId)) fail('INVALID_CHECKPOINT'); runDirectory = safeExistingDirectory(runDirectory);
   return transaction(() => {
    if (db.prepare('SELECT 1 FROM runs WHERE run_id=?').get(runId)) fail('RUN_EXISTS');
    if (parentRunId !== null) {
     const parent = getRun(parentRunId); const root = active(parent);
     if (!object(parentClaim) || !identifier(parentClaim.owner) || !Number.isSafeInteger(parentClaim.fence) || parentClaim.fence < 1) fail('PARENT_CLAIM_REQUIRED');
     writer(parentRunId, parentClaim.owner, parentClaim.fence);
     if (!identifier(definition.config.taskId)) fail('CHILD_TASK_REQUIRED');
     const siblings = db.prepare('SELECT definition FROM runs WHERE parent_run_id=?').all(parentRunId);
     if (siblings.some(row => parsed(row.definition, 65536).config.taskId === definition.config.taskId)) fail('CHILD_EXISTS');
     if (siblings.length >= 64) fail('CHILD_LIMIT');
     if (parent.parent_run_id !== null) fail('CHILD_DEPTH_LIMIT'); if (rootId !== undefined && rootId !== parent.root_id) fail('ROOT_SCOPE_MISMATCH'); rootId = parent.root_id;
     const previous = parsed(parent.definition, 65536);
     if (definition.grantId !== root.grant_id || definition.deadlineAt > previous.deadlineAt || canonical(definition.bindings.gateway) !== canonical(previous.bindings.gateway) || canonical(definition.rootLimits) !== canonical(previous.rootLimits)) fail('CHILD_SCOPE_MISMATCH');
     for (const key of ['allowedTools', 'allowedDocuments']) if (previous.config[key] && (!definition.config[key] || definition.config[key].some(value => !previous.config[key].includes(value)))) fail('CHILD_SCOPE_MISMATCH');
     for (const kind of ['plugins', 'adapters']) if (definition.bindings[kind].some(item => !previous.bindings[kind].some(old => canonical(old) === canonical(item)))) fail('CHILD_BINDING_MISMATCH');
    } else {
     if (rootId !== undefined && rootId !== runId) fail('ROOT_SCOPE_MISMATCH'); rootId = runId;
     db.prepare('INSERT INTO roots(root_id,grant_id,model_limit,tool_limit,deadline_at) VALUES(?,?,?,?,?)').run(rootId, definition.grantId, definition.rootLimits.model, definition.rootLimits.tool, definition.deadlineAt);
    }
    db.prepare('INSERT INTO runs(run_id,root_id,parent_run_id,directory,definition,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').run(runId, rootId, parentRunId, runDirectory, encodedDefinition, encodedSnapshot, now()); return view(getRun(runId));
   });
  },
  inspect(runId) { return transaction(() => view(getRun(runId))); },
  response(runId, questionId) {
   responseId(questionId);
   return transaction(()=>{const row=getRun(runId);const fact=responseFacts(row);if(!fact||fact.questionId!==questionId)fail('UNKNOWN_QUESTION');return structuredClone(fact);});
  },
  responseStatus(runId) {
   return transaction(()=>{const row=getRun(runId),state=view(row),fact=responseFacts(row,state);if(!fact)return null;
    const reason=state.status!=='active'?state.status:state.rootStatus!=='active'?state.rootStatus:now()>=fact.deadlineAt?'deadline-expired':null;
    return{runId,rootId:fact.rootId,questionId:fact.questionId,callId:fact.call.id,deadlineAt:fact.deadlineAt,questionHash:fact.questionHash,responseId:fact.receipt?.responseId??null,responseHash:fact.receipt?.responseHash??null,receivedAt:fact.receipt?.receivedAt??null,adoptedAt:fact.adoption?.adoptedAt??null,checkpointHash:fact.adoption?.checkpointHash??null,status:fact.adoption?'adopted':fact.receipt?'received-not-adopted':'awaiting-response',reason};
   });
  },
  receiveResponse(input) {
   if(!object(input)||Object.keys(input).sort().join(',')!=='questionId,responseId,runId,text')fail('INVALID_ORDINARY_RESPONSE');
   for(const key of ['runId','questionId','responseId'])responseId(input[key]);responseText(input.text);
   return transaction(()=>{
    if(!ordinary)fail('ORDINARY_PROFILE_REQUIRED');
    const existing=db.prepare('SELECT run_id FROM ordinary_responses WHERE response_id=?').get(input.responseId);
    if(existing&&existing.run_id!==input.runId)fail('RESPONSE_ID_CONFLICT');
    const row=getRun(input.runId),state=view(row),fact=responseFacts(row,state);
    if(!fact||fact.questionId!==input.questionId){if(existing)fail('RESPONSE_ID_CONFLICT');fail('UNKNOWN_QUESTION');}
    if(fact.receipt){if(fact.receipt.responseId===input.responseId&&fact.receipt.text===input.text)return structuredClone(fact.receipt);fail(fact.receipt.responseId===input.responseId?'RESPONSE_ID_CONFLICT':'QUESTION_ALREADY_ANSWERED');}
    const root=active(row),time=now();if(Math.min(root.deadline_at,fact.deadlineAt)<=time)fail('DEADLINE_EXPIRED');
    fact.receipt={responseId:input.responseId,text:input.text,responseHash:responseHash(input.text),receivedAt:time};validateResponseFact(fact,state);
    db.prepare('UPDATE ordinary_responses SET response_id=?,fact=? WHERE run_id=?').run(input.responseId,json(fact),input.runId);return structuredClone(fact.receipt);
   });
  },
  confirmResponse(runId,call,result) {
   return transaction(()=>{const fact=responseFacts(getRun(runId));if(!fact?.adoption||responseCanonical(call)!==responseCanonical(fact.call)||responseCanonical(result)!==responseCanonical(responseResult(fact)))fail('INVALID_ORDINARY_RESPONSE');return true;});
  },
  publication(runId, revision) {
   if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 1 || revision > 3)) fail('INVALID_PUBLICATION_REVISION');
   return transaction(() => { const values = publicationFacts(getRun(runId)); return structuredClone(revision === undefined ? values.at(-1) ?? null : values.find(value => value.receipt.revision === revision) ?? null); });
  },
  publicationRevisions(runId) { return transaction(() => structuredClone(publicationFacts(getRun(runId)))); },
  publicationEvent(runId) { return transaction(() => { const value = publicationFacts(getRun(runId)).at(-1); return value ? committedPublicationEvent(value) : null; }); },
  confirmPublication(receipt) {
   const identity = validatePublicationReceipt(receipt);
   return transaction(() => {
    const value = publicationFacts(getRun(identity.runId)).find(item => item.receipt.revision === identity.revision);
    if (!value || canonical(value.receipt) !== canonical(identity)) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
    return structuredClone(value);
   });
  },
  findChild(parentRunId, taskId) {
   if (!identifier(taskId)) fail('INVALID_TASK_ID');
   return transaction(() => {
    getRun(parentRunId); const children = db.prepare('SELECT * FROM runs WHERE parent_run_id=?').all(parentRunId); if (children.length > 64) fail('CHILD_LIMIT');
    const matches = children.filter(row => parsed(row.definition, 65536).config.taskId === taskId); if (matches.length > 1) fail('CORRUPT_CHILD_RELATION'); return matches.length ? view(matches[0]) : null;
   });
  },
  cancel(runId) { return transaction(() => { const row = getRun(runId); cancelRoot(row.root_id); return view(getRun(runId)); }); },
  claim(runId, owner) {
   if (!identifier(owner)) fail('INVALID_OWNER');
   const initial = transaction(() => {
    const row = getRun(runId); active(row); view(row); const time = now();
    if (row.owner !== null && row.lease_until > time) fail('LEASE_BUSY');
    db.prepare('UPDATE runs SET owner=?,fence=fence+1,lease_until=? WHERE run_id=?').run(owner, time + leaseMs, runId); return view(getRun(runId));
   });
   const { rootId, fence } = initial;
   const reserve = (kind, snapshot) => {
    if (!['model', 'tool'].includes(kind)) fail('INVALID_BUDGET_KIND'); const encoded = snapshot === undefined ? undefined : encodeCheckpoint(snapshot);
    return transaction(() => {
     const row = writer(runId, owner, fence); const root = getRoot(row.root_id); if (root[kind + '_used'] >= root[kind + '_limit']) fail('ROOT_BUDGET_EXHAUSTED');
     db.prepare(`UPDATE roots SET ${kind}_used=${kind}_used+1 WHERE root_id=?`).run(rootId);
     if (encoded !== undefined) db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encoded, runId); return view(getRun(runId));
    });
   };
   return Object.freeze({
    runId, rootId, owner, fence, get leaseUntil() { return store.inspect(runId).leaseUntil; },
    read() { return transaction(() => { writer(runId, owner, fence, false); return view(getRun(runId)); }); },
    renew() { return transaction(() => { writer(runId, owner, fence, false); const until = now() + leaseMs; db.prepare('UPDATE runs SET lease_until=? WHERE run_id=?').run(until, runId); return until; }); },
    checkpoint(snapshot) { const encoded = encodeCheckpoint(snapshot); return transaction(() => { writer(runId, owner, fence); db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encoded, runId); return view(getRun(runId)); }); },
    askResponse(expected) {
     return transaction(()=>{
      if(!ordinary)fail('ORDINARY_PROFILE_REQUIRED');
      const row=writer(runId,owner,fence),state=originalResponseState(row,expected,'proposal-sealed');
      if(responseFacts(row,state))fail('QUESTION_LIMIT');
      const snapshot=state.snapshot,proposal=snapshot.proposal;
      if(proposal?.kind!=='calls'||proposal.calls.length!==1||snapshot.cursor!==0)fail('INVALID_ORDINARY_RESPONSE');
      const call=validateResponseCall(proposal.calls[0]);
      if(snapshot.usedIds.includes(call.id)||snapshot.toolsDispatched>=state.definition.limits.maxTools)fail('INVALID_ORDINARY_RESPONSE');
      const root=getRoot(rootId);if(root.tool_used>=root.tool_limit)fail('ROOT_BUDGET_EXHAUSTED');
      const fact={schemaVersion:RESPONSE_PROFILE,runId,rootId,questionId:'question-'+randomUUID(),call:structuredClone(call),questionHash:responseHash(call.arguments.question),createdAt:now(),deadlineAt:state.definition.deadlineAt,receipt:null,adoption:null};
      snapshot.phase='awaiting-response';snapshot.usedIds.push(call.id);snapshot.toolsDispatched++;snapshot.responseQuestion=fact.questionId;
      validateResponseFact(fact,{...state,snapshot});
      db.prepare('INSERT INTO ordinary_responses(run_id,question_id,response_id,fact) VALUES(?,?,NULL,?)').run(runId,fact.questionId,json(fact));
      db.prepare('UPDATE roots SET tool_used=tool_used+1 WHERE root_id=?').run(rootId);
      db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encodeCheckpoint(snapshot),runId);return view(getRun(runId));
     });
    },
    adoptResponse(expected) {
     return transaction(()=>{
      const row=writer(runId,owner,fence),state=originalResponseState(row,expected,'awaiting-response'),fact=responseFacts(row,state);
      if(!fact?.receipt)return null;if(fact.adoption)fail('INVALID_ORDINARY_RESPONSE');
      const snapshot=state.snapshot;snapshot.phase='result-committed';snapshot.result=responseResult(fact);
      fact.adoption={adoptedAt:now(),checkpointHash:adoptionHash(fact)};validateResponseFact(fact,{...state,snapshot});
      db.prepare('UPDATE ordinary_responses SET fact=? WHERE run_id=?').run(json(fact),runId);
      db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encodeCheckpoint(snapshot),runId);return view(getRun(runId));
     });
    },
    reserve,
    publish(prepared) { return transaction(() => commitPublication(writer(runId, owner, fence), prepared)); },
    replacePublication(prepared, expectedRevision) {
     if (expectedRevision === undefined) fail('INVALID_PUBLICATION_REVISION');
     return transaction(() => commitPublication(writer(runId, owner, fence), prepared, expectedRevision));
    },
    finish(snapshot) {
     const encoded = encodeCheckpoint(snapshot, true);
     return transaction(() => {
      const row = writer(runId, owner, fence, false);
      if (row.parent_run_id === null && snapshot.status === 'completed' && db.prepare("SELECT 1 FROM runs WHERE root_id=? AND run_id<>? AND status='active'").get(rootId, runId)) fail('ACTIVE_CHILD');
      db.prepare('UPDATE runs SET snapshot=?,status=?,owner=NULL,lease_until=0 WHERE run_id=?').run(encoded, snapshot.status, runId);
      if (row.parent_run_id === null) db.prepare('UPDATE roots SET status=? WHERE root_id=?').run(snapshot.status, rootId); return view(getRun(runId));
     });
    },
    release() { return transaction(() => { const row = getRun(runId); if (row.owner === null && row.fence === fence) return false; writer(runId, owner, fence, false); db.prepare('UPDATE runs SET owner=NULL,lease_until=0 WHERE run_id=?').run(runId); return true; }); },
    rootBudget: Object.freeze({ rootId, claim: kind => { reserve(kind); }, snapshot: () => store.inspect(runId).rootUsage })
   });
  },
  close() { if (!closed) { db.close(); closed = true; } }
 };
 return Object.freeze(store);
}
