import {verifyReportDeliveryState,publicReportAssessment} from './report-assessment.mjs';
import {INTERACTION_PROFILE, validateInteractionConfig, validateInteractionDefinition, validateInteractionCheckpoint, validateInteractionFacts, interactionResult, interactionAdoptionHash} from './human-interaction.mjs';
import { validateControlObservations } from './run-control.mjs';
import { SCHEDULE_PROFILE, prepareSchedule, validateScheduleReference, scheduleCanonical } from './schedule.mjs';
import { searchPages } from './retrieval.mjs';
import { validateProtectedHostSnapshot, validateProtectedCsvResult } from './tools.mjs';
import { validateArtifactProtection, validateProtectedOutputFact, validateProtectedOutputProof, validateProtectedSourcePayload, PROTECTED_OUTPUT_BYTES } from './artifacts.mjs';
import { DOCUMENT_REVOCATION_PROFILE, validateDocumentManifest, documentManifestHash, validateDocumentAuthority, bindProtectedSource, validateProtectedSourceBinding } from './source.mjs';
import { validateRuntimeCheckpoint, cancelRuntimeCheckpoint, validateGatewayOutcomeCheckpoint } from './runtime.mjs';
import { RESPONSE_PROFILE, validateResponseAbsence, hasResponseSemantics, validateResponseProfile, validateResponseCheckpoint, validateResponseFact, validateResponseCall, responseCanonical, responseHash, responseText, responseId, responseResult, adoptionHash } from './human-response.mjs';
import { validateTaskTime } from './temporal.mjs';
import { DatabaseSync } from 'node:sqlite';
import { lstatSync, realpathSync, openSync, closeSync, readSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { PUBLICATION_BINDING, PUBLICATION_TEXT_MAX_BYTES, validatePublication, validatePublicationReceipt, committedPublicationEvent } from './publication.mjs';
import { ensureSafeDirectory } from './storage-files.mjs';
import { prepareSessionRecovery } from './session-recovery.mjs';

// Only an original writable Session instance can hold the terminal proof lock.
const terminalAdmissionOwners=new WeakMap(),activeAdmissionOwners=new WeakMap();
export function withTerminalAdmissionOwner(session,ticket,operation){
 const check=terminalAdmissionOwners.get(session);if(!check||typeof operation!=='function')throw Object.assign(new Error('ADMISSION_SESSION_AUTHORITY_REQUIRED'),{code:'ADMISSION_SESSION_AUTHORITY_REQUIRED'});
 return check(ticket,operation);
}

export function revokeActiveAdmissionOwner(session,ticket,persistStop){
 const revoke=activeAdmissionOwners.get(session);if(!revoke||typeof persistStop!=='function')throw Object.assign(new Error('ADMISSION_SESSION_AUTHORITY_REQUIRED'),{code:'ADMISSION_SESSION_AUTHORITY_REQUIRED'});
 return revoke(ticket,persistStop);
}

export function fenceExpiredAdmissionOwner(session,ticket,persistStop){
 const revoke=activeAdmissionOwners.get(session);if(!revoke||typeof persistStop!=="function")throw Object.assign(new Error("ADMISSION_SESSION_AUTHORITY_REQUIRED"),{code:"ADMISSION_SESSION_AUTHORITY_REQUIRED"});
 return revoke(ticket,persistStop,true);
}

const APP_ID = 0x4f455446;
const SCHEMA_VERSION = 2;
const MAX_JSON = 3 * 1048576;
// Checkpoints may repeat report, proposal, answer and outcome bodies.
const MAX_CHECKPOINT_JSON = 12 * 1048576;
const MAX_PUBLICATION_JSON = 6 * PUBLICATION_TEXT_MAX_BYTES + 393216;
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
function validateConfig(value, ordinary = false, protectedProfile = false, interaction = false) {
 fields(value, [], ['requireReport', 'hostProjection', 'allowedTools', 'allowedDocuments', 'documentCatalog', 'pdfSnapshot', 'contextBytes', 'taskId', 'workingInput', 'publication', 'taskTime', ...(ordinary ? ['ordinaryResponse'] : []), ...(interaction ? ['interaction'] : []), ...(protectedProfile ? ['documentProtection'] : [])]);
 if(protectedProfile){if(value.documentCatalog!==undefined||value.pdfSnapshot!==undefined)fail('INVALID_PROTECTED_PROFILE');fields(value.documentProtection,['authorityId','libraryId']);if(!identifier(value.documentProtection.authorityId)||!identifier(value.documentProtection.libraryId)||!Array.isArray(value.allowedDocuments)||!value.allowedDocuments.length||value.workingInput!==undefined||value.ordinaryResponse!==undefined)fail('INVALID_PROTECTED_PROFILE');}
 if(value.documentCatalog!==undefined){fields(value.documentCatalog,['schemaVersion','id','sha256']);if(!['document-catalog@1','document-catalog@2'].includes(value.documentCatalog.schemaVersion)||!identifier(value.documentCatalog.id)||!hash(value.documentCatalog.sha256))fail('INVALID_DEFINITION');}
 if(value.pdfSnapshot!==undefined){const p=value.pdfSnapshot;fields(p,['schemaVersion','parser','parserWorkerSha256','originalSha256','originalBytes','snapshotSha256']);if(p.schemaVersion!=='pdf-input-snapshot@1'||p.parser!=='pdf2json@4.1.0'||!hash(p.parserWorkerSha256)||!hash(p.originalSha256)||!hash(p.snapshotSha256)||!Number.isSafeInteger(p.originalBytes)||p.originalBytes<5||p.originalBytes>1048576)fail('INVALID_DEFINITION');}
 if (value.taskTime !== undefined) validateTaskTime(value.taskTime);
 if (value.publication !== undefined && value.publication !== 'publication@1') fail('INVALID_DEFINITION');
 if (value.requireReport !== undefined && typeof value.requireReport !== 'boolean') fail('INVALID_DEFINITION');
 for (const key of ['allowedTools', 'allowedDocuments']) if (value[key] !== undefined && (!Array.isArray(value[key]) || !value[key].length || value[key].length > 64 || new Set(value[key]).size !== value[key].length || value[key].some(v => !identifier(v)))) fail('INVALID_DEFINITION');
 if(value.hostProjection!==undefined&&!['host-results@1','host-results@2'].includes(value.hostProjection))fail('INVALID_DEFINITION');
 if (value.contextBytes !== undefined && (!Number.isSafeInteger(value.contextBytes) || value.contextBytes < 1 || value.contextBytes > 1048576)) fail('INVALID_DEFINITION');
 if (value.taskId !== undefined && value.taskId !== null && !identifier(value.taskId)) fail('INVALID_DEFINITION');
 if (value.workingInput !== undefined) {
  fields(value.workingInput, [], ['memoryLibraryId', 'compaction']);
  if (value.workingInput.memoryLibraryId !== undefined && !identifier(value.workingInput.memoryLibraryId)) fail('INVALID_DEFINITION');
  if (value.workingInput.compaction !== undefined) {
   const c = value.workingInput.compaction; fields(c, ['thresholdBytes', 'version'], ['summaryTimeoutMs','maxSummaryRounds']);
   if (!Number.isSafeInteger(c.thresholdBytes) || c.thresholdBytes < 1 || c.thresholdBytes > 1048576 || !identifier(c.version) || (c.summaryTimeoutMs !== undefined && (!Number.isSafeInteger(c.summaryTimeoutMs) || c.summaryTimeoutMs < 1 || c.summaryTimeoutMs > 120000))) fail('INVALID_DEFINITION');
   if(c.version==='gateway-history-compaction@2'?(!Number.isSafeInteger(c.maxSummaryRounds)||c.maxSummaryRounds<1||c.maxSummaryRounds>24):c.maxSummaryRounds!==undefined)fail('INVALID_DEFINITION');
  }
 }
}
function definitionBytes(value, ordinary = false, protectedProfile = false, interaction = false) {
 fields(value, ['question', 'grantId', 'bindings', 'limits', 'rootLimits', 'deadlineAt', 'config']);
 if (typeof value.question !== 'string' || !value.question.trim() || (value.config?.hostProjection===undefined&&Buffer.byteLength(value.question) > 16000) || !identifier(value.grantId) || !Number.isSafeInteger(value.deadlineAt) || value.deadlineAt < 1) fail('INVALID_DEFINITION');
 fields(value.limits, ['maxRounds', 'maxTools', 'timeoutMs']); fields(value.rootLimits, ['model', 'tool']);
 for (const [key, n] of Object.entries(value.limits)) if (!Number.isSafeInteger(n) || n < 1 || n > (key === 'timeoutMs' ? 3600000 : 1000)) fail('INVALID_DEFINITION');
 for (const n of Object.values(value.rootLimits)) if (!Number.isSafeInteger(n) || n < 1 || n > 1000) fail('INVALID_DEFINITION');
 if(!protectedProfile&&value.bindings?.adapters?.some(x=>x.id==='document-revocation'||x.version===DOCUMENT_REVOCATION_PROFILE))fail('INVALID_PROTECTED_PROFILE');
 if(protectedProfile&&(value.bindings?.gateway?.mode==='live'||value.bindings?.plugins?.length||!value.bindings?.adapters?.some(x=>x.id==='document-revocation'&&x.version===DOCUMENT_REVOCATION_PROFILE)))fail('PROTECTED_EXECUTION_DISABLED');
 validateBindings(value.bindings); validateConfig(value.config, ordinary, protectedProfile, interaction); if(interaction)validateInteractionDefinition(value);else validateResponseProfile(value, ordinary); return json(value, 65536);
}
function checkpointBytes(value, terminal = false, ordinary = false, interaction = false) {
 if(interaction)validateInteractionCheckpoint(value);else validateResponseCheckpoint(value, ordinary);validateGatewayOutcomeCheckpoint(value);validateControlObservations(value);
 if (!object(value) || value.schemaVersion !== 'runtime-checkpoint@1' || !(phases.has(value.phase) || ordinary && value.phase === 'awaiting-response') || (terminal ? value.phase !== 'terminal' || !['completed', 'failed', 'cancelled'].includes(value.status) : value.phase === 'terminal')) fail('INVALID_CHECKPOINT');
 return json(value, MAX_CHECKPOINT_JSON);
}
function validateRunRoot(row, root, definition, snapshot) {
 validateControlObservations(snapshot,row.run_id);
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

const scheduleSchemas = [
 `CREATE TABLE schedule_definitions (schedule_id TEXT PRIMARY KEY, envelope TEXT NOT NULL, confirmation_hash TEXT NOT NULL, confirmed_at INTEGER NOT NULL) STRICT`,
 `CREATE TABLE schedule_occurrences (schedule_id TEXT PRIMARY KEY REFERENCES schedule_definitions(schedule_id), state TEXT NOT NULL, run_id TEXT UNIQUE REFERENCES runs(run_id), decided_at INTEGER, materialized_at INTEGER) STRICT`
];

const interactionSchema = `CREATE TABLE human_interactions (run_id TEXT NOT NULL REFERENCES runs(run_id), ordinal INTEGER NOT NULL, question_id TEXT NOT NULL UNIQUE, response_id TEXT UNIQUE, fact TEXT NOT NULL, PRIMARY KEY(run_id,ordinal)) STRICT`;
const responseSchema = `CREATE TABLE ordinary_responses (run_id TEXT PRIMARY KEY REFERENCES runs(run_id), question_id TEXT NOT NULL UNIQUE, response_id TEXT UNIQUE, fact TEXT NOT NULL) STRICT`;


const protectedSchemas = [
 `CREATE TABLE document_authority (singleton INTEGER PRIMARY KEY CHECK(singleton=1), fact TEXT NOT NULL) STRICT`,
 `CREATE TABLE document_grants (document_id TEXT PRIMARY KEY, manifest TEXT NOT NULL, manifest_hash TEXT NOT NULL, auth_revision INTEGER NOT NULL, status TEXT NOT NULL) STRICT`,
 `CREATE TABLE protected_dependencies (run_id TEXT NOT NULL REFERENCES runs(run_id), result_ref TEXT NOT NULL, fact TEXT NOT NULL, PRIMARY KEY(run_id,result_ref)) STRICT`,
 `CREATE TABLE protected_outputs (run_id TEXT PRIMARY KEY REFERENCES runs(run_id), fact TEXT NOT NULL CHECK(json_valid(fact) AND json_extract(fact,'$.schemaVersion') IS 'protected-output@2')) STRICT`,
 `CREATE TABLE protected_query_facts (run_id TEXT NOT NULL REFERENCES runs(run_id), call_id TEXT NOT NULL, fact TEXT NOT NULL, PRIMARY KEY(run_id,call_id)) STRICT`
];
function hasProtectedSemantics(value) {
 if(!value||typeof value!=='object')return false;
 if(value.id==='document-revocation'&&value.version===DOCUMENT_REVOCATION_PROFILE||Object.hasOwn(value,'documentProtection')||['protected-query-fact@1','protected-source-binding@1','document-authority@1','protected-document@1','tool-host-protected@1','protected-output@1','protected-output@2','protected-artifact@1','protected-artifact-root@1','protected-artifact-revision@1','protected-artifact-revision@2'].includes(value.schemaVersion))return true;
 return Object.values(value).some(hasProtectedSemantics);
}

// Synchronous short transactions own facts only. No tool/model callback enters a transaction.
export async function openSession({ directory, clock = Date.now, leaseMs = 1000, profile, readOnly = false } = {}) {
 if (typeof readOnly !== 'boolean' || typeof directory !== 'string' || typeof clock !== 'function' || !Number.isSafeInteger(leaseMs) || leaseMs < 20 || leaseMs > 30000) fail('INVALID_SESSION_OPTIONS');
 if (profile !== undefined && profile !== RESPONSE_PROFILE && profile !== INTERACTION_PROFILE && profile !== DOCUMENT_REVOCATION_PROFILE && profile !== SCHEDULE_PROFILE) fail('INVALID_SESSION_PROFILE');
 let interaction = profile === INTERACTION_PROFILE; let ordinary = profile === RESPONSE_PROFILE || interaction; const protectedProfile=profile===DOCUMENT_REVOCATION_PROFILE; const scheduled=profile===SCHEDULE_PROFILE;
 const encodeDefinition = value => definitionBytes(value, ordinary, protectedProfile, interaction);
 const encodeCheckpoint = (value, terminal = false) => {let checked=value;if(protectedProfile&&value?.host?.schemaVersion==='tool-host-protected@1'){
   validateProtectedHostSnapshot(value.host,value.host.protection);checked=structuredClone(value);checked.host=null;const csv=(call,result)=>{validateProtectedCsvResult(call,result,value.host.protection);return {...result,value:null};};
   if(value.result?.value?.schemaVersion==='protected-artifact@1'){if(value.phase!=='result-committed'&&!(value.phase==='terminal'&&['failed','cancelled'].includes(value.status)))fail('INVALID_PROTECTED_CHECKPOINT');checked.result=csv(value.proposal?.calls?.[value.cursor],value.result);}
   const pairedCsv=new Map();let pending=[],index=0;
   for(let i=0;i<(value.messages?.length||0);i++){const message=value.messages[i];if(message.role==='assistant'){pending=message.calls||[];index=0;}else if(message.role==='tool'){if(message.result?.value?.schemaVersion==='protected-artifact@1'){const call=pending[index];if(call?.id!==message.callId||pairedCsv.has(message.callId))fail('INVALID_PROTECTED_CHECKPOINT');checked.messages[i]={...message,result:csv(call,message.result)};pairedCsv.set(message.callId,{call,message});}index++;}}
   if(value.working){
    fields(value.working,['schemaVersion','messages','noteRef','hash']);
    if(value.working.schemaVersion!=='working-input@1'||!Array.isArray(value.working.messages)||value.working.hash!==digest(JSON.stringify(value.working.messages)))fail('INVALID_PROTECTED_CHECKPOINT');
    pending=[];index=0;const seen=new Set();
    for(let i=0;i<value.working.messages.length;i++){const message=value.working.messages[i];if(message.role==='assistant'){pending=message.calls||[];index=0;}else if(message.role==='tool'){if(message.result?.value?.schemaVersion==='protected-artifact@1'){const call=pending[index],original=pairedCsv.get(message.callId);if(!original||seen.has(message.callId)||canonical(call)!==canonical(original.call)||canonical(message)!==canonical(original.message))fail('INVALID_PROTECTED_CHECKPOINT');seen.add(message.callId);checked.working.messages[i]={...message,result:csv(call,message.result)};}index++;}}
   }
  }if(hasProtectedSemantics(checked))fail('INVALID_PROTECTED_CHECKPOINT');return checkpointBytes(value, terminal, ordinary, interaction);};
 directory = readOnly ? safeExistingDirectory(directory) : await ensureSafeDirectory(directory); const filename = join(directory, 'session.sqlite');
 const paths = ['', '-journal', '-wal', '-shm'].map(suffix => filename + suffix);
 for (const path of paths) safeFile(path);
 if(readOnly&&paths.slice(1).some(path=>safeFile(path)))fail('SESSION_READ_SIDECAR_UNSUPPORTED');
 let fresh = false;
 if (!safeFile(filename)) {
  if(readOnly)fail('SESSION_NOT_FOUND');
  if (paths.slice(1).some(path => safeFile(path))) fail('ORPHAN_SESSION_SIDECAR');
  const handle = openSync(filename, 'wx', 0o600); closeSync(handle); fresh = true;
 }
 else {
  const handle = openSync(filename, 'r'); try { const bytes = Buffer.alloc(16); if (readSync(handle, bytes, 0, 16, 0) !== 16 || bytes.toString() !== 'SQLite format 3\0') fail('UNSUPPORTED_SESSION_SCHEMA'); } finally { closeSync(handle); }
 }
 function authorityFrom(connection) {
  const rows=connection.prepare('SELECT * FROM document_authority').all();
  if(rows.length!==1||rows[0].singleton!==1)fail('DOCUMENT_AUTHORITY_UNAVAILABLE');
  return validateDocumentAuthority(parsed(rows[0].fact,4096));
 }
 function grantFrom(connection, documentId) {
  const row=connection.prepare('SELECT * FROM document_grants WHERE document_id=?').get(documentId);if(!row)fail('DOCUMENT_GRANT_UNAVAILABLE');
  const manifest=validateDocumentManifest(parsed(row.manifest,4096));
  if(row.document_id!==manifest.documentId||row.manifest_hash!==documentManifestHash(manifest)||!['allowed','revoked'].includes(row.status)||row.auth_revision!==(row.status==='allowed'?1:2))fail('CORRUPT_DOCUMENT_GRANT');
  return {...row,manifest};
 }
 function queryHash(query){if(typeof query!=='string'||!query.trim()||Buffer.byteLength(query)>512)fail('INVALID_PROTECTED_QUERY');return digest(JSON.stringify({query,limit:2}));}
 function queryValue(fact){return {candidates:fact.candidates.map(({documentId,page,score})=>({documentId,page,score})),acquired:false};}
 function queryFactFrom(connection,item,current=false){
  const fact=parsed(item.fact,4096);fields(fact,['schemaVersion','authorityId','libraryId','runId','callId','querySha256','limit','candidates'],[],'INVALID_PROTECTED_QUERY_FACT');const authority=authorityFrom(connection),row=connection.prepare('SELECT * FROM runs WHERE run_id=?').get(item.run_id);if(!row)fail('PROTECTED_SCOPE_MISMATCH');const definition=parsed(row.definition,65536);
  if(fact.schemaVersion!=='protected-query-fact@1'||fact.authorityId!==authority.authorityId||fact.libraryId!==authority.libraryId||fact.runId!==item.run_id||fact.callId!==item.call_id||!identifier(fact.callId)||!hash(fact.querySha256)||fact.limit!==2||!Array.isArray(fact.candidates)||fact.candidates.length>2)fail('INVALID_PROTECTED_QUERY_FACT');
  const seen=new Set();for(const candidate of fact.candidates){fields(candidate,['documentId','documentVersion','documentManifestHash','page','score'],[],'INVALID_PROTECTED_QUERY_FACT');const grant=grantFrom(connection,candidate.documentId);if(!definition.config.allowedDocuments.includes(candidate.documentId)||candidate.documentVersion!==grant.manifest.version||candidate.documentManifestHash!==grant.manifest_hash||!Number.isSafeInteger(candidate.page)||candidate.page<1||candidate.page>grant.manifest.pages.length||!Number.isSafeInteger(candidate.score)||candidate.score<1||candidate.score>65536)fail('INVALID_PROTECTED_QUERY_FACT');const id=candidate.documentId+':'+candidate.page;if(seen.has(id))fail('INVALID_PROTECTED_QUERY_FACT');seen.add(id);if(current&&grant.status!=='allowed')fail('DOCUMENT_REVOKED');}
  return fact;
 }
 function validateProtectedDatabase(connection) {
  const rows=connection.prepare('SELECT * FROM document_authority').all();
  if(!rows.length){if(connection.prepare('SELECT 1 FROM document_grants UNION ALL SELECT 1 FROM protected_dependencies UNION ALL SELECT 1 FROM protected_outputs UNION ALL SELECT 1 FROM protected_query_facts UNION ALL SELECT 1 FROM runs').get())fail('DOCUMENT_AUTHORITY_UNAVAILABLE');return;}
  const authority=authorityFrom(connection),grants=connection.prepare('SELECT document_id FROM document_grants ORDER BY document_id').all();
  if(grants.length!==2||grants.map(x=>x.document_id).join(',')!=='atlas-a,atlas-b')fail('CORRUPT_DOCUMENT_GRANT');for(const g of grants)grantFrom(connection,g.document_id);
  for(const row of connection.prepare('SELECT * FROM runs').all()){
   const definition=parsed(row.definition,65536),snapshot=parsed(row.snapshot, MAX_CHECKPOINT_JSON);encodeDefinition(definition);encodeCheckpoint(snapshot,row.status!=='active');validateRuntimeCheckpoint(snapshot,definition);validateRunRoot(row,connection.prepare('SELECT * FROM roots WHERE root_id=?').get(row.root_id),definition,snapshot);
   if(row.parent_run_id!==null||row.root_id!==row.run_id||definition.config.documentProtection.authorityId!==authority.authorityId||definition.config.documentProtection.libraryId!==authority.libraryId)fail('PROTECTED_SCOPE_MISMATCH');if(snapshot.host)validateProtectedHostSnapshot(snapshot.host,{profile:DOCUMENT_REVOCATION_PROFILE,authorityId:authority.authorityId,libraryId:authority.libraryId,rootId:row.root_id,runId:row.run_id});
  }
  for(const item of connection.prepare('SELECT * FROM protected_query_facts').all())queryFactFrom(connection,item);
  for(const output of connection.prepare('SELECT * FROM protected_outputs').all()){
   const row=connection.prepare('SELECT * FROM runs WHERE run_id=?').get(output.run_id);if(!row)fail('PROTECTED_SCOPE_MISMATCH');
   validateProtectedOutputFact(parsed(output.fact,PROTECTED_OUTPUT_BYTES),{profile:DOCUMENT_REVOCATION_PROFILE,authorityId:authority.authorityId,libraryId:authority.libraryId,rootId:row.root_id,runId:row.run_id});
  }
  for(const row of connection.prepare('SELECT * FROM protected_dependencies').all()){
   const run=connection.prepare('SELECT * FROM runs WHERE run_id=?').get(row.run_id);if(!run)fail('PROTECTED_SCOPE_MISMATCH');
   const fact=parsed(row.fact,4096),grant=grantFrom(connection,fact.documentId);validateProtectedSourceBinding(fact,authority,grant.manifest);
   if(row.result_ref!==fact.resultRef||!parsed(run.definition,65536).config.allowedDocuments.includes(fact.documentId))fail('PROTECTED_SCOPE_MISMATCH');
  }
 }
 function scheduleFact(connection, scheduleId) {
  const row=connection.prepare('SELECT * FROM schedule_definitions WHERE schedule_id=?').get(scheduleId);
  if(!row)fail('UNKNOWN_SCHEDULE');
  const envelope=parsed(row.envelope,131072);fields(envelope,['schemaVersion','schedule','definition','snapshot'],[],'INVALID_SCHEDULE');
  if(envelope.schemaVersion!==SCHEDULE_PROFILE)fail('INVALID_SCHEDULE');
  encodeDefinition(envelope.definition);encodeCheckpoint(envelope.snapshot);validateRuntimeCheckpoint(envelope.snapshot,envelope.definition);
  const prepared=prepareSchedule(envelope.schedule,envelope.definition,envelope.snapshot);
  if(row.schedule_id!==prepared.reference.scheduleId||row.confirmation_hash!==prepared.reference.confirmationHash||!Number.isSafeInteger(row.confirmed_at)||row.confirmed_at<0||row.confirmed_at>=Date.parse(envelope.schedule.scheduledInstant))fail('CORRUPT_SCHEDULE');
  const occurrence=connection.prepare('SELECT * FROM schedule_occurrences WHERE schedule_id=?').get(scheduleId);
  if(!occurrence||!['confirmed','materialized','missed','cancelled','revoked'].includes(occurrence.state))fail('CORRUPT_SCHEDULE');
  if(occurrence.state==='confirmed'?(occurrence.decided_at!==null||occurrence.run_id!==null):(!Number.isSafeInteger(occurrence.decided_at)||occurrence.decided_at<row.confirmed_at))fail('CORRUPT_SCHEDULE');
  if(occurrence.state==='materialized'&&occurrence.run_id===null||occurrence.state==='missed'&&occurrence.run_id!==null)fail('CORRUPT_SCHEDULE');
  if(occurrence.state==='missed'&&occurrence.decided_at<Date.parse(envelope.schedule.scheduledInstant)+envelope.schedule.maxLatenessMs)fail('CORRUPT_SCHEDULE');
  if(occurrence.run_id===null&&occurrence.materialized_at!==null)fail('CORRUPT_SCHEDULE');
  if(occurrence.run_id!==null){
   const due=Date.parse(envelope.schedule.scheduledInstant);if(!Number.isSafeInteger(occurrence.materialized_at)||occurrence.materialized_at<due||occurrence.materialized_at>=due+envelope.schedule.maxLatenessMs||occurrence.decided_at<occurrence.materialized_at)fail('CORRUPT_SCHEDULE');
   if(occurrence.run_id!==prepared.runId)fail('CORRUPT_SCHEDULE');
   const run=connection.prepare('SELECT * FROM runs WHERE run_id=?').get(occurrence.run_id);
   if(!run||run.parent_run_id!==null||run.root_id!==run.run_id||scheduleCanonical(parsed(run.definition,65536))!==scheduleCanonical(envelope.definition))fail('CORRUPT_SCHEDULE');
   const snapshot=parsed(run.snapshot,MAX_CHECKPOINT_JSON);encodeCheckpoint(snapshot,snapshot.phase==='terminal');validateRuntimeCheckpoint(snapshot,envelope.definition);validateRunRoot(run,connection.prepare('SELECT * FROM roots WHERE root_id=?').get(run.root_id),envelope.definition,snapshot);
   if(['cancelled','revoked'].includes(occurrence.state)&&run.status==='active')fail('CORRUPT_SCHEDULE');
  }
  return {...prepared,confirmedAt:row.confirmed_at,state:occurrence.state,decidedAt:occurrence.decided_at,materializedRunId:occurrence.run_id,materializedAt:occurrence.materialized_at};
 }
 function validateScheduleDatabase(connection){
  for(const row of connection.prepare('SELECT schedule_id FROM schedule_definitions').all())scheduleFact(connection,row.schedule_id);
  if(connection.prepare('SELECT 1 FROM schedule_occurrences o LEFT JOIN schedule_definitions d ON d.schedule_id=o.schedule_id WHERE d.schedule_id IS NULL').get()||connection.prepare('SELECT 1 FROM runs r LEFT JOIN schedule_occurrences o ON o.run_id=r.run_id WHERE o.run_id IS NULL').get()||connection.prepare('SELECT 1 FROM roots r LEFT JOIN runs x ON x.root_id=r.root_id WHERE x.run_id IS NULL').get())fail('CORRUPT_SCHEDULE');
 }
 function validateSchema(connection) {
  const version = connection.prepare('PRAGMA user_version').get().user_version; const app = connection.prepare('PRAGMA application_id').get().application_id;
  const actual = connection.prepare("SELECT sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.sql);
  if (!(scheduled ? version===5 : protectedProfile ? version===4 : [2,3,6].includes(version)) || (profile === RESPONSE_PROFILE && version !== 3) || (profile === INTERACTION_PROFILE && version !== 6) || app !== APP_ID || JSON.stringify(actual) !== JSON.stringify([...(version===5?[...schemas,...scheduleSchemas]:version===4?[...schemas,...protectedSchemas]:version === 6 ? [...schemas,interactionSchema] : version === 3 ? [...schemas,responseSchema] : schemas)].sort())) fail('UNSUPPORTED_SESSION_SCHEMA');
  interaction = version === 6; ordinary = version === 3 || interaction;
  if(protectedProfile)validateProtectedDatabase(connection);
  if(scheduled)validateScheduleDatabase(connection);
  // Admission (including a hot-journal isolated copy) rejects cross-profile semantics.
  for (const row of connection.prepare('SELECT * FROM runs').iterate()) {
   if(!ordinary){
    // Preserve v2's existing deferred malformed-state rejection; only the new
    // profile's semantic markers are excluded at admission.
    for(const text of [row.definition,row.snapshot]){let value;try{value=JSON.parse(text);}catch{continue;}if(hasResponseSemantics(value))fail('INVALID_ORDINARY_RESPONSE');if(!protectedProfile&&hasProtectedSemantics(value))fail('INVALID_PROTECTED_PROFILE');}
    continue;
   }
   const definition=parsed(row.definition,65536),snapshot=parsed(row.snapshot, MAX_CHECKPOINT_JSON);encodeDefinition(definition);encodeCheckpoint(snapshot,snapshot.phase==='terminal');
   if(ordinary){
    validateRuntimeCheckpoint(snapshot,definition);
    validateRunRoot(row,connection.prepare('SELECT * FROM roots WHERE root_id=?').get(row.root_id),definition,snapshot);
    if(row.parent_run_id!==null||row.root_id!==row.run_id)fail('INVALID_ORDINARY_RESPONSE');
    if(interaction){const slots=connection.prepare('SELECT * FROM human_interactions WHERE run_id=? ORDER BY ordinal').all(row.run_id);validateInteractionRows(slots,{runId:row.run_id,rootId:row.root_id,parentRunId:row.parent_run_id,definition,snapshot});continue;}
    const slot=connection.prepare('SELECT * FROM ordinary_responses WHERE run_id=?').get(row.run_id);
    if(slot){const fact=parsed(slot.fact);validateResponseFact(fact,{runId:row.run_id,rootId:row.root_id,parentRunId:row.parent_run_id,definition,snapshot});if(slot.question_id!==fact.questionId||slot.response_id!==(fact.receipt?.responseId??null))fail('INVALID_ORDINARY_RESPONSE');}
    else validateResponseAbsence(snapshot);
   }
  }
  if(interaction&&connection.prepare('SELECT 1 FROM human_interactions o LEFT JOIN runs r ON r.run_id=o.run_id WHERE r.run_id IS NULL').get())fail('INVALID_HUMAN_INTERACTION');
  if(ordinary&&!interaction&&connection.prepare('SELECT 1 FROM ordinary_responses o LEFT JOIN runs r ON r.run_id=o.run_id WHERE r.run_id IS NULL').get())fail('INVALID_ORDINARY_RESPONSE');
 }
 let db; let closed = false; let identity; let recovery;
 try {
  // An unrelated database must not undergo writable recovery before schema admission.
  if (!fresh && !readOnly) {
   try { const reader = new DatabaseSync(filename, { readOnly: true, timeout: 1000 }); try { validateSchema(reader); } finally { reader.close(); } }
   catch (error) { if (error.errcode !== 776) throw error; recovery = prepareSessionRecovery({ filename, validateSchema }); }
  }
  recovery?.assertCurrent(); recovery?.originalStarting();
  db = new DatabaseSync(filename, { timeout: 1000, readOnly }); safeExistingDirectory(directory); identity = safeFile(filename, true);
  if (fresh) {
   db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; BEGIN IMMEDIATE');
   try { for (const schema of scheduled ? [...schemas,...scheduleSchemas] : protectedProfile ? [...schemas,...protectedSchemas] : interaction ? [...schemas,interactionSchema] : ordinary ? [...schemas,responseSchema] : schemas) db.exec(schema); db.exec(`PRAGMA application_id=${APP_ID}; PRAGMA user_version=${scheduled ? 5 : protectedProfile ? 4 : interaction ? 6 : ordinary ? 3 : SCHEMA_VERSION}; COMMIT`); }
   catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  validateSchema(db);
  if(!readOnly)db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000; PRAGMA synchronous=FULL');
  recovery?.complete(); recovery = undefined;
 } catch (error) { db?.close(); throw recovery ? recovery.failed(error) : error; }
 function ready() { if(readOnly&&paths.slice(1).some(path=>safeFile(path)))fail('SESSION_READ_SIDECAR_UNSUPPORTED'); if (closed) fail('SESSION_CLOSED'); safeExistingDirectory(directory); for (const path of paths) safeFile(path, path === filename); const current = safeFile(filename, true); if (current.ino !== identity.ino || current.dev !== identity.dev) fail('SESSION_FILE_REPLACED'); }
 function now() { const value = clock(); if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_CLOCK'); return value; }
 function transaction(operation) {
  ready(); db.exec(readOnly?'BEGIN':'BEGIN IMMEDIATE');
  try { const value = operation(); if (value && typeof value.then === 'function') fail('ASYNC_TRANSACTION_REFUSED'); db.exec('COMMIT'); return value; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
 }
 const getRun = runId => { if (!identifier(runId)) fail('INVALID_RUN_ID'); const row = db.prepare('SELECT * FROM runs WHERE run_id=?').get(runId); if (!row) fail('UNKNOWN_RUN'); return row; };
 const getRoot = rootId => { const row = db.prepare('SELECT * FROM roots WHERE root_id=?').get(rootId); if (!row) fail('CORRUPT_ROOT'); return row; };
 function view(row) {
  const root = getRoot(row.root_id); const definition = parsed(row.definition, 65536); encodeDefinition(definition); const snapshot = parsed(row.snapshot, MAX_CHECKPOINT_JSON); encodeCheckpoint(snapshot, snapshot.phase === 'terminal');
  validateRunRoot(row, root, definition, snapshot);
  const state = { runId: row.run_id, rootId: row.root_id, parentRunId: row.parent_run_id, directory: row.directory, definition, snapshot, status: row.status, rootStatus: root.status, owner: row.owner, fence: row.fence, leaseUntil: row.lease_until, rootUsage: { model: root.model_used, tool: root.tool_used } };
  if(ordinary){validateRuntimeCheckpoint(snapshot,definition);responseFacts(row,state);}
  if(protectedProfile){validateRuntimeCheckpoint(snapshot,definition);protectedScope(row);if(snapshot.host)validateProtectedHostSnapshot(snapshot.host,outputProtection(row));}
  return state;
 }
 function validateInteractionRows(slots,current){const facts=slots.map(slot=>{const fact=parsed(slot.fact);if(slot.ordinal!==fact.ordinal||slot.question_id!==fact.questionId||slot.response_id!==(fact.receipt?.responseId??null))fail('INVALID_HUMAN_INTERACTION');return fact;});return validateInteractionFacts(facts,current);}
 function interactionFacts(row,state){return validateInteractionRows(db.prepare('SELECT * FROM human_interactions WHERE run_id=? ORDER BY ordinal').all(row.run_id),state??view(row));}
 function responseFacts(row, state) {
  if(!ordinary) fail('ORDINARY_PROFILE_REQUIRED');
  if(interaction)return interactionFacts(row,state).at(-1)??null;
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
 function protectedScope(row) {
  if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');const authority=authorityFrom(db),definition=parsed(row.definition,65536);encodeDefinition(definition);
  if(row.parent_run_id!==null||row.root_id!==row.run_id||canonical(definition.config.documentProtection)!==canonical({authorityId:authority.authorityId,libraryId:authority.libraryId}))fail('PROTECTED_SCOPE_MISMATCH');
  return {authority,definition};
 }
 function currentDependencies(row) {
  if(!protectedProfile)return [];
  const {authority,definition}=protectedScope(row),dependencies=db.prepare('SELECT * FROM protected_dependencies WHERE run_id=? ORDER BY result_ref').all(row.run_id);
  const hints=db.prepare('SELECT * FROM protected_query_facts WHERE run_id=? ORDER BY call_id').all(row.run_id);if(hints.length>definition.limits.maxTools)fail('PROTECTED_QUERY_LIMIT');for(const hint of hints)queryFactFrom(db,hint,true);
  if(dependencies.length>4)fail('PROTECTED_DEPENDENCY_LIMIT');
  return dependencies.map(item=>{const fact=parsed(item.fact,4096),grant=grantFrom(db,fact.documentId);validateProtectedSourceBinding(fact,authority,grant.manifest);if(item.result_ref!==fact.resultRef||!definition.config.allowedDocuments.includes(fact.documentId))fail('PROTECTED_SCOPE_MISMATCH');if(grant.status!=='allowed')fail('DOCUMENT_REVOKED');return fact;});
 }
 function outputProtection(row){const {authority}=protectedScope(row);return validateArtifactProtection({profile:DOCUMENT_REVOCATION_PROFILE,authorityId:authority.authorityId,libraryId:authority.libraryId,rootId:row.root_id,runId:row.run_id});}
 function registeredOutput(row){
  currentDependencies(row);const item=db.prepare('SELECT fact FROM protected_outputs WHERE run_id=?').get(row.run_id);if(!item)return null;return validateProtectedOutputFact(parsed(item.fact,PROTECTED_OUTPUT_BYTES),outputProtection(row));
 }
 function requiredReport(row){
  const output=registeredOutput(row);if(!output)fail('PROTECTED_REPORT_REQUIRED');const state=parsed(row.snapshot, MAX_CHECKPOINT_JSON),receipt=output.reportReceipt;
  if(canonical(state.host?.receipt)!==canonical(receipt))fail('PROTECTED_REPORT_REQUIRED');
  const groupCalls=state.messages.flatMap(m=>m.role==='assistant'?m.calls??[]:[]),call=groupCalls.find(c=>c.id===receipt.operationId);
  const result=state.messages.find(m=>m.role==='tool'&&m.callId===receipt.operationId)?.result;
  if(call?.name!=='save_report'||result?.callId!==call.id||result.status!=='succeeded'||result.dispatched!==true||canonical(result.value)!==canonical(receipt)||result.partialPaths?.length||result.artifactEffects?.length||result.memoryEffect||result.error)fail('PROTECTED_REPORT_REQUIRED');
  return output;
 }
 function publicationFacts(row) {
  publicationScope(row); currentDependencies(row);
  const versions = db.prepare('SELECT * FROM publication_versions WHERE run_id=? ORDER BY revision').all(row.run_id);
  const slot = db.prepare('SELECT event FROM publication_events WHERE run_id=?').get(row.run_id);
  if (!versions.length) { if (slot) fail('PUBLICATION_IDENTITY_UNAVAILABLE'); return []; }
  try {
   if (versions.length > 3 || !slot) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
   const values = versions.map((version, index) => {
    if (version.root_id !== row.root_id || version.revision !== index + 1) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
    const content = parsed(version.body, MAX_PUBLICATION_JSON);
    const prepared = validatePublication({ schemaVersion: 'publication@1', runId: row.run_id, rootId: row.root_id, blockId: 'answer', content, payloadHash: version.payload_hash });
    const binding = parsed(version.binding, 1024); fields(binding, ['definitionHash', 'hostHash',...(protectedProfile?['protectedOutputHash']:[])]);if(protectedProfile){const output=registeredOutput(row);if(!output||binding.protectedOutputHash!==digest(canonical(output)))fail('PUBLICATION_IDENTITY_UNAVAILABLE');}
    if (binding.definitionHash !== digest(row.definition) || !hash(binding.hostHash) || digest(canonical(binding)) !== version.binding_hash) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
    const receipt = validatePublicationReceipt({ schemaVersion: 'publication-receipt@1', runId: row.run_id, rootId: row.root_id, blockId: 'answer', revision: version.revision, deliveryOrdinal: 1, payloadHash: prepared.payloadHash, bindingHash: version.binding_hash });
    return { receipt, content: structuredClone(prepared.content) };
   });
   if (canonical(parsed(slot.event, MAX_PUBLICATION_JSON)) !== canonical(committedPublicationEvent(values.at(-1)))) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
   return values;
  } catch { fail('PUBLICATION_IDENTITY_UNAVAILABLE'); }
 }
 function commitPublication(row, proposed, expectedRevision) {
  publicationScope(row); if(protectedProfile&&!currentDependencies(row).length)fail('PROTECTED_DEPENDENCY_REQUIRED');const protectedOutput=protectedProfile?requiredReport(row):null;
  const prepared = validatePublication(proposed);
  if(prepared.content.assessment)verifyReportDeliveryState(view(row),prepared);
  if (prepared.runId !== row.run_id || prepared.rootId !== row.root_id) fail('PUBLICATION_SCOPE_MISMATCH');
  const replacing = expectedRevision !== undefined;
  if (replacing && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || expectedRevision > 3)) fail('INVALID_PUBLICATION_REVISION');
  const versions = publicationFacts(row); const current = versions.at(-1);
  if (replacing && !current) fail('PUBLICATION_NOT_FOUND');
  if (replacing && current.receipt.revision !== expectedRevision) fail('PUBLICATION_REVISION_MISMATCH');
  const binding = { definitionHash: digest(row.definition), hostHash: digest(canonical(parsed(row.snapshot, MAX_CHECKPOINT_JSON).host ?? null)),...(protectedOutput?{protectedOutputHash:digest(canonical(protectedOutput))}:{}) };
  const bindingHash = digest(canonical(binding));
  if (current && current.receipt.payloadHash === prepared.payloadHash && current.receipt.bindingHash === bindingHash) return { receipt: structuredClone(current.receipt), idempotent: true };
  if (current && !replacing) fail('PUBLICATION_REPLACE_REQUIRED');
  if (current?.receipt.revision >= 3) fail('PUBLICATION_MODIFICATION_LIMIT');
  const receipt = validatePublicationReceipt({ schemaVersion: 'publication-receipt@1', runId: row.run_id, rootId: row.root_id, blockId: 'answer', revision: (current?.receipt.revision ?? 0) + 1, deliveryOrdinal: 1, payloadHash: prepared.payloadHash, bindingHash });
  const event = committedPublicationEvent({ receipt, content: prepared.content });
  db.prepare('INSERT INTO publication_versions(run_id,root_id,revision,body,payload_hash,binding,binding_hash) VALUES(?,?,?,?,?,?,?)').run(row.run_id, row.root_id, receipt.revision, json(prepared.content, MAX_PUBLICATION_JSON), receipt.payloadHash, json(binding, 1024), bindingHash);
  if (current) {
   const changed = db.prepare('UPDATE publication_events SET event=? WHERE run_id=?').run(json(event, MAX_PUBLICATION_JSON), row.run_id);
   if (changed.changes !== 1) fail('PUBLICATION_IDENTITY_UNAVAILABLE');
  } else db.prepare('INSERT INTO publication_events(run_id,event) VALUES(?,?)').run(row.run_id, json(event, MAX_PUBLICATION_JSON));
  return { receipt: structuredClone(receipt), idempotent: false };
 }
 function cancelRoot(rootId) {
  const root = getRoot(rootId); if (root.status !== 'active') return;
  for (const row of db.prepare("SELECT * FROM runs WHERE root_id=? AND status='active'").all(rootId)) {
   const snapshot = cancelRuntimeCheckpoint(parsed(row.snapshot, MAX_CHECKPOINT_JSON));
   db.prepare("UPDATE runs SET snapshot=?,status='cancelled',owner=NULL,lease_until=0 WHERE run_id=?").run(encodeCheckpoint(snapshot, true), row.run_id);
  }
  db.prepare("UPDATE roots SET status='cancelled' WHERE root_id=?").run(rootId);
 }
 function insertRun({ runId = 'run-' + randomUUID(), rootId, parentRunId = null, parentClaim, directory: runDirectory, definition, snapshot }) {
   const encodedDefinition = encodeDefinition(definition); const encodedSnapshot = encodeCheckpoint(snapshot); if(protectedProfile&&parentRunId!==null)fail('PROTECTED_CHILD_UNSUPPORTED'); if (ordinary && parentRunId !== null) fail('ORDINARY_CHILD_UNSUPPORTED'); if (snapshot.phase !== 'ready' || !identifier(runId)) fail('INVALID_CHECKPOINT'); runDirectory = safeExistingDirectory(runDirectory);
    if(protectedProfile){const a=authorityFrom(db);if(canonical(definition.config.documentProtection)!==canonical({authorityId:a.authorityId,libraryId:a.libraryId}))fail('PROTECTED_SCOPE_MISMATCH');for(const documentId of definition.config.allowedDocuments)grantFrom(db,documentId);}
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
     if(canonical(previous.config.documentCatalog??null)!==canonical(definition.config.documentCatalog??null))fail('CHILD_SCOPE_MISMATCH');
     if(canonical(previous.config.pdfSnapshot??null)!==canonical(definition.config.pdfSnapshot??null))fail('CHILD_SCOPE_MISMATCH');
     for (const key of ['allowedTools', 'allowedDocuments']) if (previous.config[key] && (!definition.config[key] || definition.config[key].some(value => !previous.config[key].includes(value)))) fail('CHILD_SCOPE_MISMATCH');
     for (const kind of ['plugins', 'adapters']) if (definition.bindings[kind].some(item => !previous.bindings[kind].some(old => canonical(old) === canonical(item)))) fail('CHILD_BINDING_MISMATCH');
    } else {
     if (rootId !== undefined && rootId !== runId) fail('ROOT_SCOPE_MISMATCH'); rootId = runId;
     db.prepare('INSERT INTO roots(root_id,grant_id,model_limit,tool_limit,deadline_at) VALUES(?,?,?,?,?)').run(rootId, definition.grantId, definition.rootLimits.model, definition.rootLimits.tool, definition.deadlineAt);
    }
    db.prepare('INSERT INTO runs(run_id,root_id,parent_run_id,directory,definition,snapshot,created_at) VALUES(?,?,?,?,?,?,?)').run(runId, rootId, parentRunId, runDirectory, encodedDefinition, encodedSnapshot, now()); return view(getRun(runId));

 }
 function boundSchedule(reference){
  if(!scheduled)fail('SCHEDULE_PROFILE_REQUIRED');validateScheduleReference(reference);
  const fact=scheduleFact(db,reference.scheduleId);
  if(scheduleCanonical(fact.reference)!==scheduleCanonical(reference))fail('SCHEDULE_BINDING_MISMATCH');return fact;
 }
 function scheduleView(fact){return {reference:fact.reference,envelope:fact.envelope,confirmedAt:fact.confirmedAt,state:fact.state,decidedAt:fact.decidedAt,materializedAt:fact.materializedAt,runId:fact.materializedRunId,run:fact.materializedRunId===null?null:view(getRun(fact.materializedRunId))};}
 const store = {
  validateCheckpoint(snapshot) { encodeCheckpoint(snapshot); return true; },
  confirmSchedule({schedule,definition,snapshot}) {
   if(!scheduled)fail('SCHEDULE_PROFILE_REQUIRED');encodeDefinition(definition);encodeCheckpoint(snapshot);validateRuntimeCheckpoint(snapshot,definition);
   const prepared=prepareSchedule(schedule,definition,snapshot),encoded=json(prepared.envelope,131072);
   return transaction(()=>{
    if(db.prepare('SELECT 1 FROM schedule_definitions WHERE schedule_id=?').get(schedule.scheduleId))return scheduleView(boundSchedule(prepared.reference));
    const time=now();if(time>=Date.parse(schedule.scheduledInstant))fail('SCHEDULE_CONFIRMATION_TOO_LATE');
    db.prepare('INSERT INTO schedule_definitions VALUES(?,?,?,?)').run(schedule.scheduleId,encoded,prepared.reference.confirmationHash,time);
    db.prepare("INSERT INTO schedule_occurrences VALUES(?,'confirmed',NULL,NULL,NULL)").run(schedule.scheduleId);
    return scheduleView(boundSchedule(prepared.reference));
   });
  },
  inspectSchedule(reference){return transaction(()=>scheduleView(boundSchedule(reference)));},
  materializeSchedule({reference,definition,snapshot,directory,reportFresh=false}){
   if(typeof reportFresh!=='boolean')fail('INVALID_SCHEDULE_OBSERVATION');
   return transaction(()=>{
    const fact=boundSchedule(reference),prepared=prepareSchedule(fact.envelope.schedule,definition,snapshot);
    if(scheduleCanonical(prepared.reference)!==scheduleCanonical(reference))fail('SCHEDULE_BINDING_MISMATCH');
    if(fact.state!=='confirmed')return scheduleView(fact);
    const time=now(),due=Date.parse(fact.envelope.schedule.scheduledInstant);
    if(time<due)return {...scheduleView(fact),state:'not-due'};
    if(time>=due+fact.envelope.schedule.maxLatenessMs){db.prepare("UPDATE schedule_occurrences SET state='missed',decided_at=? WHERE schedule_id=?").run(time,reference.scheduleId);return scheduleView(boundSchedule(reference));}
    if(directory===undefined)return {...scheduleView(fact),state:'due'};
    insertRun({runId:fact.runId,directory,definition:fact.envelope.definition,snapshot:fact.envelope.snapshot});
    db.prepare("UPDATE schedule_occurrences SET state='materialized',run_id=?,decided_at=?,materialized_at=? WHERE schedule_id=?").run(fact.runId,time,time,reference.scheduleId);
    return {...scheduleView(boundSchedule(reference)),...(reportFresh?{materializedNow:true}:{})};
   });
  },
  cancelSchedule(reference,{revoke=false}={}){
   if(typeof revoke!=='boolean')fail('INVALID_SCHEDULE');return transaction(()=>{
    const fact=boundSchedule(reference);
    if(['cancelled','revoked','missed'].includes(fact.state))return scheduleView(fact);
    if(fact.materializedRunId!==null)cancelRoot(fact.materializedRunId);
    db.prepare('UPDATE schedule_occurrences SET state=?,decided_at=? WHERE schedule_id=?').run(revoke?'revoked':'cancelled',now(),reference.scheduleId);
    return scheduleView(boundSchedule(reference));
   });
  },

  initializeDocumentLibrary(manifests) {
   return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');if(!Array.isArray(manifests)||manifests.length!==2)fail('INVALID_DOCUMENT_LIBRARY');const values=manifests.map(validateDocumentManifest).sort((a,b)=>a.documentId.localeCompare(b.documentId));if(values.map(x=>x.documentId).join(',')!=='atlas-a,atlas-b')fail('INVALID_DOCUMENT_LIBRARY');
    if(db.prepare('SELECT 1 FROM document_authority').get()){const authority=authorityFrom(db);for(const m of values)if(grantFrom(db,m.documentId).manifest_hash!==documentManifestHash(m))fail('DOCUMENT_LIBRARY_ALREADY_INITIALIZED');return authority;}
    if(db.prepare('SELECT 1 FROM runs UNION ALL SELECT 1 FROM document_grants').get())fail('CORRUPT_DOCUMENT_GRANT');
    const authority={schemaVersion:'document-authority@1',authorityId:'authority-'+randomUUID(),libraryId:'library-'+randomUUID()};db.prepare('INSERT INTO document_authority VALUES(1,?)').run(json(authority,4096));for(const m of values)db.prepare("INSERT INTO document_grants VALUES(?,?,?,1,'allowed')").run(m.documentId,json(m,4096),documentManifestHash(m));return authority;
   });
  },
  protectedDependencies(runId){return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');return structuredClone(currentDependencies(getRun(runId)));});},
  verifyProtectedQueryResult(runId,call,value){return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');const row=getRun(runId);currentDependencies(row);fields(call,['id','name','arguments'],[],'INVALID_PROTECTED_QUERY');fields(call.arguments,['query'],[],'INVALID_PROTECTED_QUERY');if(call.name!=='search_pages'||!identifier(call.id))fail('INVALID_PROTECTED_QUERY');const item=db.prepare('SELECT * FROM protected_query_facts WHERE run_id=? AND call_id=?').get(runId,call.id);if(!item)fail('PROTECTED_QUERY_UNBOUND');const fact=queryFactFrom(db,item,true);json(value,4096);if(fact.querySha256!==queryHash(call.arguments.query)||canonical(value)!==canonical(queryValue(fact)))fail('PROTECTED_QUERY_MISMATCH');return queryValue(fact);});},
  readProtectedOutput(runId,request,proof){
   return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');const row=getRun(runId),output=registeredOutput(row);if(!output)fail('PROTECTED_OUTPUT_UNREGISTERED');fields(request,['kind'],['artifactId','revisionId','index'],'INVALID_PROTECTED_READ');
    const keys={report:['kind','artifactId'],attachment:['kind','artifactId'],metadata:['kind','artifactId'],revision:['kind','revisionId'],source:['kind','revisionId','index']}[request.kind];if(!keys)fail('INVALID_PROTECTED_READ');fields(request,keys,[],'INVALID_PROTECTED_READ');
    const attachmentIndex=output.attachmentDescriptors.findIndex(item=>item.artifactId===request.artifactId),descriptor=request.artifactId===output.reportDescriptor.artifactId?output.reportDescriptor:output.attachmentDescriptors[attachmentIndex];
    if(request.artifactId!==undefined&&(!descriptor||request.kind==='report'&&descriptor!==output.reportDescriptor||request.kind==='attachment'&&attachmentIndex<0)||request.revisionId!==undefined&&request.revisionId!==output.revisionId)fail('PROTECTED_SCOPE_MISMATCH');
    if(!proof||canonical(proof.output)!==canonical(output)||!Buffer.isBuffer(proof.revisionBytes)||proof.revisionBytes.length>5242880)fail('INVALID_PROTECTED_READ');let record;try{record=JSON.parse(proof.revisionBytes);}catch{fail('INVALID_PROTECTED_READ');}
    if(!Array.isArray(record.dependencies)||record.dependencies.length>4)fail('INVALID_PROTECTED_READ');const current=currentDependencies(row);for(const dep of record.dependencies)if(!current.some(item=>canonical(item)===canonical(dep)))fail('PROTECTED_SOURCE_UNBOUND');
    validateProtectedOutputProof(proof,outputProtection(row),record.dependencies);
    if(request.kind==='report')return Buffer.from(proof.reportBytes);if(request.kind==='attachment')return Buffer.from(proof.attachmentBytes[attachmentIndex]);if(request.kind==='metadata')return structuredClone(descriptor);if(request.kind==='revision')return structuredClone(record);
    if(!Number.isSafeInteger(request.index)||request.index<0||request.index>=record.sources.length)fail('INVALID_PROTECTED_READ');return validateProtectedSourcePayload(record.sources[request.index]);
   });
  },
  listProtectedOutputs(runId){return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');const output=registeredOutput(getRun(runId));return output?[{revisionId:output.revisionId,reportId:output.reportDescriptor.artifactId,attachmentIds:[...output.reportReceipt.attachmentIds]}]:[];});},
  protectedOutput(runId) {return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');return registeredOutput(getRun(runId));});},
  consumeProtectedSource(runId,source,resultRef){
   return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');const row=getRun(runId),sourceCopy=validateProtectedSourcePayload(source),dependencies=currentDependencies(row),dep=dependencies.find(d=>d.resultRef===resultRef);if(!dep)fail('PROTECTED_SOURCE_UNBOUND');const {authority}=protectedScope(row),grant=grantFrom(db,dep.documentId);const actual=bindProtectedSource({authority,manifest:grant.manifest,source:sourceCopy,resultRef});if(canonical(actual)!==canonical(dep))fail('PROTECTED_SCOPE_MISMATCH');return sourceCopy;});
  },
  documentAuthority() {return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');return authorityFrom(db);});},
  revokeDocument(input) {
   return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');fields(input,['authorityId','libraryId','documentId','expectedRevision']);const authority=authorityFrom(db);if(input.authorityId!==authority.authorityId||input.libraryId!==authority.libraryId||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1)fail('PROTECTED_SCOPE_MISMATCH');const grant=grantFrom(db,input.documentId);
    if(grant.status==='revoked')return {documentId:grant.document_id,status:'revoked',authRevision:grant.auth_revision,idempotent:true};
    if(input.expectedRevision!==grant.auth_revision)fail('DOCUMENT_REVISION_MISMATCH');db.prepare("UPDATE document_grants SET status='revoked',auth_revision=2 WHERE document_id=?").run(grant.document_id);return {documentId:grant.document_id,status:'revoked',authRevision:2,idempotent:false};
   });
  },

  directory, leaseMs, schemaVersion: scheduled ? 5 : protectedProfile ? 4 : interaction ? 6 : ordinary ? 3 : 2,
  create(input) { if(scheduled)fail('SCHEDULE_MATERIALIZATION_REQUIRED'); return transaction(() => insertRun(input)); },
  inspect(runId) { return transaction(() => view(getRun(runId))); },
  readClaim(token) { return transaction(() => { if(!object(token)||!identifier(token.runId)||!identifier(token.owner)||!Number.isSafeInteger(token.fence)||token.fence<1)fail('INVALID_CLAIM'); return view(writer(token.runId,token.owner,token.fence)); }); },
  response(runId, questionId) {
   responseId(questionId);
   return transaction(()=>{const row=getRun(runId);const fact=interaction?interactionFacts(row).find(f=>f.questionId===questionId):responseFacts(row);if(!fact||fact.questionId!==questionId)fail('UNKNOWN_QUESTION');return structuredClone(fact);});
  },
  responseHistory(runId) {return transaction(()=>{const row=getRun(runId),state=view(row);const facts=interaction?interactionFacts(row,state):[responseFacts(row,state)].filter(Boolean);return facts.map(f=>({...structuredClone(f),state:f.adoption?'adopted':state.status!=='active'||state.rootStatus!=='active'?'unavailable':now()>=f.deadlineAt?'expired':f.receipt?'received-not-adopted':'awaiting-response'}));});},
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
    const existing=db.prepare(`SELECT run_id,question_id FROM ${interaction?'human_interactions':'ordinary_responses'} WHERE response_id=?`).get(input.responseId);
    if(existing&&(existing.run_id!==input.runId||existing.question_id!==input.questionId))fail('RESPONSE_ID_CONFLICT');
    const row=getRun(input.runId),state=view(row),fact=interaction?interactionFacts(row,state).find(f=>f.questionId===input.questionId):responseFacts(row,state);
    if(!fact||fact.questionId!==input.questionId){if(existing)fail('RESPONSE_ID_CONFLICT');fail('UNKNOWN_QUESTION');}
    if(fact.receipt){if(fact.receipt.responseId===input.responseId&&fact.receipt.text===input.text)return structuredClone(fact.receipt);fail(fact.receipt.responseId===input.responseId?'RESPONSE_ID_CONFLICT':'QUESTION_ALREADY_ANSWERED');}
    const root=active(row),time=now();if(Math.min(root.deadline_at,fact.deadlineAt)<=time)fail('DEADLINE_EXPIRED');
    fact.receipt={responseId:input.responseId,text:input.text,responseHash:responseHash(input.text),receivedAt:time};if(interaction)validateInteractionFacts(interactionFacts(row,state).map(f=>f.questionId===fact.questionId?fact:f),state);else validateResponseFact(fact,state);
    db.prepare(`UPDATE ${interaction?'human_interactions':'ordinary_responses'} SET response_id=?,fact=? WHERE run_id=? AND question_id=?`).run(input.responseId,json(fact),input.runId,fact.questionId);return structuredClone(fact.receipt);
   });
  },
  confirmResponse(runId,call,result) {
   return transaction(()=>{const row=getRun(runId),fact=interaction?interactionFacts(row).find(f=>f.call.id===call.id):responseFacts(row);if(!fact?.adoption||responseCanonical(call)!==responseCanonical(fact.call)||responseCanonical(result)!==responseCanonical(interaction?interactionResult(fact):responseResult(fact)))fail('INVALID_ORDINARY_RESPONSE');return true;});
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
  listChildren(parentRunId) { return transaction(() => { getRun(parentRunId); const rows=db.prepare('SELECT * FROM runs WHERE parent_run_id=? ORDER BY created_at,run_id').all(parentRunId); if(rows.length>64)fail('CHILD_LIMIT'); return rows.map(view); }); },
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
     const row = writer(runId, owner, fence); if(protectedProfile){const dependencies=currentDependencies(row);if(kind==='tool'){
      const persisted=parsed(row.snapshot, MAX_CHECKPOINT_JSON),call=persisted.proposal?.calls?.[persisted.cursor],incoming=snapshot?.proposal?.calls?.[snapshot?.cursor];
      if(!['proposal-sealed','result-consumed'].includes(persisted.phase)||snapshot?.phase!=='tool-dispatched'||snapshot.cursor!==persisted.cursor||!call||canonical(incoming)!==canonical(call)||canonical(snapshot.proposal)!==canonical(persisted.proposal))fail('PROTECTED_DISPATCH_MISMATCH');
      const {definition}=protectedScope(row);if(definition.config.allowedTools&&!definition.config.allowedTools.includes(call.name))fail('PROTECTED_SCOPE_MISMATCH');
      if(call.name==='read_page'){const grant=grantFrom(db,call.arguments?.documentId);if(!definition.config.allowedDocuments.includes(grant.document_id))fail('PROTECTED_SCOPE_MISMATCH');if(grant.status!=='allowed')fail('DOCUMENT_REVOKED');}
      else if(call.name==='read_result'){if(!dependencies.some(d=>d.resultRef===call.arguments?.resultRef))fail('PROTECTED_SOURCE_UNBOUND');}
      else if(call.name==='create_csv'){if(!dependencies.length)fail('PROTECTED_DEPENDENCY_REQUIRED');fields(call.arguments,['rows'],[],'PROTECTED_CSV_SCOPE');}
      else if(call.name==='search_pages'){fields(call.arguments,['query'],[],'INVALID_PROTECTED_QUERY');queryHash(call.arguments.query);}
      else if(call.name!=='save_report')fail('PROTECTED_TOOL_UNSUPPORTED');
     }} const root = getRoot(row.root_id); if (root[kind + '_used'] >= root[kind + '_limit']) fail('ROOT_BUDGET_EXHAUSTED');
     db.prepare(`UPDATE roots SET ${kind}_used=${kind}_used+1 WHERE root_id=?`).run(rootId);
     if (encoded !== undefined) db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encoded, runId); return view(getRun(runId));
    });
   };
   return Object.freeze({
    queryProtectedPages(callId,query,documents){return transaction(()=>{
     if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');const row=writer(runId,owner,fence),state=view(row).snapshot,call=state.proposal?.calls?.[state.cursor],{authority,definition}=protectedScope(row);currentDependencies(row);const querySha256=queryHash(query);
     if(!definition.config.allowedTools?.includes('search_pages')||state.phase!=='tool-dispatched'||call?.name!=='search_pages'||call.id!==callId||!identifier(callId))fail('PROTECTED_QUERY_DISPATCH_REQUIRED');fields(call.arguments,['query'],[],'INVALID_PROTECTED_QUERY');if(call.arguments.query!==query)fail('PROTECTED_QUERY_MISMATCH');
     if(!Array.isArray(documents)||documents.length!==2)fail('INVALID_PROTECTED_QUERY_CORPUS');json(documents,262144);const ids=new Set();for(const doc of documents){fields(doc,['id','name','version','pages'],[],'INVALID_PROTECTED_QUERY_CORPUS');const grant=grantFrom(db,doc.id);if(ids.has(doc.id)||doc.name!==grant.manifest.name||doc.version!==grant.manifest.version||!Array.isArray(doc.pages)||doc.pages.length!==grant.manifest.pages.length)fail('INVALID_PROTECTED_QUERY_CORPUS');ids.add(doc.id);for(let i=0;i<doc.pages.length;i++)if(typeof doc.pages[i]!=='string'||Buffer.byteLength(doc.pages[i])>64000||digest(doc.pages[i])!==grant.manifest.pages[i].sha256)fail('INVALID_PROTECTED_QUERY_CORPUS');}
     const old=db.prepare('SELECT * FROM protected_query_facts WHERE run_id=? AND call_id=?').get(runId,callId);if(old){const fact=queryFactFrom(db,old,true);if(fact.querySha256!==querySha256)fail('PROTECTED_QUERY_MISMATCH');return queryValue(fact);}
     const allowedDocuments=definition.config.allowedDocuments.filter(id=>grantFrom(db,id).status==='allowed');const candidates=allowedDocuments.length?searchPages({query,documents,allowedDocuments,limit:2}):[];
     const fact={schemaVersion:'protected-query-fact@1',authorityId:authority.authorityId,libraryId:authority.libraryId,runId,callId,querySha256,limit:2,candidates:candidates.map(hit=>{const grant=grantFrom(db,hit.documentId);return {documentId:hit.documentId,documentVersion:grant.manifest.version,documentManifestHash:grant.manifest_hash,page:hit.page,score:hit.score};})};
     if(db.prepare('SELECT COUNT(*) AS n FROM protected_query_facts WHERE run_id=?').get(runId).n>=definition.limits.maxTools)fail('PROTECTED_QUERY_LIMIT');db.prepare('INSERT INTO protected_query_facts VALUES(?,?,?)').run(runId,callId,json(fact,4096));return queryValue(fact);
    });},
    registerProtectedOutput(proof){
     return transaction(()=>{if(!protectedProfile)fail('DOCUMENT_PROFILE_REQUIRED');const row=writer(runId,owner,fence),state=view(row).snapshot,call=state.proposal?.calls?.[state.cursor];
      if(state.phase!=='tool-dispatched'||call?.name!=='save_report'||typeof call.id!=='string')fail('PROTECTED_OUTPUT_DISPATCH_REQUIRED');
      const output=validateProtectedOutputProof(proof,outputProtection(row),currentDependencies(row));if(output.reportReceipt.operationId!==call.id)fail('PROTECTED_OUTPUT_CALL_MISMATCH');
      const old=registeredOutput(row);if(old){if(canonical(old)!==canonical(output))fail('PROTECTED_OUTPUT_CONFLICT');return structuredClone(old.reportReceipt);}
      db.prepare('INSERT INTO protected_outputs(run_id,fact) VALUES(?,?)').run(runId,json(output,PROTECTED_OUTPUT_BYTES));return structuredClone(output.reportReceipt);
     });
    },
    runId, rootId, owner, fence, get leaseUntil() { return store.inspect(runId).leaseUntil; },
    read() { return transaction(() => { writer(runId, owner, fence, false); return view(getRun(runId)); }); },
    renew() { return transaction(() => { writer(runId, owner, fence, false); const until = now() + leaseMs; db.prepare('UPDATE runs SET lease_until=? WHERE run_id=?').run(until, runId); return until; }); },
    rejectProposalGroup(snapshot) {
     const encoded=encodeCheckpoint(snapshot);return transaction(()=>{
      const row=writer(runId,owner,fence),prior=parsed(row.snapshot,MAX_CHECKPOINT_JSON),calls=prior.proposal?.calls,sha=v=>createHash('sha256').update(canonical(v)).digest('hex');
      if(prior.phase!=='proposal-sealed'||prior.cursor!==0||!Array.isArray(calls)||calls.length<2||prior.inFlight||prior.unknownEffects.length||prior.partialEffects.length||prior.gatewayOutcome!=='settled'||snapshot.phase!=='result-consumed'||snapshot.cursor!==calls.length||snapshot.result!==null||snapshot.inFlight!==null||canonical(snapshot.proposal)!==canonical(prior.proposal)||canonical(snapshot.host)!==canonical(prior.host)||snapshot.toolsDispatched!==prior.toolsDispatched||snapshot.rounds!==prior.rounds||snapshot.corrections!==1||snapshot.failureCode!==((prior.corrections??0)>=1?'CORRECTION_LIMIT':null))fail('GROUP_REFUSAL_TRANSITION');
      if(canonical(snapshot.messages.slice(0,prior.messages.length))!==canonical(prior.messages)||snapshot.messages.length!==prior.messages.length+calls.length||canonical(snapshot.usedIds)!==canonical([...prior.usedIds,...calls.map(c=>c.id)])||new Set(snapshot.usedIds).size!==snapshot.usedIds.length)fail('GROUP_REFUSAL_PAIRING');
      const expected={...prior,phase:'result-consumed',cursor:calls.length,result:null,inFlight:null,corrections:1,failureCode:(prior.corrections??0)>=1?'CORRECTION_LIMIT':null,usedIds:[...prior.usedIds,...calls.map(c=>c.id)],messages:snapshot.messages};
      if(canonical(expected)!==canonical(snapshot))fail('GROUP_REFUSAL_STATE_CHANGED');
      const definition=parsed(row.definition,65536);
      let shared;for(let i=0;i<calls.length;i++){
       const call=calls[i],m=snapshot.messages[prior.messages.length+i],r=m?.result,v=r?.validation;
       if(m?.role!=='tool'||m.callId!==call.id||r.callId!==call.id||r.status!=='rejected'||r.dispatched!==false||r.durationMs!==0||v?.schemaVersion!=='specialist-group-refusal@1'||v.runId!==runId||v.groupHash!==sha(calls)||v.requestHash!==sha(call)||canonical(v.callIds)!==canonical(calls.map(c=>c.id))||v.repairable!==true||r.error!==v.code||v.code!==(call.id===v.ownerCallId?'SPECIALIST_SINGLE_CALL_REQUIRED':'GROUP_NOT_DISPATCHED'))fail('GROUP_REFUSAL_IDENTITY');
       fields(m,['role','callId','result']);fields(r,['callId','status','dispatched','error','validation','durationMs']);fields(v,['schemaVersion','runId','ownerBinding','groupHash','callIds','ownerCallId','code','repairable','requestHash']);
       if(calls.filter(c=>c.id===v.ownerCallId).length!==1||!definition.bindings.adapters.some(b=>canonical(b)===canonical(v.ownerBinding)))fail('GROUP_REFUSAL_OWNER_BINDING');
       const identity=canonical({ownerBinding:v.ownerBinding,ownerCallId:v.ownerCallId});if(shared&&shared!==identity)fail('GROUP_REFUSAL_IDENTITY');shared=identity;
      }
      db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encoded,runId);return view(getRun(runId));
     });
    },
    checkpoint(snapshot) { const encoded = encodeCheckpoint(snapshot); return transaction(() => {
     const row=writer(runId, owner, fence),proof=snapshot.result?.validation;
     if(proof?.schemaVersion==='builtin-report-reference-validation@1'){
      const prior=parsed(row.snapshot,MAX_CHECKPOINT_JSON),definition=parsed(row.definition,65536),call=prior.proposal?.calls?.[prior.cursor];
      if(snapshot.phase!=='result-committed'||prior.phase!=='proposal-sealed'||prior.cursor!==0||prior.proposal?.calls?.length!==1||call?.name!=='save_report'||canonical(snapshot.proposal)!==canonical(prior.proposal)||snapshot.cursor!==prior.cursor||proof.runId!==runId||proof.grantId!==definition.grantId||proof.requestHash!==createHash('sha256').update(canonical(call)).digest('hex')||canonical(proof.basis)!==canonical(prior.host?.results)||canonical(snapshot.host)!==canonical(prior.host)||prior.host?.saveAttempted!==false||prior.host?.receipt!==null||prior.inFlight||prior.gatewayOutcome!=='settled'||prior.unknownEffects?.length||prior.partialEffects?.length||snapshot.result.dispatched!==false||snapshot.result.callId!==call.id)fail('REFERENCE_CORRECTION_TRANSITION');
     }
     if(snapshot.result?.deliveryAssessment){
      const prior=parsed(row.snapshot,MAX_CHECKPOINT_JSON),call=prior.proposal?.calls?.[prior.cursor];
      if(prior.phase!=='proposal-sealed'||prior.cursor!==0||prior.proposal?.calls?.length!==1||snapshot.phase!=='result-committed'||snapshot.cursor!==0||canonical(snapshot.proposal)!==canonical(prior.proposal)||canonical(snapshot.messages)!==canonical(prior.messages)||canonical(snapshot.host)!==canonical(prior.host)||snapshot.toolsDispatched!==prior.toolsDispatched||snapshot.rounds!==prior.rounds||canonical(snapshot.usedIds)!==canonical([...prior.usedIds,...(prior.usedIds.includes(call?.id)?[]:[call?.id])]))fail('REPORT_DELIVERY_TRANSITION');
      const consumed={...snapshot,phase:'result-consumed',cursor:1,result:null,messages:[...snapshot.messages,{role:'tool',callId:call.id,result:snapshot.result}]};
      verifyReportDeliveryState({...view(row),snapshot:consumed},{content:{text:call.arguments.text,assessment:publicReportAssessment(snapshot.result.deliveryAssessment,call.arguments.text)}});
     }
     const previous=parsed(row.snapshot,MAX_CHECKPOINT_JSON);
     if(previous.result?.deliveryAssessment&&snapshot.phase==='result-consumed'){
      if(canonical(snapshot.messages)!==canonical([...previous.messages,{role:'tool',callId:previous.result.callId,result:previous.result}])||canonical(snapshot.host)!==canonical(previous.host)||canonical(snapshot.proposal)!==canonical(previous.proposal))fail('REPORT_DELIVERY_TRANSITION');
      const call=previous.proposal.calls[0];verifyReportDeliveryState({...view(row),snapshot},{content:{text:call.arguments.text,assessment:publicReportAssessment(previous.result.deliveryAssessment,call.arguments.text)}});
     }
     db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encoded, runId); return view(getRun(runId)); }); },
    askResponse(expected) {
     return transaction(()=>{
      if(!ordinary)fail('ORDINARY_PROFILE_REQUIRED');
      const row=writer(runId,owner,fence),state=originalResponseState(row,expected,'proposal-sealed');
      const previous=responseFacts(row,state),history=interaction?interactionFacts(row,state):[];if(interaction?(history.length>=state.definition.config.interaction.maxQuestions||previous&&!previous.adoption):previous)fail('QUESTION_LIMIT');
      const snapshot=state.snapshot,proposal=snapshot.proposal;
      if(proposal?.kind!=='calls'||proposal.calls.length!==1||snapshot.cursor!==0)fail('INVALID_ORDINARY_RESPONSE');
      const call=validateResponseCall(proposal.calls[0]);
      if(snapshot.usedIds.includes(call.id)||snapshot.toolsDispatched>=state.definition.limits.maxTools)fail('INVALID_ORDINARY_RESPONSE');
      const root=getRoot(rootId);if(root.tool_used>=root.tool_limit)fail('ROOT_BUDGET_EXHAUSTED');
      const fact={schemaVersion:interaction?INTERACTION_PROFILE:RESPONSE_PROFILE,...(interaction?{ordinal:history.length+1}:{}),runId,rootId,questionId:'question-'+randomUUID(),call:structuredClone(call),questionHash:responseHash(call.arguments.question),createdAt:now(),deadlineAt:state.definition.deadlineAt,receipt:null,adoption:null};
      snapshot.phase='awaiting-response';snapshot.usedIds.push(call.id);snapshot.toolsDispatched++;snapshot.responseQuestion=fact.questionId;
      if(interaction)validateInteractionFacts([...history,fact],{...state,snapshot});else validateResponseFact(fact,{...state,snapshot});
      if(interaction)db.prepare('INSERT INTO human_interactions(run_id,ordinal,question_id,response_id,fact) VALUES(?,?,?,NULL,?)').run(runId,fact.ordinal,fact.questionId,json(fact));else db.prepare('INSERT INTO ordinary_responses(run_id,question_id,response_id,fact) VALUES(?,?,NULL,?)').run(runId,fact.questionId,json(fact));
      db.prepare('UPDATE roots SET tool_used=tool_used+1 WHERE root_id=?').run(rootId);
      db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encodeCheckpoint(snapshot),runId);return view(getRun(runId));
     });
    },
    adoptResponse(expected) {
     return transaction(()=>{
      const row=writer(runId,owner,fence),state=originalResponseState(row,expected,'awaiting-response'),fact=responseFacts(row,state);
      if(!fact?.receipt)return null;if(fact.adoption)fail('INVALID_ORDINARY_RESPONSE');const history=interaction?interactionFacts(row,state):[];
      const snapshot=state.snapshot;snapshot.phase='result-committed';snapshot.result=interaction?interactionResult(fact):responseResult(fact);
      fact.adoption={adoptedAt:now(),checkpointHash:interaction?interactionAdoptionHash(fact):adoptionHash(fact)};if(interaction)validateInteractionFacts(history.map(f=>f.questionId===fact.questionId?fact:f),{...state,snapshot});else validateResponseFact(fact,{...state,snapshot});
      db.prepare(`UPDATE ${interaction?'human_interactions':'ordinary_responses'} SET fact=? WHERE run_id=? AND question_id=?`).run(json(fact),runId,fact.questionId);
      db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(encodeCheckpoint(snapshot),runId);return view(getRun(runId));
     });
    },
    bindProtectedSource(source, resultRef) {
     return transaction(()=>{const row=writer(runId,owner,fence);const {authority,definition}=protectedScope(row);const grant=grantFrom(db,source?.documentId);if(!definition.config.allowedDocuments.includes(grant.document_id))fail('PROTECTED_SCOPE_MISMATCH');if(grant.status!=='allowed')fail('DOCUMENT_REVOKED');const fact=bindProtectedSource({authority,manifest:grant.manifest,source,resultRef});
      const old=db.prepare('SELECT fact FROM protected_dependencies WHERE run_id=? AND result_ref=?').get(runId,resultRef);if(old){if(canonical(parsed(old.fact,4096))!==canonical(fact))fail('PROTECTED_BINDING_MISMATCH');return structuredClone(fact);}
      if(db.prepare('SELECT COUNT(*) AS n FROM protected_dependencies WHERE run_id=?').get(runId).n>=4)fail('PROTECTED_DEPENDENCY_LIMIT');db.prepare('INSERT INTO protected_dependencies VALUES(?,?,?)').run(runId,resultRef,json(fact,4096));return structuredClone(fact);
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
 if(readOnly)return Object.freeze({directory,schemaVersion:scheduled?5:protectedProfile?4:interaction?6:ordinary?3:2,readOnly:true,publication:store.publication,publicationRevisions:store.publicationRevisions,publicationEvent:store.publicationEvent,confirmPublication:store.confirmPublication,inspect:store.inspect,findChild:store.findChild,listChildren:store.listChildren,...(ordinary?{response:store.response,responseStatus:store.responseStatus,responseHistory:store.responseHistory}:{}),...(scheduled?{inspectSchedule:store.inspectSchedule,publication:store.publication,publicationRevisions:store.publicationRevisions,publicationEvent:store.publicationEvent}:{}),...(protectedProfile?{publication:store.publication,publicationRevisions:store.publicationRevisions,publicationEvent:store.publicationEvent,verifyProtectedQueryResult:store.verifyProtectedQueryResult,protectedOutput:store.protectedOutput,consumeProtectedSource:store.consumeProtectedSource,protectedDependencies:store.protectedDependencies,readProtectedOutput:store.readProtectedOutput,listProtectedOutputs:store.listProtectedOutputs}:{}),close:store.close});
 activeAdmissionOwners.set(store,(ticket,persistStop,expired=false)=>transaction(()=>{
  const current=view(getRun(ticket.runId));
  if(ticket.runId!==ticket.rootId||current.parentRunId!==null||current.snapshot.purpose!==undefined)fail('ADMISSION_RELEASE_SCOPE_UNSUPPORTED');
  if(current.rootId!==ticket.rootId||current.status!=='active'||current.rootStatus!=='active'||current.snapshot.phase!=='model-reserved'||current.owner!==ticket.owner||current.fence!==ticket.fence||(expired?current.leaseUntil>now():current.leaseUntil<=now()))fail('ADMISSION_ACTIVE_OWNER_MISMATCH');
  if(db.prepare("SELECT 1 FROM runs WHERE root_id=? AND run_id<>? AND (status='active' OR owner IS NOT NULL OR lease_until<>0)").get(ticket.rootId,ticket.runId))fail('ADMISSION_ACTIVE_CHILD_BLOCKED');
  const input=current.snapshot.working;if(current.snapshot.gatewayOutcome!=='unknown'||current.snapshot.rounds!==ticket.round||current.rootUsage.model!==ticket.modelOrdinal||input?.hash!==ticket.inputHash||!Array.isArray(input.messages)||digest(JSON.stringify(input.messages))!==ticket.inputHash)fail('ADMISSION_TERMINAL_RESERVATION_MISMATCH');
  // Admission's durable gate commits first. If Session commit fails, the gate
  // remains and no release is authorized; later writes/dispatch still stop.
  const event=persistStop();cancelRoot(ticket.rootId);return event;
 }));
 terminalAdmissionOwners.set(store,(ticket,operation)=>transaction(()=>{
  const current=view(getRun(ticket.runId)),root=view(getRun(ticket.rootId));
  if(ticket.runId!==ticket.rootId||current.parentRunId!==null||current.snapshot.purpose!==undefined)fail('ADMISSION_RELEASE_SCOPE_UNSUPPORTED');
  if(current.rootId!==ticket.rootId||root.parentRunId!==null||current.status==='active'||current.rootStatus==='active'||root.status==='active'||current.snapshot.phase!=='terminal'||current.owner!==null||current.leaseUntil!==0||current.fence!==ticket.fence)fail('ADMISSION_RUN_NOT_TERMINAL');
  if(db.prepare("SELECT 1 FROM runs WHERE root_id=? AND (status='active' OR owner IS NOT NULL OR lease_until<>0)").get(ticket.rootId))fail('ADMISSION_RUN_NOT_TERMINAL');
  const input=current.snapshot.purpose==='compaction'?current.snapshot.summaryRequest:current.snapshot.working;
  if(current.snapshot.gatewayOutcome!=='unknown'||current.snapshot.rounds!==ticket.round||current.rootUsage.model!==ticket.modelOrdinal||input?.hash!==ticket.inputHash||!Array.isArray(input.messages)||digest(JSON.stringify(input.messages))!==ticket.inputHash)fail('ADMISSION_TERMINAL_RESERVATION_MISMATCH');
  return operation(Object.freeze({runId:current.runId,rootId:current.rootId,fence:current.fence,modelOrdinal:current.rootUsage.model,snapshotSha256:digest(canonical(current.snapshot)),status:current.status,rootStatus:current.rootStatus,leaseUntil:0,gatewayOutcome:'unknown'}));
 }));
 return Object.freeze(store);
}
