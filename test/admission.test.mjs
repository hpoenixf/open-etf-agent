import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fork } from 'node:child_process';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createSharedAdmission } from '../src/admission.mjs';
import { openSession } from '../src/session.mjs';
import { createChatGateway } from '../src/gateway.mjs';
import { run as executeRun, submitRun } from '../src/runtime.mjs';

const bindings = { gateway: { mode: 'live', provider: 'offline-fixture', protocol: 'chat-completions', model: 'synthetic', version: '1' }, plugins: [], adapters: [] };
async function run(options) {
  await submitRun(options);
  return executeRun(options);
}
async function waitFor(predicate, label, timeout = 4000) { const start = Date.now(); for (;;) { const value = predicate(); if (value) return value; if (Date.now() - start > timeout) throw new Error(`Timed out: ${label}`); await delay(10); } }
async function fixture(handler) {
  await mkdir('test-output', { recursive: true }); const directory = await mkdtemp(resolve('test-output/admission-'));
  const session = await openSession({ directory: join(directory, 'session'), leaseMs: 300 });
  const admission = await createSharedAdmission({ directory: join(directory, 'capacity'), routeId: 'offline-fixed-route', queueTimeoutMs: 2000, pollMs: 10 });
  const requests = []; const children = []; let active = 0; let maximum = 0;
  const server = createServer(async (req, res) => {
    active++; maximum = Math.max(maximum, active); res.on('close', () => active--);
    let body = ''; for await (const chunk of req) body += chunk;
    const record = { question: JSON.parse(body).messages[0].content, res }; requests.push(record);
    await handler(record, requests);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/chat/completions`;
  const launch = (runId, extra = {}) => {
    const child = fork(new URL('./fixtures/admission-worker.mjs', import.meta.url), [JSON.stringify({ directory, endpoint, runId, ...extra })], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }); children.push(child);
    let message; let stderr = ''; child.on('message', value => { message = value; }); child.stderr.on('data', chunk => { stderr += chunk; });
    const done = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal, message, stderr })));
    return { child, done };
  };
  return { directory, session, admission, requests, launch, endpoint, maximum: () => maximum,
    async close() { for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null ? null : new Promise(resolve => child.once('exit', resolve)))); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); admission.close(); session.close(); } };
}
function complete(res, finish = 'stop') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Synthetic completion.' }, finish_reason: finish }], usage: { total_tokens: 1 } })); }

test('two original Gateway workers share one slot; settled original ticket survives acknowledgement loss', { timeout: 12000 }, async () => {
  const f = await fixture(() => {});
  try {
    const a = f.launch('first'); await waitFor(() => f.requests.length === 1, 'first dispatch');
    const b = f.launch('second'); await waitFor(() => f.admission.snapshot().requests.some(x => x.state === 'queued'), 'second queued');
    assert.equal(f.requests.length, 1); complete(f.requests[0].res);
    await waitFor(() => f.requests.length === 2, 'second dispatch'); complete(f.requests[1].res);
    const [ar, br] = await Promise.all([a.done, b.done]); assert.equal(ar.code, 0, ar.stderr); assert.equal(br.code, 0, br.stderr);
    assert.equal(ar.message.result.status, 'completed'); assert.equal(br.message.result.status, 'completed'); assert.equal(f.maximum(), 1);
    const tickets = f.admission.snapshot().requests; assert.deepEqual(tickets.map(x => x.state), ['completed', 'completed']);
    for (const ticket of tickets) { assert.deepEqual(f.admission.inspect(ticket.ticketId), f.admission.inspectReservation(ticket)); assert.equal(f.session.inspect(ticket.runId).rootUsage.model, 1); }
    // Deliberately discard worker result and reopen: receipt lookup itself makes no request.
    const reopened = await createSharedAdmission({ directory: join(f.directory, 'capacity'), routeId: 'offline-fixed-route' });
    assert.deepEqual(reopened.inspect(tickets[0].ticketId), tickets[0]); reopened.close(); assert.equal(f.requests.length, 2);
  } finally { await f.close(); }
});

test('queued cancellation makes no request; complete remote cancellation releases the slot', { timeout: 12000 }, async () => {
  const f = await fixture(() => {});
  try {
    const a = f.launch('cancel-owner'); await waitFor(() => f.requests.length === 1, 'first dispatch');
    const b = f.launch('cancel-queued'); await waitFor(() => f.admission.snapshot().requests.some(x => x.runId === 'cancel-queued' && x.state === 'queued'), 'queued');
    b.child.send('cancel'); const br = await b.done; assert.equal(br.code, 0, br.stderr); assert.equal(f.requests.length, 1);
    complete(f.requests[0].res, 'aborted'); await a.done;
    assert.deepEqual(f.admission.snapshot().requests.map(x => x.state), ['cancelled', 'cancelled']);
    const c = f.launch('after-cancel'); await waitFor(() => f.requests.length === 2, 'next after remote termination'); complete(f.requests[1].res); assert.equal((await c.done).message.result.status, 'completed');
  } finally { await f.close(); }
});

test('HTTP 200 half stream retains unknown and queue timeout never refunds or retries', { timeout: 12000 }, async () => {
  const f = await fixture(({ res }) => { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n'); setTimeout(() => res.destroy(), 30); });
  try {
    const a = await f.launch('half-stream', { stream: true }).done; assert.equal(a.code, 0, a.stderr);
    assert.equal(f.admission.snapshot().requests[0].state, 'unknown');
    const b = await f.launch('blocked-after-unknown', { queueTimeoutMs: 100 }).done; assert.equal(b.code, 0, b.stderr);
    assert.equal(f.requests.length, 1); assert.equal(f.admission.snapshot().requests[1].state, 'cancelled');
    assert.equal(f.session.inspect('half-stream').rootUsage.model, 1); assert.equal(f.session.inspect('blocked-after-unknown').rootUsage.model, 1);
  } finally { await f.close(); }
});

test('killed dispatched process stays occupied; killed queued process expires without dispatch', { timeout: 12000 }, async () => {
  const f = await fixture(() => {});
  try {
    const a = f.launch('killed-dispatched'); await waitFor(() => f.requests.length === 1, 'dispatch');
    const b = f.launch('killed-queued', { queueTimeoutMs: 150 }); await waitFor(() => f.admission.snapshot().requests.some(x => x.runId === 'killed-queued'), 'queue');
    b.child.kill('SIGKILL'); await b.done; a.child.kill('SIGKILL'); await a.done; await delay(180);
    const c = await f.launch('still-blocked', { queueTimeoutMs: 100 }).done; assert.equal(c.code, 0, c.stderr);
    const tickets = f.admission.snapshot().requests; assert.equal(tickets[0].state, 'dispatched'); assert.equal(tickets[1].state, 'cancelled'); assert.equal(f.requests.length, 1);
  } finally { await f.close(); }
  const recoveredQueue = await fixture(() => {});
  try {
    const a = recoveredQueue.launch('queue-recovery-owner'); await waitFor(() => recoveredQueue.requests.length === 1, 'queue recovery owner');
    const b = recoveredQueue.launch('queue-recovery-killed', { queueTimeoutMs: 150 });
    await waitFor(() => recoveredQueue.admission.snapshot().requests.some(x => x.runId === 'queue-recovery-killed'), 'queue recovery waiter');
    b.child.kill('SIGKILL'); await b.done; await delay(180); complete(recoveredQueue.requests[0].res); await a.done;
    const c = recoveredQueue.launch('queue-recovery-next'); await waitFor(() => recoveredQueue.requests.length === 2, 'queue recovered');
    complete(recoveredQueue.requests[1].res); assert.equal((await c.done).message.result.status, 'completed');
    assert.equal(recoveredQueue.admission.snapshot().requests[1].state, 'cancelled');
    assert.equal(recoveredQueue.requests.some(x => x.question === 'queue-recovery-killed'), false);
  } finally { await recoveredQueue.close(); }
});

test('unsupported compaction is rejected before its callback or original HTTP transport', async () => {
  const f = await fixture(({ res }) => complete(res)); let summaries = 0;
  try {
    const original = createChatGateway({ endpoint: 'https://offline-fixture.invalid/chat/completions', model: 'synthetic', apiKey: 'synthetic', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, fetchImpl: (_url, options) => fetch(f.endpoint, options) });
    await assert.rejects(run({ question: 'unsupported', gateway: f.admission.wrap(original, { session: f.session, runId: 'unsupported' }), workingInput: { compaction: { thresholdBytes: 1, summarize: async () => { summaries++; } } }, durable: { store: f.session, runId: 'unsupported', grantId: 'offline-grant', bindings } }), /ADMISSION_EXECUTION_UNSUPPORTED/);
    assert.equal(summaries, 0); assert.equal(f.requests.length, 0); assert.equal(f.admission.snapshot().requests.length, 0);
  } finally { await f.close(); }
});

test('same-root concurrent debit cannot change the original reservation ordinal', { timeout: 12000 }, async () => {
  const f = await fixture(({ res }) => complete(res));
  try {
    const original = createChatGateway({ endpoint: 'https://offline-fixture.invalid/chat/completions', model: 'synthetic', apiKey: 'synthetic', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, fetchImpl: (_url, options) => fetch(f.endpoint, options) });
    let duplicate, wrapped;
    wrapped = f.admission.wrap({ mode: original.mode, next(input) { duplicate = wrapped.next(input).then(() => null, error => error); return original.next(input); } }, { session: f.session, runId: 'debit-parent' });
    const result = await run({ question: 'original debit', requireReport: false, outputRoot: join(f.directory, 'runs'), gateway: wrapped,
      durable: { store: f.session, runId: 'debit-parent', grantId: 'offline-grant', bindings, rootLimits: { model: 3, tool: 3 },
        onCheckpoint({ phase }) {
          if (phase !== 'model-reserved') return;
          const parent = f.session.inspect('debit-parent');
          const child = f.session.create({ runId: 'concurrent-debit-child', parentRunId: parent.runId, rootId: parent.rootId,
            parentClaim: { owner: parent.owner, fence: parent.fence }, directory: f.directory,
            definition: { ...parent.definition, config: { ...parent.definition.config, taskId: 'reserve-only' } }, snapshot: { schemaVersion: 'runtime-checkpoint@1', phase: 'ready' } });
          const claim = f.session.claim(child.runId, 'concurrent-owner'); claim.reserve('model');
          // This synthetic reservation-only child dispatches nothing; finish it explicitly.
          claim.finish({ schemaVersion: 'runtime-checkpoint@1', phase: 'terminal', status: 'cancelled' });
        } } });
    assert.equal(result.status, 'completed', result.code); assert.equal(f.session.inspect('debit-parent').rootUsage.model, 2);
    assert.equal(f.admission.snapshot().requests[0].modelOrdinal, 1); assert.equal(f.requests.length, 1);
    const duplicateError = await duplicate; assert.equal(duplicateError.code, 'ADMISSION_ALREADY_RECORDED');
    assert.equal(duplicateError.ticketId, f.admission.snapshot().requests[0].ticketId);
  } finally { await f.close(); }
});

for (const revoke of ['cancel-root', 'takeover-fence']) test(`observed ${revoke} while queued prevents original HTTP dispatch`, { timeout: 12000 }, async () => {
  const f = await fixture(() => {}); let takeover;
  try {
    const a = f.launch(`block-${revoke}`); await waitFor(() => f.requests.length === 1, 'blocking dispatch');
    const b = f.launch(`queued-${revoke}`); await waitFor(() => f.admission.snapshot().requests.some(x => x.runId === `queued-${revoke}`), 'queued reservation');
    if (revoke === 'cancel-root') f.session.cancel(`queued-${revoke}`);
    else {
      takeover = await openSession({ directory: join(f.directory, 'session'), clock: () => Date.now() + 500, leaseMs: 300 });
      takeover.claim(`queued-${revoke}`, 'replacement-owner');
    }
    complete(f.requests[0].res); await Promise.all([a.done, b.done]);
    assert.equal(f.requests.length, 1); assert.equal(f.admission.snapshot().requests[1].state, 'cancelled');
  } finally { takeover?.close(); await f.close(); }
});

test('missing and forged Runtime reservation never call the original Gateway', async () => {
  const f = await fixture(({ res }) => complete(res)); let calls = 0;
  try {
    const wrapped = f.admission.wrap({ mode: 'fixture', async next() { calls++; return { kind: 'final', text: 'bad' }; } }, { session: f.session, runId: 'fake' });
    for (const reservation of [undefined, { rootId: 'fake', runId: 'fake', modelOrdinal: 1, round: 1, owner: 'fake', fence: 1, inputHash: 'a'.repeat(64) }]) {
      await assert.rejects(wrapped.next({ messages: [], tools: [], reservation }), /ADMISSION_RESERVATION_REQUIRED/);
    }
    assert.equal(calls, 0); assert.equal(f.requests.length, 0); assert.equal(f.admission.snapshot().requests.length, 0);
  } finally { await f.close(); }
});

test('ordinary local tool extensions remain usable through the managed Gateway', { timeout: 12000 }, async () => {
  let executions = 0;
  const f = await fixture(({ res }, requests) => {
    if (requests.length > 1) return complete(res);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'local-echo', type: 'function', function: { name: 'local_echo', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] }));
  });
  try {
    const original = createChatGateway({ endpoint: 'https://offline-fixture.invalid/chat/completions', model: 'synthetic', apiKey: 'synthetic', authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, fetchImpl: (_url, options) => fetch(f.endpoint, options) });
    let managed;
    const result = await executeRun({ question: 'local tool', requireReport: false, outputRoot: join(f.directory, 'runs'),
      gateway: { mode: original.mode, admission: 'shared-admission@1', next: input => managed.next(input) },
      extensions: [{ name: 'local_echo', description: 'A synthetic local tool.', parameters: { type: 'object', properties: {}, additionalProperties: false }, validate() {}, execute() { executions++; return { value: 'local' }; } }],
      durable: { store: f.session, grantId: 'offline-grant', bindings, onClaim({ runId }) { managed = f.admission.wrap(original, { session: f.session, runId }); } } });
    assert.equal(result.status, 'completed'); assert.equal(executions, 1); assert.equal(f.requests.length, 2);
    assert.deepEqual(f.admission.snapshot().requests.map(x => x.state), ['completed', 'completed']);
  } finally { await f.close(); }
});
