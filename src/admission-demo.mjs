import { createServer } from 'node:http';
import { fork } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createSharedAdmission } from './admission.mjs';

const scenario = process.argv[2] ?? 'normal';
if (!['normal', 'unknown'].includes(scenario)) throw new Error('Usage: node src/admission-demo.mjs [normal|unknown] [output-directory]');
const parent = resolve(process.argv[3] ?? 'output/admission-demo');
await mkdir(parent, { recursive: true });
const directory = await mkdtemp(join(parent, `${scenario}-`));
const admission = await createSharedAdmission({ directory: join(directory, 'capacity'), routeId: 'offline-fixed-route' });
const workers = [], requests = [], observations = [];
let active = 0, maximum = 0;
function observe(stage) {
  const record = { stage, requests: requests.length, tickets: admission.snapshot().requests.map(({ ticketId, runId, state, modelOrdinal }) => ({ ticketId, runId, state, modelOrdinal })) };
  observations.push(record); process.stdout.write(JSON.stringify(record) + '\n');
}
async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { if (Date.now() >= deadline) throw new Error('DEMO_WAIT_TIMEOUT'); await delay(10); }
}
function complete(res) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Synthetic completion.' }, finish_reason: 'stop' }] }));
}
const server = createServer(async (req, res) => {
  active++; maximum = Math.max(maximum, active); res.on('close', () => active--);
  for await (const _ of req) { /* Consume only synthetic input; do not retain request bodies. */ }
  requests.push(res);
  if (scenario === 'unknown') {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n');
    setTimeout(() => res.destroy(), 30);
  }
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/chat/completions`;
  function launch(runId) {
    const child = fork(new URL('./admission-demo-worker.mjs', import.meta.url), [JSON.stringify({ directory, endpoint, runId, stream: scenario === 'unknown', queueTimeoutMs: scenario === 'unknown' ? 200 : 2000 })], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
    let message;
    child.on('message', value => { message = value; });
    const done = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal, message })));
    workers.push({ child, done }); return done;
  }
  const first = launch('caller-a');
  await until(() => requests.length === 1);
  if (scenario === 'unknown') await first;
  const second = launch('caller-b');
  await until(() => admission.snapshot().requests.some(x => x.runId === 'caller-b' && x.state === 'queued'));
  observe(scenario === 'normal' ? 'A owns slot; B waits' : 'A outcome unknown; B cannot oversell');
  if (scenario === 'normal') {
    complete(requests[0]); await until(() => requests.length === 2); observe('A settled; B dispatched'); complete(requests[1]);
  }
  const results = await Promise.all([first, second]);
  if (results.some(x => x.code !== 0 || x.message?.error)) throw new Error('DEMO_WORKER_FAILED');
  observe('terminal capacity facts');
  const states = admission.snapshot().requests.map(x => x.state);
  if (JSON.stringify(states) !== JSON.stringify(scenario === 'normal' ? ['completed', 'completed'] : ['unknown', 'cancelled']) || maximum !== 1 || requests.length !== (scenario === 'normal' ? 2 : 1)) throw new Error('DEMO_INVARIANT_FAILED');
  const receipt = { scenario, qualification: 'offline loopback HTTP; not external provider acceptance', externalModelCalls: 0, maximumConcurrentHttp: maximum, requests: requests.length, originalRootModelDebits: results.map(x => x.message.run.rootUsage.model), observations, recovery: 'Inspect original tickets. Unknown/dispatched work has no automatic release, refund or resend.' };
  await writeFile(join(directory, 'receipt.safe.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ receipt: join(directory, 'receipt.safe.json'), retainedSyntheticState: directory }) + '\n');
} finally {
  for (const { child } of workers) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await Promise.all(workers.map(x => x.done));
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); admission.close();
}
