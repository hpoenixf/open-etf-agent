import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { run } from '../src/runtime.mjs';
import { createRootBudget } from '../src/cooperation.mjs';
import { createToolHost } from '../src/tools.mjs';
import { openSession } from '../src/session.mjs';
import { sha256 } from '../src/source.mjs';
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/durable-review-')); }
const bindings = { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'synthetic-review', version: '1' }, plugins: [], adapters: [] };
const limits = { maxRounds: 5, maxTools: 5, timeoutMs: 10000 };
const call = (id, documentId = 'atlas-a') => ({ id, name: 'read_page', arguments: { documentId, page: 1 } });
function options(outputRoot, gateway, extra = {}) { return { question: 'Synthetic review of exact Runtime accounting.', outputRoot, gateway, requireReport: false, limits, ...extra }; }
async function durableOptions(gateway, extra = {}) { const d = await directory(); const store = await openSession({ directory: d }); return { d, store, options: options(d, gateway, { durable: { store, grantId: 'synthetic-review-grant', bindings, ...extra } }) }; }
function mutateSnapshot(d, runId, change, active = false) {
  const db = new DatabaseSync(join(d, 'session.sqlite'));
  try {
    const row = db.prepare('SELECT snapshot FROM runs WHERE run_id=?').get(runId); const snapshot = JSON.parse(row.snapshot); change(snapshot);
    db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(JSON.stringify(snapshot), runId);
    if (active) { db.prepare("UPDATE runs SET status='active',owner=NULL,lease_until=0 WHERE run_id=?").run(runId); db.prepare("UPDATE roots SET status='active' WHERE root_id=?").run(runId); }
  } finally { db.close(); }
}
async function expectCheckpointRefusal(promise) {
  let outcome;
  try { outcome = await promise; } catch (error) { assert.match(error.code || error.message, /CHECKPOINT|OUTCOME|MISMATCH/i); return; }
  assert.equal(outcome.status, 'failed', 'corrupt executable state must not resume as completed');
  assert.match(outcome.code, /CHECKPOINT|OUTCOME|MISMATCH/i);
}

test('7.review exhausted shared non-durable root never counts an undispatched action', async () => {
  const rootBudget = createRootBudget({ model: 3, tool: 1 }); rootBudget.claim('tool');
  const result = await run(options(await directory(), { mode: 'fixture', next: async () => ({ kind: 'calls', calls: [call('not-dispatched')] }) }, { rootBudget }));
  assert.equal(result.status, 'failed'); assert.equal(result.toolsDispatched, 0); assert.deepEqual(result.unknownEffects, []);
  assert.deepEqual(result.rootUsage, { model: 1, tool: 1 });
});
test('7.review real SQLite reservation failure does not count or publish an extra dispatch', async () => {
  const prepared = await durableOptions({ mode: 'fixture', next: async () => ({ kind: 'calls', calls: [call('first'), call('blocked', 'atlas-b')] }) }, { rootLimits: { model: 5, tool: 1 } });
  try {
    const result = await run(prepared.options); assert.equal(result.status, 'failed'); assert.equal(result.toolsDispatched, 1); assert.deepEqual(result.unknownEffects, []);
    assert.deepEqual(result.rootUsage, { model: 1, tool: 1 }); assert.equal(prepared.store.inspect(result.runId).snapshot.toolsDispatched, 1);
  } finally { prepared.store.close(); }
});
test('7.review reconciliation uses the exact persisted effective arguments, not rerun Hook input', async () => {
  let observed; let invoked = 0;
  const host = await createToolHost({ directory: await directory(), extensions: [{ name: 'narrow_child', description: 'Synthetic completed child lookup', parameters: {}, validate: () => {}, execute: async () => { invoked++; }, recoveryVersion: 'synthetic-child@1', reconcile: async args => { observed = args; return { handoff: args.task }; } }] });
  const original = { id: 'c', name: 'narrow_child', arguments: { task: 'original' } }; const effective = { ...original, arguments: { task: 'effective' } };
  const result = await host.reconcile(original, { effective });
  assert.deepEqual(observed, { task: 'effective' }); assert.equal(result.value.handoff, 'effective'); assert.equal(invoked, 0);
});
test('7.review terminal outcome cannot become an independent forged answer', async () => {
  const prepared = await durableOptions({ mode: 'fixture', next: async () => ({ kind: 'final', text: 'Original settled answer.' }) });
  const result = await run(prepared.options); assert.equal(result.status, 'completed'); prepared.store.close();
  mutateSnapshot(prepared.d, result.runId, state => { state.outcome.answer = 'Forged second truth not in the settled Runtime state.'; });
  const store = await openSession({ directory: prepared.d });
  try { await expectCheckpointRefusal(run({ ...prepared.options, durable: { ...prepared.options.durable, store, runId: result.runId } })); }
  finally { store.close(); }
});
test('7.review unpaired persisted tool history is refused before another Gateway call', async () => {
  let calls = 0;
  const gateway = { mode: 'fixture', next: async () => calls++ === 0 ? { kind: 'calls', calls: [call('bound-id')] } : { kind: 'final', text: 'Original settled answer.' } };
  const prepared = await durableOptions(gateway); const result = await run(prepared.options); assert.equal(result.status, 'completed'); prepared.store.close();
  mutateSnapshot(prepared.d, result.runId, state => { state.phase = 'ready'; state.status = 'failed'; state.code = null; state.proposal = null; state.cursor = 0; state.result = null; state.outcome = null; state.messages.find(m => m.role === 'tool').callId = 'wrong-pair'; }, true);
  const store = await openSession({ directory: prepared.d });
  try { await expectCheckpointRefusal(run({ ...prepared.options, durable: { ...prepared.options.durable, store, runId: result.runId } })); assert.equal(calls, 2); }
  finally { store.close(); }
});
test('7.review cancellation after committed report preserves its known receipt on readback', async () => {
  let step = 0;
  const gateway = { mode: 'fixture', next: async ({ messages }) => {
    if (step++ === 0) return { kind: 'calls', calls: [call('source')] };
    if (step === 2) return { kind: 'calls', calls: [{ id: 'saved', name: 'save_report', arguments: { text: '# Synthetic settled effect before cancellation', sourceIds: [messages.at(-1).result.value.sourceId] } }] };
    return { kind: 'final', text: 'Not a cancellation reversal.' };
  } };
  const prepared = await durableOptions(gateway);
  prepared.options.durable.onCheckpoint = ({ phase, callId, runId }) => { if (phase === 'result-committed' && callId === 'saved') prepared.store.cancel(runId); };
  const first = await run(prepared.options); assert.equal(first.status, 'cancelled'); assert.ok(first.receipt?.artifactId, 'original save really completed before cancellation'); prepared.store.close();
  const store = await openSession({ directory: prepared.d });
  try { const restored = await run({ ...prepared.options, durable: { ...prepared.options.durable, store, onCheckpoint: undefined, runId: first.runId } }); assert.equal(restored.status, 'cancelled'); assert.deepEqual(restored.receipt, first.receipt); assert.equal(step, 2); }
  finally { store.close(); }
});
test('7.review duplicate call IDs in an entirely pending suffix cannot replay after reopen', async () => {
  let requests = 0;
  const prepared = await durableOptions({ mode: 'fixture', next: async () => { requests++; return { kind: 'final', text: 'Synthetic baseline.' }; } });
  const result = await run(prepared.options); assert.equal(result.status, 'completed'); prepared.store.close();
  mutateSnapshot(prepared.d, result.runId, state => {
    state.phase = 'proposal-sealed'; state.status = 'failed'; state.code = null; state.answer = ''; state.outcome = null;
    state.proposal = { kind: 'calls', calls: [call('pending-first'), call('duplicated-suffix'), call('duplicated-suffix')] };
    state.messages = [state.messages[0], { role: 'assistant', calls: structuredClone(state.proposal.calls) }]; state.cursor = 0; state.usedIds = []; state.result = null;
  }, true);
  const store = await openSession({ directory: prepared.d });
  try { await expectCheckpointRefusal(run({ ...prepared.options, durable: { ...prepared.options.durable, store, runId: result.runId } })); assert.equal(requests, 1); assert.equal(store.inspect(result.runId).rootUsage.tool, 0); }
  finally { store.close(); }
});
test('7.review a rewound cursor cannot dispatch a call whose result was already consumed', async () => {
  let requests = 0;
  const prepared = await durableOptions({ mode: 'fixture', next: async () => requests++ === 0 ? { kind: 'calls', calls: [call('already-consumed')] } : { kind: 'final', text: 'Original settled result.' } });
  const result = await run(prepared.options); assert.equal(result.status, 'completed'); prepared.store.close();
  mutateSnapshot(prepared.d, result.runId, state => {
    state.phase = 'proposal-sealed'; state.status = 'failed'; state.code = null; state.answer = ''; state.outcome = null;
    state.proposal = { kind: 'calls', calls: structuredClone(state.messages[1].calls) }; state.cursor = 0; state.result = null;
  }, true);
  const store = await openSession({ directory: prepared.d });
  try { await expectCheckpointRefusal(run({ ...prepared.options, durable: { ...prepared.options.durable, store, runId: result.runId } })); assert.equal(requests, 2); assert.equal(store.inspect(result.runId).rootUsage.tool, 1); }
  finally { store.close(); }
});

for (const kind of ['source', 'method']) test(`7.review ${kind} history cannot substitute self-consistent forged bytes for the Host original`, async () => {
  const originalText = 'Original synthetic acquired method.';
  const method = { id: 'original-method', name: 'original-method', text: originalText, sha256: sha256(originalText), version: 'sha256:' + sha256(originalText) };
  const extension = { name: 'review_method', description: 'Read an original synthetic method', parameters: { type: 'object', properties: {}, additionalProperties: false }, methodResult: true, validate: args => assert.deepEqual(args, {}), execute: async () => structuredClone(method) };
  let requests = 0; let replayedText;
  const gateway = { mode: 'fixture', next: async ({ messages }) => {
    requests++;
    if (requests === 1) return { kind: 'calls', calls: [kind === 'source' ? call('typed-original') : { id: 'typed-original', name: 'review_method', arguments: {} }] };
    replayedText = messages.at(-1).result.value.text;
    return { kind: 'final', text: 'Synthetic receipt processed.' };
  } };
  const prepared = await durableOptions(gateway);
  if (kind === 'method') prepared.options.extensions = [extension];
  const first = await run(prepared.options); assert.equal(first.status, 'completed'); assert.equal(requests, 2);
  const before = prepared.store.inspect(first.runId).snapshot;
  // The actual Host originals remain intact and independently reopenable.
  await createToolHost({ directory: first.directory, extensions: prepared.options.extensions, restore: before.host });
  prepared.store.close();
  const forgedText = 'FORGED synthetic payload, not the acquired original.';
  mutateSnapshot(prepared.d, first.runId, state => {
    state.phase = 'ready'; state.status = 'failed'; state.code = null; state.answer = ''; state.outcome = null; state.proposal = null; state.cursor = 0; state.result = null; state.working = null;
    const value = state.messages.find(message => message.role === 'tool').result.value;
    value.text = forgedText; value.sha256 = sha256(forgedText);
    if (kind === 'method') value.version = 'sha256:' + value.sha256;
  }, true);
  const store = await openSession({ directory: prepared.d });
  try {
    let result; let rejection;
    try { result = await run({ ...prepared.options, durable: { ...prepared.options.durable, store, runId: first.runId } }); } catch (error) { rejection = error; }
    assert.equal(requests, 2, 'forged historical bytes must never reach another Gateway request');
    assert.notEqual(replayedText, forgedText);
    if (rejection) assert.ok(rejection instanceof Error); else assert.equal(result.status, 'failed');
  } finally { store.close(); }
});
