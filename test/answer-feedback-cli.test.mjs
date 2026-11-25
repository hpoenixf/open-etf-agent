import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { openSession } from '../src/session.mjs';
import * as publication from '../src/publication.mjs';

const cli = (...args) => spawnSync(process.execPath, ['src/answer-feedback-cli.mjs', ...args], { encoding: 'utf8', timeout: 15000 });
const successful = result => { assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
const binding = { id: 'publication', version: 'publication@1' };
const definition = { question: 'Synthetic publication fixture.', grantId: 'feedback-fixture-grant', bindings: { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'synthetic', version: '1' }, plugins: [], adapters: [binding] }, limits: { maxRounds: 4, maxTools: 4, timeoutMs: 10000 }, rootLimits: { model: 5, tool: 5 }, deadlineAt: 10000, config: {} };
const checkpoint = { schemaVersion: 'runtime-checkpoint@1', phase: 'ready' };

test('A40 feedback uses immutable original root publication identity across independent CLI processes', async t => {
 await mkdir('test-output', { recursive: true });
 const root = await mkdtemp(resolve('test-output/answer-feedback-')), session = join(root, 'session');
 const bytesPath = join(session, 'session.sqlite');
 const store = await openSession({ directory: session, clock: () => 100, leaseMs: 100 });
 const rootRun = store.create({ runId: 'answer-root', directory: session, definition, snapshot: checkpoint });
 const owner = store.claim(rootRun.runId, 'feedback-fixture-owner');
 const prepare = text => publication.preparePublication({ runId: rootRun.runId, rootId: rootRun.rootId, text });
 const bodies = ['Published answer v1.', 'Published answer v2.', 'Published answer v3.'];
 owner.publish(prepare(bodies[0])); owner.replacePublication(prepare(bodies[1]), 1); owner.replacePublication(prepare(bodies[2]), 2);
 const child = store.create({ runId: 'answer-child', directory: session, parentRunId: rootRun.runId, parentClaim: { owner: owner.owner, fence: owner.fence }, definition: { ...definition, config: { taskId: 'child-task' } }, snapshot: checkpoint });
 store.claim(child.runId, 'child-owner');
 store.close();
 const original = await readFile(bytesPath);
 t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(root, { recursive: true, force: true }); });

 const identity = successful(cli('identity', '--session', session, '--run', rootRun.runId, '--revision', '1'));
 assert.equal(successful(cli('identity', '--session', session, '--run', rootRun.runId)).content.text, bodies[2]);
 const hash = identity.receipt.payloadHash;
 assert.equal(identity.content.text, bodies[0]);
 const args = ['--session', session, '--run', rootRun.runId, '--revision', '1', '--expected-hash', hash, '--key', 'client-1', '--rating', '5', '--reason', 'Clear and useful'];
 const wrongHash = args.map(value => value === hash ? '0'.repeat(64) : value);
 const failed = cli('submit', ...wrongHash);
 assert.equal(failed.status, 2);
 assert.match(failed.stderr, /PUBLICATION_IDENTITY_MISMATCH/);
 await assert.rejects(stat(join(session, 'answer-feedback.sqlite')), {code: 'ENOENT'});
 const processes = await Promise.all([0, 1].map(() => new Promise(resolvePromise => {
  const childProcess = spawn(process.execPath, ['src/answer-feedback-cli.mjs', 'submit', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = ''; childProcess.stdout.on('data', chunk => stdout += chunk); childProcess.stderr.on('data', chunk => stderr += chunk);
  childProcess.on('close', status => resolvePromise({ status, stdout, stderr }));
 })));
 const [first, second] = processes.map(successful);
 assert.equal(first.status, 'active');
 assert.deepEqual(second, first);
 const conflicting = cli('submit', '--session', session, '--run', rootRun.runId, '--revision', '1', '--expected-hash', hash, '--key', 'client-1', '--rating', '4', '--reason', 'Changed');
 assert.equal(conflicting.status, 2); assert.match(conflicting.stderr, /FEEDBACK_CONFLICT/);
 assert.equal(cli('submit', '--session', session, '--run', rootRun.runId, '--revision', '3', '--expected-hash', hash, '--key', 'wrong-revision', '--rating', '5', '--reason', 'x').status, 2);
 assert.equal(cli('submit', '--session', session, '--run', 'missing-run', '--revision', '1', '--expected-hash', hash, '--key', 'missing', '--rating', '5', '--reason', 'x').status, 2);
 assert.equal(cli('identity', '--session', session, '--run', child.runId).status, 2);
 assert.match(cli('submit', ...args.map((value, index) => args[index - 1] === '--rating' ? '6' : value)).stderr, /INVALID_ARGUMENT/);
 assert.equal(successful(cli('submit', '--session', session, '--run', rootRun.runId, '--revision', '3', '--expected-hash', successful(cli('identity', '--session', session, '--run', rootRun.runId)).receipt.payloadHash, '--key', 'on-third-version', '--rating', '4')).revision, 3);

 const read = successful(cli('read', '--session', session, '--key', 'client-1'));
 assert.equal(read.status, 'active');
 assert.equal(successful(cli('withdraw', '--session', session, '--key', 'client-1')).status, 'withdrawn');
 assert.equal(successful(cli('submit', ...args)).status, 'withdrawn');
 assert.equal(successful(cli('read', '--session', session, '--key', 'client-1')).status, 'withdrawn');
 assert.equal(cli('read', '--session', session, '--key', 'absent').status, 2);

 const after = successful(cli('identity', '--session', session, '--run', rootRun.runId, '--revision', '1'));
 assert.deepEqual(after, identity);
 assert.deepEqual(await readFile(bytesPath), original);
 assert.equal((await stat(join(session, 'answer-feedback.sqlite'))).mode & 0o777, 0o600);
 const noStore = join(root, 'no-feedback-store'); await mkdir(noStore);
 assert.equal(cli('read', '--session', noStore, '--key', 'x').status, 2);
 await assert.rejects(stat(join(noStore, 'answer-feedback.sqlite')), { code: 'ENOENT' });
 const victim = join(root, 'victim.sqlite'); await writeFile(victim, 'must remain untouched');
 await symlink(victim, join(noStore, 'answer-feedback.sqlite'));
 assert.equal(cli('read', '--session', noStore, '--key', 'x').status, 2);
 assert.equal(await readFile(victim, 'utf8'), 'must remain untouched');

 const protectedDirectory = join(root, 'protected-session'), profile = 'document-revocation@1';
 const protectedCommand = (...args) => spawnSync(process.execPath, ['src/session-cli.mjs', ...args], { encoding: 'utf8', timeout: 30000 });
 assert.equal(protectedCommand('init-documents', '--session', protectedDirectory, '--profile', profile).status, 0);
 const protectedStart = protectedCommand('start', '--session', protectedDirectory, '--profile', profile, '--case', 'revocable-rag'); assert.equal(protectedStart.status, 0, protectedStart.stderr);
 const protectedRun = JSON.parse(protectedStart.stdout).runId;
 assert.equal(protectedCommand('publication', '--session', protectedDirectory, '--profile', profile, '--run', protectedRun).status, 0);
 assert.equal(cli('identity', '--session', protectedDirectory, '--run', protectedRun).status, 2);
});
