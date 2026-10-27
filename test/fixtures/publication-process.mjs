import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../../src/runtime.mjs';
import { openSession } from '../../src/session.mjs';
const [directory, stop, runId] = process.argv.slice(2);
const store = await openSession({ directory, leaseMs: 100 });
try {
 const outcome = await run({ question: 'Synthetic crash-boundary answer.', outputRoot: join(directory, 'runs'), requireReport: false, publication: true,
  limits: { maxRounds: 3, maxTools: 3, timeoutMs: 5000 },
  gateway: { mode: 'fixture', async next() { await appendFile(join(directory, 'synthetic-model-attempts.txt'), 'synthetic-call\n'); return { kind: 'final', text: 'Committed synthetic body before terminal.' }; } },
  durable: { store, ...(runId ? { runId } : {}), grantId: 'synthetic-crash-grant', bindings: { gateway: { mode: 'fixture', provider: 'local', protocol: 'fixture@1', model: 'publication-crash', version: '1' }, plugins: [], adapters: [{ id: 'publication', version: 'publication@1' }] },
   async onPublication(value) { process.send?.({ kind: 'committed', ...value }); if (stop === 'after-commit') await new Promise(() => {}); }
  }
 });
 process.send?.({ kind: 'outcome', outcome });
 if (outcome.status !== 'completed') process.exitCode = 1;
} finally { store.close(); process.disconnect?.(); }
