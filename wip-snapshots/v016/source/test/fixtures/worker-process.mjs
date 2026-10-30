import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { submitRun } from '../../src/runtime.mjs';
import { workRun } from '../../src/worker.mjs';
import { openSession } from '../../src/session.mjs';

const [directory, action, runId, pause = '', tick] = process.argv.slice(2);
if (!['submit', 'submit-expiring', 'work'].includes(action) || !runId) throw new Error('Invalid synthetic Worker process');
const leaseTick=Number(tick);if(!Number.isSafeInteger(leaseTick)||leaseTick<1)throw new Error('INVALID_FIXTURE_LEASE_CLOCK');
// Shared test-only lease clock; do not replace Runtime's original wall-clock deadline.
const store = await openSession({ directory, leaseMs: 100, clock:()=>leaseTick }); const stop = new AbortController();
const shutdown = () => stop.abort(); process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
const send = value => process.send?.({ ...value, pid: process.pid });
try {
 const options = { question: 'Synthetic independent Worker process.', outputRoot: join(directory, 'runs'), requireReport: false, publication: true,
  limits: { maxRounds: 3, maxTools: 3, timeoutMs: 5000 },
  gateway: { mode: 'fixture', async next({ signal }) {
   await appendFile(join(directory, 'synthetic-model-attempts.txt'), 'synthetic-call\n');
   if (pause === 'pending') {
    send({ kind: 'barrier', phase: 'model-pending', runId }); signal.throwIfAborted();
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
   }
   return { kind: 'final', text: 'Original answer from the independently invoked Worker.' };
  } },
  durable: { store, runId, grantId: 'synthetic-worker-process', ...(action === 'submit-expiring' ? { deadlineAt: Date.now() + 200 } : {}),
   bindings: { gateway: { mode: 'fixture', provider: 'synthetic', protocol: 'fixture@1', model: 'worker-process', version: '1' }, plugins: [], adapters: [{ id: 'publication', version: 'publication@1' }] },
   async onCheckpoint(value) { if (pause === 'sealed' && value.phase === 'proposal-sealed') { send({ kind: 'barrier', ...value }); await new Promise(() => {}); } },
   async onPublication(value) { if (pause === 'committed') { send({ kind: 'committed', ...value }); await new Promise(() => {}); } }
  }
 };
 if (action.startsWith('submit')) send({ kind: 'submitted', run: await submitRun(options) });
 else { const observation = await workRun({ ...options, hostSignal: stop.signal }); send({ kind: 'observation', observation }); if (observation.workerStatus !== 'settled' || observation.run.status !== 'completed') process.exitCode = 1; }
} catch (error) { send({ kind: 'fixture-error', code: error.code || 'SYNTHETIC_WORKER_FAILED' }); process.exitCode = 2; }
finally { process.off('SIGTERM', shutdown); process.off('SIGINT', shutdown); store.close(); process.disconnect?.(); }
