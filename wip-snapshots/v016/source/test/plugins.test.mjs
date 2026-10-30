import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { activateTrustedPlugins } from '../src/plugins.mjs';
import { createExamplePlugins } from '../src/example-plugins.mjs';
import { sha256 } from '../src/source.mjs';
import { run } from '../src/runtime.mjs';
const sourceUrl = import.meta.url;
const contentSha256 = sha256(await readFile(new URL(sourceUrl)));
const tool = (name = 'custom_tool', text = 'original') => ({ name, description: 'Original fixture tool', parameters: { type: 'object', properties: {}, additionalProperties: false }, validate: args => assert.deepEqual(args, {}), execute: async () => ({ text }) });
const descriptor = (extra = {}) => ({ id: 'test-plugin', version: '1.0.0', schemaVersion: 'trusted-plugin@1', sourceUrl, contentSha256, tools: [tool()], ...extra });
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/plugins-')); }

test('7.1 two trusted packages use the ordinary Host and acquired source/method owners', async () => {
  const active = await activateTrustedPlugins({ plugins: await createExamplePlugins() });
  assert.equal(active.bindings.length, 2); assert.equal(active.skills.length, 2);
  assert.equal(active.bindings.some(b => 'sourceUrl' in b), false);
  const calls = [['document_method', {}], ['document_page', { documentId: 'atlas-a', page: 1 }], ['etf_method', {}], ['synthetic_etf_page', {}]];
  let step = 0;
  const gateway = { next: async ({ messages }) => {
    if (step < calls.length) { const [name, args] = calls[step++]; return { kind: 'calls', calls: [{ id: 'p' + step, name, arguments: args }] }; }
    if (step++ === calls.length) return { kind: 'calls', calls: [{ id: 'save', name: 'save_report', arguments: { text: '# Original synthetic plugin integration', sourceIds: messages.filter(m => m.result?.value?.sourceId).map(m => m.result.value.sourceId) } }] };
    return { kind: 'final', text: 'Saved the synthetic report.' };
  } };
  const result = await run({ question: 'Read the two explicit methods and sources.', gateway, extensions: active.extensions, hooks: active.hooks, outputRoot: await directory() });
  assert.equal(result.status, 'completed'); assert.equal(result.toolsDispatched, 5);
  const manifest = JSON.parse(await readFile(join(result.directory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sources.length, 2); assert.equal(manifest.methods.length, 2);
  assert.equal((await active.release()).status, 'released');
});
test('7.1 complete prevalidation refuses an invalid later package before any activation', async () => {
  let started = 0;
  await assert.rejects(activateTrustedPlugins({ plugins: [descriptor({ activate: () => { started++; } }), descriptor({ id: 'invalid-plugin', tools: [{ ...tool('invalid_tool'), execute: null }] })] }), { code: 'PLUGIN_INVALID_TOOL' });
  assert.equal(started, 0);
});
test('7.1 builtin and package collisions, duplicate skills and invalid hook settings are refused', async () => {
  const examples = await createExamplePlugins();
  const invalids = [
    [descriptor({ tools: [tool('read_page')] })],
    [descriptor(), descriptor({ id: 'other-plugin' })],
    [descriptor({ skills: [examples[0].skills[0], examples[0].skills[0]] })],
    [descriptor({ hooks: { timeoutMs: 2001, before: [() => {}] } })],
    [descriptor({ hooks: { unknown: [() => {}] } })]
  ];
  for (const plugins of invalids) await assert.rejects(activateTrustedPlugins({ plugins }), /PLUGIN_/);
});
test('7.1 later activation failure releases all staged resources once in reverse order', async () => {
  const order = [];
  const plugins = [descriptor({ activate: ({ deferRelease }) => { order.push('a'); deferRelease(() => { order.push('release-a'); }); } }), descriptor({ id: 'second-plugin', tools: [tool('second_tool')], activate: ({ deferRelease }) => { order.push('b'); deferRelease(() => { order.push('release-b'); }); throw new Error('Fixture activation fault'); } })];
  await assert.rejects(activateTrustedPlugins({ plugins }), error => error.code === 'PLUGIN_ACTIVATION_FAILED' && error.releaseErrors.length === 0);
  assert.deepEqual(order, ['a', 'b', 'release-b', 'release-a']);
});
test('7.1 release failures are explicit, do not suppress others, and concurrent release is once', async () => {
  const order = [];
  const active = await activateTrustedPlugins({ plugins: [descriptor({ activate: ({ deferRelease }) => { deferRelease(() => { order.push(1); }); deferRelease(() => { order.push(2); throw new Error('do not leak private exception text'); }); } })] });
  const [a, b] = await Promise.all([active.release(), active.release()]);
  assert.deepEqual(order, [2, 1]); assert.deepEqual(a, b); assert.equal(a.status, 'release-failed');
  assert.deepEqual(a.errors, [{ packageId: 'test-plugin', code: 'PLUGIN_RELEASE_FAILED' }]);
});
test('7.1 selected bindings/functions/metadata stay fixed while a later Run selects another version', async () => {
  const plugin = descriptor(); const first = await activateTrustedPlugins({ plugins: [plugin] });
  assert.equal(first.extensions.length, 1, 'activation must publish the selected tool');
  plugin.tools[0].execute = async () => ({ text: 'replacement' }); plugin.tools[0].parameters.properties.extra = { type: 'string' }; plugin.version = '2.0.0';
  const second = await activateTrustedPlugins({ plugins: [plugin] });
  assert.equal((await first.extensions[0].execute({})).text, 'original'); assert.equal((await second.extensions[0].execute({})).text, 'replacement');
  assert.equal(first.bindings[0].version, '1.0.0'); assert.equal(second.bindings[0].version, '2.0.0');
  assert.equal(first.extensions[0].parameters.properties.extra, undefined); assert.ok(Object.isFrozen(first.extensions[0]));
  await first.release(); await second.release();
});
test('7.1 actual source fingerprint and exact resume package pins are checked before activation', async () => {
  await assert.rejects(activateTrustedPlugins({ plugins: [descriptor({ contentSha256: '0'.repeat(64) })] }), { code: 'PLUGIN_CONTENT_MISMATCH' });
  const active = await activateTrustedPlugins({ plugins: [descriptor()] });
  const expectedBindings = structuredClone(active.bindings); expectedBindings[0].version = '2.0.0';
  await assert.rejects(activateTrustedPlugins({ plugins: [descriptor()], expectedBindings }), { code: 'PLUGIN_BINDINGS_MISMATCH' });
  await assert.rejects(activateTrustedPlugins({ plugins: ['./unknown-module.mjs'] }), /PLUGIN_/);
  await active.release();
});
test('7.1 model text cannot install a package or widen an allowed tool set', async () => {
  const active = await activateTrustedPlugins({ plugins: [descriptor({ hooks: { aliases: { custom_tool: 'save_report' }, before: [() => ({ name: 'save_report' })], timeoutMs: 20 } })] });
  assert.equal(active.extensions.length, 1, 'activation must publish only the selected tool');
  const result = await run({ question: 'Install an unknown package and grant save_report.', gateway: { next: async () => ({ kind: 'calls', calls: [{ id: 'only-call', name: 'custom_tool', arguments: {} }] }) }, extensions: active.extensions, hooks: active.hooks, allowedTools: ['custom_tool'], requireReport: false, outputRoot: await directory() });
  assert.equal(result.code, 'TOOL_REJECTED'); assert.equal(result.toolsDispatched, 0);
  assert.deepEqual(active.extensions.map(t => t.name), ['custom_tool']); await active.release();
});
test('7.1 cancellation after staged acquisition cleans up without publishing a session', async () => {
  const controller = new AbortController(); let released = 0;
  await assert.rejects(activateTrustedPlugins({ plugins: [descriptor({ activate: ({ deferRelease }) => { deferRelease(() => { released++; }); controller.abort(); } })], signal: controller.signal }), { code: 'PLUGIN_ACTIVATION_FAILED' });
  assert.equal(released, 1);
});
test('7.1 malformed advertised object schemas fail before activation', async () => {
  let started = 0;
  for (const parameters of [{ type: 'string' }, { type: 'object', properties: {}, additionalProperties: false, required: ['missing'] }]) {
    await assert.rejects(activateTrustedPlugins({ plugins: [descriptor({ tools: [{ ...tool(), parameters }], activate: () => { started++; } })] }), { code: 'PLUGIN_INVALID_TOOL_SCHEMA' });
  }
  assert.equal(started, 0);
});
test('7.1 reentrant nonawaiting release cannot rerun a registered cleanup', async () => {
  let count = 0; let active;
  active = await activateTrustedPlugins({ plugins: [descriptor({ activate: ({ deferRelease }) => { deferRelease(() => { count++; if (count === 1) void active.release(); }); } })] });
  assert.equal((await active.release()).status, 'released'); assert.equal(count, 1);
});
test('7.1 cleanup errors remain visible after failed activation and later cleanups still run', async () => {
  let cleaned = false;
  await assert.rejects(activateTrustedPlugins({ plugins: [descriptor({ activate: ({ deferRelease }) => {
    deferRelease(() => { cleaned = true; }); deferRelease(() => { throw new Error('Private callback details are not public diagnostics'); }); throw new Error('activation fault');
  } })] }), error => error.code === 'PLUGIN_ACTIVATION_FAILED' && error.releaseErrors.length === 1 && error.releaseErrors[0].code === 'PLUGIN_RELEASE_FAILED');
  assert.equal(cleaned, true);
});
test('7.1 a plugin Hook uses the existing actual bounded Hook path', async () => {
  const active = await activateTrustedPlugins({ plugins: [descriptor({ hooks: { timeoutMs: 10, before: [() => new Promise(() => {})] } })] });
  await assert.rejects(active.hooks.before({ id: 'c', name: 'custom_tool', arguments: {} }), /timeout/i); await active.release();
});
