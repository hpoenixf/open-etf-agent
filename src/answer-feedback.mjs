import {closeSync, lstatSync, openSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openSession} from './session.mjs';
import {safeDirectory} from './storage-files.mjs';

const fail = code => { throw Object.assign(new Error(code), {code}); };
const runPattern = /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/;
const keyPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const applicationId = 0x41524642;
const schema = `CREATE TABLE feedback (
  client_key TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 3),
  payload_hash TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'withdrawn')),
  created_at TEXT NOT NULL
) STRICT`;

function safeFile(file) {
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1) fail('UNSAFE_FEEDBACK_FILE');
    return stat;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function transact(db, operation, readOnly = false) {
  db.exec(readOnly ? 'BEGIN' : 'BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function requireFeedbackSchema(db, create) {
  const app = db.prepare('PRAGMA application_id').get().application_id;
  const version = db.prepare('PRAGMA user_version').get().user_version;
  const objects = db.prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
  if (app === 0 && version === 0 && objects.length === 0) {
    if (!create) fail('FEEDBACK_NOT_FOUND');
    db.exec(`${schema}; PRAGMA application_id=${applicationId}; PRAGMA user_version=1`);
  } else if (app !== applicationId || version !== 1 || objects.length !== 1 ||
      objects[0].name !== 'feedback' || objects[0].sql !== schema) {
    fail('UNSUPPORTED_FEEDBACK_SCHEMA');
  }
}

function openFeedback(directory, {create, readOnly}) {
  const path = join(directory, 'answer-feedback.sqlite');
  const sidecars = ['-journal', '-wal', '-shm'].map(suffix => safeFile(path + suffix));
  let before = safeFile(path);
  if (!before) {
    if (!create) fail('FEEDBACK_NOT_FOUND');
    if (sidecars.some(Boolean)) fail('UNSAFE_FEEDBACK_FILE');
    try { closeSync(openSync(path, 'wx', 0o600)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    before = safeFile(path);
    if (!before) fail('UNSAFE_FEEDBACK_FILE');
  }
  const db = new DatabaseSync(path, {readOnly, timeout: 5000});
  try {
    const current = safeFile(path);
    if (!current || current.dev !== before.dev || current.ino !== before.ino) fail('UNSAFE_FEEDBACK_FILE');
    if (readOnly) transact(db, () => requireFeedbackSchema(db, false), true);
    else {
      db.exec('PRAGMA synchronous=FULL');
      transact(db, () => requireFeedbackSchema(db, create));
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

async function readPublishedIdentity({directory, runId, revision, expectedHash}) {
  const store = await openSession({directory, readOnly: true});
  try {
    const publication = store.publication(runId, revision);
    if (!publication || (expectedHash !== undefined && publication.receipt.payloadHash !== expectedHash)) {
      fail('PUBLICATION_IDENTITY_MISMATCH');
    }
    return publication;
  } finally {
    store.close();
  }
}

function feedbackRecord(row) {
  return {
    clientKey: row.client_key,
    runId: row.run_id,
    revision: row.revision,
    payloadHash: row.payload_hash,
    rating: row.rating,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at
  };
}

export async function answerFeedback({action, session, runId, revision, expectedHash, key, rating, reason = null}) {
  const submit = action === 'submit';
  const identity = action === 'identity';
  if (!['identity', 'submit', 'read', 'withdraw'].includes(action)) fail('INVALID_FEEDBACK');
  if ((identity || submit) && (!runPattern.test(runId ?? '') ||
      ((revision !== undefined || submit) && (![1, 2, 3].includes(revision))))) fail('INVALID_FEEDBACK');
  if (!identity && !keyPattern.test(key ?? '')) fail('INVALID_FEEDBACK_KEY');
  if (submit && (!hashPattern.test(expectedHash ?? '') || ![1, 2, 3, 4, 5].includes(rating) ||
      (reason !== null && (typeof reason !== 'string' || !reason.trim() || reason.includes('\0') ||
      Buffer.byteLength(reason) > 1000)))) fail('INVALID_FEEDBACK');

  const directory = await safeDirectory(session);
  if (identity) return readPublishedIdentity({directory, runId, revision});
  if (submit) await readPublishedIdentity({directory, runId, revision, expectedHash});

  const db = openFeedback(directory, {create: submit, readOnly: action === 'read'});
  try {
    const find = db.prepare('SELECT * FROM feedback WHERE client_key = ?');
    if (submit) {
      return transact(db, () => {
        const existing = find.get(key);
        if (existing) {
          if (existing.run_id !== runId || existing.revision !== revision || existing.payload_hash !== expectedHash ||
              existing.rating !== rating || existing.reason !== reason) fail('FEEDBACK_CONFLICT');
          return feedbackRecord(existing);
        }
        const row = db.prepare("INSERT INTO feedback VALUES (?, ?, ?, ?, ?, ?, 'active', ?) RETURNING *")
          .get(key, runId, revision, expectedHash, rating, reason, new Date().toISOString());
        return feedbackRecord(row);
      });
    }

    const row = find.get(key);
    if (!row) fail('FEEDBACK_NOT_FOUND');
    await readPublishedIdentity({directory, runId: row.run_id, revision: row.revision, expectedHash: row.payload_hash});
    if (action === 'read') return feedbackRecord(row);
    return transact(db, () => feedbackRecord(
      db.prepare("UPDATE feedback SET status = 'withdrawn' WHERE client_key = ? RETURNING *").get(key)
    ));
  } finally {
    db.close();
  }
}
