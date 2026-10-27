import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createToolHost } from '../src/tools.mjs';
const digest = s => createHash('sha256').update(s).digest('hex');
async function setup() {
  await mkdir('test-output', { recursive: true });
  const directory = await mkdtemp(resolve('test-output/tool-'));
  return { directory, host: await createToolHost({ directory }) };
}
const invoke = (host, id, name, args) => host.execute({ id, name, arguments: args });

test('1.1 exact original page identity and snapshot', async () => {
  const { host } = await setup();
  const result = await invoke(host, 'r1', 'read_page', { documentId: 'atlas-a', page: 1 });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.callId, 'r1');
  assert.equal(result.value.version, 'A-2026-01');
  assert.equal(result.value.page, 1);
  assert.match(result.value.text, /120 rows/);
  assert.equal(result.value.sha256, digest(result.value.text));
});
test('1.1 numerical total and increment ratios retain explicit inputs', async () => {
  const { host } = await setup();
  const args = { baseline: 120, current: 300, baselineUnit: 'rows/export', currentUnit: 'rows/export' };
  const result = await invoke(host, 'c1', 'calculate_change', args);
  assert.equal(result.status, 'succeeded');
  assert.deepEqual(result.value.inputs, args);
  assert.equal(result.value.difference, 180);
  assert.equal(result.value.ratio, 2.5);
  assert.equal(result.value.increaseRatio, 1.5);
});
test('1.1 rejects unknown tool, traversal, page and extra output paths before dispatch', async () => {
  const { host } = await setup();
  for (const [name, args] of [ ['shell', {}], ['read_page', { documentId: '../secret', page: 1 }], ['read_page', { documentId: 'atlas-a', page: 0 }], ['save_report', { text: 'x', sourceIds: [], path: '../x' }], ['calculate_change', { baseline: 0, current: 3, baselineUnit: 'rows', currentUnit: 'rows' }], ['calculate_change', { baseline: 2, current: 3, baselineUnit: 'USD', currentUnit: 'EUR' }] ]) {
    const r = await invoke(host, 'reject-' + name + JSON.stringify(args), name, args);
    assert.equal(r.status, 'rejected'); assert.equal(r.dispatched, false);
  }
});
test('1.2 actual save receipt and immutable report/source readback', async () => {
  const { host, directory } = await setup();
  const a = await invoke(host, 'a', 'read_page', { documentId: 'atlas-a', page: 1 });
  const b = await invoke(host, 'b', 'read_page', { documentId: 'atlas-b', page: 1 });
  const saved = await invoke(host, 's', 'save_report', { text: '# Comparison\nB adds Markdown; exports remain online.', sourceIds: [a.value?.sourceId, b.value?.sourceId] });
  assert.equal(saved.status, 'succeeded');
  const bytes = await readFile(join(directory, 'report.md'));
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  assert.equal(digest(bytes), saved.value.sha256);
  assert.equal(manifest.receipt.sha256, digest(bytes));
  assert.equal(manifest.sources.length, 2);
  assert.equal(manifest.sources[0].text, a.value.text);
  assert.match(bytes.toString(), /A-2026-01/); assert.match(bytes.toString(), /B-2026-02/);
  const again = await invoke(host, 's2', 'save_report', { text: 'different', sourceIds: [a.value.sourceId] });
  assert.equal(again.status, 'rejected');
  assert.deepEqual(await readFile(join(directory, 'report.md')), bytes);
});
test('1.2 forged unread source cannot save', async () => {
  const { host } = await setup();
  const r = await invoke(host, 's', 'save_report', { text: 'made up', sourceIds: ['atlas-a:1'] });
  assert.equal(r.status, 'rejected'); assert.equal(r.dispatched, false);
});
test('1.2 symlink run directory is refused', async () => {
  const { directory } = await setup();
  const link = directory + '-link'; await symlink(directory, link);
  await assert.rejects(createToolHost({ directory: link }), /symlink|directory/i);
});
