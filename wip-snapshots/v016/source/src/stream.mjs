import { normalizeChatCompletion, projectProviderProtocolDiagnostic, classifyNonSuccessfulFinish, DEFAULT_PROVIDER_RESPONSE_BYTES } from './gateway.mjs';
import { createHash } from 'node:crypto';
const diagnostics = new WeakMap();
export function projectStreamProtocolDiagnostic(error) {
  const value = error && typeof error === 'object' ? diagnostics.get(error) : null;
  return value ? { ...value } : null;
}

export async function readChatStream(body, { signal, maxBytes = DEFAULT_PROVIDER_RESPONSE_BYTES } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_PROVIDER_RESPONSE_BYTES) throw new Error('Invalid stream size limit');
  signal?.throwIfAborted();
  const reader = body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = ''; let bytes = 0; let done = false; let finish = null; let content = ''; let usage = null;
  const calls = new Map();
  const hash = createHash('sha256'); let completeBody = false; let frames = 0; let fragments = 0;
  const metrics = () => ({ bytes, frames, toolFragments: fragments, doneObserved: done, hashScope: completeBody ? 'complete-body' : 'consumed-prefix', bodySha256: hash.copy().digest('hex') });
  const invalid = (reason, phase = 'stream-event', idDetails) => {
    const error = Object.assign(new Error('INCOMPLETE_OR_UNSUPPORTED_STREAM'), { code: 'PROVIDER_PROTOCOL_INVALID' });
    diagnostics.set(error, Object.freeze({ schemaVersion: 'provider-protocol-diagnostic@1', phase, reason, ...metrics(), ...(reason==='TOOL_FRAGMENT_ID'&&idDetails?{idFailure:idDetails.idFailure,incomingIdKind:idDetails.incomingIdKind,previousIdPresent:idDetails.previousIdPresent,...(idDetails.incomingIdKind==='string'?{incomingEmpty:idDetails.incomingEmpty}:{})}:{}) }));
    throw error;
  };
  const abort = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  function event(raw) {
    const data = raw.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data) return;
    frames++;
    if (done) invalid('EVENT_AFTER_DONE');
    if (data === '[DONE]') { if (!finish) invalid('DONE_WITHOUT_FINISH'); done = true; return; }
    let chunk; try { chunk = JSON.parse(data); } catch (error) { if (error instanceof SyntaxError) invalid('EVENT_JSON'); throw error; }
    if (!chunk || typeof chunk !== 'object') invalid('EVENT_SHAPE');
    if (chunk.usage !== undefined && chunk.usage !== null) usage = chunk.usage;
    if (!Array.isArray(chunk.choices)) invalid('CHOICES_SHAPE');
    if (chunk.choices.length === 0 && chunk.usage != null) return;
    if (chunk.choices.length !== 1) invalid('CHOICE_COUNT');
    if (!chunk.choices[0] || typeof chunk.choices[0] !== 'object') invalid('CHOICE_SHAPE');
    if (chunk.choices[0].index !== 0) invalid('CHOICE_INDEX');
    if (finish) invalid('EVENT_AFTER_FINISH');
    const choice = chunk.choices[0]; const delta = choice.delta;
    if (!delta || typeof delta !== 'object' || Array.isArray(delta)) invalid('DELTA_SHAPE');
    if (delta.role != null && delta.role !== 'assistant') invalid('DELTA_ROLE');
    if (delta.refusal || delta.audio || delta.function_call) invalid('UNSUPPORTED_PAYLOAD');
    if (delta.content != null) { if (typeof delta.content !== 'string') invalid('CONTENT_TYPE'); content += delta.content; }
    if (delta.tool_calls != null) {
      if (!Array.isArray(delta.tool_calls)) invalid('TOOL_CALLS_TYPE');
      for (const part of delta.tool_calls) {
        fragments++;
        if (!part || typeof part !== 'object') invalid('TOOL_FRAGMENT_SHAPE');
        if (!Number.isSafeInteger(part.index) || part.index < 0 || part.index >= 16 || (part.type && part.type !== 'function')) invalid('TOOL_FRAGMENT_INDEX_OR_TYPE');
        const call = calls.get(part.index) || { id: '', type: 'function', function: { name: '', arguments: '' } };
        if (part.id !== undefined && !(part.id === null && call.id)) { if (typeof part.id !== 'string' || (call.id && call.id !== part.id)) invalid('TOOL_FRAGMENT_ID','stream-event',{
          idFailure:typeof part.id!=='string'?'non-string':'conflicting-string',
          incomingIdKind:part.id===null?'null':Array.isArray(part.id)?'array':typeof part.id,
          previousIdPresent:Boolean(call.id),
          ...(typeof part.id==='string'?{incomingEmpty:part.id.length===0}:{})
        }); call.id = part.id; }
        for (const key of ['name', 'arguments']) if (part.function?.[key] !== undefined) { if (typeof part.function[key] !== 'string') invalid('TOOL_FRAGMENT_VALUE_TYPE'); call.function[key] += part.function[key]; }
        calls.set(part.index, call);
      }
    }
    if (choice.finish_reason != null) {
      const nonSuccess = classifyNonSuccessfulFinish(choice.finish_reason);
      if (nonSuccess) {
        const error = Object.assign(new Error(nonSuccess.code), { code: nonSuccess.code });
        diagnostics.set(error, Object.freeze({ schemaVersion: 'provider-protocol-diagnostic@1', phase: 'stream-event', reason: 'NON_SUCCESS_FINISH', finishKind: nonSuccess.finishKind, ...metrics() }));
        throw error;
      }
      if (!['stop', 'tool_calls'].includes(choice.finish_reason)) invalid('FINISH_REASON');
      finish = choice.finish_reason;
    }
  }
  function consume() {
    buffer = buffer.replace(/\r\n/g, '\n');
    let index;
    while ((index = buffer.indexOf('\n\n')) >= 0) { event(buffer.slice(0, index)); buffer = buffer.slice(index + 2); }
  }
  try {
    for (;;) {
      signal?.throwIfAborted(); const next = await reader.read(); signal?.throwIfAborted();
      if (next.done) { completeBody = true; break; }
      hash.update(next.value); bytes += next.value.length; if (bytes > maxBytes) throw new Error('Stream exceeds byte limit');
      buffer += decoder.decode(next.value, { stream: true }); consume();
    }
    buffer += decoder.decode(); consume();
    if (buffer.trim() || !done || !finish) invalid('INCOMPLETE_TERMINAL', 'stream-final');
    const ordered = [...calls.entries()].sort(([a], [b]) => a - b);
    if (ordered.some(([index], i) => index !== i)) invalid('NONCONTIGUOUS_TOOL_INDEX', 'stream-final');
    return normalizeChatCompletion({ choices: [{ index: 0, finish_reason: finish, message: { role: 'assistant', content, ...(ordered.length ? { tool_calls: ordered.map(([, c]) => c) } : {}) } }], usage });
  } catch (error) {
    const normalization = projectProviderProtocolDiagnostic(error);
    if (normalization) diagnostics.set(error, Object.freeze({ ...normalization, ...metrics() }));
    await reader.cancel().catch(() => {}); throw error;
  }
  finally { signal?.removeEventListener('abort', abort); reader.releaseLock(); }
}
