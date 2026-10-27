import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openSession } from '../src/session.mjs';
import * as publication from '../src/publication.mjs';

const binding = { id: 'publication', version: 'publication@1' };
const checkpoint = (phase = 'ready', extra = {}) => ({ schemaVersion: 'runtime-checkpoint@1', phase, ...extra });
function definition(extra = {}) {
 return { question: 'Synthetic publication question.', grantId: 'synthetic-publication-grant', bindings: { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'synthetic', version: '1' }, plugins: [], adapters: [binding] }, limits: { maxRounds: 4, maxTools: 4, timeoutMs: 10000 }, rootLimits: { model: 5, tool: 5 }, deadlineAt: 10000, config: {}, ...extra };
}
async function fixture() {
 const base = resolve('test-output'); await mkdir(base, { recursive: true }); const directory = await mkdtemp(join(base, 'publication-'));
 let time = 100; const store = await openSession({ directory, clock: () => time, leaseMs: 100 });
 const root = store.create({ runId: 'synthetic-root', directory, definition: definition(), snapshot: checkpoint() });
 const claim = store.claim(root.runId, 'writer-a');
 const prepare = text => publication.preparePublication({ runId: root.runId, rootId: root.rootId, text });
 const requireOwner = () => { assert.equal(typeof claim.publish, 'function', 'original-owner publication commit seam required'); assert.equal(typeof claim.replacePublication, 'function', 'explicit replacement required'); };
 return { store, root, claim, directory, prepare, requireOwner, advance: n => { time = n; } };
}
const code = expected => error => error?.code === expected;

test('8.1 preparation is bounded immutable content, not a committed receipt', () => {
 const prepared = publication.preparePublication({ runId: 'r', rootId: 'r', text: '  Synthetic body.\n' });
 assert.equal(prepared.blockId, 'answer'); assert.equal(prepared.content.text, '  Synthetic body.\n');
 assert.equal(prepared.revision, undefined); assert.equal(prepared.deliveryOrdinal, undefined);
 assert.ok(Object.isFrozen(prepared) && Object.isFrozen(prepared.content));
 for (const text of ['', '  ', 'x'.repeat(64001), 'x\0y', '\ud800']) assert.throws(() => publication.preparePublication({ runId: 'r', rootId: 'r', text }));
 assert.throws(() => publication.preparePublication({ runId: 'r', rootId: 'r', text: 'body', revision: 1 }));
 assert.throws(() => publication.validatePublication({ ...prepared, content: { type: 'text', text: 'tampered' } }));
});

test('8.1 stable block and ordinal survive replace; audit differs from current event', async () => {
 const f = await fixture(); try {
  f.requireOwner(); const first = f.claim.publish(f.prepare('First body.')).receipt;
  const second = f.claim.replacePublication(f.prepare('Second body.'), 1).receipt;
  assert.deepEqual([first.blockId, second.blockId], ['answer', 'answer']); assert.deepEqual([first.deliveryOrdinal, second.deliveryOrdinal], [1, 1]);
  assert.deepEqual([first.revision, second.revision], [1, 2]); assert.notEqual(first.payloadHash, second.payloadHash);
  assert.equal(f.store.publication(f.root.runId, 1).content.text, 'First body.');
  assert.deepEqual(f.store.publication(f.root.runId).receipt, second);
  assert.deepEqual(f.store.publicationRevisions(f.root.runId).map(x => x.receipt.revision), [1, 2]);
  const event = f.store.publicationEvent(f.root.runId); assert.equal(event.type, 'publication-committed'); assert.deepEqual(event.receipt, second);
  assert.deepEqual(f.store.confirmPublication(first).receipt, first);
 } finally { f.store.close(); }
});

test('8.1 exact no-op returns original receipt and changed text requires replace', async () => {
 const f = await fixture(); try {
  f.requireOwner(); const original = f.claim.publish(f.prepare('Exact body.')); assert.equal(original.idempotent, false);
  const duplicate = f.claim.publish(f.prepare('Exact body.')); assert.equal(duplicate.idempotent, true); assert.deepEqual(duplicate.receipt, original.receipt);
  const noop = f.claim.replacePublication(f.prepare('Exact body.'), 1); assert.equal(noop.idempotent, true); assert.deepEqual(noop.receipt, original.receipt);
  assert.throws(() => f.claim.publish(f.prepare('Exact body. ')), code('PUBLICATION_REPLACE_REQUIRED'));
  assert.equal(f.store.publicationRevisions(f.root.runId).length, 1);
  assert.throws(() => f.claim.replacePublication(f.prepare('Exact body.'), 0), code('INVALID_PUBLICATION_REVISION'));
 } finally { f.store.close(); }
});

test('8.1 changed protected Host facts defeat text-only no-op', async () => {
 const f = await fixture(); try {
  f.requireOwner(); f.claim.checkpoint(checkpoint('ready', { host: { syntheticReference: 'original' } })); const original = f.claim.publish(f.prepare('Same visible text.')).receipt;
  f.claim.checkpoint(checkpoint('ready', { host: { syntheticReference: 'changed' } }));
  assert.throws(() => f.claim.publish(f.prepare('Same visible text.')), code('PUBLICATION_REPLACE_REQUIRED'));
  const changed = f.claim.replacePublication(f.prepare('Same visible text.'), 1).receipt;
  assert.equal(changed.payloadHash, original.payloadHash); assert.notEqual(changed.bindingHash, original.bindingHash); assert.equal(changed.revision, 2);
  assert.deepEqual(f.store.confirmPublication(original).receipt, original);
 } finally { f.store.close(); }
});

test('8.1 stale and unknown replacement cannot append or mutate existing delivery', async () => {
 const f = await fixture(); try {
  f.requireOwner(); assert.throws(() => f.claim.replacePublication(f.prepare('Unknown target.'), 1), code('PUBLICATION_NOT_FOUND'));
  f.claim.publish(f.prepare('v1')); const second = f.claim.replacePublication(f.prepare('v2'), 1).receipt;
  const before = f.store.publicationEvent(f.root.runId);
  assert.throws(() => f.claim.replacePublication(f.prepare('v2'), 1), code('PUBLICATION_REVISION_MISMATCH'));
  assert.deepEqual(f.store.publicationEvent(f.root.runId), before); assert.equal(f.store.publicationRevisions(f.root.runId).length, 2);
  assert.deepEqual(f.store.publication(f.root.runId).receipt, second);
 } finally { f.store.close(); }
});

test('8.1 durable two-change quota survives reopen and no-op remains free', async () => {
 const f = await fixture(); let fresh; try {
  f.requireOwner(); f.claim.publish(f.prepare('v1')); f.claim.replacePublication(f.prepare('v2'), 1); const third = f.claim.replacePublication(f.prepare('v3'), 2).receipt;
  assert.throws(() => f.claim.replacePublication(f.prepare('v4'), 3), code('PUBLICATION_MODIFICATION_LIMIT'));
  f.claim.release(); f.store.close(); fresh = await openSession({ directory: f.directory, clock: () => 100, leaseMs: 100 }); const next = fresh.claim(f.root.runId, 'fresh-writer');
  assert.throws(() => next.replacePublication(f.prepare('v4'), 3), code('PUBLICATION_MODIFICATION_LIMIT'));
  assert.deepEqual(next.replacePublication(f.prepare('v3'), 3), { receipt: third, idempotent: true });
  assert.equal(fresh.publicationRevisions(f.root.runId).length, 3);
 } finally { fresh?.close(); f.store.close(); }
});

test('8.1 missing event refuses replacement without partial revision write', async () => {
 const f = await fixture(); let db; try {
  f.requireOwner(); f.claim.publish(f.prepare('durable old body'));
  db = new DatabaseSync(join(f.directory, 'session.sqlite')); db.prepare('DELETE FROM publication_events WHERE run_id=?').run(f.root.runId);
  const before = db.prepare('SELECT * FROM publication_versions').all();
  assert.throws(() => f.claim.replacePublication(f.prepare('must not persist'), 1), code('PUBLICATION_IDENTITY_UNAVAILABLE'));
  assert.deepEqual(db.prepare('SELECT * FROM publication_versions').all(), before); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM publication_events').get().n, 0);
  assert.throws(() => f.store.publication(f.root.runId), code('PUBLICATION_IDENTITY_UNAVAILABLE'));
 } finally { db?.close(); f.store.close(); }
});

test('8.1 actual SQLite event failure rolls initial body and replacement back atomically', async () => {
 const f = await fixture(); let db; try {
  f.requireOwner(); db = new DatabaseSync(join(f.directory, 'session.sqlite'));
  db.exec("CREATE TRIGGER reject_publication_insert BEFORE INSERT ON publication_events BEGIN SELECT RAISE(ABORT,'synthetic event insert failure'); END");
  assert.throws(() => f.claim.publish(f.prepare('not committed')), /synthetic event insert failure/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM publication_versions').get().n, 0);
  db.exec('DROP TRIGGER reject_publication_insert'); const original = f.claim.publish(f.prepare('retained')).receipt;
  db.exec("CREATE TRIGGER reject_publication_update BEFORE UPDATE ON publication_events BEGIN SELECT RAISE(ABORT,'synthetic event update failure'); END");
  assert.throws(() => f.claim.replacePublication(f.prepare('not replaced'), 1), /synthetic event update failure/);
  assert.deepEqual(f.store.publication(f.root.runId).receipt, original); assert.equal(f.store.publicationRevisions(f.root.runId).length, 1);
  db.exec('DROP TRIGGER reject_publication_update');
 } finally { db?.close(); f.store.close(); }
});

test('8.1 failed terminal and cancellation preserve earlier commit but refuse later write', async () => {
 for (const ending of ['failed', 'cancelled']) {
  const f = await fixture(); try {
   f.requireOwner(); const original = f.claim.publish(f.prepare('Committed before later failure.')).receipt;
   if (ending === 'cancelled') f.store.cancel(f.root.runId); else f.claim.finish(checkpoint('terminal', { status: 'failed', code: 'SYNTHETIC_LATER_FAILURE' }));
   assert.deepEqual(f.store.confirmPublication(original).receipt, original);
   assert.throws(() => f.claim.replacePublication(f.prepare('late'), 1), code(ending === 'cancelled' ? 'RUN_CANCELLED' : 'RUN_TERMINAL'));
  } finally { f.store.close(); }
 }
});

test('8.1 stale lease and deadline fence new body while stored receipt stays readable', async () => {
 const f = await fixture(); try {
  f.requireOwner(); const original = f.claim.publish(f.prepare('stored')).receipt; f.advance(201); const next = f.store.claim(f.root.runId, 'new-writer');
  assert.throws(() => f.claim.replacePublication(f.prepare('stale'), 1), code('STALE_WRITER'));
  f.advance(10001); const expired = f.store.claim(f.root.runId, 'expired-writer');
  assert.throws(() => expired.replacePublication(f.prepare('too late'), 1), code('DEADLINE_EXPIRED')); assert.deepEqual(f.store.confirmPublication(original).receipt, original);
 } finally { f.store.close(); }
});

test('8.1 foreign root, Child, altered receipt and corrupted body never gain read/write authority', async () => {
 const f = await fixture(); let db; try {
  f.requireOwner(); const original = f.claim.publish(f.prepare('bound body')).receipt;
  assert.throws(() => f.claim.publish(publication.preparePublication({ runId: 'foreign', rootId: 'foreign', text: 'foreign' })), code('PUBLICATION_SCOPE_MISMATCH'));
  const child = f.store.create({ runId: 'child', directory: f.directory, parentRunId: f.root.runId, parentClaim: { owner: f.claim.owner, fence: f.claim.fence }, definition: definition({ config: { taskId: 'child-task' } }), snapshot: checkpoint() });
  const childClaim = f.store.claim(child.runId, 'child-owner');
  assert.throws(() => childClaim.publish(publication.preparePublication({ runId: child.runId, rootId: f.root.runId, text: 'child cannot publish root' })), code('PUBLICATION_SCOPE_MISMATCH'));
  assert.throws(() => f.store.confirmPublication({ ...original, bindingHash: '0'.repeat(64) }), code('PUBLICATION_IDENTITY_UNAVAILABLE'));
  assert.throws(() => f.store.confirmPublication({ ...original, rootId: 'foreign' }), code('PUBLICATION_IDENTITY_UNAVAILABLE'));
  db = new DatabaseSync(join(f.directory, 'session.sqlite')); db.prepare('UPDATE publication_versions SET body=? WHERE run_id=?').run(JSON.stringify({ type: 'text', text: 'tampered' }), f.root.runId);
  assert.throws(() => f.store.publication(f.root.runId), code('PUBLICATION_IDENTITY_UNAVAILABLE'));
 } finally { db?.close(); f.store.close(); }
});

test('8.1 second connection reads active committed body without taking execution lease', async () => {
 const f = await fixture(); let reader; try {
  f.requireOwner(); const original = f.claim.publish(f.prepare('readable while active')).receipt;
  reader = await openSession({ directory: f.directory, clock: () => 100, leaseMs: 100 }); const before = f.store.inspect(f.root.runId);
  assert.deepEqual(reader.confirmPublication(original).receipt, original); assert.equal(reader.inspect(f.root.runId).status, 'active');
  const after = f.store.inspect(f.root.runId); assert.deepEqual([after.owner, after.fence, after.leaseUntil], [before.owner, before.fence, before.leaseUntil]);
  assert.throws(() => reader.claim(f.root.runId, 'reader-not-owner'), code('LEASE_BUSY'));
 } finally { reader?.close(); f.store.close(); }
});

test('8.1 admitted byte-bound text survives JSON escape expansion without hidden storage truncation', async () => {
 const f = await fixture(); try {
  f.requireOwner(); const text = '\u0001'.repeat(64000); const committed = f.claim.publish(f.prepare(text)).receipt;
  assert.equal(f.store.confirmPublication(committed).content.text, text); assert.equal(f.store.publicationEvent(f.root.runId).content.text, text);
 } finally { f.store.close(); }
});
