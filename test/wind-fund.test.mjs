import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWindFundDailyClose } from '../src/wind-fund.mjs';

const query = { windCode: '588200.SH', beginDate: '2026-06-01', endDate: '2026-06-03' };
const apiKey = 'synthetic-test-key';
const data = {
  columns: [{ name: 'TIME' }, { name: 'MATCH' }, { name: 'Wind代码' }, { name: 'unused' }],
  rows: [
    ['2026-06-03', 1.35, '588200.SH', 'never expose'],
    ['2026-06-01', '1.25', '588200.SH', 'never expose']
  ]
};
const initialized = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'mock-wind', version: '1.0.0' } };
const standardResult = { content: [{ type: 'text', text: JSON.stringify({ data }) }] };

const replaceRows = rows => ({ data: { ...data, rows } });
const toolSuccess = payload => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] });

function mock({ result = standardResult, sse = false, rejectAt, status, onCall } = {}) {
  const sends = [];
  const fetchFn = async (url, options) => {
    assert.equal(url, 'https://mcp.wind.com.cn/vserver_fund_data/mcp/');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.get('authorization'), 'Bearer ' + apiKey);
    assert.match(options.headers.get('accept'), /application\/json/);
    assert.match(options.headers.get('accept'), /text\/event-stream/);
    assert.equal(options.method, 'POST');
    const parsed = JSON.parse(options.body);
    sends.push(parsed.method);
    if (parsed.method === rejectAt) return new Response('private payload ignored', { status });
    if (parsed.method === 'notifications/initialized') return new Response(null, { status: 202 });
    const payload = parsed.method === 'initialize' ? initialized : result;
    if (parsed.method === 'tools/call') {
      assert.equal(options.headers.get('mcp-session-id'), 'synthetic-session');
      assert.equal(options.headers.get('mcp-protocol-version'), '2025-03-26');
      assert.deepEqual(parsed.params, {
        name: 'get_fund_kline',
        arguments: { windcode: '588200.SH', begin_date: '2026-06-01', end_date: '2026-06-03', period: '10', aftype: '2', issusp: '0' }
      });
      const custom = onCall?.(options.signal);
      if (custom !== undefined) return custom;
    }
    const body = JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: payload });
    const headers = new Headers({ 'mcp-session-id': 'synthetic-session', 'content-type': sse ? 'text/event-stream' : 'application/json' });
    return new Response(sse ? `event: message\ndata: ${body}\n\n` : body, { headers });
  };
  return { sends, fetchFn };
}

for (const sse of [false, true]) test(`real SDK accepts ${sse ? 'SSE' : 'JSON'} and returns only typed, sorted date/close rows`, async () => {
  const { fetchFn, sends } = mock({ sse });
  const result = await fetchWindFundDailyClose(query, { apiKey, fetchFn });
  assert.deepEqual(sends, ['initialize', 'notifications/initialized', 'tools/call']);
  assert.deepEqual(result, {
    schemaVersion: 'wind-fund-daily-close@1',
    source: { provider: 'Wind', domain: 'fund_data', tool: 'get_fund_kline', priceField: 'MATCH', period: '1d', adjustment: 'unadjusted', suspended: 'excluded-by-request' },
    ...query,
    asOf: '2026-06-03',
    identityConfirmation: 'response-column',
    rows: [{ date: '2026-06-01', close: 1.25 }, { date: '2026-06-03', close: 1.35 }]
  });
  assert.ok(!JSON.stringify(result).includes('synthetic'));
  assert.ok(!JSON.stringify(result).includes('never expose'));
});

test('bad queries and missing credentials are rejected before network', async () => {
  const { fetchFn, sends } = mock();
  for (const invalid of [
    { ...query, windCode: '005827.OF' }, { ...query, windCode: '588200.SH,159915.SZ' }, { ...query, beginDate: '2026-02-30' },
    { ...query, beginDate: '2026-01-01' }, { ...query, beginDate: '2026-06-04' }, { ...query, endpoint: 'https://example.com' }
  ]) await assert.rejects(fetchWindFundDailyClose(invalid, { apiKey, fetchFn }), { code: 'WIND_FUND_INVALID_QUERY' });
  await assert.rejects(fetchWindFundDailyClose(query, { fetchFn }), { code: 'WIND_FUND_KEY_REQUIRED' });
  await assert.rejects(fetchWindFundDailyClose(query, { apiKey: 'injected\nheader', fetchFn }), { code: 'WIND_FUND_KEY_REQUIRED' });
  assert.deepEqual(sends, []);
});

for (const [status, code] of [[401, 'WIND_FUND_AUTHENTICATION'], [403, 'WIND_FUND_FORBIDDEN'], [429, 'WIND_FUND_RATE_LIMIT'], [302, 'WIND_FUND_TRANSPORT_ERROR'], [500, 'WIND_FUND_TRANSPORT_ERROR']]) {
  test(`HTTP ${status} is classified without leaking response or retrying`, async () => {
    const { fetchFn, sends } = mock({ rejectAt: 'tools/call', status });
    await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn }), { message: code, code });
    assert.deepEqual(sends, ['initialize', 'notifications/initialized', 'tools/call']);
  });
}

test('business errors in both MCP and vendor envelopes fail closed', async () => {
  for (const result of [
    { isError: true, ...standardResult },
    toolSuccess({ ...replaceRows(data.rows), mcp_tool_error_code: 1, mcp_tool_error_msg: 'never expose' }),
    toolSuccess({ data: { ...data, code: 450 } }),
    toolSuccess({ data, ok: false, error: { message: 'never expose' } }),
    { ...toolSuccess({ mcp_tool_error_code: -1 }), structuredContent: { data } }
  ]) {
    await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn: mock({ result }).fetchFn }), { message: 'WIND_FUND_BUSINESS_ERROR' });
  }
});

test('rejects out-of-range, duplicate, wrong-identity, malformed or conflicting evidence', async () => {
  for (const result of [
    toolSuccess(replaceRows([['2026-06-04', 1.25, '588200.SH', '']])),
    toolSuccess(replaceRows([data.rows[0], data.rows[0]])),
    toolSuccess(replaceRows([['2026-06-03', 1.25, '159915.SZ', '']])),
    toolSuccess(replaceRows([['2026-06-03', 1.25, '588200.OF', '']])),
    toolSuccess(replaceRows([['2026-06-03', 0, '588200.SH', '']])),
    toolSuccess(replaceRows([['2026-06-03', 1.25]])),
    toolSuccess({ data: { ...data, columns: [{ name: 'TIME' }, { name: 'TIME' }, ...data.columns.slice(2)] } }),
    { ...standardResult, structuredContent: replaceRows([data.rows[0]]) }
  ]) {
    await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn: mock({ result }).fetchFn }), { message: 'WIND_FUND_INVALID_RESPONSE' });
  }
  await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn: mock({ result: toolSuccess(replaceRows([])) }).fetchFn }), { code: 'WIND_FUND_NO_DATA' });
});

test('accepts structured results without requiring arbitrary text to be emitted', async () => {
  const { fetchFn } = mock({ result: { content: [], structuredContent: { data } } });
  const typed = await fetchWindFundDailyClose(query, { apiKey, fetchFn });
  assert.equal(typed.rows.length, 2);
  assert.equal(typed.identityConfirmation, 'response-column');
  const anonymous = { data: { columns: data.columns.slice(0, 2), rows: data.rows.map(row => row.slice(0, 2)) } };
  const unconfirmed = await fetchWindFundDailyClose(query, { apiKey, fetchFn: mock({ result: toolSuccess(anonymous) }).fetchFn });
  assert.equal(unconfirmed.identityConfirmation, 'request-only');
});

test('fails closed on oversize response and caller abort, without subsequent retry', async () => {
  const { fetchFn, sends } = mock({ onCall: () => new Response('x'.repeat(262145), { headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn }), { code: 'WIND_FUND_RESPONSE_LIMIT' });
  assert.deepEqual(sends, ['initialize', 'notifications/initialized', 'tools/call']);
  const controller = new AbortController();
  const pending = mock({ onCall: () => {
    controller.abort(new Error('never expose'));
    return new Response(null, { status: 202 });
  } });
  await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn: pending.fetchFn, signal: controller.signal }), { message: 'WIND_FUND_ABORTED' });
  assert.deepEqual(pending.sends, ['initialize', 'notifications/initialized', 'tools/call']);
});

test('the overall deadline covers a stalled response without retrying', async () => {
  const { fetchFn, sends } = mock({ onCall: signal => new Promise((resolve, reject) => {
    const reference = setTimeout(() => reject(new Error('fixture timed out')), 1000);
    signal.addEventListener('abort', () => {
      clearTimeout(reference);
      reject(signal.reason);
    }, { once: true });
  }) });
  await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn, timeoutMs: 150 }), { message: 'WIND_FUND_TIMEOUT' });
  assert.deepEqual(sends, ['initialize', 'notifications/initialized', 'tools/call']);
});

test('response identity remains bound to the admitted request even if caller mutates its object', async () => {
  const mutable = { ...query };
  const { fetchFn } = mock({ onCall: () => { mutable.windCode = '159915.SZ'; } });
  const result = await fetchWindFundDailyClose(mutable, { apiKey, fetchFn });
  assert.equal(result.windCode, '588200.SH');
  assert.equal(result.identityConfirmation, 'response-column');
});

test('optional host diagnostic reports only recognized structure when a live-like result cannot normalize', async () => {
  const sensitive = 'SECRET-MUST-NOT-APPEAR';
  const shapeResult = toolSuccess({
    data: { columns: [{ name: 'TIME' }, { name: 'MATCH' }, { name: sensitive }], rows: [['2026-06-03 00:00:00', '1.25', sensitive]], [sensitive]: sensitive }
  });
  const { fetchFn, sends } = mock({ result: shapeResult });
  const shapes = [];
  await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn, onResponseShape: shape => shapes.push(shape) }), { code: 'WIND_FUND_INVALID_RESPONSE' });
  assert.deepEqual(sends, ['initialize', 'notifications/initialized', 'tools/call']);
  assert.equal(shapes.length, 1);
  assert.equal(shapes[0].schemaVersion, 'wind-fund-response-shape@1');
  const table = shapes[0].content[0].shape.wrappers.data;
  assert.deepEqual(table.columns.recognized, ['TIME', 'MATCH']);
  assert.deepEqual(table.columns.dateKinds, ['calendar-with-time']);
  assert.deepEqual(table.rows.widths, [3]);
  assert.equal(table.unknownKeyCount, 1);
  const json = JSON.stringify(shapes);
  for (const forbidden of [sensitive, apiKey, '2026-06-03', '1.25', 'synthetic-session', '588200.SH']) assert.ok(!json.includes(forbidden));
});

test('diagnostics never expose text or business error text and callback faults do not change the result', async () => {
  const sensitive = 'SECRET-MUST-NOT-APPEAR';
  const shapes = [];
  const result = {
    isError: true,
    content: [
      { type: 'text', text: sensitive },
      { type: 'text', text: JSON.stringify({ mcp_tool_error_code: 999999, mcp_tool_error_msg: sensitive }) }
    ]
  };
  const { fetchFn } = mock({ result });
  await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn, onResponseShape: shape => {
    shapes.push(shape);
    throw new Error(sensitive);
  } }), { message: 'WIND_FUND_BUSINESS_ERROR' });
  assert.equal(shapes[0].hasExplicitMcpError, true);
  assert.deepEqual(shapes[0].content[0], { type: 'text', encoding: 'plain-text' });
  assert.ok(!JSON.stringify(shapes).includes(sensitive));
  assert.ok(!JSON.stringify(shapes).includes('999999'));
});

test('a rejected async diagnostic callback does not alter a validated result', async () => {
  const { fetchFn } = mock();
  const result = await fetchWindFundDailyClose(query, { apiKey, fetchFn, onResponseShape: async () => {
    throw new Error('local callback rejection');
  } });
  assert.equal(result.asOf, '2026-06-03');
});

test('normalizes Private-compatible date forms without UTC rebucketing', async () => {
  const result = toolSuccess(replaceRows([
    ['20260603', '1.35', '588200.SH', ''],
    ['2026-06-01T00:10:00.000+08:00', '1.25', '588200.SH', '']
  ]));
  const value = await fetchWindFundDailyClose(query, { apiKey, fetchFn: mock({ result }).fetchFn });
  assert.deepEqual(value.rows, [{ date: '2026-06-01', close: 1.25 }, { date: '2026-06-03', close: 1.35 }]);
});

test('rejects invalid response timestamps and duplicates after date normalization', async () => {
  for (const rows of [
    [['2026-06-01T24:00:00.000+08:00', 1.25, '588200.SH', '']],
    [['2026-06-01T00:00:00.000+25:00', 1.25, '588200.SH', '']],
    [['2026-06-01T00:00:00.000+08:00junk', 1.25, '588200.SH', '']],
    [['20260230', 1.25, '588200.SH', '']],
    [['2026-06-01', 1.25, '588200.SH', ''], ['20260601', 1.35, '588200.SH', '']]
  ]) {
    await assert.rejects(fetchWindFundDailyClose(query, { apiKey, fetchFn: mock({ result: toolSuccess(replaceRows(rows)) }).fetchFn }),
      { code: 'WIND_FUND_INVALID_RESPONSE' });
  }
});
