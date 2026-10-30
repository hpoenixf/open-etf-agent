import test from 'node:test';
import assert from 'node:assert/strict';
import { createRootBudget, batchRead } from '../src/cooperation.mjs';
const tasks = [{ taskId: 'a', documentId: 'atlas-a', page: 1 }, { taskId: 'b', documentId: 'atlas-b', page: 1 }];
test('3.2 the final root unit is claimed exactly once before async dispatch', async () => {
  const budget = createRootBudget({ model: 1, tool: 1 });
  const claims = await Promise.allSettled([Promise.resolve().then(() => budget.claim('tool')), Promise.resolve().then(() => budget.claim('tool'))]);
  assert.equal(claims.filter(r => r.status === 'fulfilled').length, 1); assert.deepEqual(budget.snapshot(), { model: 0, tool: 1 });
});
test('3.2 reversed completion retains task pairing and bounded concurrency', async () => {
  let active = 0; let maximum = 0; const completed = [];
  const result = await batchRead({ tasks, budget: createRootBudget({ model: 1, tool: 2 }), concurrency: 2, read: async task => { active++; maximum = Math.max(maximum, active); await new Promise(r => setTimeout(r, task.taskId === 'a' ? 20 : 1)); active--; completed.push(task.taskId); return task.documentId; } });
  assert.deepEqual(completed, ['b', 'a']); assert.equal(maximum, 2); assert.deepEqual(result.map(r => [r.taskId, r.status, r.value]), [['a','succeeded','atlas-a'],['b','succeeded','atlas-b']]);
});
test('3.2 local failure is preserved without fabricating a successful source', async () => {
  const result = await batchRead({ tasks, budget: createRootBudget({ model: 1, tool: 2 }), read: async task => { if (task.taskId === 'b') throw new Error('missing synthetic page'); return 'source-a'; } });
  assert.equal(result[0]?.status, 'succeeded'); assert.equal(result[1]?.status, 'failed'); assert.equal(result[1]?.value, undefined);
});
test('3.2 root cancellation prevents queued worker dispatch', async () => {
  const controller = new AbortController(); let calls = 0;
  const result = await batchRead({ tasks, signal: controller.signal, concurrency: 1, budget: createRootBudget({ model: 1, tool: 2 }), read: async () => { calls++; controller.abort(); throw new Error('cancelled read'); } });
  assert.equal(calls, 1); assert.equal(result[1]?.status, 'cancelled');
});
test('3.2 invalid duplicate or out-of-scope tasks reject before any read', async () => {
  for (const invalid of [[tasks[0], tasks[0]], [{ ...tasks[0], documentId: 'private' }]]) await assert.rejects(batchRead({ tasks: invalid, budget: createRootBudget({ model: 1, tool: 2 }), read: async () => assert.fail('must not read') }), /task|document|scope/i);
});
