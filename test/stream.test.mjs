import test from 'node:test';
import assert from 'node:assert/strict';
import { readChatStream } from '../src/stream.mjs';
const event = (delta, finish_reason = null) => 'data: ' + JSON.stringify({ choices: [{ index: 0, delta, finish_reason }] }) + '\n\n';
function body(text, fragment = 7) { const bytes = Buffer.from(text); let at = 0; return new ReadableStream({ pull(controller) { if (at >= bytes.length) return controller.close(); controller.enqueue(bytes.subarray(at, at += fragment)); } }); }
test('2.2 fragmented UTF-8 text requires finish and DONE', async () => {
  const r = await readChatStream(body(event({ role: 'assistant', content: 'café 中文' }) + event({}, 'stop') + 'data: [DONE]\n\n', 1));
  assert.deepEqual(r, { kind: 'final', text: 'café 中文', usage: null });
});
test('2.2 tool argument fragments assemble by index before parsing', async () => {
  const text = event({ tool_calls: [{ index: 0, id: 'a', type: 'function', function: { name: 'read_page', arguments: '{"documentId":' } }] }) + event({ tool_calls: [{ index: 0, function: { arguments: '"atlas-a","page":1}' } }] }) + event({}, 'tool_calls') + 'data: [DONE]\n\n';
  const r = await readChatStream(body(text)); assert.equal(r.kind, 'calls'); assert.equal(r.calls[0].id, 'a'); assert.deepEqual(r.calls[0].arguments, { documentId: 'atlas-a', page: 1 });
});
test('2.2 EOF or missing finish never becomes a usable proposal', async () => {
  for (const text of [event({ content: 'partial' }), event({ content: 'done' }, 'stop'), event({ content: 'unfinished' }) + 'data: [DONE]\n\n', event({}, 'length') + 'data: [DONE]\n\n']) await assert.rejects(readChatStream(body(text)));
});
test('2.2 parseable call without DONE still rejects', async () => {
  const text = event({ tool_calls: [{ index: 0, id: 'a', type: 'function', function: { name: 'read_page', arguments: '{}' } }] }, 'tool_calls');
  await assert.rejects(readChatStream(body(text)));
});
test('2.2 byte bound and cancelled stream reject rather than silently truncate', async () => {
  await assert.rejects(readChatStream(body(event({ content: 'x'.repeat(100) }) + event({}, 'stop') + 'data: [DONE]\n\n'), { maxBytes: 64 }), /large|limit/i);
  const controller = new AbortController(); controller.abort(); await assert.rejects(readChatStream(body(''), { signal: controller.signal }));
});
test('2.2 usage-only final chunk is retained, missing usage stays unknown', async () => {
  const r = await readChatStream(body(event({ content: 'yes' }, 'stop') + 'data: {"choices":[],"usage":{"total_tokens":5}}\n\ndata: [DONE]\n\n'));
  assert.deepEqual(r.usage, { total_tokens: 5 });
});
test('2.2 cancellation interrupts a pending read without releasing a proposal', async () => {
  const controller = new AbortController(); let cancelled = false;
  const input = new ReadableStream({ cancel() { cancelled = true; } });
  const pending = readChatStream(input, { signal: controller.signal });
  const timer = setTimeout(() => controller.abort(new Error('active stream cancellation')), 20);
  try { await assert.rejects(pending, /active stream cancellation/); }
  finally { clearTimeout(timer); }
  assert.equal(cancelled, true); assert.equal(input.locked, false);
});
