import test from 'node:test';
import assert from 'node:assert/strict';
import { draftScheduledTaskFromConversation as draft, confirmScheduledTaskDraft as confirm } from '../src/scheduled-task-draft.mjs';
const confirmedAtMs = Date.parse('2026-11-28T10:20:00.000Z');
const opts = { confirm: true, confirmedAtMs };
test('conversation drafts once without running or opting into email, and delays start at confirmation', () => {
  const input = draft('请在15分钟后提醒我看晚报');
  assert.deepEqual(input.start, { kind: 'delay', after: { amount: 15, unit: 'minutes' } });
  assert.equal(input.question, '看晚报');
  assert.equal(input.emailEnabled, false);
  assert.throws(() => confirm(input, { ...opts, confirm: false }), { code: 'SCHEDULE_EXPLICIT_CONFIRMATION_REQUIRED' });
  assert.deepEqual(confirm(input, opts), { question: '看晚报', timeZone: 'Asia/Shanghai', firstScheduledAt: '2026-11-28T10:35:00.000Z', repeatEveryMs: null, emailEnabled: false });
});
test('editable recurrence supports elapsed hours, keeps explicit timezone and starts only after confirmation', () => {
  const input = draft('every 2 hours, run check the status', 'America/New_York');
  assert.deepEqual(input.repeat, { amount: 2, unit: 'hours' });
  input.start.after.amount = 3;
  assert.deepEqual(confirm(input, opts), { question: 'check the status', timeZone: 'America/New_York',
    firstScheduledAt: '2026-11-28T13:20:00.000Z', repeatEveryMs: 7_200_000, emailEnabled: false });
  assert.equal(draft('每隔3小时帮我查看进度').repeat.amount, 3);
});
test('email remains off regardless of chat text; enabling it requires an explicit edit and configured delivery', () => {
  const input = draft('in 2 hours remind me to email the report');
  assert.equal(confirm(input, opts).emailEnabled, false);
  input.emailEnabled = true;
  assert.throws(() => confirm(input, opts), { code: 'SCHEDULE_EMAIL_NOT_CONFIGURED' });
  assert.equal(confirm(input, { ...opts, emailAvailable: true }).emailEnabled, true);
});
test('absolute time must be explicit and real; past, current and invalid values cannot be confirmed', () => {
  const input = draft('in 5 minutes run research');
  for (const at of ['2026-11-28T10:20:00.000Z', '2026-11-28T10:19:59.000Z']) {
    assert.throws(() => confirm({ ...input, start: { kind: 'instant', at } }, opts), { code: 'SCHEDULE_START_OUTSIDE_WINDOW' });
  }
  for (const at of ['2026-02-30T11:00:00.000Z', '2026-11-28T11:00:00+08:00']) {
    assert.throws(() => confirm({ ...input, start: { kind: 'instant', at } }, opts), { code: 'SCHEDULE_DRAFT_INSTANT' });
  }
  const at = '2026-11-28T11:00:00.000Z';
  assert.equal(confirm({ ...input, start: { kind: 'instant', at } }, opts).firstScheduledAt, at);
});
test('ambiguous or oversized natural language does not become a job; invalid draft edits are rejected', () => {
  for (const text of ['十分钟以后怎样', '明天早点提醒我', 'in 0 hours run check', 'in 500 days run check']) assert.equal(draft(text), null);
  const input = draft('in 10 minutes run check');
  assert.throws(() => confirm({ ...input, timeZone: 'Nowhere/Market' }, opts), { code: 'SCHEDULE_DRAFT_TIME_ZONE' });
  assert.throws(() => confirm({ ...input, repeat: { amount: 0.5, unit: 'hours' } }, opts), { code: 'SCHEDULE_DRAFT_DURATION' });
  assert.throws(() => confirm({ ...input, ignored: true }, opts), { code: 'SCHEDULE_DRAFT_INVALID' });
});
