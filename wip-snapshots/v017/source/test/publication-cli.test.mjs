import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openArtifactStore } from '../src/artifacts.mjs';
const entry = resolve('src/session-cli.mjs');
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/publication-cli-')); }
function cli(...args) { return spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1048576 }); }
function successful(result) { assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }
test('8.2 local CLI starts same Runtime and separately reads body, current event and immutable Artifact', async () => {
 const d = await directory(); const outcome = successful(cli('start', '--session', d, '--case', 'durable-publication')); assert.equal(outcome.status, 'completed'); assert.ok(outcome.publication);
 const body = successful(cli('publication', '--session', d, '--run', outcome.runId)); assert.equal(body.content.text, outcome.answer); assert.deepEqual(body.receipt, outcome.publication);
 const old = successful(cli('publication', '--session', d, '--run', outcome.runId, '--revision', '1')); assert.deepEqual(old, body);
 assert.equal(successful(cli('publication-revisions', '--session', d, '--run', outcome.runId)).length, 1);
 assert.deepEqual(successful(cli('publication-event', '--session', d, '--run', outcome.runId)).receipt, outcome.publication);
 const artifacts = await openArtifactStore({ directory: outcome.directory, readOnly: true }); const report = await artifacts.read(outcome.receipt.artifactId);
 assert.ok(report.bytes.equals(await readFile(join(outcome.directory, 'report.md')))); assert.equal(report.sha256, outcome.receipt.sha256); assert.notEqual(outcome.publication.payloadHash, outcome.receipt.sha256);
});
test('8.2 separate CLI resume confirms original receipt without duplicate report or model budget', async () => {
 const d = await directory(); const first = successful(cli('start', '--session', d, '--case', 'durable-publication')); const before = await stat(join(first.directory, 'report.md'));
 const second = successful(cli('resume', '--session', d, '--run', first.runId)); assert.deepEqual(second.publication, first.publication); assert.deepEqual(second.rootUsage, first.rootUsage); assert.equal((await stat(join(first.directory, 'report.md'))).mtimeMs, before.mtimeMs);
});
test('8.2 Publication read commands do not create missing databases or accept extra options', async () => {
 const root = await directory(); const absent = join(root, 'missing');
 for (const action of ['publication', 'publication-revisions', 'publication-event']) { const result = cli(action, '--session', absent, '--run', 'unknown'); assert.equal(result.status, 2); assert.match(result.stderr, /SESSION_NOT_FOUND/); }
 await assert.rejects(stat(absent), { code: 'ENOENT' });
 for (const args of [['publication', '--revision', '0'], ['publication', '--revision', '1', '--revision', '2'], ['publication-event', '--revision', '1'], ['publication', '--case', 'durable-publication'], ['start', '--revision', '1']]) {
  const result = cli(...args, '--session', root, ...(args[0] === 'start' ? [] : ['--run', 'unknown'])); assert.equal(result.status, 2); assert.match(result.stderr, /INVALID_ARGUMENT/);
 }
 await assert.rejects(stat(join(root, 'session.sqlite')), { code: 'ENOENT' });
});
