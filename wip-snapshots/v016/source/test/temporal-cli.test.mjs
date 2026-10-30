import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const entry = resolve('src/temporal-cli.mjs');
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/temporal-cli-')); }
function cli(tz, ...args) { return spawnSync(process.execPath, [entry, ...args], { env: { ...process.env, TZ: tz }, encoding: 'utf8', timeout: 12000, maxBuffer: 8 * 1048576 }); }
function good(r) { assert.equal(r.error, undefined); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); }
test('12.4 separate submit/work/read processes preserve task dates and original report bytes across host zones', async () => {
 const d = await directory(); const args = ['--session', d, '--run', 'fixed'];
 const original = good(cli('Asia/Tokyo', 'submit', ...args, '--time-zone', 'America/Los_Angeles', '--anchor', '2026-10-28T00:30:00.000Z'));
 assert.equal(original.definition.config.taskTime.taskDate, '2026-10-27'); assert.deepEqual(original.rootUsage, { model: 0, tool: 0 });
 const repeated = good(cli('Europe/London', 'submit', ...args, '--time-zone', 'America/Los_Angeles')); assert.deepEqual(repeated, original);
 const work = good(cli('Pacific/Auckland', 'work', ...args)); assert.equal(work.workerStatus, 'settled'); assert.equal(work.run.status, 'completed');
 assert.deepEqual(work.run.definition.config.taskTime, original.definition.config.taskTime);
 const saved = good(cli('UTC', 'read', ...args)); const bytes = await readFile(join(saved.directory, saved.receipt.path));
 assert.match(bytes.toString(), /Today: 2026-10-27/); assert.match(bytes.toString(), /Yesterday: 2026-10-26/);
 assert.equal(createHash('sha256').update(bytes).digest('hex'), saved.receipt.sha256);
 assert.deepEqual(good(cli('America/New_York', 'read', ...args)), saved);
 assert.deepEqual(good(cli('UTC', 'work', ...args)).run.rootUsage, work.run.rootUsage);
});
test('12.4 invalid zone/ambiguous instant fails before storage; read/work never create missing sessions', async () => {
 const d = join(await directory(), 'absent'); const args = ['--session', d, '--run', 'bad'];
 for (const extra of [['--time-zone', 'Unknown/Place'], ['--time-zone', 'UTC', '--anchor', '2026-11-01T01:30:00']]) assert.equal(cli('UTC', 'submit', ...args, ...extra).status, 2);
 for (const op of ['read', 'work']) assert.match(cli('UTC', op, ...args).stderr, /SESSION_NOT_FOUND/);
 await assert.rejects(stat(d), { code: 'ENOENT' });
});
