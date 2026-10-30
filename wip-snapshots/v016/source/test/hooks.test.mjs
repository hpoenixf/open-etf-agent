import test from 'node:test';
import assert from 'node:assert/strict';
import { createHookChain } from '../src/hooks.mjs';
const call = { id: 'c1', name: 'legacy_read', arguments: { documentId: 'atlas-a', page: 1 } };
test('3.1 ordered before hooks retain frozen original and exact effective patch', async () => {
  const order = [];
  const hooks = createHookChain({ aliases: { legacy_read: 'read_page' }, mutableFields: ['page'], before: [input => { order.push(1); assert.ok(Object.isFrozen(input.original.arguments)); return { name: 'read_page', arguments: { page: 2 } }; }, input => { order.push(2); assert.equal(input.effective.arguments.page, 2); }] });
  const result = await hooks.before(call); assert.deepEqual(order, [1, 2]); assert.deepEqual(result.original, call); assert.equal(result.effective.name, 'read_page'); assert.equal(result.effective.arguments.page, 2); assert.equal(call.arguments.page, 1);
});
test('3.1 before hooks cannot rewrite identity or undeclared field/tool', async () => {
  for (const patch of [{ id: 'other' }, { name: 'save_report' }, { arguments: { documentId: 'outside' } }]) await assert.rejects(createHookChain({ mutableFields: ['page'], before: [() => patch] }).before(call), /patch|field|alias/i);
});
test('3.1 a pending before hook reaches bounded timeout', async () => {
  await assert.rejects(createHookChain({ timeoutMs: 20, before: [() => new Promise(() => {})] }).before(call), /timeout/i);
});
test('3.1 after observer error cannot replace an immutable receipt', async () => {
  const event = { result: { status: 'succeeded', value: { sha256: 'fixed' } } };
  const errors = await createHookChain({ after: [input => { input.result.value.sha256 = 'forged'; }] }).observe('after', event);
  assert.equal(errors.length, 1); assert.equal(event.result.value.sha256, 'fixed');
});
