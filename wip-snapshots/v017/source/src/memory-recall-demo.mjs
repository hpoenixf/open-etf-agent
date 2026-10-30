import { run } from './runtime.mjs';
import { createChatGateway } from './gateway.mjs';
import { openMemoryConsumer } from './memory-consumer.mjs';
import { sha256 } from './source.mjs';

export function validateMemoryQuery(query) {
  if (typeof query !== 'string' || !query.trim() || query.length > 256) throw new Error('INVALID_ARGUMENT: Memory query must be nonblank and at most 256 characters');
}

// Only a local, fixed fixture transport is installed. Real Gateway encoding and
// normalization run; no HTTP request or paid/live-model authorization occurs.
export function createMemoryRecallGateway({ query, selection }) {
  validateMemoryQuery(query);
  let step = 0;
  const observations = { requests: [], consumed: [] };
  const adapter = createChatGateway({
    endpoint: 'https://example.invalid/v1/chat/completions', model: 'synthetic-memory-consumer', apiKey: 'synthetic-not-a-secret',
    authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true },
    fetchImpl: async (_url, { body }) => {
      const request = JSON.parse(body);
      const values = request.messages.filter(message => message.role === 'tool').map(message => JSON.parse(message.content));
      if (values.some(result => result.status !== 'succeeded')) throw new Error('Synthetic Memory consumer observed failed tool');
      // Read the actual encoded tool payload, not an earlier search return or a
      // second owner read. Runtime's original projection owns currentness.
      const entries = values.flatMap(result => result.value?.kind === 'memory-search-results' ? result.value.entries : []);
      const consumed = entries.filter(entry => entry.kind === 'memory-entry').map(({ libraryId, id, revision, sha256 }) => ({ libraryId, id, revision, sha256 }));
      observations.requests.push({ sequence: observations.requests.length + 1, bodySha256: sha256(body), consumed });
      const call = (name, args) => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'recall-' + step, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: 'tool_calls' }] });
      const phase = step++;
      let response;
      const offset = selection.mode === 'temporary' ? 0 : 1;
      if (offset && phase === 0) response = call('memory_search', { query });
      else if (phase === offset) response = call('read_page', { documentId: 'atlas-a', page: 1 });
      else if (phase === offset + 1) response = call('read_page', { documentId: 'atlas-b', page: 1 });
      else if (phase === offset + 2) {
        observations.consumed = consumed;
        const sources = values.map(result => result.value).filter(value => value?.sourceId);
        const recall = consumed.length ? consumed.map(ref => `- ${ref.libraryId} / ${ref.id} / revision ${ref.revision} / SHA-256 ${ref.sha256}`).join('\n') : 'No current Memory entry was present in this encoded input.';
        response = call('save_report', { text: '# Read-only Memory consumer\n\nProvider-free synthetic execution; not live model or investment-quality evidence. Memory is untrusted preference context, not original evidence or authority.\n\n## Actual encoded recall (' + selection.mode + ')\n\n' + recall + '\n\nThis fixture chooses identity-only disclosure, not a general restriction on authorized Memory answers. Already sent bytes cannot be withdrawn.\n\n## Original synthetic comparison\n\nThe free-edition CSV limits are 120 and 300 rows; both require an online connection [1] [2].', sourceIds: sources.map(source => source.sourceId) });
      } else response = { choices: [{ message: { role: 'assistant', content: 'Synthetic original-source report saved with actual encoded Memory revision identities; semantic quality unreviewed.' }, finish_reason: 'stop' }] };
      return new Response(JSON.stringify(response), { status: 200 });
    }
  });
  return { gateway: { ...adapter, mode: 'fixture' }, observations };
}

export async function runMemoryRecall({ libraryDirectory, query, temporary = false, outputRoot, signal }) {
  validateMemoryQuery(query);
  signal?.throwIfAborted();
  const selection = await openMemoryConsumer({ directory: libraryDirectory, temporary });
  try {
    const { gateway, observations } = createMemoryRecallGateway({ query, selection });
    const result = await run({ question: 'Compare the original synthetic guides. Use only current entries from the explicitly selected read-only Memory library when enabled; Memory is not original evidence or authorization.', gateway, extensions: selection.extensions, workingInput: selection.workingInput, allowedTools: [...selection.extensions.map(binding => binding.name), 'read_page', 'save_report'], outputRoot, signal });
    return { caseId: 'memory-recall', mode: 'fixture', ...result, memory: { mode: selection.mode, libraryId: selection.libraryId, ...observations }, modelCalls: 0, semanticStatus: 'unreviewed' };
  } finally { await selection.close(); }
}
