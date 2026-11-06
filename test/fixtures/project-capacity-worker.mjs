// Isolated public Project worker: all transport is synthetic, with no network.
import { workResearchTask, inspectResearchTask, inspectResearchRequests } from '../../src/research-project.mjs';

const { projectDir, runId, inspect, unknown } = JSON.parse(process.argv[2]);
const send = message => new Promise((resolve, reject) => process.send(message, error => error ? reject(error) : resolve()));
const host = new AbortController();
let release;
const released = new Promise(resolve => { release = resolve; });
process.on('message', message => { if (message === 'release') release(); if (message === 'stop') host.abort(); });
const response = stream => stream
  ? new Response('data: {"choices":[{"index":0,"delta":{"content":"Synthetic worker response."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
  : new Response(JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Synthetic worker response.' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { headers: { 'content-type': 'application/json' } });

try {
  if (inspect) {
    const task = await inspectResearchTask({ projectDir, runId });
    const [ticket] = await inspectResearchRequests({ projectDir, runId, reservations: [{ rootId: runId, modelOrdinal: 1 }] });
    await send({ type: 'inspection', task, ticket });
  } else {
    const result = await workResearchTask({ projectDir, runId, apiKey: 'synthetic-capacity-placeholder-not-a-secret', hostSignal: host.signal,
      async onCheckpoint({ phase }) { if (phase === 'model-reserved') await send({ type: 'reserved' }); },
      fetchImpl: async (url, options, context) => {
        if (new URL(url).hostname !== 'synthetic.invalid') throw new Error('SYNTHETIC_ENDPOINT_REQUIRED');
        const wire = JSON.parse(options.body);
        await send({ type: 'transport', endpoint: String(url), wire, context });
        if (unknown) throw new Error('Synthetic transport outcome unknown.');
        await released;
        return response(wire.stream);
      } });
    await send({ type: 'result', result: { workerStatus: result.workerStatus, observationCode: result.observationCode,
      status: result.run.status, snapshot: result.run.snapshot, rootUsage: result.run.rootUsage } });
  }
} catch (error) {
  await send({ type: 'error', code: error.code, message: error.message });
  process.exitCode = 1;
} finally {
  process.disconnect();
}
