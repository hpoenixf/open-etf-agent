import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
import { createChatGateway } from '../src/gateway.mjs';
import { createRootBudget } from '../src/cooperation.mjs';

async function directory(label) { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/teaching-defaults-' + label + '-')); }
const read = id => ({ id, name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } });
const final = text => ({ kind: 'final', text });
const completion = (message, finish_reason = 'stop') => ({ choices: [{ index: 0, finish_reason, message: { role: 'assistant', ...message } }] });
const call = (id, name, args) => completion({ content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, 'tool_calls');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('teaching defaults: a moderate ordinary lesson is not stopped by the old 12-step/report defaults', async () => {
  const root = await directory('lesson'); const store = await openSession({ directory: root }); let requests = 0;
  try {
    const outcome = await run({ question: 'Synthetic lesson using repeated original reads.', outputRoot: join(root, 'runs'),
      gateway: { mode: 'fixture', async next() { const index = requests++; return index < 13 ? { kind: 'calls', calls: [read('a-' + index), read('b-' + index)] } : final('The ordinary lesson is complete.'); } },
      durable: { store, grantId: 'synthetic-teaching-defaults', bindings: { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'teaching', version: '1' }, plugins: [], adapters: [] } } });
    assert.equal(outcome.status, 'completed', outcome.code); assert.equal(outcome.receipt, null); assert.equal(requests, 14); assert.equal(outcome.toolsDispatched, 26);
    const saved = store.inspect(outcome.runId);
    assert.deepEqual(saved.definition.limits, { maxRounds: 24, maxTools: 64, timeoutMs: 120000 });
    assert.deepEqual(saved.definition.rootLimits, { model: 24, tool: 64 }); assert.equal(saved.definition.config.requireReport, false);
  } finally { store.close(); }
});

async function reportFixture(maxInputBytes) {
  const root = await directory('report'); const text = '学'.repeat(87381) + 'x'; let requests = 0, failure = null; const requestBytes = [];
  const adapter = createChatGateway({ endpoint: 'https://synthetic.invalid/v1/chat/completions', model: 'teaching', apiKey: 'synthetic-not-a-secret',
    authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, ...(maxInputBytes === undefined ? {} : { maxInputBytes }),
    fetchImpl: async (_url, request) => {
      requests++; requestBytes.push(Buffer.byteLength(request.body)); const body = JSON.parse(request.body);
      const response = requests === 1 ? call('read-original', 'read_page', { documentId: 'atlas-a', page: 1 })
        : requests === 2 ? call('save-report', 'save_report', { text, sourceIds: [JSON.parse(body.messages.at(-1).content).value.sourceId] })
        : completion({ content: 'The complete teaching report is saved.' });
      return new Response(JSON.stringify(response), { status: 200 });
    } });
  const gateway = { ...adapter, async next(input) { try { return await adapter.next(input); } catch (error) { failure = error.message; throw error; } } };
  const outcome = await run({ question: 'Save a complete synthetic long teaching report.', outputRoot: root, gateway, requireReport: true });
  assert.ok(outcome.receipt, 'successful save must retain its original receipt');
  const bytes = await readFile(join(outcome.directory, 'report.md'));
  assert.equal(bytes.subarray(0, Buffer.byteLength(text)).toString('utf8'), text); assert.equal(sha(bytes), outcome.receipt.sha256);
  return { outcome, requests, requestBytes, failure };
}

test('teaching defaults: the existing 1 MiB input allowance now fits a bounded long report by default', async () => {
  const { outcome, requests, requestBytes, failure } = await reportFixture();
  assert.equal(outcome.status, 'completed', outcome.code); assert.equal(requests, 3); assert.equal(failure, null);
  assert.ok(requestBytes.at(-1) > 262144); assert.ok(requestBytes.at(-1) <= 1048576);
});

test('teaching defaults: explicit report and small round/tool/root budgets retain priority', async () => {
  const base = async label => ({ question: 'Synthetic explicit bound.', outputRoot: await directory(label) });
  const report = await run({ ...await base('required'), requireReport: true, gateway: { next: async () => final('No file was saved.') } });
  assert.equal(report.status, 'failed'); assert.equal(report.code, 'REPORT_REQUIRED'); assert.equal(report.receipt, null);
  let rounds = 0;
  const round = await run({ ...await base('round'), limits: { maxRounds: 1 }, gateway: { next: async () => ({ kind: 'calls', calls: [read('round-' + rounds++)] }) } });
  assert.equal(round.code, 'ROUND_LIMIT'); assert.equal(rounds, 1);
  const tool = await run({ ...await base('tool'), limits: { maxTools: 1 }, gateway: { next: async () => ({ kind: 'calls', calls: [read('one'), read('two')] }) } });
  assert.equal(tool.code, 'TOOL_LIMIT'); assert.equal(tool.toolsDispatched, 0);
  let rootRequests = 0;
  const root = await run({ ...await base('root'), rootBudget: createRootBudget({ model: 1, tool: 1 }),
    gateway: { next: async () => rootRequests++ === 0 ? { kind: 'calls', calls: [read('root-read')] } : final('Must not dispatch.') } });
  assert.equal(root.code, 'ROOT_BUDGET_EXHAUSTED'); assert.equal(rootRequests, 1); assert.deepEqual(root.rootUsage, { model: 1, tool: 1 });
});

test('teaching defaults: an explicit 256 KiB input guard rejects before dispatch without losing the saved report', async () => {
  const { outcome, requests, failure } = await reportFixture(262144);
  assert.equal(outcome.status, 'failed'); assert.equal(failure, 'PROVIDER_INPUT_BYTE_LIMIT'); assert.equal(requests, 2);
  assert.ok(outcome.receipt); assert.equal(outcome.toolsDispatched, 2);
});
