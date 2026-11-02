import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readChatStream, projectStreamProtocolDiagnostic } from '../src/stream.mjs';
import { createChatGateway } from '../src/gateway.mjs';
import { run } from '../src/runtime.mjs';

const grant = { providerApproved: true, syntheticDataApproved: true, costApproved: true };
const event = value => 'data: ' + JSON.stringify(value) + '\n\n';
const frame = (delta, finish_reason = null) => ({ choices: [{ index: 0, delta, finish_reason }] });
const wire = parts => parts.map((tool_calls, i) => event(frame({ tool_calls }, i === parts.length - 1 ? 'tool_calls' : null))).join('') + 'data: [DONE]\n\n';
const start = (fn, index = 0, id = 'synthetic-one') => ({ index, id, type: 'function', function: fn });
const continuation = (fn, index = 0) => ({ index, id: null, type: null, function: fn });
const decode = parts => readChatStream(new Response(wire(parts)).body);
const gateway = fetchImpl => createChatGateway({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'synthetic-nullable-delta', apiKey: 'synthetic-not-a-key', authorization: grant, stream: true, fetchImpl });
const viaGateway = parts => gateway(async () => new Response(wire(parts), { headers: { 'content-type': 'text/event-stream' } })).next({ messages: [{ role: 'user', content: 'Synthetic only.' }], tools: [] });
async function outputRoot() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/nullable-function-')); }

test('nullable name and arguments are absent increments, preserving string concatenation and separate indices', async () => {
  const omitted = [[start({ name: 'read_', arguments: '{"page":' }), start({ name: 'save_', arguments: '{"text":' }, 1, 'synthetic-two')], [continuation({ name: 'page' }), continuation({ name: 'report' }, 1)], [continuation({ arguments: '1}' }), continuation({ arguments: '"synthetic"}' }, 1)]];
  const nullable = [[start({ name: 'read_', arguments: null }), start({ name: 'save_', arguments: null }, 1, 'synthetic-two')], [continuation({ name: null, arguments: '{"page":' }), continuation({ name: null, arguments: '{"text":' }, 1)], [continuation({ name: 'page', arguments: null }), continuation({ name: 'report', arguments: null }, 1)], [continuation({ name: null, arguments: null }), continuation({ name: null, arguments: null }, 1)], [continuation({ name: null, arguments: '1}' }), continuation({ name: null, arguments: '"synthetic"}' }, 1)]];
  const expected = await decode(omitted);
  assert.deepEqual(await decode(nullable), expected);
  assert.deepEqual(await viaGateway(nullable), expected);
  assert.deepEqual(expected.calls.map(c => [c.id, c.name, c.arguments]), [['synthetic-one', 'read_page', { page: 1 }], ['synthetic-two', 'save_report', { text: 'synthetic' }]]);
  // Unknown extension fields were already ignored; this is not a new platform surface.
  const extras = [[{ ...start({ name: 'read_page', arguments: '{}' }), future: { arbitrary: 'synthetic' } }], [continuation({ name: null, arguments: null, future: { arbitrary: 'synthetic' } })]];
  assert.equal((await viaGateway(extras)).calls[0].name, 'read_page');
});

test('non-null non-string function values retain the original plain-error contract without modern diagnostics', async () => {
  for (const field of ['name', 'arguments']) for (const value of [{ marker: 'SYNTHETIC_PRIVATE_MARKER' }, ['synthetic'], 12345, false]) {
    const parts = [[start({ name: 'read_page', arguments: '{}' })], [continuation({ [field]: value })]];
    for (const invoke of [decode, viaGateway]) await assert.rejects(invoke(parts), error => {
      assert.equal(error.message, 'INCOMPLETE_OR_UNSUPPORTED_STREAM'); assert.equal(error.code, undefined);
      assert.equal(projectStreamProtocolDiagnostic(error), null); return true;
    });
  }
  assert.equal(projectStreamProtocolDiagnostic(Object.assign(new Error('synthetic'), { reason: 'TOOL_FRAGMENT_VALUE_TYPE' })), null);
});

test('nullable increments do not weaken final JSON object, identity, index or terminal checks', async () => {
  for (const argumentsText of ['null', '[]', '1', '"text"']) await assert.rejects(viaGateway([[start({ name: 'read_page', arguments: argumentsText })]]), e => e.message === 'INCOMPLETE_OR_UNSUPPORTED_PROTOCOL');
  await assert.rejects(viaGateway([[start({ name: 'read_page', arguments: '{' })]]), e => e instanceof SyntaxError);
  await assert.rejects(viaGateway([[start({ name: 'read_page', arguments: '{}' })], [{ ...continuation({ name: null, arguments: null }), id: 'conflicting' }]]), e => projectStreamProtocolDiagnostic(e)?.reason === 'TOOL_FRAGMENT_ID');
  await assert.rejects(viaGateway([[start({ name: 'read_page', arguments: '{}' }, 1)]]), e => e.message === 'INCOMPLETE_OR_UNSUPPORTED_STREAM');
  await assert.rejects(viaGateway([[start({ name: 'read_page', arguments: '{}' }), start({ name: 'read_page', arguments: '{}' }, 1)]]), e => e.message === 'INCOMPLETE_OR_UNSUPPORTED_PROTOCOL');
  const unfinished = wire([[start({ name: 'read_page', arguments: '{}' })]]).replace('data: [DONE]\n\n', '');
  await assert.rejects(readChatStream(new Response(unfinished).body), e => e.message === 'INCOMPLETE_OR_UNSUPPORTED_STREAM');
});

test('nullable function deltas use the original Gateway Runtime Host path to read and save the same report', async () => {
  const root = await outputRoot();
  async function execute(nullable) {
    let requests = 0;
    const adapter = gateway(async (_url, options) => {
      requests++; const request = JSON.parse(options.body); assert.ok(request.tools.some(t => t.function.name === 'read_page')); assert.ok(request.tools.some(t => t.function.name === 'save_report')); // This original version has no tool-allowlist API.
      let call;
      if (requests === 1) call = { id: 'read-one', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } };
      if (requests === 2) { const source = request.messages.filter(m => m.role === 'tool').map(m => JSON.parse(m.content).value).find(v => v?.sourceId); assert.ok(source); call = { id: 'save-one', name: 'save_report', arguments: { text: '# Synthetic report\n\nOriginal source retained.', sourceIds: [source.sourceId] } }; }
      let text;
      if (call) { const args = JSON.stringify(call.arguments), cut = Math.floor(args.length / 2); text = wire([[start({ name: call.name, arguments: nullable ? null : '' }, 0, call.id)], [continuation({ ...(nullable ? { name: null } : {}), arguments: args.slice(0, cut) })], [continuation({ ...(nullable ? { name: null, arguments: null } : {}) })], [continuation({ ...(nullable ? { name: null } : {}), arguments: args.slice(cut) })]]); }
      else text = event(frame({ role: 'assistant', content: 'Synthetic report saved.' }, 'stop')) + 'data: [DONE]\n\n';
      return new Response(text, { headers: { 'content-type': 'text/event-stream' } });
    });
    const result = await run({ question: 'Read atlas-a page1 and save a synthetic report.', gateway: adapter, outputRoot: root, requireReport: true, limits: { maxRounds: 3, maxTools: 2, timeoutMs: 2000 } });
    assert.equal(result.status, 'completed'); assert.equal(result.toolsDispatched, 2); assert.equal(requests, 3); assert.equal(Object.hasOwn(result, 'rootUsage'), false); // No shared-root budget in this original version.
    assert.deepEqual(result.unknownEffects, []);
    return { receipt: result.receipt, body: await readFile(join(result.directory, 'report.md'), 'utf8') };
  }
  const omitted = await execute(false), nullable = await execute(true); assert.equal(nullable.receipt.sha256, omitted.receipt.sha256); assert.equal(nullable.body, omitted.body);
});

test('missing final name, denied tool and bad schema are rejected by the original Host before dispatch; budget is unchanged', async () => {
  const root = await outputRoot();
  for (const fixture of [
    { label: 'missing-name', fn: { arguments: '{}' }, code: 'TOOL_REJECTED', decodedName: '' },
    { label: 'unregistered-tool', fn: { name: 'synthetic_not_registered', arguments: '{}' }, code: 'TOOL_REJECTED', decodedName: 'synthetic_not_registered' },
    { label: 'invalid-tool-schema', fn: { name: 'read_page', arguments: '{"documentId":"atlas-a","page":"wrong"}' }, code: 'TOOL_REJECTED', decodedName: 'read_page' },
    { label: 'tool-budget', fn: { name: 'read_page', arguments: '{"documentId":"atlas-a","page":1}' }, code: 'TOOL_LIMIT', decodedName: 'read_page', twoCalls: true }
  ]) {
    const parts = [[start(fixture.fn), ...(fixture.twoCalls ? [start(fixture.fn, 1, 'synthetic-two')] : [])]]; const proposal = await viaGateway(parts); assert.equal(proposal.calls[0].name, fixture.decodedName);
    let requests = 0; const adapter = gateway(async () => { requests++; return new Response(wire(parts), { headers: { 'content-type': 'text/event-stream' } }); });
    const result = await run({ question: 'Synthetic guard regression ' + fixture.label, gateway: adapter, outputRoot: root, requireReport: false, limits: { maxRounds: 1, maxTools: 1, timeoutMs: 2000 } });
    assert.equal(result.status, 'failed'); assert.equal(result.code, fixture.code); assert.equal(result.toolsDispatched, 0); assert.equal(Object.hasOwn(result, 'rootUsage'), false); assert.equal(requests, 1); assert.deepEqual(result.unknownEffects, []); assert.equal(result.receipt, null);
  }
});
