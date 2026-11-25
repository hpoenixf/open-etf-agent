import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createTaskTime, validateTaskTime, taskTimeMessage } from '../src/temporal.mjs';
import { run, submitRun, validateRuntimeCheckpoint } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';
import { createChatGateway } from '../src/gateway.mjs';
const at = (anchorInstant, timeZone) => createTaskTime({ anchorInstant, timeZone });
const bindings = { gateway: { mode: 'test', provider: 'synthetic', protocol: 'test', model: 'temporal', version: '1' }, plugins: [], adapters: [] };
async function setup() { await mkdir('test-output', { recursive: true }); const directory = await mkdtemp(resolve('test-output/temporal-')); const store = await openSession({ directory }); return { directory, store }; }
test('12.1 explicit zone determines task date; DST uses calendar days, not elapsed 24h', () => {
 const a = at('2026-10-28T00:30:00.000Z', 'America/Los_Angeles');
 assert.equal(a.taskDate, '2026-10-27'); assert.equal(a.yesterday, '2026-10-26');
 assert.equal(at(a.anchorInstant, 'Asia/Shanghai').taskDate, '2026-10-28');
 for (const instant of ['2026-03-08T06:30:00.000Z', '2026-03-08T07:30:00.000Z']) {
  const t = at(instant, 'America/New_York'); assert.equal(t.taskDate, '2026-03-08'); assert.equal(t.yesterday, '2026-03-07'); assert.equal(t.tomorrow, '2026-03-09');
 }
 for (const instant of ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']) assert.equal(at(instant, 'America/New_York').taskDate, '2026-11-01');
 assert.equal(at('2024-03-01T00:00:00.000Z', 'UTC').yesterday, '2024-02-29');
 assert.equal(at('2026-12-31T23:00:00.000Z', 'UTC').tomorrow, '2027-01-01');
});
test('A36 explicit venue rows resolve last completed session with coverage and provenance', async () => {
 const { resolveTradingCalendar } = await import('../src/temporal.mjs');
 const calendar = { schemaVersion: 'venue-calendar-input@1', venue: 'SYNTH-X', timeZone: 'America/New_York', revision: 'fixture-r3', coverage: { from: '2026-03-06', through: '2026-03-10' }, rows: [
  { date: '2026-03-06', status: 'open', open: '2026-03-06T09:30:00.000-05:00', close: '2026-03-06T16:00:00.000-05:00' },
  { date: '2026-03-07', status: 'closed' }, { date: '2026-03-08', status: 'closed' },
  { date: '2026-03-09', status: 'open', open: '2026-03-09T09:30:00.000-04:00', close: '2026-03-09T13:00:00.000-04:00' },
  { date: '2026-03-10', status: 'open', open: '2026-03-10T09:30:00.000-04:00', close: '2026-03-10T16:00:00.000-04:00' }
 ] };
 const at = (anchorInstant) => resolveTradingCalendar({ anchorInstant, timeZone: 'Asia/Shanghai', marketCalendar: calendar });
 assert.equal(at('2026-03-09T13:29:59.999Z').tradingCalendar.phase, 'before-open');
 assert.equal(at('2026-03-09T13:30:00.000Z').tradingCalendar.phase, 'open');
 assert.equal(at('2026-03-09T13:30:00.000Z').tradingCalendar.sessionDate, '2026-03-06');
 assert.equal(at('2026-03-09T16:59:59.999Z').tradingCalendar.sessionDate, '2026-03-06');
 assert.equal(at('2026-03-09T17:00:00.000Z').tradingCalendar.phase, 'after-close');
 assert.equal(at('2026-03-09T17:00:00.000Z').tradingCalendar.sessionDate, '2026-03-09');
 assert.equal(at('2026-03-09T17:30:00.000Z').tradingCalendar.sessionDate, '2026-03-09');
 assert.equal(at('2026-03-09T18:00:00.000Z').tradingCalendar.sessionDate, '2026-03-09');
 const result = at('2026-03-09T17:00:00.000Z');
 assert.equal(result.yesterday, '2026-03-09'); // task-local date, independent of venue session
 assert.equal(result.tradingCalendar.venueDate, '2026-03-09');
 assert.match(result.tradingCalendar.source.digest, /^[a-f0-9]{64}$/);
 assert.equal(result.tradingCalendar.source.revision, 'fixture-r3');
 assert.equal(at('2026-03-09T17:00:00.000Z').tradingCalendar.source.digest, result.tradingCalendar.source.digest);
 assert.throws(() => validateTaskTime({ ...result, tradingCalendar: { ...result.tradingCalendar, source: { ...result.tradingCalendar.source, revision: 'forged' } } }), /INVALID_TASK_TIME/);
 const outside = resolveTradingCalendar({ anchorInstant: '2026-03-11T16:00:00.000Z', timeZone: 'Asia/Shanghai', marketCalendar: calendar });
 assert.equal(outside.tradingCalendar.status, 'unknown');
 assert.equal(outside.tradingCalendar.sessionDate, null);
 assert.equal(outside.yesterday, '2026-03-11');
 const gap = resolveTradingCalendar({ anchorInstant: '2026-03-09T16:00:00.000Z', timeZone: 'UTC', marketCalendar: { ...calendar, rows: calendar.rows.filter(r => r.date !== '2026-03-08') } });
 assert.equal(gap.tradingCalendar.status, 'unknown'); assert.equal(gap.tradingCalendar.sessionDate, null);
 const olderGap = resolveTradingCalendar({ anchorInstant: '2026-03-09T17:00:00.000Z', timeZone: 'UTC', marketCalendar: { ...calendar, rows: calendar.rows.filter(r => r.date !== '2026-03-08') } });
 assert.equal(olderGap.tradingCalendar.status, 'known'); assert.equal(olderGap.tradingCalendar.sessionDate, '2026-03-09');
 const futureGap = resolveTradingCalendar({ anchorInstant: '2026-03-09T17:00:00.000Z', timeZone: 'UTC', marketCalendar: { ...calendar, rows: calendar.rows.filter(r => r.date !== '2026-03-10') } });
 assert.equal(futureGap.tradingCalendar.status, 'known'); assert.equal(futureGap.tradingCalendar.sessionDate, '2026-03-09');
 const holiday = at('2026-03-08T16:00:00.000Z');
 assert.equal(holiday.tradingCalendar.phase, 'closed'); assert.equal(holiday.tradingCalendar.sessionDate, '2026-03-06');
});
test('A36 preserves the byte-identical task-time@1 message and projects only a fixed calendar summary', () => {
 const legacy = createTaskTime({ anchorInstant: '2026-10-28T23:59:00.000Z', timeZone: 'UTC' });
 assert.equal(taskTimeMessage(legacy).content, 'Task time (trusted, fixed at admission; not current execution time or evidence freshness): ' + JSON.stringify(legacy) + '\nInterpret today/yesterday/tomorrow against these calendar dates. Do not infer a market session, business day, data cutoff, or scheduled trigger.');
 const marketCalendar = { schemaVersion: 'venue-calendar-input@1', venue: 'SYNTH', timeZone: 'America/New_York', revision: 'r1', coverage: { from: '2026-03-09', through: '2026-03-09' }, rows: [{ date: '2026-03-09', status: 'open', open: '2026-03-09T09:30:00.000-04:00', close: '2026-03-09T13:00:00.000-04:00' }] };
 const message = taskTimeMessage(createTaskTime({ anchorInstant: '2026-03-09T17:00:00.000Z', timeZone: 'UTC', marketCalendar }));
 assert.match(message.content, /"sessionDate":"2026-03-09"/); assert.doesNotMatch(message.content, /"rows"|2026-03-09T09:30/);
 const summary = JSON.parse(message.content.split('): ')[1].split('\n')[0]);
 assert.deepEqual(Object.keys(summary), ['taskTime', 'tradingCalendar']);
 assert.deepEqual(Object.keys(summary.tradingCalendar.source), ['revision', 'digest', 'coverage']);
 const absent = createTaskTime({ anchorInstant: '2026-03-09T17:00:00.000Z', timeZone: 'UTC', marketCalendar: null });
 assert.equal(absent.tradingCalendar.status, 'unknown');
 assert.equal(absent.tradingCalendar.reason, 'calendar-not-supplied');
 assert.match(taskTimeMessage(absent).content, /"status":"unknown"/);
 const huge = { ...marketCalendar, coverage: { from: '0001-01-01', through: '9999-12-31' } };
 assert.throws(() => createTaskTime({ anchorInstant: '2026-03-09T17:00:00.000Z', timeZone: 'UTC', marketCalendar: huge }), /INVALID_MARKET_CALENDAR/);
 assert.throws(() => createTaskTime({ anchorInstant: '2026-03-09T17:00:00.000Z', timeZone: 'UTC', marketCalendar: { ...marketCalendar, rows: [{ ...marketCalendar.rows[0], open: '2026-03-09T01:00:00.000Z' }] } }), /INVALID_MARKET_CALENDAR/);
});
test('12.1 missing/invalid zones, ambiguous local instants and invalid persisted dates fail closed', () => {
 for (const zone of [undefined, '', 'Not/AZone', '+08:00', 8]) assert.throws(() => at('2026-10-28T00:00:00.000Z', zone), /INVALID_TASK_TIME_ZONE/);
 for (const instant of ['2026-11-01T01:30:00', '2026-02-30T00:00:00.000Z', '2026-10-28', '2026-10-28T00:00:00+08:00', 'invalid']) assert.throws(() => at(instant, 'UTC'), /INVALID_TASK_ANCHOR/);
 const t = at('2026-10-28T00:00:00.000Z', 'UTC');
 for (const bad of [{ ...t, taskDate: '2026-10-29' }, { ...t, extra: true }, { ...t, schemaVersion: 'task-time@2' }]) assert.throws(() => validateTaskTime(bad));
});
test('12.2 admission survives changed clock/zone on resume; conflicts cannot overwrite original', async () => {
 const { directory, store } = await setup();
 const taskTime = { anchorInstant: '2026-10-28T23:59:00.000Z', timeZone: 'UTC' };
 const gateway = { mode: 'test', async next({ messages }) { assert.deepEqual(messages[1], taskTimeMessage(createTaskTime(taskTime))); return { kind: 'final', text: 'today 2026-10-28' }; } };
 const options = { question: 'today?', gateway, requireReport: false, outputRoot: join(directory, 'runs'), durable: { store, runId: 'same', grantId: 'test', bindings } };
 try {
  const saved = await submitRun({ ...options, taskTime });
  const original = Date.now; Date.now = () => original() + 60000;
  try { assert.deepEqual(await submitRun({ ...options, taskTime: { timeZone: 'UTC' } }), saved); } finally { Date.now = original; }
  await assert.rejects(submitRun({ ...options, taskTime: { ...taskTime, timeZone: 'Asia/Shanghai' } }), /RUN_BINDINGS_MISMATCH/);
  await assert.rejects(run({ ...options, taskTime: { timeZone: 'UTC', anchorInstant: null } }), /INVALID_TASK_ANCHOR/);
  await assert.rejects(run({ ...options, taskTime: { ...taskTime, anchorInstant: '2026-10-29T00:01:00.000Z' } }), /RUN_BINDINGS_MISMATCH/);
  assert.equal((await run(options)).status, 'completed');
  assert.deepEqual(store.inspect('same').definition.config.taskTime, saved.definition.config.taskTime);
  assert.equal(store.inspect('same').definition.deadlineAt, saved.definition.deadlineAt);
 } finally { store.close(); }
});
test('12.2 legacy runs stay legacy; adding a new anchor on resume is rejected', async () => {
 const { directory, store } = await setup(); const options = { question: 'legacy', requireReport: false, outputRoot: join(directory, 'runs'), gateway: { mode: 'test', async next({ messages }) { assert.equal(messages.length, 1); return { kind: 'final', text: 'legacy' }; } }, durable: { store, runId: 'legacy', grantId: 'test', bindings } };
 try { await submitRun(options); await assert.rejects(run({ ...options, taskTime: { timeZone: 'UTC' } }), /RUN_BINDINGS_MISMATCH/); assert.equal((await run(options)).status, 'completed'); } finally { store.close(); }
});
test('12.3 real Gateway encoding retains fixed time; mandatory context cannot be trimmed', async () => {
 const { directory, store } = await setup(); store.close(); let request;
 const gateway = createChatGateway({ endpoint: 'https://example.invalid/v1/chat/completions', model: 'synthetic', apiKey: 'synthetic-test-only', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, fetchImpl: async (_url, init) => { request = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'done' }, finish_reason: 'stop' }] })); } });
 const taskTime = { anchorInstant: '2026-10-28T00:30:00.000Z', timeZone: 'America/Los_Angeles' };
 const options = { question: 'today?', gateway, taskTime, requireReport: false, outputRoot: join(directory, 'runs') };
 assert.equal((await run(options)).status, 'completed'); assert.deepEqual(request.messages[1], taskTimeMessage(createTaskTime(taskTime)));
 request = undefined; assert.equal((await run({ ...options, contextBytes: 40 })).status, 'failed'); assert.equal(request, undefined);
});
test('12.2 altered adopted temporal input is rejected even with a matching working hash', async () => {
 const { directory, store } = await setup();
 const options = { question: 'today', gateway: { mode: 'test', next() {} }, requireReport: false, outputRoot: join(directory, 'runs'), taskTime: { timeZone: 'UTC', anchorInstant: '2026-10-28T23:59:00.000Z' }, durable: { store, runId: 'tampered', grantId: 'test', bindings } };
 try {
  const saved = await submitRun(options); const state = structuredClone(saved.snapshot);
  const { sha256 } = await import('../src/source.mjs');
  const messages = [{ role: 'user', content: 'today' }, taskTimeMessage(createTaskTime({ timeZone: 'UTC', anchorInstant: '2026-10-29T00:01:00.000Z' }))];
  state.working = { messages, hash: sha256(JSON.stringify(messages)) };
  assert.throws(() => validateRuntimeCheckpoint(state, saved.definition), /INVALID_TASK_TIME_CHECKPOINT/);
 } finally { store.close(); }
});
test('12.5 real process kill after working-input reuses the persisted task anchor', async () => {
 const { fork } = await import('node:child_process'); const { once } = await import('node:events');
 const { directory, store } = await setup(); const clock = Date.now();
 const taskTime = { timeZone: 'America/New_York', anchorInstant: '2026-11-01T05:30:00.000Z' };
 await submitRun({ question: 'today', taskTime, gateway: { mode: 'test', next() {} }, requireReport: false, outputRoot: join(directory, 'runs'), durable: { store, runId: 'restart', grantId: 'test', bindings } }); store.close();
 function start(stop, time, tz) {
  const child = fork(new URL('./fixtures/temporal-recovery-process.mjs', import.meta.url), [directory, 'restart', String(time), stop], { env: { ...process.env, TZ: tz }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], execArgv: [] });
  const messages = []; child.on('message', m => messages.push(m)); let stderr = ''; child.stderr.on('data', b => stderr += b);
  const exited = once(child, 'exit');
  return { child, messages, exited, async wait(kind) { const end = Date.now() + 7000; while (Date.now() < end) { const m = messages.find(m => m.kind === kind); if (m) return m; if (child.exitCode !== null) throw new Error(stderr); await new Promise(r => setTimeout(r, 10)); } throw new Error('checkpoint timeout ' + stderr); } };
 }
 const first = start('stop', clock, 'UTC');
 try { await first.wait('checkpoint'); } finally { first.child.kill('SIGKILL'); await first.exited; }
 const second = start('', clock + 1001, 'Asia/Tokyo');
 try { const { result } = await second.wait('outcome'); assert.equal(result.status, 'completed'); assert.equal(result.rounds, 1); assert.deepEqual(result.rootUsage, { model: 1, tool: 0 }); assert.deepEqual(second.messages.find(m => m.kind === 'input').messages[1], taskTimeMessage(createTaskTime(taskTime))); assert.equal((await second.exited)[0], 0); }
 finally { if (second.child.exitCode === null) { second.child.kill('SIGKILL'); await second.exited; } }
});
test('12.2 concurrent first admissions with omitted instants adopt one winning anchor', async () => {
 const { directory, store } = await setup();
 const options = { question: 'today', taskTime: { timeZone: 'UTC' }, gateway: { mode: 'test', next() {} }, requireReport: false, outputRoot: join(directory, 'runs'), durable: { store, runId: 'racing', grantId: 'test', bindings } };
 try {
  const first = submitRun(options);
  // First submit is suspended at its first filesystem await; a different wall
  // instant is sampled by the second before either can create the Run.
  const until = performance.now() + 5; while (performance.now() < until) {}
  const second = submitRun(options);
  const [a, b] = await Promise.all([first, second]); assert.deepEqual(a, b); assert.equal(a.fence, 0); assert.deepEqual(a.rootUsage, { model: 0, tool: 0 });
 } finally { store.close(); }
});

test('A36 searches the first covered venue date even when UTC is one day ahead', () => {
 const rows = Array.from({length: 366}, (_, index) => ({
  date: new Date(Date.UTC(2025, 2, 10 + index)).toISOString().slice(0, 10), status: 'closed'
 }));
 rows[0] = {date: '2025-03-10', status: 'open', open: '2025-03-10T09:00:00.000-11:00', close: '2025-03-10T14:00:00.000-11:00'};
 const marketCalendar = {
  schemaVersion: 'venue-calendar-input@1', venue: 'SYNTH', timeZone: 'Pacific/Pago_Pago',
  revision: 'long-window', coverage: {from: rows[0].date, through: rows.at(-1).date}, rows
 };
 const result = createTaskTime({anchorInstant: '2026-03-11T10:59:00.000Z', timeZone: 'UTC', marketCalendar}).tradingCalendar;
 assert.equal(result.venueDate, '2026-03-10');
 assert.equal(result.sessionDate, '2025-03-10');
});

test('A36 rejects impossible timestamp dates that Date.parse would roll into a valid venue day', () => {
 const marketCalendar = {
  schemaVersion: 'venue-calendar-input@1', venue: 'SYNTH', timeZone: 'UTC',
  revision: 'invalid-row', coverage: {from: '2026-03-02', through: '2026-03-02'},
  rows: [{date: '2026-03-02', status: 'open', open: '2026-02-30T01:00:00.000Z', close: '2026-03-02T02:00:00.000Z'}]
 };
 assert.throws(() => createTaskTime({anchorInstant: '2026-03-02T17:00:00.000Z', timeZone: 'UTC', marketCalendar}), /INVALID_MARKET_CALENDAR/);
});
