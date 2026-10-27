import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openSession } from '../src/session.mjs';
const base = resolve('test-output');
async function directory() { await mkdir(base, { recursive: true }); return mkdtemp(join(base, 'session-')); }
const checkpoint = (phase = 'ready', extra = {}) => ({ schemaVersion: 'runtime-checkpoint@1', phase, ...extra });
function definition(extra = {}) { return { question: 'Synthetic exact original question.', grantId: 'synthetic-grant-1', bindings: { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'synthetic', version: '1' }, plugins: [], adapters: [] }, limits: { maxRounds: 4, maxTools: 4, timeoutMs: 10000 }, rootLimits: { model: 5, tool: 5 }, deadlineAt: 10000, config: {}, ...extra }; }
async function create(store, d, extra = {}) {
 const options = { directory: d, definition: definition(), snapshot: checkpoint(), ...extra };
 if (!options.parentRunId) return store.create(options);
 options.definition = { ...options.definition, config: { ...options.definition.config, taskId: options.definition.config.taskId || 'synthetic-child' } };
 const parent = store.claim(options.parentRunId, 'child-admission');
 try { return store.create({ ...options, parentClaim: { owner: parent.owner, fence: parent.fence } }); } finally { parent.release(); }
}
test('7.2 SQLite stores immutable request, bindings, deadline and shared budget across reopen', async () => {
 const d = await directory(); let store = await openSession({ directory: d, clock: () => 100, leaseMs: 100 });
 assert.ok(store && typeof store.create === 'function', 'loadable Session must expose real persistence');
 const created = await create(store, d); const claim = store.claim(created.runId, 'writer-a'); claim.reserve('model', checkpoint('model-reserved')); claim.release(); store.close();
 assert.equal((await readFile(join(d, 'session.sqlite'))).subarray(0, 16).toString(), 'SQLite format 3\0');
 store = await openSession({ directory: d, clock: () => 100, leaseMs: 100 });
 try { const saved = store.inspect(created.runId); assert.deepEqual(saved.definition, definition()); assert.equal(saved.snapshot.phase, 'model-reserved'); assert.deepEqual(saved.rootUsage, { model: 1, tool: 0 }); assert.equal(saved.directory, d); }
 finally { store.close(); }
});
test('7.2 live lease conflicts and expired takeover fence all old mutations', async () => {
 const d = await directory(); let now = 100; const store = await openSession({ directory: d, clock: () => now, leaseMs: 100 }); assert.ok(store, 'Session required');
 try { const { runId } = await create(store, d); const old = store.claim(runId, 'writer-a'); assert.throws(() => store.claim(runId, 'writer-b'), /LEASE_BUSY/); now = 201; const next = store.claim(runId, 'writer-b'); assert.equal(next.fence, old.fence + 1); assert.throws(() => old.checkpoint(checkpoint()), /STALE_WRITER/); assert.throws(() => old.reserve('tool', checkpoint('tool-dispatched')), /STALE_WRITER/); next.reserve('tool', checkpoint('tool-dispatched')); assert.deepEqual(next.rootBudget.snapshot(), { model: 0, tool: 1 }); }
 finally { store.close(); }
});
test('7.2 cancellation is root-monotonic and late results cannot revive it', async () => {
 const d = await directory(); const store = await openSession({ directory: d, clock: () => 100 }); assert.ok(store, 'Session required');
 try { const root = await create(store, d); const child = await create(store, d, { parentRunId: root.runId, rootId: root.rootId }); const claim = store.claim(child.runId, 'child'); store.cancel(root.runId); assert.equal(store.inspect(root.runId).status, 'cancelled'); assert.equal(store.inspect(child.runId).status, 'cancelled'); assert.throws(() => claim.checkpoint(checkpoint('result-committed')), /RUN_CANCELLED/); assert.throws(() => store.claim(root.runId, 'other'), /RUN_CANCELLED/); assert.throws(() => store.create({ directory: d, parentRunId: root.runId, rootId: root.rootId, definition: definition(), snapshot: checkpoint() }), /RUN_CANCELLED/); }
 finally { store.close(); }
});
test('7.2 completed child preserves original handoff and consumes the same root pool', async () => {
 const d = await directory(); const store = await openSession({ directory: d, clock: () => 100 }); assert.ok(store, 'Session required');
 try { const root = await create(store, d); const child = await create(store, d, { parentRunId: root.runId, rootId: root.rootId }); const c = store.claim(child.runId, 'child'); c.rootBudget.claim('model'); c.finish(checkpoint('terminal', { status: 'completed', result: { derived: true, answer: 'Synthetic handoff' } })); assert.equal(store.inspect(child.runId).snapshot.result.answer, 'Synthetic handoff'); assert.deepEqual(store.inspect(root.runId).rootUsage, { model: 1, tool: 0 }); assert.throws(() => store.claim(child.runId, 'again'), /RUN_TERMINAL/); const r = store.claim(root.runId, 'root'); r.reserve('model', checkpoint('model-reserved')); assert.deepEqual(r.rootBudget.snapshot(), { model: 2, tool: 0 }); }
 finally { store.close(); }
});
test('7.2 durable reservations do not reset, refund or overdraw on another claim', async () => {
 const d = await directory(); let now = 100; const store = await openSession({ directory: d, clock: () => now, leaseMs: 100 }); assert.ok(store, 'Session required');
 try { const { runId } = await create(store, d, { definition: definition({ rootLimits: { model: 1, tool: 1 } }) }); const old = store.claim(runId, 'a'); old.reserve('model', checkpoint('model-reserved')); now = 201; const next = store.claim(runId, 'b'); assert.throws(() => next.reserve('model', checkpoint('model-reserved')), /ROOT_BUDGET_EXHAUSTED/); assert.deepEqual(next.rootBudget.snapshot(), { model: 1, tool: 0 }); assert.equal(next.read().definition.deadlineAt, 10000); assert.equal(next.read().snapshot.phase, 'model-reserved'); }
 finally { store.close(); }
});
test('7.2 unsafe path, sidecar, unknown SQLite schema and secret binding fields are refused', async () => {
 const d = await directory(); const link = join(await directory(), 'link'); await symlink(d, link);
 await assert.rejects(openSession({ directory: link }), /unsafe|symlink/i);
 const side = await directory(); await symlink(join(side, 'missing'), join(side, 'session.sqlite-journal')); await assert.rejects(openSession({ directory: side }), /unsafe|symlink/i);
 const wrong = await directory(); const db = new DatabaseSync(join(wrong, 'session.sqlite')); db.exec('CREATE TABLE unrelated (id TEXT)'); db.close(); await assert.rejects(openSession({ directory: wrong }), /SCHEMA|schema/);
 const malformed = await directory(); await writeFile(join(malformed, 'session.sqlite'), 'not a database'); await assert.rejects(openSession({ directory: malformed }), /SCHEMA|schema|database/);
 const safe = await directory(); const store = await openSession({ directory: safe, clock: () => 100 }); assert.ok(store, 'Session required');
 try { const bad = definition(); bad.bindings.gateway.apiKey = 'SYNTHETIC-NOT-A-SECRET'; assert.throws(() => store.create({ directory: safe, definition: bad, snapshot: checkpoint() }), /BINDING|binding|credential/i); }
 finally { store.close(); }
});
test('7.2 unsupported active codec, malformed JSON and oversized snapshots fail closed', async () => {
 const d = await directory(); const store = await openSession({ directory: d, clock: () => 100 }); assert.ok(store, 'Session required');
 try { assert.throws(() => store.create({ directory: d, definition: definition(), snapshot: { schemaVersion: 'runtime-checkpoint@999', phase: 'ready' } }), /CHECKPOINT/); const { runId } = await create(store, d); const c = store.claim(runId, 'a'); assert.throws(() => c.checkpoint(checkpoint('ready', { payload: 'x'.repeat(4 * 1048576) })), /BOUND/); assert.throws(() => c.checkpoint(checkpoint('ready', { invalid: undefined })), /JSON/); assert.equal(c.read().snapshot.phase, 'ready'); }
 finally { store.close(); }
});
test('7.2 independent SQLite connections cannot spend the same last root unit', async () => {
 const d = await directory(); const a = await openSession({ directory: d, clock: () => 100 }); const b = await openSession({ directory: d, clock: () => 100 });
 try { const root = await create(a, d, { definition: definition({ rootLimits: { model: 1, tool: 1 } }) }); const child = await create(a, d, { definition: definition({ rootLimits: { model: 1, tool: 1 } }), parentRunId: root.runId }); const rootClaim = a.claim(root.runId, 'root'); const childClaim = b.claim(child.runId, 'child'); rootClaim.reserve('model', checkpoint('model-reserved')); assert.throws(() => childClaim.reserve('model', checkpoint('model-reserved')), /ROOT_BUDGET_EXHAUSTED/); assert.deepEqual(b.inspect(root.runId).rootUsage, { model: 1, tool: 0 }); assert.equal(b.inspect(child.runId).snapshot.phase, 'ready'); }
 finally { a.close(); b.close(); }
});
test('7.2 child scope cannot extend grant, provider binding, root budget or deadline', async () => {
 const d = await directory(); const store = await openSession({ directory: d, clock: () => 100 });
 try { const rootDef = definition({ config: { allowedTools: ['read_page'], allowedDocuments: ['atlas-a'] } }); const root = await create(store, d, { definition: rootDef });
  const invalid = [ { grantId: 'different' }, { deadlineAt: 10001 }, { rootLimits: { model: 6, tool: 5 } }, { bindings: { ...rootDef.bindings, gateway: { ...rootDef.bindings.gateway, model: 'other' } } }, { config: { allowedTools: ['save_report'], allowedDocuments: ['atlas-a'] } } ];
  const parent = store.claim(root.runId, 'admission');
  for (const patch of invalid) assert.throws(() => store.create({ directory: d, parentRunId: root.runId, parentClaim: { owner: parent.owner, fence: parent.fence }, definition: { ...rootDef, ...patch, config: { ...(patch.config || rootDef.config), taskId: 'child' } }, snapshot: checkpoint() }), /CHILD_SCOPE_MISMATCH/); parent.release();
  assert.equal(store.inspect(root.runId).rootUsage.model, 0);
 } finally { store.close(); }
});
test('7.2 absolute deadline refuses late mutation but permits honest failed terminal', async () => {
 const d = await directory(); let now = 100; const store = await openSession({ directory: d, clock: () => now, leaseMs: 1000 });
 try { const { runId } = await create(store, d, { definition: definition({ deadlineAt: 150 }) }); const claim = store.claim(runId, 'a'); now = 151; assert.throws(() => claim.reserve('model', checkpoint('model-reserved')), /DEADLINE_EXPIRED/); assert.throws(() => claim.checkpoint(checkpoint('result-committed')), /DEADLINE_EXPIRED/); claim.finish(checkpoint('terminal', { status: 'failed', code: 'TIMEOUT' })); assert.equal(store.inspect(runId).status, 'failed'); assert.equal(store.inspect(runId).definition.deadlineAt, 150); assert.deepEqual(store.inspect(runId).rootUsage, { model: 0, tool: 0 }); }
 finally { store.close(); }
});
test('7.2 failed root retains incomplete child facts but fences every child continuation', async () => {
 const d = await directory(); const store = await openSession({ directory: d, clock: () => 100 });
 try { const root = await create(store, d); const child = await create(store, d, { parentRunId: root.runId }); const parentClaim = store.claim(root.runId, 'root'); const childClaim = store.claim(child.runId, 'child'); childClaim.reserve('tool', checkpoint('tool-dispatched', { callId: 'unknown-child-call' })); assert.throws(() => parentClaim.finish(checkpoint('terminal', { status: 'completed' })), /ACTIVE_CHILD/); parentClaim.finish(checkpoint('terminal', { status: 'failed', code: 'CHILD_UNKNOWN' })); const retained = store.inspect(child.runId); assert.equal(retained.status, 'active'); assert.equal(retained.rootStatus, 'failed'); assert.equal(retained.snapshot.phase, 'tool-dispatched'); assert.throws(() => childClaim.checkpoint(checkpoint('result-committed')), /RUN_TERMINAL/); assert.throws(() => store.claim(child.runId, 'late'), /RUN_TERMINAL/); }
 finally { store.close(); }
});
test('7.2 persisted malformed checkpoint and future schema are refused on readback', async () => {
 const d = await directory(); let store = await openSession({ directory: d, clock: () => 100 }); const { runId } = await create(store, d); store.close();
 const db = new DatabaseSync(join(d, 'session.sqlite')); db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run('{not-json', runId); db.close();
 store = await openSession({ directory: d, clock: () => 100 }); try { assert.throws(() => store.inspect(runId), /INVALID_JSON/); assert.throws(() => store.claim(runId, 'a'), /INVALID_JSON/); } finally { store.close(); }
 const future = new DatabaseSync(join(d, 'session.sqlite')); future.exec('PRAGMA user_version=999'); future.close(); await assert.rejects(openSession({ directory: d }), /UNSUPPORTED_SESSION_SCHEMA/);
});
test('7.2 orphan ordinary SQLite sidecar is not adopted into a fresh session', async () => {
 const d = await directory(); await writeFile(join(d, 'session.sqlite-journal'), 'synthetic orphan journal');
 await assert.rejects(openSession({ directory: d }), /ORPHAN_SESSION_SIDECAR/);
 await assert.rejects(readFile(join(d, 'session.sqlite')), { code: 'ENOENT' });
});
test('7.2 child admission requires current parent fence, not a stale relationship token', async () => {
 const d = await directory(); let now = 100; const store = await openSession({ directory: d, clock: () => now, leaseMs: 100 });
 try { const root = await create(store, d); const old = store.claim(root.runId, 'old'); const input = { directory: d, parentRunId: root.runId, definition: definition({ config: { taskId: 'scoped-child' } }), snapshot: checkpoint() }; assert.throws(() => store.create(input), /PARENT_CLAIM_REQUIRED/); now = 201; const current = store.claim(root.runId, 'current'); assert.throws(() => store.create({ ...input, parentClaim: { owner: old.owner, fence: old.fence } }), /STALE_WRITER/); const child = store.create({ ...input, parentClaim: { owner: current.owner, fence: current.fence } }); assert.equal(child.parentRunId, root.runId); }
 finally { store.close(); }
});
test('7.2 child relationship lookup is exact and uniquely bound to parent plus task ID', async () => {
 const d = await directory(); const store = await openSession({ directory: d, clock: () => 100 });
 try { const root = await create(store, d); assert.equal(typeof store.findChild, 'function', 'Session must expose exact child lookup'); assert.equal(store.findChild(root.runId, 'missing'), null); const child = await create(store, d, { parentRunId: root.runId }); assert.equal(store.findChild(root.runId, 'synthetic-child').runId, child.runId); const parent = store.claim(root.runId, 'parent'); assert.throws(() => store.create({ directory: d, parentRunId: root.runId, parentClaim: { owner: parent.owner, fence: parent.fence }, definition: definition({ config: { taskId: 'synthetic-child' } }), snapshot: checkpoint() }), /CHILD_EXISTS/); const other = await create(store, d); assert.equal(store.findChild(other.runId, 'synthetic-child'), null); }
 finally { store.close(); }
});
