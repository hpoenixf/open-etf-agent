import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/financial-chart-producer.py', import.meta.url));
const runtime = process.env.OPEN_ETF_CHART_TEST_SOURCE
  ? new URL(process.env.OPEN_ETF_CHART_TEST_SOURCE, 'file:///')
  : new URL('../src/', import.meta.url);
const { suppliedChartDatasets } = await import(new URL('financial-chart-input.mjs', runtime));
const { compileFinancialChart } = await import(new URL('financial-chart.mjs', runtime));
const hasPython = spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
const profileCases = [
  ['financial-share', 'pie', '%', 'period,数值\n一季度,60\n二季度,30', ['数值']],
  ['financial-columns', 'bar', 'CNY million', 'period,数值\n一季度,"1,123.5"\n二季度,', ['数值']],
  ['financial-trend', 'line', 'x', 'period,数值\n2025-06-30,2\n2025-09-30,3', ['数值']],
  ['financial-stacked', 'stacked', 'count', 'period,数值,关联\nQ2,2,-3\nQ3,4,5', ['数值', '关联']],
  ['financial-multi-line', 'multi-line', '%', 'period,数值,关联\n2025-06-30,2,-3\n2025-09-30,,5', ['数值', '关联']],
  ['financial-area', 'area', 'count', 'period,数值\n2025-06-30,2\n2025-09-30,3', ['数值']],
  ['financial-combo', 'combo', 'CNY', 'period,数值,关联\nQ2,2,-3\nQ3,4,5', ['数值', '关联']],
  ['financial-heatmap', 'heatmap', 'USD million', 'period,数值,关联\nQ2,2,-3\nQ3,4,5', ['数值', '关联']],
  ['financial-ohlc', 'candlestick', 'CNY/share', 'period,O,H,L,C\n2025-06-30,10,12,9,11\n2025-09-30,,,,',
    ['O', 'H', 'L', 'C'], ['--ohlc-label', '合成股价']],
];

test('Python datasets round-trip all nine chart profiles through the real JS runtime', { skip: !hasPython }, async () => {
  for (const [kind, expectedChart, unit, input, columns, extra = []] of profileCases) {
    const result = spawnSync('python3', ['-B', script, '-', '--kind', kind, '--as-of', '2025-09-30',
      '--unit', unit, '--key-column', 'period', ...columns.flatMap(name => ['--value-column', name]),
      ...extra, '--fenced'], { input, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr || kind);
    const data = JSON.parse(result.stdout.trim().split('\n')[1]);
    const datasets = suppliedChartDatasets(result.stdout, 'test-run');
    assert.equal(datasets.length, 1, kind);
    const { receipts } = datasets[0];
    const compiled = await compileFinancialChart({
      runId: 'test-run',
      selection: { kind, receiptIds: receipts.map(receipt => receipt.receiptId) },
      readCommittedEvidence: ({ receiptId }) => receipts.find(receipt => receipt.receiptId === receiptId),
    });
    assert.deepEqual(compiled.series.map(({ label, values }) => ({ label, values })), data.series);
    assert.deepEqual(compiled.keys, data.keys);
    assert.equal(compiled.chart, expectedChart);
    assert.equal(compiled.provenance, 'user-supplied', 'format conversion must not elevate provenance');
  }
});
