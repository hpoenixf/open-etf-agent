import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openSession } from '../src/session.mjs';
const entry = resolve('src/session-cli.mjs');
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/session-cli-')); }
function cli(...args) { return spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1048576 }); }
function successful(result) { assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }
const gateway = model => ({ mode: 'fixture', provider: 'synthetic', protocol: 'fixture@1', model, version: '1' });
async function activeSession(d, binding = gateway('durable-report')) {
 const store = await openSession({ directory: d });
 try { return store.create({ directory: d, definition: { question: 'Synthetic CLI control-only fixture.', grantId: 'cli-control-grant', bindings: { gateway: binding, plugins: [], adapters: [] }, limits: { maxRounds: 4, maxTools: 4, timeoutMs: 10000 }, rootLimits: { model: 4, tool: 4 }, deadlineAt: Date.now() + 10000, config: {} }, snapshot: { schemaVersion: 'runtime-checkpoint@1', phase: 'ready' } }); }
 finally { store.close(); }
}
test('7.cli default start produces real report and inspect reads its exact local persisted identity', async () => {
 const d = await directory(); const run = successful(cli('start', '--session', d)); assert.equal(run.status, 'completed'); assert.ok(run.receipt?.artifactId);
 const report = await readFile(join(run.directory, 'report.md')); assert.equal(report.length, run.receipt.bytes);
 const state = successful(cli('inspect', '--session', d, '--run', run.runId)); assert.equal(state.runId, run.runId); assert.equal(state.status, 'completed'); assert.equal(state.definition.bindings.gateway.model, 'durable-report'); assert.deepEqual(state.rootUsage, run.rootUsage); assert.ok(state.definition.question);
});
test('7.cli completed resume returns original settlement without a second file or budget reset', async () => {
 const d = await directory(); const original = successful(cli('start', '--session', d)); const path = join(original.directory, 'report.md'); const before = await stat(path);
 const restored = successful(cli('resume', '--session', d, '--run', original.runId)); const after = await stat(path);
 assert.equal(restored.status, 'completed'); assert.equal(restored.runId, original.runId); assert.equal(restored.directory, original.directory); assert.deepEqual(restored.receipt, original.receipt); assert.deepEqual(restored.rootUsage, original.rootUsage); assert.equal(after.mtimeMs, before.mtimeMs);
});
test('7.cli cancel changes only durable root status and is monotonic when inspected again', async () => {
 const d = await directory(); const original = await activeSession(d); const cancelled = successful(cli('cancel', '--session', d, '--run', original.runId)); assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.rootStatus, 'cancelled'); assert.deepEqual(cancelled.rootUsage, { model: 0, tool: 0 });
 const inspected = successful(cli('inspect', '--session', d, '--run', original.runId)); assert.equal(inspected.status, 'cancelled'); assert.deepEqual(inspected.definition, original.definition);
 const repeated = successful(cli('cancel', '--session', d, '--run', original.runId)); assert.deepEqual(repeated, inspected);
});
test('7.cli resume refuses live or foreign fixture identity rather than substituting a script', async () => {
 for (const binding of [{ ...gateway('durable-report'), mode: 'live' }, { ...gateway('durable-report'), version: '999' }, gateway('unregistered-case')]) {
  const d = await directory(); const original = await activeSession(d, binding); const result = cli('resume', '--session', d, '--run', original.runId); assert.equal(result.status, 2); assert.match(result.stderr, /FIXTURE_BINDING_REQUIRED/);
  const store = await openSession({ directory: d }); try { assert.deepEqual(store.inspect(original.runId), original); } finally { store.close(); }
 }
});
test('7.cli strict options reject unknown, duplicate, missing and action-incompatible input', async () => {
 const d = await directory();
 const cases = [[], ['unknown'], ['start'], ['start', '--session'], ['start', '--session', d, '--session', d], ['start', '--session', d, '--unknown', 'x'], ['start', '--session', d, '--run', 'unexpected'], ['resume', '--session', d], ['inspect', '--session', d, '--run', 'x', '--case', 'durable-report'], ['cancel', '--session', d, '--run', 'x', '--case', 'durable-report'], ['start', '--session', d, '--case', 'live']];
 for (const args of cases) { const result = cli(...args); assert.equal(result.status, 2); assert.match(result.stderr, /INVALID_ARGUMENT/); assert.equal(result.stdout, ''); }
 await assert.rejects(readFile(join(d, 'session.sqlite')), { code: 'ENOENT' });
});
test('7.cli read/resume/cancel on absent sessions do not initialize empty databases', async () => {
 for (const action of ['inspect', 'resume', 'cancel']) { const d = join(await directory(), 'absent'); const result = cli(action, '--session', d, '--run', 'unknown'); assert.equal(result.status, 2); assert.match(result.stderr, /SESSION_NOT_FOUND/); await assert.rejects(stat(d), { code: 'ENOENT' }); }
});
test('7.cli all named fixture profiles start independently and retain their own resume pin', async () => {
 for (const caseId of ['durable-child', 'durable-compaction', 'durable-memory', 'trusted-plugins']) {
  const d = await directory(); const original = successful(cli('start', '--session', d, '--case', caseId)); assert.equal(original.status, 'completed', caseId);
  const inspected = successful(cli('inspect', '--session', d, '--run', original.runId)); assert.deepEqual(inspected.definition.bindings.gateway, gateway(caseId));
  const resumed = successful(cli('resume', '--session', d, '--run', original.runId)); assert.equal(resumed.status, 'completed'); assert.deepEqual(resumed.rootUsage, original.rootUsage);
  const mismatch = cli('resume', '--session', d, '--run', original.runId, '--case', 'durable-report'); assert.equal(mismatch.status, 2); assert.match(mismatch.stderr, /CASE_MISMATCH/);
 }
});
