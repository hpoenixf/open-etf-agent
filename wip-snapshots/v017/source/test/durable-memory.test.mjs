import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, lstat, readFile, writeFile, readdir, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDurableMemory } from '../src/durable-memory.mjs';
import { sha256 } from '../src/source.mjs';

const text = 'SYNTHETIC recovery preference: preserve exact source versions.';
let sequence = 0;
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/durable-memory-')); }
function intent(library, operation, value, extra = {}) { return { explicit: true, libraryId: library.libraryId, operation, intentId: 'durable-memory-' + (++sequence), origin: 'synthetic-test', ...(value === undefined ? {} : { approvedTextHash: sha256(value) }), ...extra }; }
async function call(adapter, name, args) {
  const binding = adapter.extensions.find(value => value.name === name);
  assert.ok(binding, 'ordinary Memory binding must exist');
  await binding.validate(args);
  return binding.execute(args, { signal: new AbortController().signal });
}
async function saved() {
  const dir = await directory(); const empty = await openDurableMemory({ directory: dir }); const grant = intent(empty, 'save', text);
  const adapter = await openDurableMemory({ directory: dir, intents: [grant] });
  const receipt = await call(adapter, 'memory_save', { text });
  return { dir, adapter, receipt, grant };
}
async function noLock(dir) { await assert.rejects(lstat(join(dir, '.writer.lock')), error => error.code === 'ENOENT'); }

test('7.Memory operation-scoped write closes owner before returning a verifiable receipt', async () => {
  const { dir, adapter, receipt } = await saved();
  await noLock(dir);
  assert.deepEqual(adapter.binding, { schemaVersion: 'durable-memory@1', libraryId: adapter.libraryId });
  assert.equal((await call(adapter, 'memory_read', { id: receipt.id })).text, text);
  assert.deepEqual(await adapter.verifyReceipt(receipt), receipt);
  assert.equal((await adapter.state({ libraryId: adapter.libraryId, id: receipt.id })).revision, 1);
  await assert.rejects(adapter.state({ libraryId: 'wrong-library', id: receipt.id }), /scope|library/i);
});

test('7.Memory a new actual process verifies original receipt without a new write grant', async () => {
  const dir = await directory();
  const code = `import {openDurableMemory} from './src/durable-memory.mjs'; import {sha256} from './src/source.mjs';
  const directory=process.argv[1]; const first=await openDurableMemory({directory}); const text='SYNTHETIC child-process preference.';
  const adapter=await openDurableMemory({directory,intents:[{explicit:true,libraryId:first.libraryId,operation:'save',intentId:'child-save',origin:'synthetic-test',approvedTextHash:sha256(text)}]});
  const tool=adapter.extensions.find(x=>x.name==='memory_save'); tool.validate({text}); const receipt=await tool.execute({text},{signal:new AbortController().signal}); console.log(JSON.stringify({pid:process.pid,receipt}));`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code, dir], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr); const original = JSON.parse(child.stdout);
  assert.notEqual(original.pid, process.pid);
  const verify = `import {openDurableMemory} from './src/durable-memory.mjs'; const adapter=await openDurableMemory({directory:process.argv[1]}); const receipt=await adapter.verifyReceipt(JSON.parse(process.argv[2])); console.log(JSON.stringify({pid:process.pid,receipt}));`;
  const second = spawnSync(process.execPath, ['--input-type=module', '-e', verify, dir, JSON.stringify(original.receipt)], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
  assert.equal(second.status, 0, second.stderr); const recovered = JSON.parse(second.stdout);
  assert.notEqual(recovered.pid, original.pid); assert.notEqual(recovered.pid, process.pid);
  assert.deepEqual(recovered.receipt, original.receipt);
  assert.equal((await readdir(join(dir, 'intents'))).length, 1);
  await noLock(dir);
});

test('7.Memory settled save and revise remain verifiable after forget without recalling old text', async () => {
  const { dir, adapter, receipt: first } = await saved(); const revisedText = 'SYNTHETIC revision: retain physical page identities.';
  const secondAdapter = await openDurableMemory({ directory: dir, intents: [intent(adapter, 'revise', revisedText, { entryId: first.id, expectedRevision: 1 })] });
  const second = await call(secondAdapter, 'memory_revise', { id: first.id, expectedRevision: 1, text: revisedText });
  const thirdAdapter = await openDurableMemory({ directory: dir, intents: [intent(adapter, 'forget', undefined, { entryId: first.id, expectedRevision: 2 })] });
  const third = await call(thirdAdapter, 'memory_forget', { id: first.id, expectedRevision: 2 });
  const reader = await openDurableMemory({ directory: dir });
  for (const receipt of [first, second, third]) assert.deepEqual(await reader.verifyReceipt(receipt), receipt);
  assert.deepEqual((await call(reader, 'memory_list', {})).entries, []);
  await assert.rejects(call(reader, 'memory_read', { id: first.id }), /forgotten|unavailable/i);
  await noLock(dir);
});

test('7.Memory duplicate consumed intent is not replayed and failed write releases its own lock', async () => {
  const { dir, adapter, receipt } = await saved();
  await assert.rejects(call(adapter, 'memory_save', { text }), /intent.*consumed/i);
  await noLock(dir);
  assert.equal((await readdir(join(dir, 'entries'))).length, 1);
  assert.deepEqual(await adapter.verifyReceipt(receipt), receipt);
});

test('7.Memory unknown stale writer lock is never stolen, even when old settled receipt is inspected', async () => {
  const { dir, adapter, receipt } = await saved(); const lock = join(dir, '.writer.lock'); const bytes = '{"synthetic":"unknown prior writer"}';
  await writeFile(lock, bytes, { flag: 'wx', mode: 0o600 });
  const reader = await openDurableMemory({ directory: dir });
  assert.deepEqual(await reader.verifyReceipt(receipt), receipt);
  await assert.rejects(call(adapter, 'memory_save', { text }), /writer|lock|owned/i);
  assert.equal(await readFile(lock, 'utf8'), bytes);
});

test('7.Memory mismatched receipt, actual immutable byte corruption and symlink fail closed', async () => {
  const { dir, adapter, receipt } = await saved();
  for (const bad of [{ ...receipt, libraryId: '00000000-0000-0000-0000-000000000000' }, { ...receipt, operation: 'forgotten' }, { ...receipt, revision: 2 }, { ...receipt, intentId: 'other-intent' }, { ...receipt, extra: true }]) await assert.rejects(adapter.verifyReceipt(bad), /receipt|identity|intent|library|ENOENT/i);
  const target = join(dir, 'entries', receipt.id, '1.json'); const bytes = await readFile(target);
  await writeFile(target, bytes.toString().replace('preserve', 'modified'));
  await assert.rejects(adapter.verifyReceipt(receipt), /hash|receipt|identity/i);
  const other = await saved(); const link = join(other.dir, 'intents', sha256(other.receipt.intentId) + '.json');
  // A separate synthetic intent path supplies an adversarial symlink, without deleting owned data.
  const alias = { ...other.receipt, intentId: 'symlink-intent' };
  await symlink(link, join(other.dir, 'intents', sha256(alias.intentId) + '.json'));
  await assert.rejects(other.adapter.verifyReceipt(alias), /link|safe|ELOOP|intent|receipt/i);
});

test('7.Memory receipt requires a committed index, not just orphan immutable revision bytes', async () => {
  const { dir, adapter, receipt } = await saved();
  const path = join(dir, 'memory-index.json'); const index = JSON.parse(await readFile(path, 'utf8'));
  index.entries = [];
  await writeFile(path, JSON.stringify(index));
  await assert.rejects(adapter.verifyReceipt(receipt), /receipt|commit|revision|index/i);
});


test('7.Memory immutable authority digest binds exact selected intents, independent of input ordering', async () => {
  const dir = await directory(); const adapter = await openDurableMemory({ directory: dir });
  const first = intent(adapter, 'save', text); const second = intent(adapter, 'save', 'SYNTHETIC alternative.');
  const selected = await openDurableMemory({ directory: dir, intents: [first, second] });
  const reordered = Object.fromEntries(Object.entries(first).reverse());
  const same = await openDurableMemory({ directory: dir, intents: [second, reordered] });
  assert.equal(selected.intentDigest, same.intentDigest);
  assert.match(selected.intentDigest, /^[a-f0-9]{64}$/);
  assert.notEqual(selected.intentDigest, adapter.intentDigest);
  first.approvedTextHash = sha256('unapproved replacement');
  const receipt = await call(selected, 'memory_save', { text });
  assert.deepEqual(await selected.extensions.find(value => value.name === 'memory_save').verifyResult(receipt), receipt);
  await assert.rejects(call(adapter, 'memory_save', { text }), /intent/i);
  await assert.rejects(openDurableMemory({ directory: dir, intents: [second, second] }), /intent/i);
  await noLock(dir);
});
