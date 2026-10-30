import { openSession } from '../../src/session.mjs';
import { run } from '../../src/runtime.mjs';
import { taskTimeMessage } from '../../src/temporal.mjs';
const [directory, runId, clock, stop] = process.argv.slice(2);
const store = await openSession({ directory, clock: () => Number(clock), leaseMs: 1000 });
try {
 const saved = store.inspect(runId);
 const gateway = { mode: 'test', async next({ messages }) {
  if (JSON.stringify(messages[1]) !== JSON.stringify(taskTimeMessage(saved.definition.config.taskTime))) throw new Error('TEMPORAL_RESTORE_CHANGED');
  process.send({ kind: 'input', messages }); return { kind: 'final', text: 'original task date ' + saved.definition.config.taskTime.taskDate };
 } };
 const result = await run({ question: saved.definition.question, gateway, requireReport: false, durable: { store, runId, grantId: saved.definition.grantId, bindings: saved.definition.bindings, onCheckpoint: async ({ phase }) => {
  if (phase === 'working-input' && stop === 'stop') { process.send({ kind: 'checkpoint' }); await new Promise(() => {}); }
 } } });
 process.send({ kind: 'outcome', result });
} finally { store.close(); }
