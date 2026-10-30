import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatGateway } from '../src/gateway.mjs';
const configured = (text, capture) => createChatGateway({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'synthetic', apiKey: 'synthetic-placeholder', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, stream: true, fetchImpl: async (_url, options) => { capture(JSON.parse(options.body)); return new Response(text, { headers: { 'content-type': 'text/event-stream' } }); } });
test('2.2 streaming mode connects the complete SSE decoder to the same Gateway contract', async () => {
  let sent;
  const gateway = configured('data: {"choices":[{"index":0,"delta":{"content":"streamed"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', request => { sent = request; });
  const result = await gateway.next({ messages: [{ role: 'user', content: 'exact' }], tools: [] });
  assert.equal(sent.stream, true); assert.equal(result.kind, 'final'); assert.equal(result.text, 'streamed');
});
