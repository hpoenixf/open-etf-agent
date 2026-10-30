import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const entry = resolve('src/session-cli.mjs');
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/worker-cli-')); }
function cli(...args) { return spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 12000, maxBuffer: 8 * 1048576 }); }
function good(result) { assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }
test('9.1 submit exits before a separate work process drives and reads the original Run', async () => {
 const d = await directory(); const saved = good(cli('submit', '--session', d, '--run', 'cli-original', '--case', 'durable-publication')); assert.equal(saved.runId, 'cli-original'); assert.equal(saved.fence, 0); assert.deepEqual(saved.rootUsage, { model: 0, tool: 0 });
 const before = good(cli('inspect', '--session', d, '--run', saved.runId)); assert.equal(before.snapshot.phase, 'ready'); assert.equal(before.owner, null);
 const outcome = good(cli('work', '--session', d, '--run', saved.runId)); assert.equal(outcome.workerStatus, 'settled'); assert.equal(outcome.run.status, 'completed'); assert.equal(outcome.run.runId, saved.runId);
 const body = good(cli('publication', '--session', d, '--run', saved.runId)); assert.equal(body.receipt.revision, 1); assert.equal(body.receipt.runId, saved.runId);
 const again = good(cli('work', '--session', d, '--run', saved.runId)); assert.deepEqual(again.run.rootUsage, outcome.run.rootUsage); assert.deepEqual(good(cli('publication', '--session', d, '--run', saved.runId)), body);
});
test('9.1 repeated CLI submission uses the original explicit ID and does not reset time or grant', async () => {
 const d = await directory(); const args = ['submit', '--session', d, '--run', 'same-admission', '--case', 'durable-publication']; const first = good(cli(...args)); const second = good(cli(...args)); assert.deepEqual(second, first);
});
test('9.1 new worker CLI refuses unsupported profiles and never creates missing read/work sessions', async () => {
 const root = await directory(), absent = join(root, 'absent');
 for (const args of [['submit', '--run', 'bad', '--case', 'durable-child'], ['submit', '--case', 'durable-publication'], ['work', '--run', 'bad', '--case', 'durable-publication']]) {
  const result = cli(...args, '--session', absent); assert.equal(result.status, 2); assert.match(result.stderr, /INVALID_ARGUMENT/);
 }
 const result = cli('work', '--session', absent, '--run', 'missing'); assert.equal(result.status, 2); assert.match(result.stderr, /SESSION_NOT_FOUND/); await assert.rejects(stat(absent), { code: 'ENOENT' });
});
