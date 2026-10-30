import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const execute = args => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256' } });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function output() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/cli-')); }
test('1.5 built package runs independently with its own fixtures', async () => {
  const build = execute(['scripts/build.mjs']); assert.equal(build.status, 0, build.stderr);
  const root = await output();
  const demo = execute(['dist/src/cli.mjs', '--case', 'document-compare', '--output', root]);
  assert.equal(demo.status, 0, demo.stderr);
  assert.equal(JSON.parse(demo.stdout).denominator, 4);
});
test('1.5 default demo preserves all four cases and fresh-process file readback', async () => {
  const root = await output(); const result = execute(['src/cli.mjs', '--case', 'document-compare', '--output', root]);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout); assert.equal(summary.denominator, 4); assert.equal(summary.cases.length, 4);
  assert.deepEqual(summary.cases.map(c => c.caseId), ['T1', 'T2', 'T3', 'T4']);
  for (const c of summary.cases) {
    assert.equal(c.status, 'completed'); assert.equal(c.semanticStatus, 'unreviewed'); assert.equal(c.httpDownload, 'not-applicable');
    const bytes = await readFile(join(c.directory, 'report.md'));
    const manifest = JSON.parse(await readFile(join(c.directory, 'manifest.json'), 'utf8'));
    assert.equal(hash(bytes), c.receipt.sha256); assert.equal(manifest.sources.length, 2);
    for (const s of manifest.sources) assert.equal(hash(s.text), s.sha256);
    assert.deepEqual(manifest.sources.map(s => s.documentId), ['atlas-a', 'atlas-b']);
    assert.deepEqual(manifest.sources.map(s => s.page), c.caseId === 'T2' ? [2, 2] : [1, 1]);
    const body = bytes.toString();
    if (c.caseId === 'T1') { assert.match(body, /A exports CSV; B exports CSV and Markdown/); assert.match(body, /online connection for every export/); }
    if (c.caseId === 'T2') { assert.match(body, /neither permits offline editing/); assert.match(body, /Initial download and synchronization require an online connection/); }
    if (c.caseId === 'T3') {
      for (const expected of ['120 rows/export', '300 rows/export', '180 rows/export', 'Total ratio B/A: 2.5', 'Increase ratio (B-A)/A: 1.5']) assert.ok(body.includes(expected), expected);
    }
    // Child process has ended. This test reads bytes; it never calls a gateway.
  }
  assert.equal((await readdir(root)).length, 4);
});
test('1.5 live gate blocks before producing a run or reading credentials', async () => {
  const root = await output(); const result = execute(['src/cli.mjs', '--live', '--output', root]);
  assert.equal(result.status, 2); assert.match(result.stderr, /LIVE_BLOCKED/);
  assert.deepEqual(await readdir(root), []);
});
test('1.5 unknown switches and unsupported cases fail explicitly', () => {
  for (const args of [['--shell', 'x'], ['--case', 'v0.2'], ['--output']]) {
    const result = execute(['src/cli.mjs', ...args]); assert.equal(result.status, 2); assert.match(result.stderr, /INVALID_ARGUMENT/);
  }
});
