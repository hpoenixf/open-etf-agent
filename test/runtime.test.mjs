import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { run } from '../src/runtime.mjs';
async function options(extra = {}) {
  await mkdir('test-output', { recursive: true });
  return { outputRoot: await mkdtemp(resolve('test-output/runtime-')), question: 'Keep this exact original question.', requireReport: false, ...extra };
}
test('1.3 direct response retains exact user input and unique run', async () => {
  let captured;
  const o = await options({ gateway: { next: async request => { captured = request; return { kind: 'final', text: 'Hello' }; } } });
  const r = await run(o); assert.equal(r.status, 'completed');
  assert.equal(captured.messages[0].content, o.question);
  const second = await run(o); assert.notEqual(r.directory, second.directory);
  const events = (await readFile(join(r.directory, 'run.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(events.some(e => e.type === 'model_proposal'));
});
test('1.3 file task cannot complete without a save receipt', async () => {
  const r = await run(await options({ requireReport: true, gateway: { next: async () => ({ kind: 'final', text: 'I saved it.' }) } }));
  assert.equal(r.status, 'failed'); assert.equal(r.code, 'REPORT_REQUIRED'); assert.equal(r.receipt, null);
});
test('1.3 call IDs and tool results are paired, duplicate call IDs fail', async () => {
  let next = 0; let pair;
  const gateway = { next: async ({ messages }) => {
    if (next++ === 0) return { kind: 'calls', calls: [{ id: 'same', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] };
    pair = messages.at(-1); return { kind: 'calls', calls: [{ id: 'same', name: 'read_page', arguments: { documentId: 'atlas-b', page: 1 } }] };
  } };
  const r = await run(await options({ gateway }));
  assert.ok(pair, 'gateway must receive the actual paired tool result');
  assert.equal(pair.callId, 'same'); assert.equal(pair.result.callId, 'same');
  assert.equal(r.code, 'DUPLICATE_CALL_ID');
});
test('1.3 tool and round budgets bound dispatch', async () => {
  let count = 0;
  const gateway = { next: async () => ({ kind: 'calls', calls: [{ id: 'call-' + count++, name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] }) };
  const r = await run(await options({ gateway, limits: { maxRounds: 10, maxTools: 1, timeoutMs: 1000 } }));
  assert.equal(r.code, 'TOOL_LIMIT'); assert.equal(r.toolsDispatched, 1);
  const r2 = await run(await options({ gateway, limits: { maxRounds: 1, maxTools: 10, timeoutMs: 1000 } }));
  assert.equal(r2.code, 'ROUND_LIMIT');
});
test('1.3 cancellation during pending model prevents late tools', async () => {
  const controller = new AbortController();
  const gateway = { next: async () => { controller.abort(); return { kind: 'calls', calls: [{ id: 'late', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] }; } };
  const r = await run(await options({ gateway, signal: controller.signal }));
  assert.equal(r.status, 'cancelled'); assert.equal(r.toolsDispatched, 0);
});
test('1.3 timeout returns even when gateway never settles', async () => {
  const r = await run(await options({ gateway: { next: async () => new Promise(() => {}) }, limits: { maxRounds: 2, maxTools: 2, timeoutMs: 20 } }));
  assert.equal(r.code, 'TIMEOUT'); assert.equal(r.toolsDispatched, 0);
});
