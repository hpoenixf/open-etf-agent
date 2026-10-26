import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatCompletion, createChatGateway } from '../src/gateway.mjs';
const completion = (message, finish_reason) => ({ choices: [{ index: 0, message: { role: 'assistant', ...message }, finish_reason }] });
test('1.4 normalize complete non-streaming text and tool protocol', () => {
  assert.deepEqual(normalizeChatCompletion(completion({ content: 'answer' }, 'stop')), { kind: 'final', text: 'answer', usage: null });
  const c = normalizeChatCompletion(completion({ content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'read_page', arguments: '{"documentId":"atlas-a","page":1}' } }] }, 'tool_calls'));
  assert.equal(c.kind, 'calls'); assert.equal(c.calls[0].id, 'c1'); assert.equal(c.calls[0].arguments.page, 1);
});
test('1.4 truncated, mismatched and malformed responses never normalize to calls', () => {
  for (const response of [ completion({ content: 'partial' }, 'length'), completion({ content: 'partial' }, null), completion({ tool_calls: [{ id: 'a', type: 'function', function: { name: 'x', arguments: '{}' } }] }, 'stop'), completion({ tool_calls: [{ id: 'a', type: 'function', function: { name: 'x', arguments: '{' } }] }, 'tool_calls'), { choices: [] } ]) assert.throws(() => normalizeChatCompletion(response));
});
test('1.4 adapter requires explicit grant before it can call a transport', () => {
  let called = false;
  assert.throws(() => createChatGateway({ fetchImpl: () => { called = true; } }), /LIVE_BLOCKED/);
  assert.equal(called, false);
});
test('1.4 injected offline transport verifies request encoding and matched tool results', async () => {
  let captured;
  const gateway = createChatGateway({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'synthetic-test-model', apiKey: 'synthetic-not-a-secret', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, fetchImpl: async (url, options) => {
    captured = { url: String(url), options };
    return new Response(JSON.stringify(completion({ content: 'done' }, 'stop')), { status: 200 });
  } });
  const result = await gateway.next({ tools: [], messages: [{ role: 'user', content: 'exact question' }, { role: 'assistant', calls: [{ id: 'c1', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] }, { role: 'tool', callId: 'c1', result: { callId: 'c1', status: 'succeeded', value: 'synthetic' } }] });
  assert.equal(result.kind, 'final');
  const request = JSON.parse(captured.options.body);
  assert.equal(request.stream, false); assert.equal(request.messages[0].content, 'exact question');
  assert.equal(request.messages[1].tool_calls[0].id, 'c1'); assert.equal(request.messages[2].tool_call_id, 'c1');
  assert.equal(captured.options.redirect, 'error');
});
