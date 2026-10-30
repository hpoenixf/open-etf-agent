import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { run } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
import { createChatGateway, normalizeChatCompletion } from '../src/gateway.mjs';
import { readChatStream } from '../src/stream.mjs';
import { openArtifactStore } from '../src/artifacts.mjs';

const completion = (message, finish_reason = 'stop') => ({ choices: [{ index: 0, finish_reason, message: { role: 'assistant', ...message } }] });
const call = (id, name, args) => completion({ content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, 'tool_calls');
const bindings = { gateway: { mode: 'live', provider: 'local', protocol: 'chat-completion-fixture@1', model: 'long-content', version: '1' }, plugins: [], adapters: [{ id: 'publication', version: 'publication@1' }] };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readback = (...args) => JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('./fixtures/long-content-readback.mjs', import.meta.url)), ...args], { encoding: 'utf8', maxBuffer: 32768 }));
async function directory(label) {
  await mkdir('test-output', { recursive: true });
  return mkdtemp(resolve('test-output/long-content-' + label + '-'));
}
function offlineGateway(respond, options = {}) {
  return createChatGateway({ endpoint: 'https://synthetic.invalid/v1/chat/completions', model: 'long-content', apiKey: 'synthetic-not-a-secret',
    authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true },
    ...options, fetchImpl: async (_url, request) => new Response(JSON.stringify(await respond(JSON.parse(request.body))), { status: 200 }) });
}

test('teaching capacity: complete long Chinese body reaches terminal and reopened Publication', async () => {
  const root = await directory('han'); const text = '学'.repeat(22000); let calls = 0;
  let store = await openSession({ directory: root }); let outcome;
  try {
    outcome = await run({ question: 'Return the exact synthetic long lesson.', outputRoot: join(root, 'runs'), requireReport: false, publication: true,
      gateway: offlineGateway(() => { calls++; return completion({ content: text }); }),
      durable: { store, grantId: 'long-content-test', bindings } });
    assert.equal(outcome.status, 'completed', outcome.code); assert.equal(outcome.answer, text);
    assert.equal(store.confirmPublication(outcome.publication).content.text, text);
  } finally { store.close(); }
  const databaseHash = sha(await readFile(join(root, 'session.sqlite')));
  // Existing Publication reads use the regular store API; no claim or write is requested.
  store = await openSession({ directory: root });
  try { assert.equal(store.inspect(outcome.runId).status, 'completed'); assert.equal(store.confirmPublication(outcome.publication).content.text, text); }
  finally { store.close(); }
  assert.equal(sha(await readFile(join(root, 'session.sqlite'))), databaseHash);
  assert.equal(calls, 1);
});

test('teaching capacity: JSON-escaped report arguments save exact immutable bytes and complete', async () => {
  const root = await directory('quoted-report'); const text = '"'.repeat(63000); let requests = 0;
  const gateway = offlineGateway(request => {
    requests++;
    if (requests === 1) return call('read-original', 'read_page', { documentId: 'atlas-a', page: 1 });
    if (requests === 2) {
      const original = JSON.parse(request.messages.at(-1).content).value;
      return call('save-long-report', 'save_report', { text, sourceIds: [original.sourceId] });
    }
    return completion({ content: 'The exact synthetic report is saved.' });
  }, { maxInputBytes: 1048576 });
  const outcome = await run({ question: 'Save the synthetic quoted lesson with the acquired source.', outputRoot: root, gateway, requireReport: true });
  assert.equal(outcome.status, 'completed', outcome.code); assert.ok(outcome.receipt); assert.equal(requests, 3);
  const saved = await readFile(join(outcome.directory, 'report.md'));
  assert.equal(saved.subarray(0, Buffer.byteLength(text)).toString('utf8'), text);
  assert.match(saved.subarray(Buffer.byteLength(text)).toString('utf8'), /^\n\n## Acquired sources\n/);
  const artifacts = await openArtifactStore({ directory: outcome.directory, readOnly: true });
  assert.deepEqual((await artifacts.read(outcome.receipt.artifactId)).bytes, saved);
  assert.equal(outcome.receipt.bytes, saved.length);
  const independent = readback('artifact', outcome.directory, outcome.receipt.artifactId);
  assert.notEqual(independent.pid, process.pid); assert.equal(independent.sha256, outcome.receipt.sha256); assert.equal(independent.bytes, saved.length);
});

test('teaching capacity: ordinary SSE fragmentation is not mistaken for oversized answer text', async () => {
  const frame = content => 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] }) + '\n\n';
  const raw = frame('学').repeat(4000) + 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n';
  assert.ok(Buffer.byteLength(raw) > 262144);
  const bytes = Buffer.from(raw); let offset = 0;
  const body = new ReadableStream({ pull(controller) { if (offset === bytes.length) return controller.close(); const end = Math.min(offset + 113, bytes.length); controller.enqueue(bytes.subarray(offset, end)); offset = end; } });
  const result = await readChatStream(body);
  assert.equal(result.kind, 'final'); assert.equal(result.text, '学'.repeat(4000));
});

test('teaching capacity: full allowed control-character body survives JSON expansion and Session reopen', async () => {
  const root = await directory('escaped-body'); const text = '\u0001'.repeat(256 * 1024); let store = await openSession({ directory: root }); let receipt;
  try {
    const outcome = await run({ question: 'Return exact synthetic escaped body bytes.', outputRoot: join(root, 'runs'), requireReport: false, publication: true,
      gateway: offlineGateway(() => completion({ content: text })), durable: { store, grantId: 'long-escaped-test', bindings } });
    assert.equal(outcome.status, 'completed', outcome.code); assert.equal(outcome.answer, text); receipt = outcome.publication;
    assert.equal(store.confirmPublication(receipt).content.text, text);
    const snapshot = store.inspect(outcome.runId).snapshot;
    assert.equal(snapshot.proposal.text, text); assert.equal(snapshot.answer, text); assert.equal(snapshot.outcome.answer, text);
    const checkpointBytes = Buffer.byteLength(JSON.stringify(snapshot));
    assert.ok(checkpointBytes > 3 * 1048576, 'actual repeated escaped checkpoint must exceed the old cap');
    assert.ok(checkpointBytes <= 12 * 1048576);
  } finally { store.close(); }
  const databaseHash = sha(await readFile(join(root, 'session.sqlite')));
  store = await openSession({ directory: root });
  try { assert.equal(store.confirmPublication(receipt).content.text, text); }
  finally { store.close(); }
  assert.equal(sha(await readFile(join(root, 'session.sqlite'))), databaseHash);
  const independent = readback('publication', root, receipt.runId);
  assert.notEqual(independent.pid, process.pid); assert.equal(independent.status, 'completed');
  assert.equal(independent.sha256, sha(text)); assert.equal(independent.bytes, Buffer.byteLength(text)); assert.deepEqual(independent.receipt, receipt);
  assert.equal(independent.databaseBytesUnchanged, true);
});

test('teaching capacity: maximum UTF-8 report and final body complete through Gateway and Session', async () => {
  const root = await directory('max-report'); const text = '学'.repeat(87381) + 'x'; let requests = 0;
  assert.equal(Buffer.byteLength(text), 256 * 1024);
  const store = await openSession({ directory: root });
  try {
    const gateway = offlineGateway(request => {
      requests++;
      if (requests === 1) return call('read-original', 'read_page', { documentId: 'atlas-a', page: 1 });
      if (requests === 2) return call('save-long-report', 'save_report', { text, sourceIds: [JSON.parse(request.messages.at(-1).content).value.sourceId] });
      return completion({ content: text });
    }, { maxInputBytes: 1048576 });
    const outcome = await run({ question: 'Save and publish the exact synthetic long lesson.', outputRoot: join(root, 'runs'), gateway, publication: true, requireReport: true,
      durable: { store, grantId: 'max-content-test', bindings } });
    assert.equal(outcome.status, 'completed', outcome.code); assert.equal(requests, 3); assert.equal(outcome.answer, text);
    assert.equal(store.confirmPublication(outcome.publication).content.text, text);
    const bytes = await readFile(join(outcome.directory, 'report.md'));
    assert.equal(bytes.subarray(0, Buffer.byteLength(text)).toString('utf8'), text); assert.equal(sha(bytes), outcome.receipt.sha256);
    assert.equal(readback('artifact', outcome.directory, outcome.receipt.artifactId).sha256, outcome.receipt.sha256);
  } finally { store.close(); }
});

test('teaching capacity: escaped parameters remain complete and protected finishes still reject', async () => {
  const text = '\u0001'.repeat(256 * 1024);
  const response = call('escaped', 'save_report', { text, sourceIds: ['synthetic-source'] });
  const result = normalizeChatCompletion(response);
  assert.equal(result.calls[0].arguments.text, text);
  assert.throws(() => normalizeChatCompletion({ ...response, choices: [{ ...response.choices[0], finish_reason: 'length' }] }), error => error.code === 'PROVIDER_OUTPUT_INCOMPLETE');
  const oversized = call('oversized', 'save_report', { text: '\u0001'.repeat(400000), sourceIds: ['synthetic-source'] });
  assert.throws(() => normalizeChatCompletion(oversized), error => error.code === 'PROVIDER_PROTOCOL_INVALID');
});
