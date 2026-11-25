import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { constants, mkdtemp, open } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRuns } from './evaluate.mjs';
import { buildEvalObservation } from './eval-observation.mjs';
import { ensureSafeDirectory, publishImmutable, safeDirectory } from './storage-files.mjs';

const ids = ['T1', 'T2', 'T3', 'T4'];
const help = [
  'npm run -s eval -- run [--case all|T1|T2|T3|T4] [--output <parent-directory>]',
  'npm run -s eval -- compare <baseline/http-evaluation.json> <candidate/http-evaluation.json>',
  'Fixture delivery checks only; no model calls, keys or GUI.',
].join('\n');
const invalid = () => { throw new Error('INVALID_ARGUMENT: run with --help'); };
const print = value => process.stdout.write(JSON.stringify(value, null, 2) + '\n');

async function run(args) {
  const options = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const [name, value] = args.slice(i, i + 2);
    if (!['--case', '--output'].includes(name) || options.has(name) || !value || value.startsWith('--')) invalid();
    options.set(name, value);
  }
  const choice = options.get('--case') ?? 'all';
  if (choice !== 'all' && !ids.includes(choice)) invalid();
  const parent = await ensureSafeDirectory(options.get('--output') ?? 'runs/eval');
  const directory = await mkdtemp(join(parent, 'eval-'));
  process.stderr.write('Local evaluation directory: ' + directory + '\n');

  // Invoke the same published fixture entry point as a standalone consumer.
  const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
  let output;
  try {
    output = (await promisify(execFile)(process.execPath, [cli, '--case', choice === 'all' ? 'document-compare' : choice, '--output', join(directory, 'artifacts')])).stdout;
  } catch (error) {
    // The producer returns 1 with a structured receipt on individual case failures.
    if (error.code !== 1 || !error.stdout) throw new Error('FIXTURE_RUNNER_FAILED');
    output = error.stdout;
  }
  const fixture = JSON.parse(output);
  await publishImmutable(directory, 'fixture-run.json', output);
  const report = await evaluateRuns({ cases: fixture.cases });
  await publishImmutable(directory, 'http-evaluation.json', JSON.stringify(report, null, 2) + '\n');
  print(report);
  try {
    const observation = await buildEvalObservation(fixture, report);
    await publishImmutable(directory, 'eval-observations.json', JSON.stringify(observation, null, 2) + '\n');
  } catch {
    process.stderr.write('EVAL_OBSERVATION_EXPORT_FAILED: HTTP evaluation is unchanged\n');
  }
  const selected = report.cases.filter(row => choice === 'all' || row.caseId === choice);
  if (selected.some(row => row.status !== 'passed')) process.exitCode = 1;
}

async function loadReport(path) {
  const absolute = resolve(path);
  await safeDirectory(dirname(absolute));
  const file = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    // The receipt consists of four small evidence rows; never load report bodies.
    const max = 128 * 1024;
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > max) throw new Error('INVALID_EVAL_REPORT');
    const bytes = Buffer.alloc(max + 1);
    let n = 0;
    while (n < bytes.length) {
      const { bytesRead } = await file.read(bytes, n, bytes.length - n);
      if (!bytesRead) break;
      n += bytesRead;
    }
    if (n > max) throw new Error('INVALID_EVAL_REPORT');
    const report = JSON.parse(bytes.subarray(0, n).toString('utf8'));
    if (report?.transport !== 'actual-loopback-http' || report.denominator !== 4 || report.modelCalls !== 0
        || !Array.isArray(report.cases) || report.cases.length !== ids.length) throw new Error('INVALID_EVAL_REPORT');
    const rows = new Map(report.cases.map(r => [r?.caseId, r]));
    for (const id of ids) {
      const r = rows.get(id);
      if (!r || r.semanticStatus !== 'unreviewed' || !['passed','failed','not-run'].includes(r.status)
          || (r.status === 'passed' && (r.reportBytesVerified !== true
              || ![r.sourceWindowsVerified, r.attachmentsVerified].every(x => Number.isSafeInteger(x) && x >= 0)
              || !/^artifact:sha256:[0-9a-f]{64}$/.test(r.artifactId) || !/^revision:sha256:[0-9a-f]{64}$/.test(r.revisionId) || !/^[0-9a-f]{64}$/.test(r.sha256)))
          || (r.status === 'failed' && typeof r.code !== 'string')) throw new Error('INVALID_EVAL_REPORT');
    }
    return rows;
  } finally { await file.close(); }
}

async function compare(args) {
  if (args.length !== 2 || args.some(x => !x || x.startsWith('--'))) invalid();
  const [before, after] = await Promise.all(args.map(loadReport));
  const cases = ids.map(caseId => {
    const a = before.get(caseId).status, b = after.get(caseId).status;
    const change = a === 'not-run' || b === 'not-run' ? 'not-comparable'
      : a === b ? 'unchanged' : b === 'failed' ? 'regression' : 'recovered';
    return {caseId, baseline: a, candidate: b, change};
  });
  print({denominator: 4, comparable: cases.filter(x => x.change !== 'not-comparable').length, cases, semanticStatus: 'unreviewed'});
  if (cases.some(x => x.change === 'regression')) process.exitCode = 1;
}

try {
  const [command, ...args] = process.argv.slice(2);
  if ((!command || command === '--help') && !args.length) process.stdout.write(help + '\n');
  else if (command === 'run') await run(args);
  else if (command === 'compare') await compare(args);
  else invalid();
} catch (error) {
  const message = /^INVALID_ARGUMENT|^INVALID_EVAL_REPORT|^FIXTURE_RUNNER_FAILED/.test(error.message)
    ? error.message : 'EVAL_CLI_FAILED: check input, directory and fixture runner';
  process.stderr.write(message + '\n');
  process.exitCode = 2;
}
