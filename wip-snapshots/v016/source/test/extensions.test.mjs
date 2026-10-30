import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { run } from '../src/runtime.mjs';
import { createToolHost } from '../src/tools.mjs';
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/extensions-')); }
test('2.4 trusted extra binding enters ordinary Host dispatch and Runtime budget', async () => {
  let dispatched = 0;
  const extensions = [{ name: 'method', description: 'Synthetic method read', parameters: { type: 'object', properties: {}, additionalProperties: false }, validate: args => { assert.deepEqual(args, {}); }, execute: async () => { dispatched++; return { text: 'method as data' }; } }];
  let step = 0;
  const gateway = { next: async ({ messages }) => step++ === 0 ? { kind: 'calls', calls: [{ id: 'extension-call', name: 'method', arguments: {} }] } : { kind: 'final', text: messages.at(-1).result.value.text } };
  const result = await run({ question: 'load method', outputRoot: await directory(), gateway, extensions, requireReport: false });
  assert.equal(result.status, 'completed'); assert.equal(result.answer, 'method as data'); assert.equal(dispatched, 1); assert.equal(result.toolsDispatched, 1);
});
test('2.4 extension binding cannot replace an existing builtin tool', async () => {
  await assert.rejects(createToolHost({ directory: await directory(), extensions: [{ name: 'read_page' }] }), /duplicate|collision|builtin/i);
});
test('2.4 validated externally acquired page is the exact saved source snapshot', async () => {
  const snapshot = { sourceId: 'remote@R:p1', documentId: 'remote', name: 'Synthetic remote note', version: 'R', page: 1, text: 'Actual remote snapshot', sha256: 'placeholder', mediaType: 'text/plain; charset=utf-8' };
  const { createHash } = await import('node:crypto'); snapshot.sha256 = createHash('sha256').update(snapshot.text).digest('hex');
  const extensions = [{ name: 'external_read', description: 'Read synthetic source', parameters: {}, sourceResult: true, validate: () => {}, execute: async () => snapshot }];
  const d = await directory(); const host = await createToolHost({ directory: d, extensions });
  const read = await host.execute({ id: 'r', name: 'external_read', arguments: {} }); assert.equal(read.status, 'succeeded');
  const saved = await host.execute({ id: 's', name: 'save_report', arguments: { text: '# Result', sourceIds: [snapshot.sourceId] } }); assert.equal(saved.status, 'succeeded');
  const manifest = JSON.parse(await readFile(join(d, 'manifest.json'), 'utf8')); assert.deepEqual(manifest.sources[0], snapshot);
});
