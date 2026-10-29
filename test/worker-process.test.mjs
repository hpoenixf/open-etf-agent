import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { openSession } from '../src/session.mjs';

const leaseClocks=new Map();
async function directory() { await mkdir('test-output', { recursive: true }); const d=await mkdtemp(resolve('test-output/worker-process-'));leaseClocks.set(d,Date.now());return d; }
function launch(directory, action, runId, pause = '', leaseTick = leaseClocks.get(directory)) {
 const child = fork(new URL('./fixtures/worker-process.mjs', import.meta.url), [directory, action, runId, pause, String(leaseTick)], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] });
 const messages = []; let stderr = ''; child.stdout.resume(); child.stderr.on('data', x => { stderr += x; }); child.on('message', x => messages.push(x));
 const exited = once(child, 'exit').then(([code, signal]) => ({ code, signal }));
 return { child, exited, async wait(kind) { const end = Date.now() + 6000; while (Date.now() < end) { const found = messages.find(x => x.kind === kind); if (found) return found; const failed = messages.find(x => x.kind === 'fixture-error'); if (failed) throw new Error(failed.code); if (child.exitCode !== null || child.signalCode) throw new Error('Worker exited before ' + kind + ': ' + stderr); await delay(10); } throw new Error('Worker message timed out: ' + kind); }, async stop() { if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL'); return exited; } };
}
async function submit(d, id, action = 'submit') { const p = launch(d, action, id); try { const saved = await p.wait('submitted'); assert.equal((await p.exited).code, 0); return saved; } finally { await p.stop(); } }
async function read(d, fn) { const store = await openSession({ directory: d }); try { return fn(store); } finally { store.close(); } }
async function calls(d) { try { return (await readFile(join(d, 'synthetic-model-attempts.txt'), 'utf8')).trim().split('\n').length; } catch (error) { if (error.code === 'ENOENT') return 0; throw error; } }

test('9.2 actual SIGTERM stops the Worker without cancelling the original Run; fresh process continues sealed work', async () => {
 const d = await directory(), id = 'graceful-original'; const saved = await submit(d, id); const first = launch(d, 'work', id, 'sealed'); let paused;
 try { paused = await first.wait('barrier'); first.child.kill('SIGTERM'); const observed = await first.wait('observation'); assert.equal((await first.exited).code, 1); assert.equal(observed.observation.workerStatus, 'interrupted'); assert.equal(observed.observation.run.status, 'active'); assert.equal(observed.observation.run.owner, null); }
 finally { await first.stop(); }
 assert.notEqual(saved.pid, first.child.pid); const second = launch(d, 'work', id);
 try { const observed = await second.wait('observation'); assert.equal((await second.exited).code, 0); assert.notEqual(first.child.pid, second.child.pid); assert.equal(observed.observation.run.status, 'completed'); assert.ok(observed.observation.run.fence > paused.fence); assert.equal(observed.observation.run.definition.deadlineAt, saved.run.definition.deadlineAt); assert.equal(observed.observation.run.rootUsage.model, 1); }
 finally { await second.stop(); }
 assert.equal(await calls(d), 1);
});
test('9.2 actual competing workers use one original lease and an independent durable cancel stops the owner', async () => {
 const d = await directory(), id = 'one-claim'; await submit(d, id); const first = launch(d, 'work', id, 'sealed'); let second;
 try {
  const paused = await first.wait('barrier'); second = launch(d, 'work', id); const denied = await second.wait('observation'); assert.equal((await second.exited).code, 1); assert.equal(denied.observation.workerStatus, 'busy'); assert.equal(denied.observation.run.fence, paused.fence);
  await read(d, store => store.cancel(id)); const stopped = await first.wait('observation'); assert.equal((await first.exited).code, 1); assert.equal(stopped.observation.run.status, 'cancelled'); assert.equal(stopped.observation.publication, null); assert.equal(await calls(d), 1);
 } finally { await first.stop(); await second?.stop(); }
});
test('9.2 actual SIGKILL with an unknown dispatched model request never repeats it in a fresh Worker', async () => {
 const d = await directory(), id = 'unknown-original'; const saved = await submit(d, id); const first = launch(d, 'work', id, 'pending');
 try { await first.wait('barrier'); } finally { assert.equal((await first.stop()).signal, 'SIGKILL'); }
 assert.equal(await calls(d), 1); const before = await read(d, store => store.inspect(id)); assert.equal(before.status, 'active'); assert.equal(before.snapshot.phase, 'model-reserved');
 const second = launch(d, 'work', id, '', before.leaseUntil+1);
 try { const seen = await second.wait('observation'); assert.equal((await second.exited).code, 1); assert.notEqual(first.child.pid, second.child.pid); assert.equal(seen.observation.run.status, 'failed'); assert.equal(seen.observation.run.snapshot.code, 'MODEL_OUTCOME_UNKNOWN'); assert.deepEqual(seen.observation.run.rootUsage, before.rootUsage); assert.equal(seen.observation.run.definition.deadlineAt, saved.run.definition.deadlineAt); }
 finally { await second.stop(); }
 assert.equal(await calls(d), 1);
});
test('9.2 actual post-publication SIGKILL preserves one original revision and performs no replacement model call', async () => {
 const d = await directory(), id = 'publication-original'; await submit(d, id); const first = launch(d, 'work', id, 'committed'); let committed;
 try { committed = await first.wait('committed'); } finally { assert.equal((await first.stop()).signal, 'SIGKILL'); }
 assert.deepEqual(await read(d, store => store.confirmPublication(committed.receipt).receipt), committed.receipt);const prior=await read(d,store=>store.inspect(id));
 const second = launch(d, 'work', id, '', prior.leaseUntil+1);
 try { const seen = await second.wait('observation'); assert.equal((await second.exited).code, 0); assert.deepEqual(seen.observation.publication, committed.receipt); assert.equal(seen.observation.run.runId, id); }
 finally { await second.stop(); }
 assert.equal(await calls(d), 1); assert.equal(await read(d, store => store.publicationRevisions(id).length), 1);
});
test('9.2 time spent after submit counts against the original deadline and an expired Worker dispatches nothing', async () => {
 const d = await directory(), id = 'deadline-original'; const saved = await submit(d, id, 'submit-expiring'); await delay(250); const worker = launch(d, 'work', id);
 try { const seen = await worker.wait('observation'); assert.equal((await worker.exited).code, 1); assert.equal(seen.observation.run.status, 'failed'); assert.equal(seen.observation.run.snapshot.code, 'TIMEOUT'); assert.equal(seen.observation.run.definition.deadlineAt, saved.run.definition.deadlineAt); assert.deepEqual(seen.observation.run.rootUsage, { model: 0, tool: 0 }); }
 finally { await worker.stop(); }
 assert.equal(await calls(d), 0);
});
