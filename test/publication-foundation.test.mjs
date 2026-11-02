import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
import { createToolHost } from '../src/tools.mjs';
import { PUBLICATION_BINDING, preparePublication } from '../src/publication.mjs';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bindings = { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'publication-foundation', version: '1' }, plugins: [], adapters: [PUBLICATION_BINDING] };
const limits = { maxRounds: 4, maxTools: 4, timeoutMs: 10000 };
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/publication-foundation-')); }

for (const ending of ['cancelled', 'failed']) test(`Publication survives ${ending} with original bindings and zero-execution terminal cold read`, async () => {
  const d = await directory(), controller = new AbortController(); let calls = 0, committed, definition;
  let store = await openSession({ directory: d });
  const options = { question: 'Preserve the committed synthetic body independently of Run completion.', outputRoot: d, publication: true, requireReport: ending === 'failed', allowedTools: ['read_page', 'read_result'], contextBytes: 32000, limits, signal: controller.signal, gateway: { mode: 'fixture', async next() { calls++; return { kind: 'final', text: 'Original synthetic Publication, not a Report receipt.' }; } }, durable: { store, grantId: 'publication-foundation', bindings, onPublication({ runId, receipt }) { committed = store.confirmPublication(receipt); definition = store.inspect(runId).definition; if (ending === 'cancelled') controller.abort(); } } };
  let first, saved;
  try {
    first = await run(options); assert.equal(first.status, ending); assert.equal(first.code, ending === 'failed' ? 'REPORT_REQUIRED' : 'CANCELLED');
    assert.equal(first.receipt, null); assert.deepEqual(first.publication, committed.receipt); assert.deepEqual(first.unknownEffects, []);
    saved = { publication: store.publication(first.runId), revisions: store.publicationRevisions(first.runId), event: store.publicationEvent(first.runId), definition: store.inspect(first.runId).definition, usage: store.inspect(first.runId).rootUsage };
    assert.deepEqual(saved.definition, definition); assert.deepEqual(saved.publication, committed); assert.equal(saved.revisions.length, 1);
  } finally { store.close(); }
  store = await openSession({ directory: d });
  try {
    const coldOptions = { ...options, signal: undefined, durable: { ...options.durable, store, runId: first.runId, onPublication: undefined } };
    const cold = await run(coldOptions); assert.equal(cold.status, ending); assert.deepEqual(cold.publication, committed.receipt); assert.equal(cold.receipt, null); assert.deepEqual(cold.unknownEffects, []);
    assert.deepEqual(store.confirmPublication(cold.publication), committed); assert.deepEqual(store.publicationRevisions(first.runId), saved.revisions); assert.deepEqual(store.publicationEvent(first.runId), saved.event); assert.deepEqual(store.inspect(first.runId).definition, definition); assert.deepEqual(cold.rootUsage, saved.usage);
    // Terminal admission exemption never exempts immutable binding verification.
    await assert.rejects(run({ ...coldOptions, allowedTools: ['read_page'] }), error => error.code === 'RUN_BINDINGS_MISMATCH');
    await assert.rejects(run({ ...coldOptions, publication: false }), error => error.code === 'PUBLICATION_BINDING_MISMATCH');
    assert.equal(calls, 1);
  } finally { store.close(); }
});

test('near-cap cancelled dispatch preserves complete unknown identity and prior Publication no-op, revisions and event', async () => {
  const d = await directory(); const question = 'Synthetic Session-owned Publication before a pending effect.';
  const text = 'x'.repeat(1048576); let modelCalls = 0, toolCalls = 0;
  const extensions = [{ name: 'pending_effect', description: 'Synthetic pending effect.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false }, validate(args) { assert.equal(args.text, text); }, execute() { toolCalls++; throw Error('NO_TERMINAL_TOOL'); } }];
  const host = await createToolHost({ directory: d, extensions });
  const definition = { question, grantId: 'publication-foundation', bindings, limits, rootLimits: { model: 4, tool: 4 }, deadlineAt: Date.now() + 10000, config: { requireReport: false, publication: PUBLICATION_BINDING.version, taskId: null } };
  const ready = { schemaVersion: 'runtime-checkpoint@1', phase: 'ready', messages: [{ role: 'user', content: question }], usedIds: [], rounds: 0, toolsDispatched: 0, proposal: null, cursor: 0, result: null, host: host.snapshot(), working: null, answer: '', status: 'failed', code: null, unknownEffects: [], partialEffects: [], hookErrors: [] };
  let store = await openSession({ directory: d }); let runId, saved, revisions, event, second;
  try {
    runId = store.create({ directory: d, definition, snapshot: ready }).runId; const claim = store.claim(runId, 'original-owner');
    const prepare = body => preparePublication({ runId, rootId: runId, text: body });
    const first = claim.publish(prepare('Original synthetic body.')).receipt;
    assert.deepEqual(claim.publish(prepare('Original synthetic body.')), { receipt: first, idempotent: true });
    second = claim.replacePublication(prepare('Explicitly replaced synthetic body.'), 1).receipt;
    assert.deepEqual(claim.replacePublication(prepare('Explicitly replaced synthetic body.'), 2), { receipt: second, idempotent: true });
    revisions = store.publicationRevisions(runId); event = store.publicationEvent(runId); assert.equal(revisions.length, 2); assert.equal(second.blockId, first.blockId); assert.equal(second.deliveryOrdinal, first.deliveryOrdinal);
    const call = { id: 'pending-one', name: 'pending_effect', arguments: { text } }; const dispatch = { callId: call.id, name: call.name, effective: call };
    // Original Session API fixture, not a claim that Runtime emitted padding.
    const pending = { ...ready, phase: 'tool-dispatched', messages: [...ready.messages, { role: 'assistant', calls: [call] }], usedIds: [call.id], rounds: 1, toolsDispatched: 1, proposal: { kind: 'calls', calls: [call] }, inFlight: dispatch, publication: second, payload: 'p'.repeat(8.5 * 1048576) };
    assert.ok(Buffer.byteLength(JSON.stringify(pending)) < 12 * 1048576);
    claim.reserve('model', { ...ready, phase: 'model-reserved', rounds: 1 }); claim.reserve('tool', pending); saved = store.cancel(runId);
    assert.equal(saved.status, 'cancelled'); assert.equal(Object.hasOwn(saved.snapshot, 'inFlight'), false); assert.equal(saved.snapshot.unknownEffects.length, 1);
    assert.equal(digest(saved.snapshot.unknownEffects[0]), digest({ ...dispatch, status: 'unknown', dispatched: true }));
    for (const field of ['messages', 'proposal', 'working', 'result', 'publication', 'payload']) assert.equal(digest(saved.snapshot[field]), digest(pending[field]), field + ' remains original');
    assert.deepEqual(store.publicationRevisions(runId), revisions); assert.deepEqual(store.publicationEvent(runId), event); assert.equal(digest(store.cancel(runId)), digest(saved));
    assert.throws(() => claim.replacePublication(prepare('Late write.'), 2), error => error.code === 'RUN_CANCELLED');
  } finally { store.close(); }
  store = await openSession({ directory: d });
  try {
    const cold = await run({ question, extensions, gateway: { mode: 'fixture', async next() { modelCalls++; throw Error('NO_TERMINAL_MODEL'); } }, publication: true, requireReport: false, limits, durable: { store, grantId: definition.grantId, bindings, runId } });
    assert.equal(cold.status, 'cancelled'); assert.deepEqual(cold.publication, second); assert.equal(digest(cold.unknownEffects), digest(saved.snapshot.unknownEffects)); assert.deepEqual(cold.rootUsage, { model: 1, tool: 1 });
    assert.deepEqual(store.publicationRevisions(runId), revisions); assert.deepEqual(store.publicationEvent(runId), event); for (const original of revisions) assert.deepEqual(store.confirmPublication(original.receipt), original);
    assert.equal(modelCalls, 0); assert.equal(toolCalls, 0); assert.equal(digest(store.inspect(runId)), digest(saved));
  } finally { store.close(); }
});
