import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createResultStore } from '../src/results.mjs';
import { readFixturePage } from '../src/tools.mjs';
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/results-')); }
const validRef = ref => assert.match(ref.resultRef, /^result:sha256:[a-f0-9]{64}$/);
test('4.1 actual immutable snapshot has a durable ref and survives store reopening', async () => {
  const dir = await directory(); const source = await readFixturePage({ documentId: 'atlas-a', page: 1 });
  const store = await createResultStore({ directory: dir }); const ref = await store.add(source); validRef(ref);
  assert.deepEqual(await store.read(ref.resultRef), source); assert.equal((await store.resolve(source.sourceId)).resultRef, ref.resultRef);
  const reopened = await createResultStore({ directory: dir }); assert.deepEqual(await reopened.read(ref.resultRef), source);
  const index = JSON.parse(await readFile(join(dir, 'content-index.json'), 'utf8')); assert.equal(index.entries.length, 1);
});
test('4.1 equal text hash cannot rebind a source ID to different intrinsic metadata', async () => {
  const store = await createResultStore({ directory: await directory() }); const source = await readFixturePage({ documentId: 'atlas-a', page: 1 });
  validRef(await store.add(source));
  for (const changed of [{ ...source, version: 'changed' }, { ...source, page: 2 }, { ...source, name: 'different document identity' }]) await assert.rejects(store.add(changed), /identity|rebind|conflict/i);
});
test('4.1 a distinct newer version does not replace the old ref bytes', async () => {
  const dir = await directory(); const store = await createResultStore({ directory: dir }); const a = await readFixturePage({ documentId: 'atlas-a', page: 1 });
  const newer = { ...a, sourceId: 'atlas-a@A-2026-02:p1', version: 'A-2026-02' };
  const old = await store.add(a); validRef(old); const updated = await store.add(newer); validRef(updated); assert.notEqual(old.resultRef, updated.resultRef);
  const reopened = await createResultStore({ directory: dir }); assert.deepEqual(await reopened.read(old.resultRef), a); assert.deepEqual(await reopened.read(updated.resultRef), newer);
});
test('4.1 unknown paths, corrupted records and invalid source hashes reject', async () => {
  const dir = await directory(); const store = await createResultStore({ directory: dir }); const source = await readFixturePage({ documentId: 'atlas-a', page: 1 });
  const ref = await store.add(source); validRef(ref);
  await assert.rejects(store.read('../secret'), /ref|unknown|invalid/i);
  await assert.rejects(store.add({ ...source, sha256: 'wrong' }), /hash|snapshot|invalid/i);
  await writeFile(join(dir, 'results', ref.resultRef.split(':').at(-1) + '.json'), '{}'); await assert.rejects(store.read(ref.resultRef), /corrupt|identity|snapshot|hash/i);
});
test('4.1 add captures the original snapshot before asynchronous queue dispatch', async () => {
  const store=await createResultStore({directory:await directory()}); const source=await readFixturePage({documentId:'atlas-a',page:1}); const original=structuredClone(source);
  const pending=store.add(source); source.name='mutated after acquisition'; const ref=await pending; assert.deepEqual(await store.read(ref.resultRef),original);
});
test('4.1 symlink record directories and corrupt durable index are refused', async () => {
  const { symlink, readdir }=await import('node:fs/promises'); const dir=await directory(); const target=await directory(); await symlink(target,join(dir,'results'));
  await assert.rejects(createResultStore({directory:dir}),/unsafe|symlink/i); assert.deepEqual(await readdir(target),[]);
  const other=await directory(); await writeFile(join(other,'content-index.json'),'{}'); await assert.rejects(createResultStore({directory:other}),/corrupt|index/i);
});
test('4.1 missing index cannot silently reset a nonempty original-content directory', async () => {
  const { unlink }=await import('node:fs/promises'); const dir=await directory(); const store=await createResultStore({directory:dir});
  await store.add(await readFixturePage({documentId:'atlas-a',page:1})); await unlink(join(dir,'content-index.json'));
  await assert.rejects(createResultStore({directory:dir}),/missing|index|corrupt/i);
});
