import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { run } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
const bindings = { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'publication-test', version: '1' }, plugins: [], adapters: [{ id: 'publication', version: 'publication@1' }] };
async function fixture() {
 await mkdir('test-output', { recursive: true }); const directory = await mkdtemp(resolve('test-output/publication-runtime-')); const store = await openSession({ directory }); let calls = 0;
 const options = { question: 'Synthetic plain Markdown reply.', outputRoot: join(directory, 'runs'), requireReport: false, publication: true, gateway: { mode: 'fixture', async next() { calls++; return { kind: 'final', text: 'Original synthetic answer.' }; } }, limits: { maxRounds: 3, maxTools: 3, timeoutMs: 5000 }, durable: { store, grantId: 'synthetic-publication-grant', bindings } };
 return { directory, store, options, calls: () => calls };
}
test('8.2 same Runtime publishes sealed final text and confirms original receipt on terminal resume', async () => {
 const f = await fixture(); try {
  const outcome = await run(f.options); assert.equal(outcome.status, 'completed'); assert.ok(outcome.publication, 'durable body receipt required');
  assert.equal(f.store.confirmPublication(outcome.publication).content.text, outcome.answer);
  const again = await run({ ...f.options, durable: { ...f.options.durable, runId: outcome.runId } });
  assert.deepEqual(again.publication, outcome.publication); assert.equal(f.calls(), 1); assert.equal(f.store.publicationRevisions(outcome.runId).length, 1);
 } finally { f.store.close(); }
});
test('8.2 missing or changed Publication binding refuses before a model request', async () => {
 const f = await fixture(); try {
  await assert.rejects(run({ ...f.options, durable: { ...f.options.durable, bindings: { ...bindings, adapters: [] } } }), /PUBLICATION_BINDING/);
  await assert.rejects(run({ ...f.options, publication: false }), /PUBLICATION_BINDING/);
  await assert.rejects(run({ ...f.options, durable: { ...f.options.durable, bindings: { ...bindings, adapters: [{ id: 'publication', version: 'future' }] } } }), /PUBLICATION_BINDING/);
  assert.equal(f.calls(), 0);
 } finally { f.store.close(); }
});
test('8.2 committed body survives a later report-required failure without inventing report receipt', async () => {
 const f = await fixture(); try {
  const outcome = await run({ ...f.options, requireReport: true }); assert.equal(outcome.status, 'failed'); assert.equal(outcome.code, 'REPORT_REQUIRED'); assert.equal(outcome.receipt, null);
  assert.ok(outcome.publication); assert.equal(f.store.confirmPublication(outcome.publication).content.text, 'Original synthetic answer.');
  assert.equal(f.store.inspect(outcome.runId).status, 'failed');
 } finally { f.store.close(); }
});
test('8.2 post-commit local failure preserves body independently of failed terminal', async () => {
 const f = await fixture(); let receipt; try {
  const outcome = await run({ ...f.options, durable: { ...f.options.durable, onPublication(value) { receipt = value.receipt; throw Object.assign(new Error('SYNTHETIC_AFTER_COMMIT'), { code: 'SYNTHETIC_AFTER_COMMIT' }); } } });
  assert.equal(outcome.code, 'SYNTHETIC_AFTER_COMMIT'); assert.equal(outcome.status, 'failed'); assert.ok(receipt);
  assert.deepEqual(f.store.confirmPublication(receipt).receipt, receipt); assert.deepEqual(outcome.publication, receipt);
 } finally { f.store.close(); }
});
test('8.2 cancellation after commit preserves original body and does not complete Run', async () => {
 const f = await fixture(); const abort = new AbortController(); try {
  const outcome = await run({ ...f.options, signal: abort.signal, durable: { ...f.options.durable, onPublication() { abort.abort(); } } });
  assert.equal(outcome.status, 'cancelled'); assert.ok(outcome.publication); assert.deepEqual(f.store.confirmPublication(outcome.publication).receipt, outcome.publication);
  assert.equal(f.store.inspect(outcome.runId).status, 'cancelled'); assert.equal(f.calls(), 1);
 } finally { f.store.close(); }
});
test('8.2 terminal resume refuses a forged Publication receipt rather than echoing checkpoint success', async () => {
 const f = await fixture(); try {
  const outcome = await run(f.options); assert.ok(outcome.publication);
  const db = new DatabaseSync(join(f.directory, 'session.sqlite')); try {
   const row = db.prepare('SELECT snapshot FROM runs WHERE run_id=?').get(outcome.runId); const snapshot = JSON.parse(row.snapshot); snapshot.outcome.publication.payloadHash = '0'.repeat(64); snapshot.publication = snapshot.outcome.publication;
   db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(JSON.stringify(snapshot), outcome.runId);
  } finally { db.close(); }
  await assert.rejects(run({ ...f.options, durable: { ...f.options.durable, runId: outcome.runId } }), /PUBLICATION_IDENTITY/); assert.equal(f.calls(), 1);
 } finally { f.store.close(); }
});
async function child(directory, stop, runId = '') {
 const process = fork(new URL('./fixtures/publication-process.mjs', import.meta.url), [directory, stop, runId], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] });
 const messages = []; let stderr = ''; process.stdout.resume(); process.stderr.on('data', x => { stderr += x; }); process.on('message', x => messages.push(x));
 const exited = once(process, 'exit').then(([code, signal]) => ({ code, signal }));
 return { process, exited, async wait(kind) { const end = Date.now() + 7000; while (Date.now() < end) { const message = messages.find(x => x.kind === kind); if (message) return message; if (process.exitCode !== null || process.signalCode) throw new Error('Publication child exited early: ' + stderr); await delay(10); } throw new Error('Publication child timed out: ' + stderr); }, async stop() { if (process.exitCode === null && !process.signalCode) process.kill('SIGKILL'); return exited; } };
}
test('8.2 actual process death after body commit resumes original receipt without another model call', async () => {
 await mkdir('test-output', { recursive: true }); const directory = await mkdtemp(resolve('test-output/publication-crash-')); const first = await child(directory, 'after-commit'); let committed;
 try { committed = await first.wait('committed'); } finally { await first.stop(); }
 const store = await openSession({ directory }); try { assert.equal(store.inspect(committed.runId).status, 'active'); assert.deepEqual(store.confirmPublication(committed.receipt).receipt, committed.receipt); } finally { store.close(); }
 await delay(200); const second = await child(directory, '', committed.runId);
 try {
  const result = await second.wait('outcome'); assert.notEqual(first.process.pid, second.process.pid); assert.equal((await second.exited).code, 0); assert.equal(result.outcome.status, 'completed'); assert.deepEqual(result.outcome.publication, committed.receipt);
  const calls = (await readFile(join(directory, 'synthetic-model-attempts.txt'), 'utf8')).trim().split('\n'); assert.equal(calls.length, 1); assert.equal(result.outcome.rootUsage.model, 1);
  const restored = await openSession({ directory }); try { assert.equal(restored.publicationRevisions(committed.runId).length, 1); assert.equal(restored.publicationEvent(committed.runId).receipt.revision, 1); } finally { restored.close(); }
 } finally { await second.stop(); }
});
