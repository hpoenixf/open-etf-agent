import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '../src/runtime.mjs';
import { createToolHost } from '../src/tools.mjs';
import { openSession } from '../src/session.mjs';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// This is a valid legacy-shape checkpoint created through the original Session
// API, not a claim that Runtime emitted the synthetic capacity-padding field.
// The actual Runtime consumer must preserve its complete cancellation identity.
test('near-cap original Session cancellation moves a full dispatch once and Runtime cold-reads it without execution', async () => {
  await mkdir('test-output', { recursive: true }); const directory = await mkdtemp(resolve('test-output/cancel-capacity-'));
  const question = 'Synthetic bounded cancellation and original terminal readback.';
  const text = 'x'.repeat(1048576); let modelCalls = 0, toolCalls = 0;
  const extensions = [{ name: 'pending_effect', description: 'Synthetic original pending effect.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }, validate(args) { assert.equal(args.text, text); }, execute() { toolCalls++; throw Error('NO_TERMINAL_DISPATCH'); } }];
  const host = await createToolHost({ directory, extensions });
  const bindings = { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'capacity-runtime', version: '1' }, plugins: [], adapters: [] };
  const limits = { maxRounds: 4, maxTools: 4, timeoutMs: 10000 };
  const definition = { question, grantId: 'capacity-runtime', bindings, limits, rootLimits: { model: 4, tool: 4 }, deadlineAt: Date.now() + 10000, config: { requireReport: false, taskId: null } };
  const call = { id: 'pending-one', name: 'pending_effect', arguments: { text } };
  const dispatch = { callId: call.id, name: call.name, effective: structuredClone(call) };
  const ready = { schemaVersion: 'runtime-checkpoint@1', phase: 'ready', messages: [{ role: 'user', content: question }], usedIds: [], rounds: 0, toolsDispatched: 0, proposal: null, cursor: 0, result: null, host: host.snapshot(), working: null, answer: '', status: 'failed', code: null, unknownEffects: [], partialEffects: [], hookErrors: [] };
  const pending = { ...ready, phase: 'tool-dispatched', messages: [...ready.messages, { role: 'assistant', calls: [call] }], usedIds: [call.id], rounds: 1, toolsDispatched: 1, proposal: { kind: 'calls', calls: [call] }, inFlight: dispatch, payload: 'p'.repeat(8.5 * 1048576) };
  const cap = 12 * 1048576;
  assert.ok(Buffer.byteLength(JSON.stringify(pending)) < cap);
  assert.ok(Buffer.byteLength(JSON.stringify({ ...pending, phase: 'terminal', status: 'cancelled', code: 'CANCELLED' })) < cap, 'the original pre-port cancel shape fit its unchanged cap');
  assert.ok(Buffer.byteLength(JSON.stringify({ ...pending, phase: 'terminal', status: 'cancelled', code: 'CANCELLED', unknownEffects: [{ ...dispatch, status: 'unknown', dispatched: true }] })) > cap, 'duplicating the full dispatch is the actual regression');
  let store = await openSession({ directory }); let runId, saved;
  try {
    runId = store.create({ directory, definition, snapshot: ready }).runId;
    const claim = store.claim(runId, 'original-owner'); claim.reserve('model', { ...ready, phase: 'model-reserved', rounds: 1 }); claim.reserve('tool', pending);
    saved = store.cancel(runId); assert.equal(saved.status, 'cancelled');
    assert.equal(saved.snapshot.unknownEffects.length, 1); assert.equal(Object.hasOwn(saved.snapshot, 'inFlight'), false);
    assert.equal(digest(saved.snapshot.unknownEffects[0]), digest({ ...dispatch, status: 'unknown', dispatched: true }));
    for (const field of ['messages', 'proposal', 'working', 'result', 'payload']) assert.equal(digest(saved.snapshot[field]), digest(pending[field]), field + ' is preserved');
    assert.ok(Buffer.byteLength(JSON.stringify(saved.snapshot)) < cap);
    assert.equal(digest(store.cancel(runId)), digest(saved));
    assert.throws(() => claim.checkpoint(ready), error => error.code === 'RUN_CANCELLED');
  } finally { store.close(); }
  store = await openSession({ directory });
  try {
    const restored = await run({ question, extensions, gateway: { mode: 'fixture', async next() { modelCalls++; throw Error('NO_TERMINAL_MODEL'); } }, requireReport: false, limits, durable: { store, grantId: definition.grantId, bindings, runId } });
    assert.equal(restored.status, 'cancelled'); assert.equal(digest(restored.unknownEffects), digest(saved.snapshot.unknownEffects));
    assert.deepEqual(restored.rootUsage, { model: 1, tool: 1 }); assert.equal(modelCalls, 0); assert.equal(toolCalls, 0);
    assert.equal(digest(store.inspect(runId)), digest(saved));
  } finally { store.close(); }
});
