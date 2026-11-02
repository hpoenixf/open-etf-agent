import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.fetch = () => { throw new Error('OFFLINE_TEST_FETCH_FORBIDDEN'); };
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { run } from '../src/runtime.mjs';
import { openSession } from '../src/session.mjs';

const bindings = { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'timeout-bound', version: '1' }, plugins: [], adapters: [] };
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/task-timeout-')); }
const checkpoint = phase => ({ schemaVersion: 'runtime-checkpoint@1', phase });
const definition = timeoutMs => ({ question: 'Synthetic timeout bound only.', grantId: 'timeout-bound', bindings, limits: { maxRounds: 4, maxTools: 4, timeoutMs }, rootLimits: { model: 5, tool: 5 }, deadlineAt: 10000, config: {} });

test('Runtime accepts one-hour configured timeout and rejects one millisecond above before any model call', async () => {
  const d = await directory(), store = await openSession({ directory: d }); let calls = 0;
  const gateway = { mode: 'fixture', async next() { calls++; return { kind: 'final', text: 'Synthetic immediate result, no real-time wait.' }; } };
  try {
    const limits = { maxRounds: 36, maxTools: 72, timeoutMs: 3600000 }, rootLimits = { model: 57, tool: 72 };
    const before = Date.now(); const result = await run({ question: 'Synthetic configured duration.', outputRoot: d, gateway, requireReport: false, limits, durable: { store, grantId: 'timeout-bound', bindings, rootLimits } }); const after = Date.now();
    assert.equal(result.status, 'completed'); assert.equal(calls, 1); assert.deepEqual(result.rootUsage, { model: 1, tool: 0 });
    const saved = store.inspect(result.runId); assert.deepEqual(saved.definition.limits, limits); assert.deepEqual(saved.definition.rootLimits, rootLimits); assert.ok(saved.definition.deadlineAt >= before + 3600000 && saved.definition.deadlineAt <= after + 3600000);
    await assert.rejects(run({ question: 'Must reject oversized duration.', outputRoot: d, gateway, limits: { ...limits, timeoutMs: 3600001 } }), e => e.code === 'INVALID_LIMIT'); assert.equal(calls, 1);
  } finally { store.close(); }
});

test('Runtime defaults remain 24 rounds, 64 tools and 120 seconds', async () => {
  const d = await directory(), store = await openSession({ directory: d });
  try {
    const before = Date.now(); const result = await run({ question: 'Original defaults.', outputRoot: d, requireReport: false, gateway: { mode: 'fixture', async next() { return { kind: 'final', text: 'Defaults preserved.' }; } }, durable: { store, grantId: 'timeout-bound', bindings } }); const after = Date.now();
    const saved = store.inspect(result.runId); assert.equal(result.status, 'completed'); assert.deepEqual(saved.definition.limits, { maxRounds: 24, maxTools: 64, timeoutMs: 120000 }); assert.ok(saved.definition.deadlineAt >= before + 120000 && saved.definition.deadlineAt <= after + 120000);
  } finally { store.close(); }
});

test('Session accepts exact one-hour bound, rejects overflow and reopens old 300000 definitions without mutation or refund', async () => {
  const d = await directory(); let store = await openSession({ directory: d, clock: () => 100 }); const saved = [];
  try {
    for (const timeoutMs of [300000, 3600000]) {
      const originalDefinition = definition(timeoutMs); const created = store.create({ directory: d, definition: originalDefinition, snapshot: checkpoint('ready') });
      const claim = store.claim(created.runId, 'synthetic-owner'); claim.reserve('model', checkpoint('model-reserved')); claim.release(); saved.push({ runId: created.runId, definition: originalDefinition });
    }
    assert.throws(() => store.create({ directory: d, definition: definition(3600001), snapshot: checkpoint('ready') }), e => e.code === 'INVALID_DEFINITION');
  } finally { store.close(); }
  store = await openSession({ directory: d, clock: () => 100 });
  try {
    for (const original of saved) {
      const recovered = store.inspect(original.runId); assert.deepEqual(recovered.definition, original.definition); assert.deepEqual(recovered.rootUsage, { model: 1, tool: 0 });
      const cancelled = store.cancel(original.runId); assert.equal(cancelled.status, 'cancelled'); assert.deepEqual(cancelled.definition, original.definition); assert.deepEqual(cancelled.rootUsage, { model: 1, tool: 0 }); assert.deepEqual(store.cancel(original.runId), cancelled); assert.throws(() => store.claim(original.runId, 'late'), e => e.code === 'RUN_CANCELLED');
    }
  } finally { store.close(); }
});

test('larger configurable bound never extends an explicitly persisted deadline or relaxes other budgets', async () => {
  const d = await directory(); let now = 100; const store = await openSession({ directory: d, clock: () => now, leaseMs: 1000 });
  try {
    const originalDefinition = { ...definition(3600000), deadlineAt: 150 }; const created = store.create({ directory: d, definition: originalDefinition, snapshot: checkpoint('ready') }); const claim = store.claim(created.runId, 'synthetic-owner'); now = 151;
    assert.throws(() => claim.reserve('model', checkpoint('model-reserved')), e => e.code === 'DEADLINE_EXPIRED'); assert.equal(store.inspect(created.runId).definition.deadlineAt, 150); assert.deepEqual(store.inspect(created.runId).rootUsage, { model: 0, tool: 0 }); claim.finish({ ...checkpoint('terminal'), status: 'failed', code: 'TIMEOUT' }); assert.equal(store.inspect(created.runId).definition.deadlineAt, 150);
    assert.throws(() => store.create({ directory: d, definition: { ...definition(3600000), limits: { maxRounds: 1001, maxTools: 4, timeoutMs: 3600000 } }, snapshot: checkpoint('ready') }), e => e.code === 'INVALID_DEFINITION');
    await assert.rejects(run({ question: 'Original round bound.', outputRoot: d, gateway: { async next() { assert.fail('no model'); } }, limits: { maxRounds: 1001, maxTools: 1, timeoutMs: 3600000 } }), e => e.code === 'INVALID_LIMIT');
  } finally { store.close(); }
});

import {DOCUMENT_REVOCATION_PROFILE} from '../src/source.mjs';
import {initialize,gateway as protectedGateway,options as protectedOptions} from './protected-runtime-fixture.mjs';
test('one-hour protected execution keeps original fixture-only profile, default five tools and current Publication custody',async()=>{
 const d=await directory(),store=await openSession({directory:d,profile:DOCUMENT_REVOCATION_PROFILE});await initialize(store);
 try{
  const model=protectedGateway(),limits={maxRounds:36,maxTools:72,timeoutMs:3600000};const opts=protectedOptions(store,d,model,{limits});
  const result=await run(opts);assert.equal(result.status,'completed');assert.equal(model.calls,4);assert.deepEqual(result.rootUsage,{model:4,tool:3});assert.deepEqual(store.inspect(result.runId).definition.limits,limits);assert.deepEqual(store.inspect(result.runId).definition.config.allowedTools,['search_pages','read_page','read_result','create_csv','save_report']);assert.ok(result.receipt);assert.ok(result.publication);
  const denied=protectedGateway();denied.mode='live';const rejected={...opts,gateway:denied,durable:{...opts.durable,bindings:{...opts.durable.bindings,gateway:{...opts.durable.bindings.gateway,mode:'live'}}}};
  await assert.rejects(run(rejected),{code:'PROTECTED_EXECUTION_UNSUPPORTED'});assert.equal(denied.calls,0);assert.equal(model.calls,4);assert.deepEqual(store.publication(result.runId).receipt,result.publication);
 }finally{store.close();}
});
