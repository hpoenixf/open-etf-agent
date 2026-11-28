import test from 'node:test';
import assert from 'node:assert/strict';
import { openPostgresScheduleConfirmation, POSTGRES_SCHEDULE_CONFIRMATION_DDL } from '../src/postgres-schedule-confirmation.mjs';
import { draftScheduledTaskFromConversation } from '../src/scheduled-task-draft.mjs';

const start = Date.parse('2026-11-28T11:00:00.000Z');
const draft = draftScheduledTaskFromConversation('15分钟后提醒我看晚报');
const req = { draft, requestId: 'req-1', confirmed: true };
const open = (db, workspaceId, now = start) => openPostgresScheduleConfirmation(db, { workspaceId, now: () => now });

function fakeDb() {
  const receipts = new Map();
  let queries = 0, loseNext = false;
  return {
    get queries() { return queries; },
    get size() { return receipts.size; },
    loseAck() { loseNext = true; },
    async query(sql, [scope, request, hash, confirmedAtMs, body]) {
      queries++;
      const key = JSON.stringify([scope, request]);
      if (sql.startsWith('SELECT ')) return { rows: receipts.has(key) ? [receipts.get(key)] : [] };
      assert.match(sql, /ON CONFLICT \(workspace_id, request_id\) DO NOTHING/);
      if (receipts.has(key)) return { rows: [] };
      const row = { draft_hash: hash, confirmed_at_ms: confirmedAtMs, schedule: JSON.parse(body) };
      receipts.set(key, row);
      if (loseNext) { loseNext = false; throw Error('simulated lost acknowledgement'); }
      return { rows: [row] };
    },
  };
}

async function assertConfirmations(db) {
  const two = [open(db, 'workspace-a'), open(db, 'workspace-a', start + 2000)];
  const [a, b] = await Promise.all(two.map(store => store.confirm(req)));
  assert.deepEqual(a, b);
  assert.equal(Date.parse(a.schedule.firstScheduledAt) - a.confirmedAtMs, 900_000);
  assert.equal(a.schedule.emailEnabled, false);
  const later = open(db, 'workspace-a', start + 3_600_000);
  assert.deepEqual(await later.confirm({ ...req, draft: { ...draft, start: { after: draft.start.after, kind: 'delay' } } }), a);
  await assert.rejects(later.confirm({ ...req, draft: { ...draft, question: 'changed' } }), { code: 'SCHEDULE_CONFIRMATION_CONFLICT' });
  const bScope = await open(db, 'workspace-b', start + 10000).confirm(req);
  assert.equal(bScope.confirmedAtMs, start + 10000);
  assert.equal(bScope.schedule.firstScheduledAt, '2026-11-28T11:15:10.000Z');
  const separate = await open(db, 'workspace-b', start + 2000).confirm({ ...req, requestId: 'req-2' });
  assert.equal(separate.confirmedAtMs, start + 2000);
  const other = await open(db, 'workspace-c', start + 3000).confirm({ ...req, draft: { ...draft, question: 'different workspace' } });
  assert.equal(other.schedule.question, 'different workspace');
}

test('explicit confirmation, then persist once across concurrent callers and workspace boundaries', async () => {
  const db = fakeDb();
  await assert.rejects(open(db, 'workspace-a').confirm({ ...req, confirmed: false }), { code: 'SCHEDULE_EXPLICIT_CONFIRMATION_REQUIRED' });
  assert.equal(db.queries, 0);
  await assertConfirmations(db);
  assert.equal(db.size, 4);
});
test('lost acknowledgement / later retry keeps the first execution time, and creates no further row', async () => {
  const db = fakeDb();
  db.loseAck();
  await assert.rejects(open(db, 'workspace-a').confirm(req), /simulated lost acknowledgement/);
  const retried = await open(db, 'workspace-a', start + 3_600_000).confirm(req);
  assert.equal(retried.confirmedAtMs, start);
  assert.equal(retried.schedule.firstScheduledAt, '2026-11-28T11:15:00.000Z');
  assert.equal(db.size, 1);
});
test('does not fall back to local storage or enable mail without host configuration', async () => {
  assert.throws(() => open(null, 'workspace-a'), { code: 'SCHEDULE_POSTGRES_CONFIGURATION_REQUIRED' });
  const db = fakeDb();
  await assert.rejects(open(db, 'workspace-a').confirm({ ...req, draft: { ...draft, emailEnabled: true } }), { code: 'SCHEDULE_EMAIL_NOT_CONFIGURED' });
  assert.equal(db.size, 0);
});
const embedded = process.env.OPEN_ETF_PG_TEST_EMBEDDED;
test('PostgreSQL statement engine: schema, conflicting inserts, canonical receipt and distinct workspaces', { skip: !embedded }, async () => {
  const { PGlite } = await import(embedded);
  const pg = new PGlite();
  try {
    await pg.exec(POSTGRES_SCHEDULE_CONFIRMATION_DDL);
    await assertConfirmations(pg);
    assert.equal(Number((await pg.query('SELECT count(*) AS n FROM etf_schedule.confirmation_receipts')).rows[0].n), 4);
  } finally { await pg.close(); }
});
