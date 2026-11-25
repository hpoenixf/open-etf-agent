import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, readdir, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { buildEvalObservation } from '../src/eval-observation.mjs';

const cmd = promisify(execFile);
const entry = fileURLToPath(new URL('../src/public-eval-cli.mjs', import.meta.url));
const legacy = fileURLToPath(new URL('../src/evaluate-cli.mjs', import.meta.url));
const cli = (...args) => cmd(process.execPath, [entry, ...args]);
const dirs = async t => {
  const dir = await mkdtemp(join(tmpdir(), 'open-eval-cli-'));
  t.after(() => rm(dir, {force:true, recursive:true}));
  return dir;
};

test('full run exports the legacy raw result; single-case coverage is explicit', async t => {
  const root = await dirs(t);
  const run = async (name, ...selection) => {
    const parent = join(root, name);
    const {stdout} = await cli('run', '--output', parent, ...selection);
    const result = JSON.parse(stdout);
    const [child] = await readdir(parent);
    const dir = join(parent, child);
    const file = join(dir, 'http-evaluation.json');
    assert.deepEqual(JSON.parse(await readFile(file)), result);
    return {result, dir, file};
  };
  const baseline = await run('first');
  assert.equal(baseline.result.transport, 'actual-loopback-http');
  assert.equal(baseline.result.modelCalls, 0);
  assert.deepEqual(baseline.result.cases.map(r => r.status), Array(4).fill('passed'));
  const candidate = await run('second', '--case', 'T4');
  assert.deepEqual(candidate.result.cases.map(r => r.status), ['not-run','not-run','not-run','passed']);
  assert.equal(candidate.result.cases[3].sourceWindowsVerified, 2);
  assert.equal(candidate.result.cases[3].semanticStatus, 'unreviewed');
  const observations = await readFile(join(candidate.dir, 'eval-observations.json'), 'utf8');
  const sidecar = JSON.parse(observations);
  assert.equal(sidecar.schemaVersion, 'open-etf-eval-observation@1');
  assert.equal(sidecar.remoteTelemetry, false);
  assert.deepEqual(sidecar.cases.map(r => r.timeline.status), ['not-run','not-run','not-run','available']);
  assert.equal(sidecar.cases[3].receipt.artifactId, candidate.result.cases[3].artifactId);
  assert.equal(sidecar.cases[3].receipt.verifiedByHttp, true);
  assert.equal(sidecar.cases[3].timeline.preSettlementSeen, true);
  assert.equal(sidecar.cases[3].timeline.toolResults.dispatched, 3);
  assert.ok(!observations.includes(candidate.dir));
  assert.ok(!/https?:|artifacts\/|Atlas Notes|"question"|"answer"/.test(observations));
  const input = join(candidate.dir, 'fixture-run.json');
  const recheck = await cmd(process.execPath, [legacy,'--input',input]);
  assert.deepEqual(JSON.parse(recheck.stdout), candidate.result);
  const delta = JSON.parse((await cli('compare', baseline.file, candidate.file)).stdout);
  assert.equal(delta.comparable, 1);
  assert.deepEqual(delta.cases.map(r=>r.change), ['not-comparable','not-comparable','not-comparable','unchanged']);

  // Prove a broken receipt cannot be promoted to a successful delivery check.
  const data = JSON.parse(await readFile(input));
  data.cases.find(r => r.caseId === 'T4').receipt.sha256 = '0'.repeat(64);
  const changedInput = join(root, 'corrupt.json'), failed = join(root, 'failed.json');
  await writeFile(changedInput, JSON.stringify(data));
  let failedResult;
  try { await cmd(process.execPath, [legacy,'--input',changedInput]); } catch(e) {
    assert.equal(e.code, 1); failedResult = JSON.parse(e.stdout);
  }
  assert.equal(failedResult.cases[3].code, 'HTTP_ARTIFACT_CHECK_FAILED');
  await writeFile(failed, JSON.stringify(failedResult));
  await assert.rejects(cli('compare', candidate.file, failed), e => e.code === 1 && JSON.parse(e.stdout).cases[3].change === 'regression');
});

test('CLI rejects unsupported options and malformed imported receipts', async t => {
  const root = await dirs(t);
  const invalid = join(root, 'invalid.json');
  await writeFile(invalid, JSON.stringify({denominator: 4, cases: []}));
  for (const args of [['run','--live'],['run','--case','T7'],['run','--case','T1','--case','T2'],['compare',invalid,invalid]]) {
    await assert.rejects(cli(...args), e => e.code === 2 && e.stdout === '');
  }
});


test('observation statuses diagnose actual missing, truncated, invalid and mismatched logs independently of delivery', async t => {
  const root = await dirs(t);
  const {stdout} = await cli('run', '--case', 'T4', '--output', root);
  const json = JSON.parse(stdout);
  const [child] = await readdir(root);
  const fixture = JSON.parse(await readFile(join(root, child, 'fixture-run.json'), 'utf8'));
  const run = fixture.cases[3];
  const log = join(run.directory, 'run.jsonl');
  const lines = (await readFile(log, 'utf8')).trimEnd().split('\n');
  const row = async () => (await buildEvalObservation(fixture, json)).cases[3];
  await writeFile(log, lines.slice(0, -1).join('\n') + '\n');
  assert.deepEqual([(await row()).timeline.status, (await row()).evaluation.status], ['incomplete','passed']);
  await writeFile(log, '.broken');
  assert.deepEqual((await row()).timeline, {status:'unavailable',code:'RUN_LOG_UNREADABLE'});
  const last = JSON.parse(lines.at(-1));
  await writeFile(log, [...lines.slice(0, -1), JSON.stringify({...last, runId:'different-run'})].join('\n') + '\n');
  assert.deepEqual((await row()).timeline, {status:'mismatch',code:'TIMELINE_RUN_MISMATCH'});
  await writeFile(log, [...lines.slice(0, -1), JSON.stringify({...last, status:'failed'})].join('\n') + '\n');
  assert.deepEqual((await row()).timeline, {status:'mismatch',code:'TIMELINE_OUTCOME_MISMATCH'});
  await unlink(log);
  assert.deepEqual((await row()).timeline, {status:'unavailable',code:'RUN_LOG_MISSING'});
  assert.equal((await row()).receipt.verifiedByHttp, true);

  json.cases[3] = {...json.cases[3], status:'failed', code:'HTTP_ARTIFACT_CHECK_FAILED'};
  const failure = await row();
  assert.equal(failure.runtime.status, 'completed');
  assert.equal(failure.evaluation.code, 'HTTP_ARTIFACT_CHECK_FAILED');
  assert.equal(failure.receipt.verifiedByHttp, false);
});
