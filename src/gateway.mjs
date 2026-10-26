const reject = () => { throw new Error('INCOMPLETE_OR_UNSUPPORTED_PROTOCOL'); };
const plainObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function normalizeChatCompletion(response) {
  if (!Array.isArray(response?.choices) || response.choices.length !== 1) reject();
  const { message, finish_reason: finish } = response.choices[0];
  if (!message || message.role !== 'assistant' || message.refusal || message.audio || message.function_call) reject();
  const usage = response.usage ?? null;
  if (finish === 'stop' && typeof message.content === 'string' && !message.tool_calls?.length) return { kind: 'final', text: message.content, usage };
  if (finish !== 'tool_calls' || !Array.isArray(message.tool_calls) || !message.tool_calls.length || message.tool_calls.length > 16) reject();
  const ids = new Set();
  const calls = message.tool_calls.map(c => {
    if (c.type !== 'function' || typeof c.id !== 'string' || !c.id || ids.has(c.id) || typeof c.function?.name !== 'string' || typeof c.function.arguments !== 'string' || c.function.arguments.length > 66000) reject();
    ids.add(c.id);
    const args = JSON.parse(c.function.arguments);
    if (!plainObject(args)) reject();
    return { id: c.id, name: c.function.name, arguments: args };
  });
  return { kind: 'calls', calls, usage };
}

function encodeMessages(messages) {
  return messages.map(m => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.callId, content: JSON.stringify(m.result) };
    if (m.role === 'assistant' && m.calls) return { role: 'assistant', content: null, tool_calls: m.calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.arguments) } })) };
    return { role: m.role, content: m.content };
  });
}

// No authorization is implied by importing this adapter. CLI keeps live blocked.
// The caller must supply an explicit reviewed grant; never derive it from data.
export function createChatGateway({ endpoint, model, apiKey, authorization, stream = false, maxInputBytes = 262144, fetchImpl = globalThis.fetch }) {
  if (!authorization?.providerApproved || !authorization?.syntheticDataApproved || !authorization?.costApproved) throw new Error('LIVE_BLOCKED');
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > 1048576) throw new Error('Invalid input byte limit');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/chat/completions')) throw new Error('Invalid trusted endpoint');
  if (typeof model !== 'string' || !model || typeof apiKey !== 'string' || !apiKey) throw new Error('Missing trusted provider configuration');
  return {
    mode: 'live',
    async next({ messages, tools, signal }) {
      const body = JSON.stringify({ model, stream, ...(stream ? { stream_options: { include_usage: true } } : {}), n: 1, messages: encodeMessages(messages), tools: tools.map(t => ({ type: 'function', function: t })) });
      if (Buffer.byteLength(body) > maxInputBytes) throw new Error('PROVIDER_INPUT_BYTE_LIMIT');
      const response = await fetchImpl(url, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body
      });
      if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
      if (stream) {
        if (!response.headers.get('content-type')?.startsWith('text/event-stream')) throw new Error('PROVIDER_STREAM_CONTENT_TYPE');
        const { readChatStream } = await import('./stream.mjs');
        return readChatStream(response.body, { signal });
      }
      const reader = response.body.getReader(); const parts = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length; if (size > 262144) { await reader.cancel(); throw new Error('PROVIDER_RESPONSE_TOO_LARGE'); }
          parts.push(value);
        }
      } finally { reader.releaseLock(); }
      return normalizeChatCompletion(JSON.parse(Buffer.concat(parts).toString('utf8')));
    }
  };
}
