import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile, readdir, truncate, symlink, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openSession } from '../src/session.mjs';
import { prepareSessionRecovery } from '../src/session-recovery.mjs';
const MAGIC = Buffer.from('d9d505f920a163d7', 'hex');
const shape = db => ({ version: db.prepare('PRAGMA user_version').get().user_version, app: db.prepare('PRAGMA application_id').get().application_id, sql: db.prepare("SELECT sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.sql) });
async function fixture(kind = 'known') {
 await mkdir('test-output', { recursive: true }); const parent = await mkdtemp(resolve('test-output/admission-')); const directory = join(parent, 'session'); await mkdir(directory, { mode: 0o700 });
 const filename = join(directory, 'session.sqlite');
 if (kind !== 'unknown') { const store = await openSession({ directory }); store.close(); if (kind === 'future') { const db = new DatabaseSync(filename); db.exec('PRAGMA user_version=999'); db.close(); } }
 else { const db = new DatabaseSync(filename); db.exec('CREATE TABLE unrelated(value TEXT)'); db.close(); }
 const db = new DatabaseSync(filename, { readOnly: true }); const expected = shape(db); db.close();
 return { parent, directory, filename, expected };
}
async function killed(f) {
 const child = fork(new URL('./fixtures/session-recovery-process.mjs', import.meta.url), ['spill', f.directory], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
 const ended = once(child, 'exit'), message = once(child, 'message'); const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
 try { const [event] = await Promise.race([message, ended.then(() => { throw Error('writer ended before spill'); })]); assert.equal(event.kind, 'spilled'); child.kill('SIGKILL'); await ended; assert.equal(child.signalCode, 'SIGKILL'); }
 finally { clearTimeout(timer); if (child.exitCode === null && !child.signalCode) { child.kill('SIGKILL'); await ended; } }
}
async function hashes(f) { return Promise.all(['', '-journal'].map(async suffix => createHash('sha256').update(await readFile(f.filename + suffix)).digest('hex'))); }
async function underLock(f, hold, operation) {
 const before = createHash('sha256').update(await readFile(f.filename)).digest('hex');
 const child = fork(new URL('./fixtures/session-recovery-process.mjs', import.meta.url), ['lock', f.directory, String(hold)], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
 const ended = once(child, 'exit'), ready = once(child, 'message'); const kill = setTimeout(() => child.kill('SIGKILL'), 5000);
 try {
  const [event] = await Promise.race([ready, ended.then(() => { throw Error('lock child exited before lock'); })]); assert.equal(event.kind, 'locked'); child.send({ beginBoundedHold: true });
  await operation(); const [code, signal] = await ended; assert.equal(code, 0); assert.equal(signal, null);
  assert.equal(createHash('sha256').update(await readFile(f.filename)).digest('hex'), before);
 } finally { clearTimeout(kill); if (child.exitCode === null && !child.signalCode) { child.kill('SIGKILL'); await ended; } }
}
function validate(expected) { return db => assert.deepEqual(shape(db), expected); }
async function refusal(f, pattern) {
 const before = await hashes(f), names = await readdir(f.directory);
 await assert.rejects(openSession({ directory: f.directory }), pattern);
 assert.deepEqual(await hashes(f), before); assert.deepEqual(await readdir(f.directory), names);
 assert.deepEqual((await readdir(f.parent)).sort(), ['session']);
}
async function persistedRun(f) {
 const store = await openSession({ directory: f.directory, clock: () => 100 });
 const definition = { question: 'Exact synthetic request', grantId: 'grant', bindings: { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture', model: 'synthetic', version: '1' }, plugins: [], adapters: [] }, limits: { maxRounds: 4, maxTools: 4, timeoutMs: 10000 }, rootLimits: { model: 5, tool: 5 }, deadlineAt: 10000, config: {} };
 const run = store.create({ directory: f.directory, definition, snapshot: { schemaVersion: 'runtime-checkpoint@1', phase: 'ready' } });
 const claim = store.claim(run.runId, 'first'); claim.reserve('model', { schemaVersion: 'runtime-checkpoint@1', phase: 'model-reserved' }); claim.release(); const before = store.inspect(run.runId); store.close(); return { run, before };
}
test('Session automatic 776 admission preserves an original Run and accepts legacy files without provenance receipts', async () => {
 const f = await fixture(), { run, before } = await persistedRun(f);
 await killed(f);
 const ro = new DatabaseSync(f.filename, { readOnly: true }); try { assert.throws(() => shape(ro), error => error.errcode === 776); } finally { ro.close(); }
 const store = await openSession({ directory: f.directory, clock: () => 100 }); try { assert.deepEqual(store.inspect(run.runId), before); } finally { store.close(); }
 assert.deepEqual((await readdir(f.parent)).sort(), ['session']);
});
for (const kind of ['unknown', 'future']) test('Session hot ' + kind + ' schema refusal leaves original DB and journal bytes unchanged', async () => {
 const f = await fixture(kind); await killed(f); await refusal(f, /UNSUPPORTED_SESSION_SCHEMA/);
});
test('Session hot journal terminal magic is conservatively refused before any copy recovery', async () => {
 const f = await fixture(); await killed(f); const journal = await readFile(f.filename + '-journal'); await writeFile(f.filename + '-journal', Buffer.concat([journal, MAGIC]));
 await refusal(f, /SESSION_RECOVERY_SUPER_JOURNAL_REFUSED/);
});
test('Session bounded admission rejects oversized rollback target and input without touching originals', async () => {
 const f = await fixture(); await killed(f); const journal = await readFile(f.filename + '-journal'); journal.writeUInt32BE(0x7fffffff, 16); await writeFile(f.filename + '-journal', journal);
 await refusal(f, /SESSION_RECOVERY_SCOPE_EXCEEDED/);
 const g = await fixture(); await killed(g); await truncate(g.filename, 64 * 1048576 + 1); await refusal(g, /SESSION_RECOVERY_SCOPE_EXCEEDED/);
});
test('Session admission refuses WAL sidecars and symlinks without changing DB/journal', async () => {
 const f = await fixture(); await killed(f); await writeFile(f.filename + '-wal', 'synthetic'); await refusal(f, /SESSION_RECOVERY_UNSUPPORTED_SIDECAR/);
 const g = await fixture(); await killed(g); await symlink(g.filename, g.filename + '-shm'); await refusal(g, /UNSAFE_SESSION_FILE/);
});
test('Session copy validation failure cleans its copies but leaves original bytes unchanged', async () => {
 const f = await fixture(); await killed(f); const before = await hashes(f);
 assert.throws(() => prepareSessionRecovery({ filename: f.filename, validateSchema() { throw Object.assign(new Error('synthetic admission failure'), { code: 'SYNTHETIC_COPY_FAILURE' }); } }), /synthetic admission failure/);
 assert.deepEqual(await hashes(f), before); assert.deepEqual((await readdir(f.parent)).sort(), ['session']);
});
test('Normal cold opens retain large compatible databases and backup copies with different inode identities', async () => {
 const f = await fixture(); await truncate(f.filename, 64 * 1048576 + 4096);
 let store = await openSession({ directory: f.directory }); store.close();
 const restored = join(f.parent, 'restored'); await mkdir(restored, { mode: 0o700 }); await copyFile(f.filename, join(restored, 'session.sqlite'));
 store = await openSession({ directory: restored }); store.close();
});
test('Unreviewed SQLite metadata refuses only the 776 path and leaves cold opens unchanged', async () => {
 const cold = await fixture(), hot = await fixture(); await killed(hot); const before = await hashes(hot), descriptor = Object.getOwnPropertyDescriptor(process.versions, 'sqlite');
 try {
  Object.defineProperty(process.versions, 'sqlite', { ...descriptor, value: 'unreviewed-synthetic-version' });
  const store = await openSession({ directory: cold.directory }); store.close();
  await assert.rejects(openSession({ directory: hot.directory }), /SESSION_RECOVERY_UNSUPPORTED_SQLITE/);
 } finally { Object.defineProperty(process.versions, 'sqlite', descriptor); }
 assert.deepEqual(await hashes(hot), before); assert.deepEqual((await readdir(hot.parent)).sort(), ['session']);
});
test('Session copy admission detects later source drift and cleans only its own preflight capture', async () => {
 const f = await fixture(); await killed(f); const admission = prepareSessionRecovery({ filename: f.filename, validateSchema: validate(f.expected) });
 const journal = await readFile(f.filename + '-journal'); journal[12] ^= 1; await writeFile(f.filename + '-journal', journal); const changed = await hashes(f);
 let failure; try { admission.assertCurrent(); } catch (error) { failure = admission.failed(error); }
 assert.equal(failure.code, 'SESSION_RECOVERY_SOURCE_CHANGED'); assert.deepEqual(await hashes(f), changed); assert.deepEqual((await readdir(f.parent)).sort(), ['session']);
});
test('Session post-start failure explicitly retains pristine capture and reports possible effects', async () => {
 const f = await fixture(); await killed(f); const before = await hashes(f); const admission = prepareSessionRecovery({ filename: f.filename, validateSchema: validate(f.expected) });
 admission.assertCurrent(); admission.originalStarting(); const error = admission.failed(Object.assign(new Error('synthetic I/O failure'), { code: 'EIO' }));
 assert.equal(error.code, 'SESSION_RECOVERY_FAILED'); assert.equal(error.recoveryMayHaveEffects, true); assert.equal(error.cause.code, 'EIO');
 const captured = { filename: join(error.recoveryCaptureDirectory, 'session.sqlite') }; assert.deepEqual(await hashes(captured), before); assert.deepEqual(await hashes(f), before);
 // No native write was attempted in this injected boundary test; retention is
 // verified, not a claim that every real native failure is side-effect free.
});
test('Two legitimate processes may race to open a hot Session without a new single-opener lock', async () => {
 const f = await fixture(), { run, before } = await persistedRun(f); await killed(f); const children = [];
 try {
  for (let i = 0; i < 2; i++) {
   const child = fork(new URL('./fixtures/session-recovery-process.mjs', import.meta.url), ['open', f.directory], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
   const ended = once(child, 'exit'); const [ready] = await once(child, 'message'); assert.equal(ready.kind, 'ready'); children.push({ child, ended });
  }
  const responses = children.map(({ child }) => once(child, 'message').then(([m]) => m)); for (const { child } of children) child.send({ start: true });
  const outcomes = await Promise.all(responses); await Promise.all(children.map(({ ended }) => ended));
  for (const o of outcomes.filter(o => !o.ok)) assert(
   (o.code === 'ERR_SQLITE_ERROR' && o.errcode === 5) || (o.code === 'SESSION_RECOVERY_FAILED' && o.causeCode === 'ERR_SQLITE_ERROR' && o.causeErrcode === 5) || o.code === 'SESSION_RECOVERY_SOURCE_CHANGED' || (o.code === 'ENOENT' && o.path === f.filename + '-journal'), JSON.stringify(o));
  const first = await openSession({ directory: f.directory }), second = await openSession({ directory: f.directory });
  try { assert.deepEqual(first.inspect(run.runId), before); assert.deepEqual(second.inspect(run.runId), before); } finally { first.close(); second.close(); }
 } finally { for (const { child, ended } of children) if (child.exitCode === null && !child.signalCode) { child.kill('SIGKILL'); await ended; } }
});
test('Initial readonly admission waits for a real 150ms SQLite lock without application retry', async () => {
 const f = await fixture(), { run, before } = await persistedRun(f);
 await underLock(f, 150, async () => { const started = performance.now(), store = await openSession({ directory: f.directory }); try { assert(performance.now() - started >= 100); assert.deepEqual(store.inspect(run.runId), before); } finally { store.close(); } });
});
test('Initial readonly admission still reports native BUSY beyond its 1000ms bound and later opens normally', async () => {
 const f = await fixture(), { run, before } = await persistedRun(f);
 await underLock(f, 1400, async () => { const started = performance.now(); await assert.rejects(openSession({ directory: f.directory }), error => error.code === 'ERR_SQLITE_ERROR' && error.errcode === 5); assert(performance.now() - started >= 900); });
 const store = await openSession({ directory: f.directory }); try { assert.deepEqual(store.inspect(run.runId), before); } finally { store.close(); }
});
