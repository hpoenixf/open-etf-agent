import { join } from 'node:path';
import { openSession } from './session.mjs';
import { createSharedAdmission } from './admission.mjs';
import { createChatGateway } from './gateway.mjs';
import { run, submitRun } from './runtime.mjs';

const config = JSON.parse(process.argv[2]);
const localEndpoint = new URL(config.endpoint);
if (localEndpoint.protocol !== 'http:' || localEndpoint.hostname !== '127.0.0.1' || localEndpoint.pathname !== '/chat/completions') throw new Error('OFFLINE_LOOPBACK_REQUIRED');
const session = await openSession({ directory: join(config.directory, 'session'), leaseMs: 300 });
const admission = await createSharedAdmission({ directory: join(config.directory, 'capacity'), routeId: 'offline-fixed-route', queueTimeoutMs: config.queueTimeoutMs ?? 2000, pollMs: 10 });
const controller = new AbortController();
process.on('message', message => { if (message === 'cancel') controller.abort(); });
const original = createChatGateway({ endpoint: 'https://offline-fixture.invalid/chat/completions', model: 'synthetic', apiKey: 'synthetic-not-a-credential',
  authorization: { providerApproved: true, syntheticDataApproved: true, costApproved: true }, stream: config.stream === true,
  fetchImpl: async (_url, options) => fetch(config.endpoint, options) });
const gateway = admission.wrap(original, { session, runId: config.runId });
const bindings = { gateway: { mode: 'live', provider: 'offline-fixture', protocol: 'chat-completions', model: 'synthetic', version: '1' }, plugins: [], adapters: [] };
try {
  const options = { question: config.runId, gateway, requireReport: false, outputRoot: join(config.directory, 'runs'), signal: controller.signal,
    limits: { maxRounds: 2, maxTools: 2, timeoutMs: 5000 },
    durable: { store: session, runId: config.runId, grantId: 'offline-grant', bindings, rootLimits: { model: 2, tool: 2 } } };
  await submitRun(options);
  const result = await run(options);
  process.send?.({ result: { status: result.status, code: result.code }, run: session.inspect(config.runId), capacity: admission.snapshot() });
} catch (error) { process.send?.({ error: error.code ?? error.message }); process.exitCode = 1; }
finally { admission.close(); session.close(); process.disconnect?.(); }
