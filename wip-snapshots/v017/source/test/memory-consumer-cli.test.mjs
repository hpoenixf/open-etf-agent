import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openMemoryLibrary } from '../src/memory.mjs';
import { sha256 } from '../src/source.mjs';

const cli = resolve('src/cli.mjs');
async function root() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/memory-consumer-')); }
async function inventory(path) {
  const entries = [];
  async function walk(folder, prefix = '') {
    for (const item of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = prefix + item.name;
      if (item.isDirectory()) await walk(join(folder, item.name), name + '/');
      else entries.push({ path: name, sha256: sha256(await readFile(join(folder, item.name))) });
    }
  }
  await walk(path); return entries;
}
async function seed(directory) {
  const library = await openMemoryLibrary({ directory, writable: true });
  try {
    const text = 'SYNTHETIC recalled preference: cite exact physical pages.';
    const written = await library.save({ text }, { intent: { explicit: true, libraryId: library.libraryId, operation: 'save', intentId: 'consumer-seed', origin: 'synthetic-test', approvedTextHash: sha256(text) } });
    return { ...written, text };
  } finally { await library.close(); }
}
function invoke(args, prefix = []) { return spawnSync(process.execPath, [...prefix, cli, ...args], { encoding: 'utf8', timeout: 30000 }); }

test('14.1 CLI consumes an existing nonempty Memory library without changing its bytes', async () => {
  const dir = await root(), library = join(dir, 'library');
  const entry = await seed(library), before = await inventory(library);
  const child = invoke(['--case', 'memory-recall', '--memory-library', library, '--query', 'physical', '--output', join(dir, 'runs')]);
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.status, 'completed'); assert.equal(result.mode, 'fixture');
  assert.equal(result.memory.mode, 'read-only'); assert.equal(result.memory.libraryId, entry.libraryId);
  assert.ok(result.memory.consumed.some(ref => ref.id === entry.id && ref.revision === 1 && ref.sha256 === entry.sha256));
  assert.deepEqual(await inventory(library), before);
  const report = await readFile(join(result.directory, 'report.md'));
  assert.equal(sha256(report), result.receipt.sha256);
  assert.ok(report.toString().includes(entry.id)); assert.ok(report.toString().includes(entry.sha256));
  assert.ok(!report.toString().includes(entry.text), 'Memory is not copied into the source-backed report');
  const reread = spawnSync(process.execPath, ['--input-type=module', '--eval', "import {readFile} from 'node:fs/promises';process.stdout.write(await readFile(process.argv[1]));", join(result.directory, 'report.md')], { timeout: 30000 });
  assert.equal(reread.status, 0, reread.stderr.toString()); assert.deepEqual(reread.stdout, report);
});

test('14.2 CLI temporary overrides configured missing library before any filesystem access', async () => {
  const dir = await root(), library = join(dir, 'not-created'), guard = join(dir, 'guard.mjs');
  // Intercept the selected path, not unrelated report/source IO. Any access fails
  // the process; success therefore cannot be caused by a caught ENOENT fallback.
  await writeFile(guard, `import fs from 'node:fs/promises';\nimport {syncBuiltinESMExports} from 'node:module';\nimport {resolve} from 'node:path';\nconst denied=${JSON.stringify(library)};\nfor(const key of ['open','stat','lstat','realpath','readdir','readFile','access','opendir','mkdir']) { const original=fs[key];fs[key]=function(path,...args){if(typeof path==='string'&&(resolve(path)===denied||resolve(path).startsWith(denied+'/')))throw Error('MEMORY_PATH_ACCESSED:'+key);return original.call(this,path,...args);};}\nsyncBuiltinESMExports();\n`);
  const child = invoke(['--case', 'memory-recall', '--memory-library', library, '--query', 'physical', '--temporary', '--output', join(dir, 'runs')], ['--import', guard]);
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.status, 'completed'); assert.equal(result.memory.mode, 'temporary');
  assert.deepEqual(result.memory.consumed, []); assert.equal(result.memory.libraryId, null);
  assert.equal(sha256(await readFile(join(result.directory, 'report.md'))), result.receipt.sha256);
});

test('14.3 malformed memory consumer arguments do not create the library or execute', async () => {
  const dir = await root(), library = join(dir, 'missing');
  for (const args of [
    ['--case', 'memory-recall', '--memory-library', library],
    ['--case', 'memory-recall', '--memory-library', library, '--query', ' '],
    ['--case', 'memory-recall', '--memory-library', library, '--query', 'x'.repeat(257)],
    ['--case', 'document-compare', '--temporary'],
    ['--observe', dir, '--temporary'],
    ['--case', 'memory-recall', '--memory-library', library, '--query', 'x', '--temporary', '--temporary']
  ]) { const child = invoke(args); assert.equal(child.status, 2); }
  assert.deepEqual(await readdir(dir), []);
});
