import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, symlink, access, readdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { run } from '../src/runtime.mjs';
async function root() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/review-')); }
test('1.2 runtime preserves known partial file effects on manifest publication failure', async () => {
  const outputRoot = await root(); let step = 0;
  const gateway = { next: async ({ messages }) => {
    if (step++ === 0) {
      const [directory] = await readdir(outputRoot);
      await writeFile(join(outputRoot, directory, 'manifest.json'), 'occupied');
      return { kind: 'calls', calls: [{ id: 'read', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] };
    }
    return { kind: 'calls', calls: [{ id: 'save', name: 'save_report', arguments: { text: '# Exact body', sourceIds: [messages.at(-1).result.value.sourceId] } }] };
  } };
  const r = await run({ question: 'save original report', gateway, outputRoot });
  assert.equal(r.status, 'failed'); assert.equal(r.receipt, null);
  assert.deepEqual(r.partialEffects.filter(effect=>effect.partialPaths), [{ callId: 'save', name: 'save_report', partialPaths: ['report.md'] }]);
  assert.deepEqual(r.partialEffects.find(effect=>effect.artifactEffects).artifactEffects.map(effect=>effect.kind),['artifact','revision']);
  const events = (await readFile(join(r.directory, 'run.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.find(e => e.type === 'tool_result' && e.callId === 'save').partialPaths, ['report.md']);
  assert.match(await readFile(join(r.directory, 'report.md'), 'utf8'), /Exact body/);
  assert.equal(await readFile(join(r.directory, 'manifest.json'), 'utf8'), 'occupied');
});
test('1.2 unsafe ancestor refusal occurs before creating any descendant directory', async () => {
  const directory = await root(); const target = join(directory, 'target'); await mkdir(target);
  const alias = join(directory, 'alias'); await symlink(target, alias);
  await assert.rejects(run({ question: 'x', gateway: { next: async () => ({ kind: 'final', text: 'x' }) }, outputRoot: join(alias, 'child'), requireReport: false }), /symlink|directory/i);
  await assert.rejects(access(join(target, 'child')), { code: 'ENOENT' });
});
test('1.3 round count includes first final model request', async () => {
  const r = await run({ question: 'x', gateway: { next: async () => ({ kind: 'final', text: 'x' }) }, outputRoot: await root(), requireReport: false });
  assert.equal(r.status, 'completed'); assert.equal(r.rounds, 1);
});
