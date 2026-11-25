import {randomUUID} from 'node:crypto';
import {closeSync, lstatSync, openSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {ensureSafeDirectory, safeDirectory} from './storage-files.mjs';

const fail = code => { throw Object.assign(new Error(code), {code}); };
const instant = z.iso.datetime({offset: true});
const schema = `CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  reference TEXT,
  due TEXT NOT NULL,
  occurrence INTEGER NOT NULL CHECK (occurrence >= 1),
  state TEXT NOT NULL CHECK (state IN ('pending', 'displayed', 'acknowledged'))
) STRICT`;

function dueInstant(value) {
  if (typeof value !== 'string' || !instant.safeParse(value).success || value.endsWith('-00:00')) {
    fail('REMINDER_INVALID_INSTANT');
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail('REMINDER_INVALID_INSTANT');
  const result = date.toISOString();
  if (!/^\d{4}-/.test(result)) fail('REMINDER_INVALID_INSTANT');
  return result;
}

function checkFile(file) {
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1) fail('REMINDER_UNSAFE_STORE');
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function openStore(directory, {create, readOnly}) {
  try {
    directory = await (create ? ensureSafeDirectory(directory) : safeDirectory(directory));
  } catch (error) {
    if (!create && error.code === 'ENOENT') return null;
    fail('REMINDER_UNSAFE_STORE');
  }
  const file = join(directory, 'action-reminders.sqlite');
  for (const suffix of ['-journal', '-wal', '-shm']) checkFile(file + suffix);
  if (!checkFile(file)) {
    if (!create) return null;
    try { closeSync(openSync(file, 'wx', 0o600)); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (!checkFile(file)) fail('REMINDER_UNSAFE_STORE');
  }
  return new DatabaseSync(file, {readOnly, timeout: 5000});
}

function item(row) {
  const {reference, ...rest} = row;
  return reference === null ? rest : {...rest, reference};
}

export async function actionReminder({store, command, options, now = Date.now()}) {
  const add = command === 'add';
  const readOnly = command === 'list' || command === 'due';
  const due = add || command === 'defer' ? dueInstant(options.due) : undefined;
  const {id, text, reference} = options;
  const occurrence = Number(options.occurrence);
  if (add) {
    if (!text?.trim() || Buffer.byteLength(text) > 2048 ||
        (reference !== undefined && (!reference.trim() || Buffer.byteLength(reference) > 512))) {
      fail('REMINDER_INVALID_TEXT');
    }
  } else if (!readOnly) {
    if (!/^\d+$/.test(options.occurrence) || !Number.isSafeInteger(occurrence) || occurrence < 1 ||
        !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) fail('REMINDER_INVALID_IDENTITY');
  }
  const at = new Date(now).toISOString();
  const db = await openStore(store, {create: add, readOnly});
  if (!db) {
    if (readOnly) return {items: []};
    fail('REMINDER_NOT_FOUND');
  }

  try {
    if (readOnly) {
      const rows = command === 'due'
        ? db.prepare("SELECT * FROM reminders WHERE state != 'acknowledged' AND due <= ? ORDER BY due, id").all(at)
        : db.prepare('SELECT * FROM reminders ORDER BY due, id').all();
      return {items: rows.map(item)};
    }
    db.exec('PRAGMA synchronous=FULL; BEGIN IMMEDIATE');
    try {
      let row;
      if (add) {
        db.exec(schema);
        row = db.prepare("INSERT INTO reminders VALUES (?, ?, ?, ?, 1, 'pending') RETURNING *")
          .get(randomUUID(), text, reference ?? null, due);
      } else {
        row = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
        if (!row) fail('REMINDER_NOT_FOUND');
        if (row.occurrence !== occurrence) fail('REMINDER_STALE_OCCURRENCE');
        if (row.state === 'acknowledged' && command !== 'acknowledge') fail('REMINDER_ALREADY_ACKNOWLEDGED');
        if (command === 'mark-shown' && row.state === 'pending') {
          if (row.due > at) fail('REMINDER_NOT_DUE');
          row = db.prepare("UPDATE reminders SET state = 'displayed' WHERE id = ? RETURNING *").get(id);
        }
        if (command === 'acknowledge' && row.state !== 'acknowledged') {
          row = db.prepare("UPDATE reminders SET state = 'acknowledged' WHERE id = ? RETURNING *").get(id);
        }
        if (command === 'defer') {
          if (due <= row.due) fail('REMINDER_DUE_NOT_LATER');
          row = db.prepare("UPDATE reminders SET due = ?, occurrence = occurrence + 1, state = 'pending' WHERE id = ? RETURNING *")
            .get(due, id);
        }
      }
      db.exec('COMMIT');
      return item(row);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } finally {
    db.close();
  }
}
