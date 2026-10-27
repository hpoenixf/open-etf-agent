import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as runtime from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';

const bindings = { gateway: { mode: 'fixture', provider: 'synthetic', protocol: 'fixture@1', model: 'worker-contract', version: '1' }, plugins: [], adapters: [{ id: 'publication', version: 'publication@1' }] };
async function fixture({ clock = Date.now } = {}) {
 await mkdir('test-output', { recursive: true }); const directory = await mkdtemp(resolve('test-output/worker-')); const store = await openSession({ directory, leaseMs: 100, clock }); let calls = 0;
 const options = { question: 'Synthetic worker: keep the original Run.', outputRoot: join(directory, 'runs'), requireReport: false, publication: true,
  limits: { maxRounds: 3, maxTools: 3, timeoutMs: 5000 }, gateway: { mode: 'fixture', async next() { calls++; return { kind: 'final', text: 'Original bounded worker answer.' }; } },
  durable: { store, runId: 'selected-worker-run', grantId: 'synthetic-worker-grant', bindings, rootLimits: { model: 3, tool: 3 } } };
 return { directory, store, options, calls: () => calls };
}
async function submit(options) { assert.equal(typeof runtime.submitRun, 'function', 'shared Runtime submission entry is required'); return runtime.submitRun(options); }
async function work(options) { const { workRun } = await import('../src/worker.mjs'); assert.equal(typeof workRun, 'function'); return workRun(options); }

test('9.1 submission persists original ready Run without claim or dispatch', async () => {
 const f = await fixture(); try {
  const saved = await submit(f.options); assert.equal(saved.runId, f.options.durable.runId); assert.equal(saved.rootId, saved.runId); assert.equal(saved.status, 'active');
  assert.equal(saved.snapshot.phase, 'ready'); assert.equal(saved.owner, null); assert.equal(saved.fence, 0); assert.deepEqual(saved.rootUsage, { model: 0, tool: 0 }); assert.equal(f.calls(), 0);
  assert.deepEqual(f.store.inspect(saved.runId), saved); await assert.rejects(stat(join(saved.directory, 'run.jsonl')), { code: 'ENOENT' });
 } finally { f.store.close(); }
});
test('9.1 repeated admission keeps original deadline and changed definition cannot replace it', async () => {
 const f = await fixture(); try {
  const saved = await submit(f.options); await delay(10); const again = await submit(f.options); assert.deepEqual(again, saved);
  for (const changed of [{ question: 'A different request.' }, { limits: { ...f.options.limits, maxRounds: 4 } }, { durable: { ...f.options.durable, deadlineAt: saved.definition.deadlineAt + 1 } }]) {
   await assert.rejects(submit({ ...f.options, ...changed }), /RUN_BINDINGS_MISMATCH/);
  }
  assert.deepEqual(f.store.inspect(saved.runId), saved); assert.equal(f.calls(), 0);
 } finally { f.store.close(); }
});
test('9.2 non-user host stop preserves a sealed checkpoint instead of writing user cancel or terminal success', async () => {
 const f = await fixture(); const stop = new AbortController(); let runId;
 try {
  const outcome = await runtime.run({ ...f.options, hostSignal: stop.signal, durable: { ...f.options.durable, runId: undefined, onClaim(value) { runId = value.runId; }, onCheckpoint(value) { if (value.phase === 'proposal-sealed') stop.abort(); } } });
  assert.equal(outcome.status, 'interrupted'); assert.equal(outcome.code, 'HOST_STOPPED'); const state = f.store.inspect(runId);
  assert.equal(state.status, 'active'); assert.equal(state.snapshot.phase, 'proposal-sealed'); assert.equal(state.owner, null); assert.equal(state.rootUsage.model, 1); assert.equal(f.calls(), 1);
  const resumed = await runtime.run({ ...f.options, durable: { ...f.options.durable, runId } }); assert.equal(resumed.status, 'completed'); assert.equal(f.calls(), 1);
 } finally { f.store.close(); }
});
test('9.2 host stop while a model request is pending retains its original unknown reservation', async () => {
 const f = await fixture(); const stop = new AbortController(), fallbackCancel = new AbortController(); let runId, calls = 0, aborted = false;
 const fallback = setTimeout(() => fallbackCancel.abort(), 300);
 try {
  const outcome = await runtime.run({ ...f.options, hostSignal: stop.signal, signal: fallbackCancel.signal,
   gateway: { mode: 'fixture', async next({ signal }) { calls++; stop.abort(); if (signal.aborted) { aborted = true; throw signal.reason; } await new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true })); } },
   durable: { ...f.options.durable, runId: undefined, onClaim(value) { runId = value.runId; } } });
  assert.equal(outcome.status, 'interrupted'); assert.equal(aborted, true); const state = f.store.inspect(runId);
  assert.equal(state.status, 'active'); assert.equal(state.snapshot.phase, 'model-reserved'); assert.equal(state.rootUsage.model, 1); assert.equal(calls, 1);
  const observed = await work({ ...f.options, durable: { ...f.options.durable, runId } }); assert.equal(observed.run.status, 'failed'); assert.equal(observed.run.snapshot.code, 'MODEL_OUTCOME_UNKNOWN'); assert.equal(f.calls(), 0);
  const again = await work({ ...f.options, durable: { ...f.options.durable, runId } }); assert.equal(again.run.snapshot.code, 'MODEL_OUTCOME_UNKNOWN'); assert.equal(f.calls(), 0); assert.equal(again.run.rootUsage.model, 1);
 } finally { clearTimeout(fallback); f.store.close(); }
});
test('9.2 bounded Worker executes the same original Run and terminal repetition only reads its receipt', async () => {
 const f = await fixture(); try {
  const saved = await submit(f.options); const first = await work(f.options); assert.equal(first.workerStatus, 'settled'); assert.equal(first.run.status, 'completed'); assert.equal(first.run.runId, saved.runId); assert.equal(first.run.rootId, saved.rootId);
  const body = f.store.publication(saved.runId); assert.ok(body); assert.equal(body.receipt.revision, 1); assert.equal(f.calls(), 1);
  const second = await work(f.options); assert.equal(second.run.status, 'completed'); assert.deepEqual(second.run.rootUsage, first.run.rootUsage); assert.equal(f.calls(), 1); assert.deepEqual(f.store.publication(saved.runId), body);
 } finally { f.store.close(); }
});
test('9.2 mismatched admission cannot dispatch and a live claim cannot be displaced', async () => {
 const f = await fixture(); let claim; try {
  const saved = await submit(f.options); await assert.rejects(work({ ...f.options, question: 'Changed question.' }), /RUN_BINDINGS_MISMATCH/);
  claim = f.store.claim(saved.runId, 'existing-owner'); const observed = await work(f.options); assert.equal(observed.workerStatus, 'busy'); assert.equal(observed.run.owner, 'existing-owner'); assert.equal(observed.run.fence, claim.fence); assert.equal(f.calls(), 0);
 } finally { claim?.release(); f.store.close(); }
});
test('9.2 explicit cancellation before work is durable and starts no model request', async () => {
 const f = await fixture(); try {
  const saved = await submit(f.options); f.store.cancel(saved.runId); const result = await work(f.options); assert.equal(result.run.status, 'cancelled'); assert.equal(f.calls(), 0); assert.deepEqual(result.run.rootUsage, { model: 0, tool: 0 });
 } finally { f.store.close(); }
});
test('9.2 explicit cancel wins a host-stop race without erasing an independently committed body', async () => {
 // This race starts after publication; unrelated wall-clock lease expiry must not prevent its setup.
 const now = Date.now(); const f = await fixture({ clock: () => now });
 const stop = new AbortController(), cancel = new AbortController(); let original, cancelledBeforeHostStop;
 try {
  const outcome = await runtime.run({ ...f.options, hostSignal: stop.signal, signal: cancel.signal, durable: { ...f.options.durable, runId: undefined, onPublication(value) {
   original = value.receipt; assert.deepEqual(f.store.confirmPublication(original).receipt, original);
   cancel.abort(); cancelledBeforeHostStop = f.store.inspect(original.runId).status; stop.abort();
  } } });
  const diagnostic = `outcome=${outcome.status}/${outcome.code}`;
  assert.ok(original, `Publication must commit before the cancellation race: ${diagnostic}`);
  assert.equal(cancelledBeforeHostStop, 'cancelled', `User cancellation must persist before host stop: ${diagnostic}`);
  assert.equal(outcome.status, 'cancelled', diagnostic); assert.equal(f.store.inspect(original.runId).status, 'cancelled'); assert.deepEqual(f.store.confirmPublication(original).receipt, original);
 } finally { f.store.close(); }
});
test('9.2 an unacknowledged model stop retains the lease and original reservation instead of promising clean handoff', async () => {
 const f = await fixture(); const stop = new AbortController(); let finish, runId;
 try {
  const outcome = await runtime.run({ ...f.options, hostSignal: stop.signal, gateway: { mode: 'fixture', next() { stop.abort(); return new Promise(resolve => { finish = resolve; }); } }, durable: { ...f.options.durable, runId: undefined, onClaim(value) { runId = value.runId; } } });
  assert.equal(outcome.status, 'interrupted'); assert.equal(outcome.interruption.effectsStopped, false); assert.equal(outcome.interruption.leaseReleased, false);
  const state = f.store.inspect(runId); assert.equal(state.status, 'active'); assert.equal(state.snapshot.phase, 'model-reserved'); assert.ok(state.owner); assert.equal(state.rootUsage.model, 1);
  finish({ kind: 'final', text: 'Late synthetic response is not adopted.' }); await delay(0); assert.deepEqual(f.store.inspect(runId), state); assert.equal(f.store.publication(runId), null);
 } finally { finish?.({ kind: 'final', text: 'Late fixture cleanup.' }); await delay(0); f.store.close(); }
});
test('9.2 a stale original token cannot mutate or settle while the Worker holds its newer execution fence', async () => {
 const f = await fixture(); let release, pending; try {
  const saved = await submit(f.options); const old = f.store.claim(saved.runId, 'expired-owner'); await delay(130);
  let enter; const entered = new Promise(resolve => { enter = resolve; }); const held = new Promise(resolve => { release = resolve; });
  pending = work({ ...f.options, durable: { ...f.options.durable, async onCheckpoint(value) { if (value.phase === 'proposal-sealed') { enter(); await held; } } } });
  await Promise.race([entered, pending.then(() => { throw new Error('Worker ended before controlled checkpoint'); })]); const current = f.store.inspect(saved.runId); assert.ok(current.fence > old.fence);
  for (const mutation of [() => old.renew(), () => old.checkpoint(current.snapshot), () => old.reserve('model', current.snapshot), () => old.finish({ ...current.snapshot, phase: 'terminal', status: 'completed' })]) assert.throws(mutation, { code: 'STALE_WRITER' });
  release(); const seen = await pending; assert.equal(seen.run.status, 'completed'); assert.equal(f.calls(), 1);
 } finally { release?.(); await pending?.catch(() => {}); f.store.close(); }
});
test('9.2 Worker observes later report failure without deleting Publication or presenting it as Run success', async () => {
 const f = await fixture(); try {
  const options = { ...f.options, requireReport: true }; await submit(options); const result = await work(options);
  assert.equal(result.workerStatus, 'settled'); assert.equal(result.run.status, 'failed'); assert.equal(result.run.snapshot.code, 'REPORT_REQUIRED'); assert.ok(result.publication);
  assert.equal(f.store.confirmPublication(result.publication).content.text, 'Original bounded worker answer.');
 } finally { f.store.close(); }
});
