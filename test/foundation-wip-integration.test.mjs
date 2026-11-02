import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openSession } from '../src/session.mjs';
import { DOCUMENT_REVOCATION_PROFILE as profile } from '../src/source.mjs';
import { run } from '../src/runtime.mjs';
import { initialize, gateway, options, bindings } from './protected-runtime-fixture.mjs';

async function fixture(t) {
  await mkdir('test-output', { recursive: true });
  const directory = await mkdtemp(resolve('test-output/foundation-wip-'));
  const store = await openSession({ directory, profile });
  t.after(async () => { store.close(); await rm(directory, { recursive: true, force: true }); });
  return { directory, store, authority: await initialize(store), outputRoot: join(directory, 'runs') };
}

test('foundation consumer admission preserves protected default tools, exact terminal readback and current revocation', async t => {
  const f = await fixture(t), model = gateway();
  const initial = options(f.store, f.outputRoot, model, { contextBytes: 32000 });
  const outcome = await run(initial);
  assert.equal(outcome.status, 'completed', outcome.code);
  assert.equal(outcome.gatewayOutcome, 'settled');
  assert.equal(model.calls, 4);
  const saved = f.store.inspect(outcome.runId);
  assert.deepEqual(saved.definition.config.allowedTools, ['search_pages', 'read_page', 'read_result', 'create_csv', 'save_report']);
  assert.deepEqual(saved.rootUsage, { model: 4, tool: 3 });
  assert.equal(saved.snapshot.gatewayOutcome, 'settled');
  assert.ok(f.store.protectedOutput(outcome.runId));
  assert.ok(f.store.publication(outcome.runId));
  const resumed = gateway();
  const resumeOptions = options(f.store, f.outputRoot, resumed, {
    contextBytes: 32000,
    durable: { store: f.store, bindings, grantId: 'protected-local-fixture', runId: outcome.runId }
  });
  assert.deepEqual(await run(resumeOptions), outcome);
  assert.equal(resumed.calls, 0);
  f.store.revokeDocument({ authorityId: f.authority.authorityId, libraryId: f.authority.libraryId, documentId: 'atlas-a', expectedRevision: 1 });
  await assert.rejects(run(resumeOptions), /DOCUMENT_REVOKED/);
  assert.equal(resumed.calls, 0);
  assert.deepEqual(f.store.inspect(outcome.runId).rootUsage, saved.rootUsage);
});

test('foundation integration does not enable a live protected Gateway or replace its fixture-only rejection', async t => {
  const f = await fixture(t);
  let calls = 0;
  // No transport is constructed: this negative is an injected callback only.
  const model = { mode: 'live', async next() { calls++; throw Error('MUST_NOT_DISPATCH'); } };
  const liveBindings = { ...bindings, gateway: { ...bindings.gateway, mode: 'live' } };
  await assert.rejects(run(options(f.store, f.outputRoot, model, {
    contextBytes: 32000,
    durable: { store: f.store, bindings: liveBindings, grantId: 'protected-local-fixture' }
  })), { code: 'PROTECTED_EXECUTION_UNSUPPORTED' });
  assert.equal(calls, 0);
});
