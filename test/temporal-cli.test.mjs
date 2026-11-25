import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat, writeFile, symlink } from 'node:fs/promises';
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
 assert.match(bytes.toString(), /Market calendar: unknown \(no calendar supplied\)/);
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
test('A36 submit/work/read processes carry the admitted synthetic venue calendar into the normal projection', async () => {
 const d = await directory(), calendarPath = join(d, 'calendar.json');
 const calendar = { schemaVersion: 'venue-calendar-input@1', venue: 'SYNTH-X', timeZone: 'America/New_York', revision: 'cli-fixture-r1', coverage: { from: '2026-03-06', through: '2026-03-10' }, rows: [
  { date: '2026-03-06', status: 'open', open: '2026-03-06T14:30:00.000-05:00', close: '2026-03-06T16:00:00.000-05:00' }, { date: '2026-03-07', status: 'closed' }, { date: '2026-03-08', status: 'closed' },
  { date: '2026-03-09', status: 'open', open: '2026-03-09T09:30:00.000-04:00', close: '2026-03-09T13:00:00.000-04:00' }, { date: '2026-03-10', status: 'open', open: '2026-03-10T09:30:00.000-04:00', close: '2026-03-10T16:00:00.000-04:00' }
 ] };
 await writeFile(calendarPath, JSON.stringify(calendar));
 const args = ['--session', d, '--run', 'calendar', '--time-zone', 'Asia/Shanghai', '--anchor', '2026-03-09T17:00:00.000Z', '--calendar', calendarPath];
 const submitted = good(cli('UTC', 'submit', ...args));
 const admitted = submitted.definition.config.taskTime;
 assert.equal(admitted.taskDate, '2026-03-10'); assert.equal(admitted.yesterday, '2026-03-09');
 assert.equal(admitted.tradingCalendar.sessionDate, '2026-03-09'); assert.equal(admitted.tradingCalendar.phase, 'after-close');
 assert.equal(admitted.tradingCalendar.source.revision, 'cli-fixture-r1');
 assert.deepEqual(good(cli('Asia/Tokyo', 'submit', ...args)), submitted);
 await writeFile(calendarPath, JSON.stringify({ ...calendar, revision: 'changed-r2' }));
 const changed = cli('UTC', 'submit', ...args); assert.equal(changed.status, 2); assert.match(changed.stderr, /RUN_BINDINGS_MISMATCH/);
 const work = good(cli('Pacific/Auckland', 'work', '--session', d, '--run', 'calendar'));
 assert.equal(work.run.status, 'completed');
 const read = good(cli('Europe/London', 'read', '--session', d, '--run', 'calendar'));
 const report = await readFile(join(read.directory, read.receipt.path), 'utf8');
 assert.match(report, /Last completed session: 2026-03-09/); assert.match(report, /Calendar revision: cli-fixture-r1/);
 assert.equal(good(cli('UTC', 'read', '--session', d, '--run', 'calendar')).receipt.sha256, read.receipt.sha256);
});
test('A36 calendar reader rejects symlink and oversized calendar files before admission',async()=>{
 const d=await directory(),real=join(d,'calendar-real.json'),link=join(d,'calendar-link.json');await writeFile(real,'{}');await symlink(real,link);
 const base=['submit','--session',join(d,'absent'),'--run','unsafe','--time-zone','UTC','--calendar'];
 const linked=cli('UTC',...base,link);assert.equal(linked.status,2);assert.match(linked.stderr,/INVALID_MARKET_CALENDAR/);await assert.rejects(stat(join(d,'absent')),{code:'ENOENT'});
 const oversized=join(d,'oversized.json');await writeFile(oversized,Buffer.alloc(262145));const tooLarge=cli('UTC',...base,oversized);assert.equal(tooLarge.status,2);assert.match(tooLarge.stderr,/INVALID_MARKET_CALENDAR/);
});
