import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const execute = promisify(execFile);
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/v03-cli-')); }
test('3.5 batch-read and fixture-child produce Main-owned actual receipts', async () => {
  for (const mode of ['batch-read', 'fixture-child']) {
    const { stdout } = await execute(process.execPath, ['src/cli.mjs', '--case', mode, '--output', await directory()], { timeout: 15000 });
    const result = JSON.parse(stdout); assert.equal(result.status, 'completed'); assert.equal(result.caseId, mode); assert.equal(result.semanticStatus, 'unreviewed'); assert.ok(result.observations.some(e => e.observation === 'run-release'));
    const manifest = JSON.parse(await readFile(join(result.directory, 'manifest.json'), 'utf8')); assert.equal(manifest.sources.length, 2); assert.equal(manifest.receipt.operationId, 'main-save');
    assert.equal(result.rootUsage.tool, 4); assert.equal(result.rootUsage.model, mode === 'batch-read' ? 3 : 6);
  }
});
test('3.5 model-child name refuses unsupported live claim before creating a run', async () => {
  await assert.rejects(execute(process.execPath, ['src/cli.mjs', '--case', 'model-child', '--output', await directory()], { timeout: 5000 }), error => /MODEL_CHILD_BLOCKED/.test(error.stderr));
});
test('3.5 observe returns metadata without question or tool arguments', async () => {
  const directoryPath = await directory();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(directoryPath, 'run.jsonl'), [
    { runId: 'run-example', sequence: 1, type: 'run_started', question: 'private test prompt' },
    { runId: 'run-example', sequence: 2, type: 'model_proposal', kind: 'calls', callIds: ['c1'], durationMs: 1, usage: null, cost: null },
    { runId: 'run-example', sequence: 3, type: 'tool_result', callId: 'c1', name: 'read_page', status: 'succeeded', dispatched: true, original: { arguments: { secret: 'omit' } }, durationMs: 2 }
  ].map(row => JSON.stringify(row)).join('\n') + '\n');
  const { stdout } = await execute(process.execPath, ['src/cli.mjs', '--observe', directoryPath], { timeout: 5000 });
  const result = JSON.parse(stdout); assert.equal(result.entries.length, 3); assert.equal(result.entries[1].usage, null); assert.equal(result.entries[1].cost, null); assert.equal(result.entries[2].callId, 'c1'); assert.doesNotMatch(stdout, /private test prompt|secret|omit|arguments/);
});
test('3.5 observe strips nested provider content and invalid typed metadata', async () => {
  const directoryPath = await directory(); const { writeFile } = await import('node:fs/promises');
  const { readTimeline } = await import('../src/observe.mjs');
  await writeFile(join(directoryPath, 'run.jsonl'), JSON.stringify({ runId: 'run-safe', sequence: 1, type: 'model_proposal', kind: 'calls', name: { prompt: 'NESTED_NAME_SECRET' }, callIds: ['safe', { sourceText: 'NESTED_ID_SECRET' }], usage: { total_tokens: 5, prompt_tokens: -1, completion_tokens: 'NESTED_COUNT_SECRET', prompt: 'NESTED_USAGE_SECRET', sourceText: 'NESTED_SOURCE_SECRET' }, cost: { privateText: 'NESTED_COST_SECRET' } }) + '\n');
  const result = await readTimeline(directoryPath); const output = JSON.stringify(result);
  assert.doesNotMatch(output, /NESTED_|privateText|sourceText/); assert.deepEqual(result.entries[0].usage, { total_tokens: 5 }); assert.equal(result.entries[0].cost, null); assert.equal(result.entries[0].name, undefined); assert.equal(result.entries[0].callIds, undefined);
});
