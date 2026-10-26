import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createToolHost, readFixturePage } from '../src/tools.mjs';
import { createHookChain } from '../src/hooks.mjs';
import { createRootBudget } from '../src/cooperation.mjs';
import { run } from '../src/runtime.mjs';
import { runReadOnlyChild } from '../src/child.mjs';
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/cooperation-')); }
const page = { documentId: 'atlas-a', page: 1 };
test('3.3 Host revalidates effective Hook arguments and preserves original call', async () => {
  const host = await createToolHost({ directory: await directory(), hooks: createHookChain({ aliases: { legacy_read: 'read_page' }, mutableFields: ['page'], before: [() => ({ name: 'read_page', arguments: { page: 2 } })] }) });
  const result = await host.execute({ id: 'r', name: 'legacy_read', arguments: page });
  assert.equal(result.status, 'succeeded'); assert.equal(result.value.page, 2); assert.equal(result.original.arguments.page, 1); assert.equal(result.effective.arguments.page, 2);
  const invalid = await createToolHost({ directory: await directory(), hooks: createHookChain({ mutableFields: ['page'], before: [() => ({ arguments: { page: 99 } })] }) });
  const rejected = await invalid.execute({ id: 'bad', name: 'read_page', arguments: page }); assert.equal(rejected.dispatched, false); assert.equal(rejected.status, 'rejected');
});
test('3.3 observer failure preserves successful returned source', async () => {
  const host = await createToolHost({ directory: await directory(), hooks: createHookChain({ after: [() => { throw new Error('observer unavailable'); }] }) });
  const result = await host.execute({ id: 'r', name: 'read_page', arguments: page });
  assert.equal(result.status, 'succeeded'); assert.equal(result.hookErrors?.length, 1);
});
test('3.3 batch source snapshots enter the same save registry', async () => {
  const source = await readFixturePage(page); const d = await directory();
  const host = await createToolHost({ directory: d, extensions: [{ name: 'batch_read', description: 'Fixed scoped reads', parameters: {}, sourceResults: true, validate: () => {}, execute: async () => ({ sources: [source], tasks: [] }) }] });
  await host.execute({ id: 'b', name: 'batch_read', arguments: {} });
  const saved = await host.execute({ id: 's', name: 'save_report', arguments: { text: '# Main synthesis', sourceIds: [source.sourceId] } });
  assert.equal(saved.status, 'succeeded'); const manifest = JSON.parse(await readFile(join(d, 'manifest.json'), 'utf8')); assert.deepEqual(manifest.sources, [source]);
});
test('3.3 root budget refusal stops before a second model request', async () => {
  let calls = 0; const rootBudget = createRootBudget({ model: 1, tool: 2 });
  const result = await run({ question: 'read', outputRoot: await directory(), requireReport: false, rootBudget, gateway: { next: async () => ++calls === 1 ? { kind: 'calls', calls: [{ id: 'r', name: 'read_page', arguments: page }] } : { kind: 'final', text: 'done' } } });
  assert.equal(calls, 1); assert.equal(result.status, 'failed'); assert.equal(result.code, 'ROOT_BUDGET_EXHAUSTED'); assert.deepEqual(rootBudget.snapshot(), { model: 1, tool: 1 });
});
test('3.4 fixture child shares root counters and advertises only allowed read tool', async () => {
  const rootBudget = createRootBudget({ model: 2, tool: 1 }); let calls = 0; const seen = [];
  const result = await runReadOnlyChild({ taskId: 'child-a', question: 'Compare limits', dimensions: ['row limit'], documents: ['atlas-a'], outputRoot: await directory(), rootBudget, gateway: { mode: 'fixture', next: async ({ tools, messages }) => { seen.push(tools.map(t => t.name)); calls++; return calls === 1 ? { kind: 'calls', calls: [{ id: 'read', name: 'read_page', arguments: page }] } : { kind: 'final', text: messages.at(-1).result.value.text }; } } });
  assert.equal(result.status, 'completed'); assert.deepEqual(seen, [['read_page'], ['read_page']]); assert.deepEqual(rootBudget.snapshot(), { model: 2, tool: 1 }); assert.equal(result.receipt, null); assert.equal(result.derived, true);
});
test('3.4 child cannot read outside handoff or dispatch save', async () => {
  for (const call of [{ id: 'o', name: 'read_page', arguments: { documentId: 'atlas-b', page: 1 } }, { id: 's', name: 'save_report', arguments: { text: 'forbidden', sourceIds: [] } }]) {
    const result = await runReadOnlyChild({ taskId: 'restricted', question: 'read only A', dimensions: ['limits'], documents: ['atlas-a'], outputRoot: await directory(), rootBudget: createRootBudget({ model: 2, tool: 2 }), gateway: { mode: 'fixture', next: async () => ({ kind: 'calls', calls: [call] }) } });
    assert.equal(result.status, 'failed'); assert.equal(result.toolsDispatched, 0); assert.equal(result.receipt, null);
  }
});
test('3.3 root identity joins Main and child metadata without copying prompts', async () => {
  const rootBudget = createRootBudget({ model: 2, tool: 1 });
  const result = await run({ question: 'private synthetic prompt', outputRoot: await directory(), rootBudget, taskId: 'metadata-case', requireReport: false, gateway: { next: async () => ({ kind: 'final', text: 'done' }) } });
  assert.equal(typeof rootBudget.rootId, 'string'); assert.ok(rootBudget.rootId.length > 8); assert.equal(result.rootId, rootBudget.rootId);
  const events = (await readFile(join(result.directory, 'run.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(events.every(event => event.rootId === rootBudget.rootId && event.taskId === 'metadata-case'));
});
test('3.3 exact save alias records the effective file effect, not just the proposal name', async () => {
  let step = 0;
  const hooks = createHookChain({ aliases: { legacy_save: 'save_report' }, before: [({ effective }) => effective.name === 'legacy_save' ? { name: 'save_report' } : undefined] });
  const result = await run({ question: 'read then save', outputRoot: await directory(), hooks, gateway: { next: async ({ messages }) => {
    if (step++ === 0) return { kind: 'calls', calls: [{ id: 'r', name: 'read_page', arguments: page }] };
    if (step === 2) return { kind: 'calls', calls: [{ id: 's', name: 'legacy_save', arguments: { text: '# Aliased save', sourceIds: [messages.at(-1).result.value.sourceId] } }] };
    return { kind: 'final', text: 'saved' };
  } } });
  assert.equal(result.status, 'completed');
  const events = (await readFile(join(result.directory, 'run.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(events.some(event => event.type === 'file_saved' && event.receipt.operationId === 's'));
  const dispatched = events.find(event => event.type === 'tool_result' && event.callId === 's'); assert.equal(dispatched.name, 'save_report'); assert.equal(dispatched.original.name, 'legacy_save');
});
test('3.3 release observes Runtime finalization attempt rather than a premature terminal', async () => {
  const outputRoot = await directory(); let observed = false;
  const hooks = createHookChain({ release: [async event => {
    const events = (await readFile(join(outputRoot, event.runId, 'run.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(events.at(-1).type, 'run_finished'); assert.equal(events.at(-1).status, event.status); assert.deepEqual(event.logErrors, []); observed = true;
  }] });
  const result = await run({ question: 'direct final', outputRoot, hooks, requireReport: false, gateway: { next: async () => ({ kind: 'final', text: 'done' }) } });
  assert.equal(result.status, 'completed'); assert.equal(observed, true); assert.deepEqual(result.hookErrors, []);
});
