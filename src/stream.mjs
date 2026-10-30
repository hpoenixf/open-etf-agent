import { normalizeChatCompletion } from './gateway.mjs';
const invalid = () => { throw new Error('INCOMPLETE_OR_UNSUPPORTED_STREAM'); };
const idDiagnostics = new WeakMap();
export function projectStreamProtocolDiagnostic(error) {
  const value = error && typeof error === 'object' ? idDiagnostics.get(error) : null;
  return value ? { ...value } : null;
}
const invalidId = details => {
  const error = new Error('INCOMPLETE_OR_UNSUPPORTED_STREAM');
  idDiagnostics.set(error, Object.freeze({ schemaVersion: 'provider-protocol-diagnostic@1', phase: 'stream-event', reason: 'TOOL_FRAGMENT_ID', ...details }));
  throw error;
};

export async function readChatStream(body, { signal, maxBytes = 262144 } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576) throw new Error('Invalid stream size limit');
  signal?.throwIfAborted();
  const reader = body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = ''; let bytes = 0; let done = false; let finish = null; let content = ''; let usage = null;
  const calls = new Map();
  const abort = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  function event(raw) {
    const data = raw.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data) return;
    if (done) invalid();
    if (data === '[DONE]') { if (!finish) invalid(); done = true; return; }
    const chunk = JSON.parse(data);
    if (chunk.usage !== undefined && chunk.usage !== null) usage = chunk.usage;
    if (!Array.isArray(chunk.choices)) invalid();
    if (chunk.choices.length === 0 && chunk.usage != null) return;
    if (chunk.choices.length !== 1 || chunk.choices[0].index !== 0 || finish) invalid();
    const choice = chunk.choices[0]; const delta = choice.delta;
    if (!delta || typeof delta !== 'object' || Array.isArray(delta)) invalid();
    if (delta.role != null && delta.role !== 'assistant') invalid();
    if (delta.refusal || delta.audio || delta.function_call) invalid();
    if (delta.content != null) { if (typeof delta.content !== 'string') invalid(); content += delta.content; }
    if (delta.tool_calls != null) {
      if (!Array.isArray(delta.tool_calls)) invalid();
      for (const part of delta.tool_calls) {
        if (!Number.isSafeInteger(part.index) || part.index < 0 || part.index >= 16 || (part.type && part.type !== 'function')) invalid();
        const call = calls.get(part.index) || { id: '', type: 'function', function: { name: '', arguments: '' } };
        if (part.id !== undefined && !(part.id === null && call.id)) { if (typeof part.id !== 'string' || (call.id && call.id !== part.id)) invalidId({
          idFailure:typeof part.id!=='string'?'non-string':'conflicting-string',
          incomingIdKind:part.id===null?'null':Array.isArray(part.id)?'array':typeof part.id,
          previousIdPresent:Boolean(call.id),
          ...(typeof part.id==='string'?{incomingEmpty:part.id.length===0}:{})
        }); call.id = part.id; }
        for (const key of ['name', 'arguments']) if (part.function?.[key] !== undefined) { if (typeof part.function[key] !== 'string') invalid(); call.function[key] += part.function[key]; }
        calls.set(part.index, call);
      }
    }
    if (choice.finish_reason != null) { if (!['stop', 'tool_calls'].includes(choice.finish_reason)) invalid(); finish = choice.finish_reason; }
  }
  function consume() {
    buffer = buffer.replace(/\r\n/g, '\n');
    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) { event(buffer.slice(0, index)); buffer = buffer.slice(index + 2); }
  }
  try {
    for (;;) {
      signal?.throwIfAborted(); const next = await reader.read(); signal?.throwIfAborted();
      if (next.done) break;
      bytes += next.value.length; if (bytes > maxBytes) throw new Error('Stream exceeds byte limit');
      buffer += decoder.decode(next.value, { stream: true }); consume();
    }
    buffer += decoder.decode(); consume();
    if (buffer.trim() || !done || !finish) invalid();
    const ordered = [...calls.entries()].sort(([a], [b]) => a - b);
    if (ordered.some(([index], i) => index !== i)) invalid();
    return normalizeChatCompletion({ choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content, ...(ordered.length ? { tool_calls: ordered.map(([, c]) => c) } : {}) } }], usage });
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { signal?.removeEventListener('abort', abort); reader.releaseLock(); }
}
