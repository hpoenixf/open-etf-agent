import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openMemoryLibrary } from '../src/memory.mjs';
import { openMemoryConsumer } from '../src/memory-consumer.mjs';
import { runMemoryRecall } from '../src/memory-recall-demo.mjs';
import { createChatGateway } from '../src/gateway.mjs';
import { run } from '../src/runtime.mjs';
import { sha256 } from '../src/source.mjs';

async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/memory-consumer-unit-')); }
const grant = (library, operation, text, extra = {}) => ({ explicit: true, libraryId: library.libraryId, operation, intentId: 'consumer-' + operation, origin: 'synthetic-test', ...(text === undefined ? {} : { approvedTextHash: sha256(text) }), ...extra });

test('14.4 temporary selection has no Memory owner, bindings or working projection', async () => {
  const selection = await openMemoryConsumer({ directory: '/unavailable/library', temporary: true });
  assert.equal(selection.libraryId, null); assert.equal(selection.workingInput, undefined); assert.deepEqual(selection.extensions, []); await selection.close();
});

test('14.5 read-only consumer works alongside an existing writer without changing its lock', async () => {
  const dir = await directory(); const writer = await openMemoryLibrary({ directory: dir, writable: true });
  try {
    const text = 'SYNTHETIC selected preference'; const saved = await writer.save({ text }, { intent: grant(writer, 'save', text) });
    const lock = await readFile(join(dir, '.writer.lock'));
    const selection = await openMemoryConsumer({ directory: dir });
    try {
      assert.deepEqual(selection.extensions.map(binding => binding.name).sort(), ['memory_list', 'memory_read', 'memory_search']);
      assert.equal((await selection.workingInput.memoryLibrary.read(saved.id)).text, text);
      await assert.rejects(selection.workingInput.memoryLibrary.save({ text }), /read only/);
    } finally { await selection.close(); }
    assert.deepEqual(await readFile(join(dir, '.writer.lock')), lock);
  } finally { await writer.close(); }
});

test('14.6 missing corrupt and symlinked libraries fail without initializing or repairing them', async () => {
  const root = await directory();
  await assert.rejects(openMemoryConsumer({ directory: join(root, 'missing') })); assert.deepEqual(await readdir(root), []);
  const dir = join(root, 'corrupt'); await mkdir(dir); await writeFile(join(dir, 'memory-index.json'), '{broken');
  await assert.rejects(openMemoryConsumer({ directory: dir })); assert.equal(await readFile(join(dir, 'memory-index.json'), 'utf8'), '{broken'); assert.deepEqual(await readdir(dir), ['memory-index.json']);
  const link = join(root, 'link'); await symlink(dir, link); await assert.rejects(openMemoryConsumer({ directory: link }), /Unsafe/);
});

for (const operation of ['revise', 'forget']) test('14.7 ' + operation + ' after search cannot revive stale text in actual encoded subsequent requests', async () => {
  const root = await directory(), writer = await openMemoryLibrary({ directory: join(root, 'library'), writable: true });
  let selection;
  try {
    const old = 'SYNTHETIC stale preference MARKER_OLD_14', current = 'SYNTHETIC current preference MARKER_NEW_14';
    const saved = await writer.save({ text: old }, { intent: grant(writer, 'save', old) });
    selection = await openMemoryConsumer({ directory: join(root, 'library') });
    let searches = 0;
    const extensions = selection.extensions.map(binding => binding.name !== 'memory_search' ? binding : { ...binding, async execute(args, context) {
      const value = await binding.execute(args, context);
      if (++searches === 1) {
        const intent = grant(writer, operation, operation === 'forget' ? undefined : current, { entryId: saved.id, expectedRevision: 1 });
        if (operation === 'forget') await writer.forget(saved.id, 1, { intent }); else await writer.revise(saved.id, 1, { text: current }, { intent });
      }
      return value;
    } });
    const requests = []; let step = 0;
    const adapter = createChatGateway({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'synthetic-test', apiKey: 'synthetic-not-a-secret', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, fetchImpl: async (_url, { body }) => {
      requests.push(body); const n = step++;
      const message = n < 2 ? { role: 'assistant', content: null, tool_calls: [{ id: 'search-' + n, type: 'function', function: { name: 'memory_search', arguments: JSON.stringify({ query: 'preference' }) } }] } : { role: 'assistant', content: 'Synthetic currentness checked.' };
      return new Response(JSON.stringify({ choices: [{ message, finish_reason: n < 2 ? 'tool_calls' : 'stop' }] }), { status: 200 });
    } });
    const result = await run({ question: 'Use selected read-only Memory.', gateway: { ...adapter, mode: 'fixture' }, extensions, workingInput: selection.workingInput, outputRoot: join(root, 'runs'), requireReport: false });
    assert.equal(result.status, 'completed'); assert.equal(requests.length, 3);
    for (const body of requests) { assert.ok(!body.includes(old)); assert.ok(!/memory_save|memory_revise|memory_forget/.test(body)); }
    assert.ok(requests[1].includes('unavailable-memory-projection'));
    assert.equal(requests[2].includes(current), operation === 'revise');
    if (operation === 'revise') assert.ok(requests[2].includes('\\"revision\\":2'));
    else assert.deepEqual(await writer.search('preference'), []);
  } finally { await selection?.close(); await writer.close(); }
});

test('14.8 miss stays empty and pre-cancelled consumer does not open configured library', async () => {
  const root = await directory(), dir = join(root, 'library');
  const writer = await openMemoryLibrary({ directory: dir, writable: true });
  const text = 'SYNTHETIC unmatched preference'; await writer.save({ text }, { intent: grant(writer, 'save', text) }); await writer.close();
  const result = await runMemoryRecall({ libraryDirectory: dir, query: 'absent-marker', outputRoot: join(root, 'runs') });
  assert.equal(result.status, 'completed'); assert.deepEqual(result.memory.consumed, []);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runMemoryRecall({ libraryDirectory: join(root, 'never-created'), query: 'valid', signal: controller.signal }));
  assert.deepEqual((await readdir(root)).sort(), ['library', 'runs']);
});
