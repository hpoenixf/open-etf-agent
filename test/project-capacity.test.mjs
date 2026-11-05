import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { fork } from 'node:child_process';
import {
  createResearchProject, updateResearchProject, submitResearchTask,
  inspectResearchTask, inspectResearchRequests, workResearchTask
} from '../src/research-project.mjs';
import { importProjectSources } from '../src/project-sources.mjs';

const authorization = { providerApproved: true, dataApproved: true, costApproved: true };
const apiKey = 'synthetic-capacity-placeholder-not-a-secret';
const children = new WeakMap();
const config = (gateway = {}) => ({
  schemaVersion: 'research-project@1', capabilities: ['report'], limits: { timeoutMs: 15000 },
  gateway: { mode: 'live', provider: 'synthetic', protocol: 'chat-completions',
    endpoint: 'https://synthetic.invalid/v1/chat/completions', model: 'model-one',
    apiKeyEnv: 'SYNTHETIC_CAPACITY_KEY', ...gateway }
});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const reply = (stream = false) => stream
  ? new Response('data: {"choices":[{"index":0,"delta":{"content":"Synthetic capacity-only response."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  : new Response(JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop',
  message: { role: 'assistant', content: 'Synthetic capacity-only response.' } }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
{ headers: { 'content-type': 'application/json' } });

async function setup(t, gateway) {
  await mkdir('test-output', { recursive: true });
  const root = await mkdtemp(resolve('test-output/project-capacity-owned-'));
  if (!children.has(t)) children.set(t, []);
  t.after(async () => {
    for (const worker of children.get(t)) if (!worker.outcome) worker.child.kill('SIGKILL');
    await Promise.all(children.get(t).map(worker => worker.done));
    await rm(root, { recursive: true, force: true });
  });
  const project = await createResearchProject({ directory: root, config: config(gateway) });
  const source = join(root, 'synthetic-source.txt');
  await writeFile(source, 'Entirely synthetic selected evidence.');
  const bundle = await importProjectSources({ projectDir: root, files: [source] });
  const request = runId => ({ projectDir: root, runId, question: 'Check the synthetic evidence.',
    sourceManifestSha256: bundle.manifestSha256, authorization });
  return { root, project, request };
}

async function ticket(request) {
  return (await inspectResearchRequests({ ...request,
    reservations: [{ rootId: request.runId, modelOrdinal: 1 }] }))[0];
}

async function readOriginalBytes(request, definition) {
  return Promise.all([
    join(request.projectDir, 'project.json'),
    join(request.projectDir, 'tasks', `${request.runId}.json`),
    join(request.projectDir, 'sessions', request.runId, 'session.sqlite'),
    join(request.projectDir, 'admission', definition.admission.groupId, 'admission.sqlite')
  ].map(path => readFile(path)));
}

function working(options) {
  const promise = workResearchTask(options);
  // Also retain failures until the assertion/finally path joins this worker.
  promise.catch(() => {});
  return promise;
}

function reservedWorking(options) {
  const checkpoint = deferred();
  const promise = working({ ...options, onCheckpoint({ phase }) { if (phase === 'model-reserved') checkpoint.resolve(); } });
  return { promise, reserved: checkpoint.promise };
}

// The deadline detects a stuck test. Assertions use a persisted ticket or a
// transport-entry barrier, never "no call after a short sleep" as evidence.
async function observedTicket(request) {
  const deadline = Date.now() + 10000;
  for (;;) {
    // Session's cold reader refuses a journal while a writer checkpoints. Wait
    // for a readable fact instead of opening/recovering the writer's database.
    const current = await ticket(request).catch(error => {
      if (error.code !== 'SESSION_READ_SIDECAR_UNSUPPORTED') throw error;
      return null;
    });
    if (current) return current;
    assert.ok(Date.now() < deadline, `No original Admission ticket for ${request.runId}`);
    await nextTurn();
  }
}

function controlledTransport() {
  const calls = [], entered = deferred(), release = deferred();
  const fetchImpl = async (url, options, context) => {
    assert.equal(new URL(url).hostname, 'synthetic.invalid');
    assert.equal(options.method, 'POST');
    assert.ok(Object.isFrozen(context));
    calls.push({ endpoint: String(url), wire: JSON.parse(options.body), context });
    entered.resolve();
    await release.promise;
    return reply(JSON.parse(options.body).stream);
  };
  return { calls, entered: entered.promise, release: release.resolve, fetchImpl };
}

for (const [label, revision] of [
  ['model', { model: 'model-two' }],
  ['stream', { stream: true }],
  ['credential alias', { apiKeyEnv: 'SYNTHETIC_OTHER_KEY' }],
  ['provider display name', { provider: 'synthetic-alias' }],
  ['normalized host and default port', { endpoint: 'https://SYNTHETIC.invalid:443/v1/chat/completions' }]
]) test(`same endpoint ${label} revision shares the original project K=1 Admission`, { timeout: 20000 }, async t => {
  const f = await setup(t), a = f.request('revision-a'), b = f.request('revision-b');
  await submitResearchTask(a);
  const original = await inspectResearchTask(a), originalBytes = await readFile(join(f.root, 'tasks', 'revision-a.json'));
  const transport = controlledTransport(), stopB = new AbortController();
  const workers = [working({ ...a, apiKey, fetchImpl: transport.fetchImpl })];
  try {
    await transport.entered;
    const originalTicket = await ticket(a);
    assert.equal(originalTicket.state, 'dispatched');
    await updateResearchProject({ projectDir: f.root, config: config(revision),
      expectedConfigSha256: f.project.configSha256 });
    await submitResearchTask(b);
    const pending = reservedWorking({ ...b, apiKey, fetchImpl: transport.fetchImpl, signal: stopB.signal });
    workers.push(pending.promise);
    await pending.reserved;
    const second = await observedTicket(b);
    assert.equal(second.state, 'queued', `same endpoint must not dispatch a second request after a ${label} revision`);
    assert.equal(transport.calls.length, 1);
    assert.deepEqual(await ticket(a), originalTicket);
    assert.deepEqual(await readFile(join(f.root, 'tasks', 'revision-a.json')), originalBytes);
    const reread = await inspectResearchTask(a);
    assert.deepEqual(reread.definition, original.definition);
    assert.deepEqual(reread.run.definition, original.run.definition);
    transport.release();
    await Promise.all(workers);
    assert.equal(transport.calls.length, 2);
    assert.deepEqual(transport.calls.map(call => call.context.rootId), ['revision-a', 'revision-b']);
    assert.equal(transport.calls[1].wire.model, revision.model ?? 'model-one');
    assert.equal(transport.calls[1].wire.stream, revision.stream ?? false);
    assert.equal((await ticket(a)).ticketId, originalTicket.ticketId);
    assert.equal((await ticket(a)).state, 'completed');
    assert.equal((await ticket(b)).state, 'completed');
  } finally {
    stopB.abort();
    transport.release();
    await Promise.allSettled(workers);
  }
});

for (const endpoint of [
  'https://synthetic.invalid/v2/chat/completions',
  'https://synthetic.invalid:8443/v1/chat/completions'
]) test(`different endpoint remains independent: ${endpoint}`, { timeout: 20000 }, async t => {
  const f = await setup(t), a = f.request('endpoint-a'), b = f.request('endpoint-b');
  await submitResearchTask(a);
  const transport = controlledTransport(), workers = [working({ ...a, apiKey, fetchImpl: transport.fetchImpl })];
  try {
    await transport.entered;
    await updateResearchProject({ projectDir: f.root, config: config({ endpoint }), expectedConfigSha256: f.project.configSha256 });
    await submitResearchTask(b);
    const pending = reservedWorking({ ...b, apiKey, fetchImpl: transport.fetchImpl });
    workers.push(pending.promise);
    await pending.reserved;
    assert.equal((await observedTicket(b)).state, 'dispatched');
    assert.equal((await ticket(a)).state, 'dispatched');
    assert.equal(transport.calls.length, 2);
    assert.equal(transport.calls[1].endpoint, endpoint);
  } finally {
    transport.release();
    await Promise.allSettled(workers);
  }
});

test('same live endpoint in different projects is independent, not an account-global capacity guarantee', { timeout: 20000 }, async t => {
  const f = await setup(t), g = await setup(t), a = f.request('project-a'), b = g.request('project-b');
  await submitResearchTask(a); await submitResearchTask(b);
  const transport = controlledTransport(), workers = [working({ ...a, apiKey, fetchImpl: transport.fetchImpl })];
  try {
    await transport.entered;
    const pending = reservedWorking({ ...b, apiKey, fetchImpl: transport.fetchImpl });
    workers.push(pending.promise);
    await pending.reserved;
    assert.equal((await observedTicket(b)).state, 'dispatched');
    assert.equal((await ticket(a)).state, 'dispatched');
    assert.equal(transport.calls.length, 2);
  } finally {
    transport.release();
    await Promise.allSettled(workers);
  }
});

function launch(t, request, { inspect = false, unknown = false } = {}) {
  const child = fork(new URL('./fixtures/project-capacity-worker.mjs', import.meta.url),
    [JSON.stringify({ projectDir: request.projectDir, runId: request.runId, inspect, unknown })],
    { execPath: process.execPath, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { PATH: `${process.execPath.slice(0, process.execPath.lastIndexOf('/'))}:${process.env.PATH ?? ''}` } });
  const messages = [], entered = deferred(), reserved = deferred();
  let stderr = '', outcome;
  child.stderr.on('data', value => { stderr += value; });
  child.on('message', value => { messages.push(value); if (value.type === 'transport') entered.resolve(value); if (value.type === 'reserved') reserved.resolve(); });
  const done = new Promise(resolve => child.once('exit', (code, signal) => { outcome = { code, signal, messages, stderr }; resolve(outcome); }));
  const send = message => { if (child.connected) child.send(message); };
  const worker = { child, messages, entered: entered.promise, reserved: reserved.promise, done, send, get outcome() { return outcome; } };
  children.get(t).push(worker);
  return worker;
}

async function succeeded(worker) {
  const result = await worker.done;
  assert.equal(result.code, 0, JSON.stringify(result));
  assert.equal(result.messages.some(m => m.type === 'error'), false, JSON.stringify(result));
  return result.messages.find(m => ['result', 'inspection'].includes(m.type));
}

test('two original Project worker processes contend across model revision and cold-read original tickets', { timeout: 20000 }, async t => {
  const f = await setup(t), a = f.request('process-a'), b = f.request('process-b');
  await submitResearchTask(a);
  const first = launch(t, a);
  await first.entered;
  const before = await ticket(a);
  assert.equal(before.state, 'dispatched');
  await updateResearchProject({ projectDir: f.root, config: config({ model: 'model-two' }), expectedConfigSha256: f.project.configSha256 });
  await submitResearchTask(b);
  const second = launch(t, b);
  try {
    await second.reserved;
    assert.equal((await observedTicket(b)).state, 'queued');
    assert.equal(second.messages.filter(m => m.type === 'transport').length, 0);
    first.send('release');
    await succeeded(first);
    const entered = await second.entered;
    assert.equal(entered.wire.model, 'model-two');
    assert.equal((await ticket(a)).state, 'completed');
    second.send('release');
    await succeeded(second);
    const original = await ticket(a), definition = (await inspectResearchTask(a)).definition;
    const bytes = await readOriginalBytes(a, definition), cold = await succeeded(launch(t, a, { inspect: true }));
    assert.deepEqual(cold.ticket, { ...original });
    assert.deepEqual(await readOriginalBytes(a, definition), bytes);
    assert.equal(original.ticketId, before.ticketId);
    assert.equal(original.reservationId, before.reservationId);
    assert.equal(cold.task.definition.config.gateway.model, 'model-one');
    assert.equal(cold.task.run.rootUsage.model, 1);
    assert.equal(first.messages.filter(m => m.type === 'transport').length, 1);
    assert.equal(second.messages.filter(m => m.type === 'transport').length, 1);
  } finally {
    first.send('release'); second.send('release');
    await Promise.all([first.done, second.done]);
  }
});

for (const state of ['unknown', 'dispatched']) test(`${state} original request survives revision and cold process; stopped queued worker never calls fetch`, { timeout: 20000 }, async t => {
  const f = await setup(t), a = f.request('occupied-a'), b = f.request('stopped-b');
  await submitResearchTask(a);
  const before = await inspectResearchTask(a), originalBytes = await readFile(join(f.root, 'tasks', 'occupied-a.json'));
  const first = launch(t, a, { unknown: state === 'unknown' });
  await first.entered;
  if (state === 'unknown') await succeeded(first);
  else { assert.equal(first.child.kill('SIGKILL'), true); assert.equal((await first.done).signal, 'SIGKILL'); }
  const original = await ticket(a);
  assert.equal(original.state, state);
  await updateResearchProject({ projectDir: f.root,
    config: config({ model: 'model-two', stream: true, apiKeyEnv: 'SYNTHETIC_OTHER_KEY' }),
    expectedConfigSha256: f.project.configSha256 });
  await submitResearchTask(b);
  const second = launch(t, b);
  try {
    await second.reserved;
    assert.equal((await observedTicket(b)).state, 'queued');
    const bytes = await readOriginalBytes(a, before.definition), cold = await succeeded(launch(t, a, { inspect: true }));
    assert.deepEqual(cold.ticket, { ...original });
    assert.deepEqual(await readOriginalBytes(a, before.definition), bytes);
    assert.deepEqual(cold.task.definition, before.definition);
    assert.deepEqual(cold.task.run.definition, before.run.definition);
    assert.deepEqual(await readFile(join(f.root, 'tasks', 'occupied-a.json')), originalBytes);
    if (state === 'unknown') assert.equal(cold.task.run.snapshot.gatewayOutcome, 'unknown');
    second.send('stop');
    const stopped = await succeeded(second);
    assert.equal(stopped.result.workerStatus, 'interrupted');
    assert.equal(second.messages.filter(m => m.type === 'transport').length, 0);
    assert.equal((await ticket(b)).state, 'cancelled');
    assert.deepEqual(await ticket(a), original);
  } finally {
    second.send('stop'); second.send('release');
    await second.done;
  }
});

test('concurrent original request reads do not mistake a newly reserved model ordinal for a foreign owner', { timeout: 20000 }, async t => {
  const f = await setup(t);
  for (let ordinal = 0; ordinal < 12; ordinal++) {
    const request = f.request(`read-race-${ordinal}`);
    await submitResearchTask(request);
    const transport = controlledTransport();
    const running = working({ ...request, apiKey, fetchImpl: transport.fetchImpl });
    try {
      // Deliberately do not wait for model-reserved: this reader may capture
      // root usage 0 before Admission open yields to the worker's reservation.
      // observedTicket retries only Session's explicit sidecar read refusal,
      // never PROJECT_REQUEST_OWNER or another ownership/integrity failure.
      const original = await observedTicket(request);
      assert.equal(original.rootId, request.runId);
      assert.equal(original.runId, request.runId);
      assert.equal(original.modelOrdinal, 1);
      assert.equal(original.state, 'dispatched');
      assert.equal(transport.calls.length, 1);
    } finally {
      transport.release();
      await running;
    }
  }
});

test('missing original unknown owner cannot be recreated by old work or a new same-endpoint submission', { timeout: 20000 }, async t => {
  const f = await setup(t), a = f.request('missing-owner-a'), b = f.request('missing-owner-b');
  await submitResearchTask(a);
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Synthetic transport outcome unknown.'); };
  await workResearchTask({ ...a, apiKey, fetchImpl });
  const original = await ticket(a), { definition } = await inspectResearchTask(a);
  assert.equal(original.state, 'unknown');
  const owner = join(f.root, 'admission', definition.admission.groupId), held = join(f.root, 'synthetic-owner-held');
  const bytes = await readFile(join(owner, 'admission.sqlite'));
  await updateResearchProject({ projectDir: f.root, config: config({ model: 'model-two' }), expectedConfigSha256: f.project.configSha256 });
  await rename(owner, held);
  try {
    await assert.rejects(workResearchTask({ ...a, apiKey, fetchImpl }), error => error.code === 'PROJECT_CAPACITY_OWNER_MISSING');
    await assert.rejects(submitResearchTask(b), error => error.code === 'PROJECT_CAPACITY_OWNER_MISSING');
    assert.equal(calls, 1);
    await assert.rejects(readFile(join(owner, 'admission.sqlite')), error => error.code === 'ENOENT');
    await assert.rejects(readFile(join(f.root, 'tasks', 'missing-owner-b.json')), error => error.code === 'ENOENT');
    assert.deepEqual(await readFile(join(held, 'admission.sqlite')), bytes);
  } finally {
    // Only this test-owned path can contain a wrongly recreated empty owner.
    // Keep the held original intact and avoid masking the primary assertion.
    await rm(owner, { recursive: true, force: true });
    await rename(held, owner);
  }
  assert.deepEqual(await ticket(a), original);
  assert.deepEqual(await readFile(join(owner, 'admission.sqlite')), bytes);
  await submitResearchTask(b);
  assert.equal((await inspectResearchTask(b)).run.rootUsage.model, 0);
  assert.deepEqual(await ticket(a), original);
  assert.equal(calls, 1);
});
