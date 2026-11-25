import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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
