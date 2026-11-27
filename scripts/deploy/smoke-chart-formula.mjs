import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

assert.equal(process.argv.length, 3, 'usage: node smoke-chart-formula.mjs UNPACKED_ARTIFACT');
const runtime = pathToFileURL(resolve(process.argv[2], 'dist/src/financial-chart-compute.mjs'));
const { chartComputeAvailable, openChartCompute } = await import(runtime);
assert.equal(chartComputeAvailable(), true, 'deployed service user cannot access the chart formula interpreter or worker');
const result = await openChartCompute().execute({ script: 'sum(x)', inputs: { x: [1, 2] } }, { callId: 'restore-smoke' });
assert.equal(result.status, 'computed', result.reason);
assert.equal(result.value, 3);
console.log('packaged chart formula smoke passed');
