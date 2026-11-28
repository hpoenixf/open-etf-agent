import { createHash } from 'node:crypto';
import { confirmScheduledTaskDraft, validateScheduledTaskDraft } from './scheduled-task-draft.mjs';

export const POSTGRES_SCHEDULE_CONFIRMATION_DDL = `
CREATE SCHEMA IF NOT EXISTS etf_schedule;
CREATE TABLE IF NOT EXISTS etf_schedule.confirmation_receipts (
  workspace_id text NOT NULL,
  request_id text NOT NULL,
  draft_hash text NOT NULL CHECK (draft_hash ~ '^[a-f0-9]{64}$'),
  confirmed_at_ms bigint NOT NULL CHECK (confirmed_at_ms >= 0),
  schedule jsonb NOT NULL CHECK (jsonb_typeof(schedule) = 'object'),
  PRIMARY KEY (workspace_id, request_id)
);`;

const SELECT = `SELECT draft_hash, confirmed_at_ms, schedule
  FROM etf_schedule.confirmation_receipts WHERE workspace_id = $1 AND request_id = $2`;
const INSERT = `INSERT INTO etf_schedule.confirmation_receipts
  (workspace_id, request_id, draft_hash, confirmed_at_ms, schedule)
  VALUES ($1, $2, $3, $4, $5::jsonb)
  ON CONFLICT (workspace_id, request_id) DO NOTHING
  RETURNING draft_hash, confirmed_at_ms, schedule`;
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const draftHash = draft => createHash('sha256').update(JSON.stringify(draft, (_, value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
    : value)).digest('hex');

// workspaceId and mail configuration are bound by the host, never taken
// from the draft JSON. This adapter records confirmation only; it does not start
// a timer, submit a Run, or dispatch mail. Missing PostgreSQL fails closed.
export function openPostgresScheduleConfirmation(db, { workspaceId, now = Date.now, emailAvailable = false } = {}) {
  if (typeof db?.query !== 'function' || !id(workspaceId) || typeof now !== 'function' ||
      typeof emailAvailable !== 'boolean') fail('SCHEDULE_POSTGRES_CONFIGURATION_REQUIRED');
  return Object.freeze({
    async confirm({ requestId, draft, confirmed } = {}) {
      if (confirmed !== true) fail('SCHEDULE_EXPLICIT_CONFIRMATION_REQUIRED');
      if (!id(requestId)) fail('SCHEDULE_CONFIRMATION_ID_INVALID');
      const normalized = validateScheduledTaskDraft(draft);
      const fingerprint = draftHash(normalized);
      const key = [workspaceId, requestId];
      const receipt = row => {
        if (row.draft_hash !== fingerprint) fail('SCHEDULE_CONFIRMATION_CONFLICT');
        return { requestId, confirmedAtMs: Number(row.confirmed_at_ms), schedule: structuredClone(row.schedule) };
      };
      const old = (await db.query(SELECT, key)).rows[0];
      if (old) return receipt(old);
      const confirmedAtMs = now();
      const schedule = confirmScheduledTaskDraft(normalized, { confirm: true, confirmedAtMs, emailAvailable });
      const inserted = (await db.query(INSERT, [...key, fingerprint, confirmedAtMs, JSON.stringify(schedule)])).rows[0];
      if (inserted) return receipt(inserted);
      // Separate autocommit read: PostgreSQL may detect a competing insert that
      // was invisible in the INSERT statement's snapshot. Resolve that receipt,
      // never the losing caller's recomputed delay or delivery settings.
      const winner = (await db.query(SELECT, key)).rows[0];
      if (!winner) fail('SCHEDULE_CONFIRMATION_RECEIPT_MISSING');
      return receipt(winner);
    },
  });
}
