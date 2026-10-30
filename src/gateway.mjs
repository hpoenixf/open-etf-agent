import { createHash } from 'node:crypto';
// Only rejection sites in this module can mint this diagnostic; provider objects cannot.
const diagnostics = new WeakMap();
export function projectProviderProtocolDiagnostic(error) {
  const value = error && typeof error === 'object' ? diagnostics.get(error) : null;
  return value ? { ...value } : null;
}
const reject = (reason) => {
  const error = Object.assign(new Error('INCOMPLETE_OR_UNSUPPORTED_PROTOCOL'), { code: 'PROVIDER_PROTOCOL_INVALID' });
  diagnostics.set(error, Object.freeze({ schemaVersion: 'provider-protocol-diagnostic@1', phase: 'normalization', reason }));
  throw error;
};
const plainObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export function normalizeChatCompletion(response) {
  if (!Array.isArray(response?.choices) || response.choices.length !== 1) reject('CHOICE_COUNT');
  if (!plainObject(response.choices[0])) reject('CHOICE_SHAPE');
  const { message, finish_reason: finish } = response.choices[0];
  if (!message || message.role !== 'assistant' || message.refusal || message.audio || message.function_call) reject('MESSAGE_SHAPE_OR_UNSUPPORTED');
  const usage = response.usage ?? null;
  if (finish === 'stop' && typeof message.content === 'string' && !message.tool_calls?.length) return { kind: 'final', text: message.content, usage };
  if (finish !== 'tool_calls' || !Array.isArray(message.tool_calls) || !message.tool_calls.length || message.tool_calls.length > 16) reject('FINISH_OR_CALLS_SHAPE');
  const ids = new Set();
  const calls = message.tool_calls.map(c => {
    if (!plainObject(c)) reject('CALL_SHAPE');
    if (c.type !== 'function' || typeof c.id !== 'string' || !c.id || ids.has(c.id) || typeof c.function?.name !== 'string' || typeof c.function.arguments !== 'string' || c.function.arguments.length > 66000) reject('CALL_IDENTITY_OR_ARGUMENTS_TYPE');
    ids.add(c.id);
    let args; try { args = JSON.parse(c.function.arguments); } catch (error) { if (error instanceof SyntaxError) reject('ARGUMENTS_JSON'); throw error; }
    if (!plainObject(args)) reject('ARGUMENTS_OBJECT');
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
        const { readChatStream, projectStreamProtocolDiagnostic } = await import('./stream.mjs');
        try { return await readChatStream(response.body, { signal }); }
        catch (error) {
          const diagnostic = projectStreamProtocolDiagnostic(error);
          if (diagnostic) diagnostics.set(error, Object.freeze(diagnostic));
          throw error;
        }
      }
      const reader = response.body.getReader(); const parts = []; let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length; if (size > 262144) { await reader.cancel(); throw new Error('PROVIDER_RESPONSE_TOO_LARGE'); }
          parts.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = Buffer.concat(parts);
      try {
        let parsed; try { parsed = JSON.parse(bytes.toString('utf8')); } catch (error) { if (error instanceof SyntaxError) reject('RESPONSE_JSON'); throw error; }
        return normalizeChatCompletion(parsed);
      } catch (error) {
        const diagnostic = projectProviderProtocolDiagnostic(error);
        if (diagnostic) diagnostics.set(error, Object.freeze({ ...diagnostic, bytes: bytes.length, hashScope: 'complete-body', bodySha256: createHash('sha256').update(bytes).digest('hex') }));
        throw error;
      }
    }
  };
}
