import { run } from './runtime.mjs';

// One selected original Run. Session/Runtime owns the only execution lease.
// These observations are not another persisted job lifecycle.
export async function workRun(options) {
 const { store, runId } = options?.durable ?? {};
 if (typeof store?.inspect !== 'function' || typeof runId !== 'string') throw Object.assign(new Error('WORKER_RUN_REQUIRED'), { code: 'WORKER_RUN_REQUIRED' });
 const admitted = store.inspect(runId);
 if (admitted.parentRunId !== null || admitted.rootId !== runId) throw Object.assign(new Error('WORKER_ROOT_REQUIRED'), { code: 'WORKER_ROOT_REQUIRED' });
 let outcome;
 try { outcome = await run({ ...options, hostSignal: options.hostSignal ?? new AbortController().signal }); }
 catch (error) {
  if (error.code !== 'LEASE_BUSY') throw error;
  return { workerStatus: 'busy', run: store.inspect(runId) };
 }
 const original = store.inspect(runId);
 const body = options.publication ? store.publication(runId) : null;
 return {
  workerStatus: original.status !== 'active' ? 'settled' : outcome.status === 'interrupted' ? 'interrupted' : 'unresolved',
  run: original,
  publication: body?.receipt ?? null,
  observationCode: outcome.code,
  ...(outcome.interruption ? { interruption: outcome.interruption } : {})
 };
}
