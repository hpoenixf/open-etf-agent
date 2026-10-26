import { createRootBudget, batchRead } from './cooperation.mjs';
import { createHookChain } from './hooks.mjs';
import { readFixturePage } from './tools.mjs';
import { runReadOnlyChild } from './child.mjs';
const tasks = [{ taskId: 'version-a', documentId: 'atlas-a', page: 1 }, { taskId: 'version-b', documentId: 'atlas-b', page: 1 }];
export function prepareCooperation({ mode, outputRoot, signal } = {}) {
  if (!['batch-read', 'fixture-child'].includes(mode)) throw new Error('Unsupported offline cooperation mode');
  const rootBudget = createRootBudget({ model: 8, tool: 8 });
  const metadata = [];
  const hooks = createHookChain({ aliases: { legacy_batch: 'batch_read' }, before: [({ effective }) => effective.name === 'legacy_batch' ? { name: 'batch_read' } : undefined], after: [event => { metadata.push({ callId: event.callId, status: event.result.status, durationMs: event.result.durationMs, observation: 'result-returned-not-generic-durability' }); }], release: [event => { metadata.push({ runId: event.runId, status: event.status, observation: 'run-release' }); }] });
  const extension = {
    name: mode === 'batch-read' ? 'batch_read' : 'fixture_child',
    description: mode === 'batch-read' ? 'Two fixed scoped synthetic read workers, not model agents.' : 'One read-only scripted child loop; not a live independent model claim.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }, sourceResults: true,
    validate: args => { if (!args || Array.isArray(args) || Object.keys(args).length) throw new Error('This demo accepts no model-selected dispatch configuration'); },
    async execute(_, { signal: callSignal }) {
      if (mode === 'batch-read') {
        const results = await batchRead({ tasks, budget: rootBudget, concurrency: 2, signal: callSignal, read: ({ documentId, page }) => readFixturePage({ documentId, page }) });
        return { sources: results.filter(r => r.status === 'succeeded').map(r => r.value), tasks: results.map(({ value, ...meta }) => meta), workerKind: 'fixed-read-workers', derived: false };
      }
      let step = 0;
      const child = await runReadOnlyChild({ taskId: 'compare-versions', question: 'Compare free export formats, row limits, and shared online condition across both synthetic versions.', dimensions: ['free export formats', 'row limits', 'shared online condition'], documents: ['atlas-a', 'atlas-b'], outputRoot, rootBudget, signal: callSignal, gateway: {
        mode: 'fixture',
        async next({ messages }) {
          if (step < tasks.length) { const task = tasks[step++]; return { kind: 'calls', calls: [{ id: `child-${task.taskId}`, name: 'read_page', arguments: { documentId: task.documentId, page: task.page } }] }; }
          return { kind: 'final', text: 'Derived fixture observation from ' + messages.filter(m => m.role === 'tool').length + ' actual page results. No live semantic assessment.' };
        }
      } });
      return { sources: child.sources || [], child: { taskId: child.taskId, runId: child.runId, status: child.status, code: child.code, derived: true, summary: child.answer, mode: child.mode, toolsDispatched: child.toolsDispatched }, workerKind: 'fixture-child' };
    }
  };
  let step = 0;
  const gateway = { mode: 'fixture', async next({ messages }) {
    const results = messages.filter(m => m.role === 'tool').map(m => m.result);
    if (step++ === 0) return { kind: 'calls', calls: [{ id: 'cooperation-read', name: mode === 'batch-read' ? 'legacy_batch' : 'fixture_child', arguments: {} }] };
    if (step === 2) {
      const acquired = results[0]?.value;
      if (!acquired?.sources?.length) throw new Error('No source acquired; cannot claim complete comparison');
      const incomplete = acquired.sources.length !== 2 || (acquired.child && acquired.child.status !== 'completed');
      return { kind: 'calls', calls: [{ id: 'main-save', name: 'save_report', arguments: { text: `# Main-owned cooperation report\n\nMode: ${mode}; scripted offline mechanism, semantic status unreviewed.\n\n${incomplete ? 'Incomplete: one or more required reads failed; no complete comparison is claimed.' : 'Free A supports CSV and 120 rows; free B adds Markdown and allows 300 rows. Both versions require online exports. Enterprise PDF is not a free-edition entitlement.'}\n\nWorker observations are not independent sources or publication authority. Main saves this report using only the actual acquired page snapshots.`, sourceIds: acquired.sources.map(s => s.sourceId) } }] };
    }
    const receipt = results.find(r => r.value?.fileId)?.value;
    if (!receipt) throw new Error('No actual Main save receipt');
    return { kind: 'final', text: 'Main saved ' + receipt.fileId, usage: null };
  } };
  return { extensions: [extension], gateway, rootBudget, hooks, metadata, signal };
}
