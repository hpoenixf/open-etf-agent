import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const execute = args => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256' } });
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/v02-cli-')); }
test('2.5 skill-mcp uses ordinary Host calls, real child and acquired method/source snapshots', async () => {
  const result = execute(['src/cli.mjs', '--case', 'skill-mcp', '--output', await directory()]);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.caseId, 'skill-mcp'); assert.equal(summary.status, 'completed');
  assert.equal(summary.mcp.closed, true); assert.ok(summary.mcp.pid > 0);
  assert.throws(() => process.kill(summary.mcp.pid, 0), { code: 'ESRCH' });
  const manifest = JSON.parse(await readFile(join(summary.directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sources.length, 2); assert.equal(manifest.methods.length, 1);
  assert.ok(manifest.sources.every(source => source.page === 1));
  const report = await readFile(join(summary.directory, 'report.md'), 'utf8');
  assert.doesNotMatch(report, /offline editing/i, 'page-2 editing condition must not be asserted from only acquired page-1 sources');
  assert.equal(manifest.methods[0].name, 'compare-guides'); assert.match(manifest.methods[0].text, /free and enterprise/);
  for (const source of manifest.sources) { assert.ok(Number.isInteger(source.mcp.protocolRequestId)); assert.ok(source.mcp.modelCallId); }
  const events = (await readFile(join(summary.directory, 'run.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(events.filter(e => e.type === 'tool_result').map(e => e.name), ['list_skills', 'read_skill', 'mcp_read_page', 'mcp_read_page', 'save_report']);
});
test('2.5 built copy includes skill resources and runs both default and added case', async () => {
  const built = execute(['scripts/build.mjs']); assert.equal(built.status, 0, built.stderr);
  for (const name of ['document-compare', 'skill-mcp']) {
    const result = execute(['dist/src/cli.mjs', '--case', name, '--output', await directory()]); assert.equal(result.status, 0, result.stderr);
  }
});
