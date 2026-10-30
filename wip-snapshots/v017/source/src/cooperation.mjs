import { randomUUID } from 'node:crypto';
export function createRootBudget({ model = 12, tool = 12 } = {}) {
  const limits = { model, tool }; const used = { model: 0, tool: 0 };
  if (Object.values(limits).some(n => !Number.isSafeInteger(n) || n < 1 || n > 1000)) throw new Error('Invalid root budget');
  return Object.freeze({
    rootId: randomUUID(),
    claim(kind) {
      if (!Object.hasOwn(used, kind)) throw new Error('Invalid root budget kind');
      if (used[kind] >= limits[kind]) { const error = new Error('Root budget exhausted'); error.code = 'ROOT_BUDGET_EXHAUSTED'; throw error; }
      used[kind]++;
    },
    snapshot() { return { ...used }; }
  });
}
export async function batchRead({ tasks, budget, read, concurrency = 2, signal } = {}) {
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 16 || typeof read !== 'function' || typeof budget?.claim !== 'function' || !Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error('Invalid batch task configuration');
  const seen = new Set();
  for (const task of tasks) {
    if (!task || Object.keys(task).sort().join(',') !== 'documentId,page,taskId' || typeof task.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(task.taskId) || seen.has(task.taskId) || !['atlas-a','atlas-b'].includes(task.documentId) || !Number.isSafeInteger(task.page) || task.page < 1 || task.page > 2) throw new Error('Invalid or duplicate scoped task');
    seen.add(task.taskId);
  }
  const inputs = structuredClone(tasks); const results = Array(inputs.length); let next = 0;
  async function worker() {
    for (;;) {
      const index = next++; if (index >= inputs.length) return;
      const task = inputs[index]; let dispatched = false; const start = performance.now();
      try {
        signal?.throwIfAborted(); budget.claim('tool'); dispatched = true;
        const value = await read(structuredClone(task), { signal }); signal?.throwIfAborted();
        results[index] = { taskId: task.taskId, status: 'succeeded', dispatched, value, durationMs: performance.now() - start };
      } catch (error) {
        results[index] = { taskId: task.taskId, status: signal?.aborted ? 'cancelled' : 'failed', dispatched, error: error?.code || error?.message || 'Read failed', durationMs: performance.now() - start };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}
