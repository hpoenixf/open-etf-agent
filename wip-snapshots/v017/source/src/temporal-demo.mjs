import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { openSession } from './session.mjs';
import { run, submitRun } from './runtime.mjs';
import { workRun } from './worker.mjs';
import { taskTimeMessage } from './temporal.mjs';
import { sha256 } from './source.mjs';

// Offline consumer of the actual projected request; no live-model qualification.
export function createTemporalDemoGateway(taskTime) {
 return { mode: 'fixture', async next({ messages }) {
  if (JSON.stringify(messages[1]) !== JSON.stringify(taskTimeMessage(taskTime))) throw new Error('TASK_TIME_NOT_CONSUMED');
  const values = messages.filter(m => m.role === 'tool').map(m => m.result.value);
  if (!values.length) return { kind: 'calls', calls: [{ id: 'source', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] };
  if (values.length === 1) return { kind: 'calls', calls: [{ id: 'report', name: 'save_report', arguments: {
   text: `# Fixed task date\n\nOriginal question: compare today with yesterday.\n\nTask anchor: ${taskTime.anchorInstant}\nTime zone: ${taskTime.timeZone}\nToday: ${taskTime.taskDate}\nYesterday: ${taskTime.yesterday}\nTomorrow: ${taskTime.tomorrow}\n\nThese dates interpret the original task, not the source's publication/data date. This synthetic source is not current market evidence. Offline fixture; semantic quality unreviewed.`,
   sourceIds: [values[0].sourceId]
  } }] };
  return { kind: 'final', text: `Saved the original task dates: today ${taskTime.taskDate}; yesterday ${taskTime.yesterday}.` };
 } };
}
export async function temporalDemo({ directory, runId, operation, taskTime, signal } = {}) {
 const store = await openSession({ directory });
 try {
  const bindings = { gateway: { mode: 'fixture', provider: 'synthetic', protocol: 'fixture@1', model: 'temporal', version: '1' }, plugins: [], adapters: [{ id: 'temporal-demo', version: '1', contentSha256: sha256(await readFile(new URL(import.meta.url))) }] };
  let saved;
  try { saved = store.inspect(runId); } catch (e) { if (e.code !== 'UNKNOWN_RUN') throw e; }
  const gateway = { mode: 'fixture', async next(input) { return createTemporalDemoGateway(store.inspect(runId).definition.config.taskTime).next(input); } };
  const options = { question: 'Compare today with yesterday; preserve the original task date.', taskTime, gateway, outputRoot: join(directory, 'runs'), limits: { maxRounds: 4, maxTools: 3, timeoutMs: 300000 }, durable: { store, runId, grantId: 'synthetic-temporal-demo', bindings } };
  if (operation === 'submit') return await submitRun({ ...options, signal });
  if (operation === 'work') { if (!saved) throw Object.assign(new Error('UNKNOWN_RUN'), { code: 'UNKNOWN_RUN' }); return await workRun({ ...options, hostSignal: signal }); }
  if (operation === 'read') { if (!saved || saved.status !== 'completed') throw Object.assign(new Error('COMPLETED_RUN_REQUIRED'), { code: 'COMPLETED_RUN_REQUIRED' }); return await run(options); }
  throw new Error('INVALID_OPERATION');
 } finally { store.close(); }
}
