import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { run, submitRun } from '../src/runtime.mjs';
import { workRun } from '../src/worker.mjs';
import { openSession } from '../src/session.mjs';

globalThis.fetch = () => { throw new Error('OFFLINE_TEST_FETCH_FORBIDDEN'); };
async function fixture() {
 await mkdir('test-output', { recursive: true }); const directory = await mkdtemp(resolve('test-output/worker-foundation-'));
 const store = await openSession({ directory }); let calls = 0;
 const options = { question: 'Synthetic same-Run Worker foundation regression.', outputRoot: join(directory, 'runs'), publication: true, requireReport: false,
  allowedTools: ['read_page', 'read_result'], contextBytes: 4000, limits: { maxRounds: 36, maxTools: 72, timeoutMs: 3600000 },
  gateway: { mode: 'fixture', async next() { calls++; return { kind: 'final', text: 'Immediate synthetic Worker result.' }; } },
  durable: { store, runId: 'selected-foundation-run', grantId: 'foundation-worker', rootLimits: { model: 57, tool: 72 }, bindings: { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'foundation-worker', version: '1' }, plugins: [], adapters: [{ id: 'publication', version: 'publication@1' }] } } };
 return { store, options, calls: () => calls };
}

test('Worker submission accepts one hour without dispatch, keeps original deadline, and rejects overflow', async () => {
 const f = await fixture(); try {
  const first = await submitRun(f.options); assert.equal(f.calls(), 0); assert.equal(first.owner, null); assert.equal(first.snapshot.phase, 'ready'); assert.deepEqual(first.rootUsage, { model: 0, tool: 0 });
  assert.equal(first.definition.limits.timeoutMs, 3600000); assert.deepEqual(await submitRun(f.options), first);
  await assert.rejects(submitRun({ ...f.options, limits: { ...f.options.limits, timeoutMs: 3600001 } }), e => e.code === 'INVALID_LIMIT');
  await assert.rejects(submitRun({ ...f.options, durable: { ...f.options.durable, deadlineAt: first.definition.deadlineAt + 1 } }), e => e.code === 'RUN_BINDINGS_MISMATCH');
  assert.deepEqual(f.store.inspect(first.runId), first); assert.equal(f.calls(), 0);
 } finally { f.store.close(); }
});

test('new Worker submission enforces selected consumers before creating a Run and retains unsupported lifecycle guards', async () => {
 const f = await fixture(); try {
  await assert.rejects(submitRun({ ...f.options, allowedTools: ['read_page'] }), e => e.code === 'WORKING_INPUT_TOOL_UNAVAILABLE');
  assert.throws(() => f.store.inspect(f.options.durable.runId), e => e.code === 'UNKNOWN_RUN'); assert.equal(f.calls(), 0);
  await assert.rejects(submitRun({ ...f.options, workingInput: { compaction: { thresholdBytes: 1000, summarize: async () => 'not called' } } }), e => e.code === 'UNSUPPORTED_WORKER_CONFIGURATION');
  await assert.rejects(submitRun({ ...f.options, extensions: [{}] }), e => e.code === 'UNSUPPORTED_WORKER_CONFIGURATION');
  await assert.rejects(run({ ...f.options, hostSignal: new AbortController().signal, hooks: {} }), e => e.code === 'UNSUPPORTED_WORKER_CONFIGURATION');
  assert.throws(() => f.store.inspect(f.options.durable.runId), e => e.code === 'UNKNOWN_RUN'); assert.equal(f.calls(), 0);
 } finally { f.store.close(); }
});

test('Worker stop after committed tool receipt adds no unknown effect and resumes same Run without repeating the tool', async () => {
 const f = await fixture(), stop = new AbortController(); let calls = 0;
 const options = { ...f.options, gateway: { mode: 'fixture', async next() { calls++; return calls === 1 ? { kind: 'calls', calls: [{ id: 'original-read', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] } : { kind: 'final', text: 'Original source read once; same Worker Run resumed.' }; } }, durable: { ...f.options.durable, onCheckpoint(value) { if (value.phase === 'result-committed') stop.abort(); } } };
 try {
  const submitted = await submitRun(options); const first = await workRun({ ...options, hostSignal: stop.signal });
  assert.equal(first.workerStatus, 'interrupted'); assert.equal(first.run.status, 'active'); assert.equal(first.run.snapshot.phase, 'result-committed'); assert.equal(first.run.owner, null); assert.deepEqual(first.run.snapshot.unknownEffects, []); assert.deepEqual(first.run.rootUsage, { model: 1, tool: 1 }); assert.equal(calls, 1);
  const second = await workRun(options); assert.equal(second.workerStatus, 'settled'); assert.equal(second.run.status, 'completed'); assert.equal(second.run.runId, submitted.runId); assert.equal(second.run.definition.deadlineAt, submitted.definition.deadlineAt); assert.deepEqual(second.run.snapshot.unknownEffects, []); assert.deepEqual(second.run.rootUsage, { model: 2, tool: 1 }); assert.equal(calls, 2);
  const body = f.store.confirmPublication(second.publication); assert.equal(body.receipt.revision, 1); assert.deepEqual(await workRun(options), second); assert.equal(calls, 2); assert.equal(f.store.publicationRevisions(second.run.runId).length, 1);
 } finally { f.store.close(); }
});
