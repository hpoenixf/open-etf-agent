import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { windResponseShape } from './wind-response-shape.mjs';

const endpoint = 'https://mcp.wind.com.cn/vserver_fund_data/mcp/';
const tool = 'get_fund_kline';
const maxWireBytes = 262144;
const maxDays = 31;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const fundCodePattern = /^[0-9]{6}\.(SH|SZ)$/;

const fail = code => { throw Object.assign(new Error(code), { code }); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).sort().join(',') === keys;

function day(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) fail('WIND_FUND_INVALID_QUERY');
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) fail('WIND_FUND_INVALID_QUERY');
  return timestamp;
}

function queryArguments(query) {
  if (!exact(query, 'beginDate,endDate,windCode') || typeof query.windCode !== 'string' || !fundCodePattern.test(query.windCode)) fail('WIND_FUND_INVALID_QUERY');
  const days = (day(query.endDate) - day(query.beginDate)) / 86400000 + 1;
  if (days < 1 || days > maxDays) fail('WIND_FUND_INVALID_QUERY');
  return { windcode: query.windCode, begin_date: query.beginDate, end_date: query.endDate, period: '10', aftype: '2', issusp: '0' };
}

function boundedResponse(response, onLimit) {
  if (!response.body) return response;
  let bytes = 0;
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > maxWireBytes) { onLimit(); fail('WIND_FUND_RESPONSE_LIMIT'); }
      controller.enqueue(chunk);
    }
  }));
  return new Response(body, { status: response.status, headers: response.headers });
}

// Explicitly authorized operator-side fetch. No session-owned tool, model, or durable cache is wired here.
export async function fetchWindFundDailyClose(query, { apiKey, signal, fetchFn = globalThis.fetch, timeoutMs = 15000, onResponseShape } = {}) {
  const args = queryArguments(query);
  const requested = { windCode: args.windcode, beginDate: args.begin_date, endDate: args.end_date };
  if (typeof apiKey !== 'string' || !/^[\x21-\x7e]{1,512}$/.test(apiKey)) fail('WIND_FUND_KEY_REQUIRED');
  if ((onResponseShape !== undefined && typeof onResponseShape !== 'function') || typeof fetchFn !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) fail('WIND_FUND_INVALID_HOST_OPTIONS');
  if (signal?.aborted) fail('WIND_FUND_ABORTED');
  const deadline = AbortSignal.timeout(timeoutMs);
  const lifetime = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let wireError;
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    fetch: async (url, init) => {
      if (String(url) !== endpoint) fail('WIND_FUND_UNEXPECTED_REQUEST');
      // The adapter completes one POST round trip per initialize/call and does not open or resume a separate stream.
      // Streamable HTTP POST responses may themselves still be SSE.
      if (init.method === 'GET') return new Response(null, { status: 405 });
      if (init.method !== 'POST') fail('WIND_FUND_UNEXPECTED_REQUEST');
      lifetime.throwIfAborted();
      const outbound = JSON.parse(init.body);
      if (!['initialize', 'notifications/initialized', 'tools/call'].includes(outbound.method)) fail('WIND_FUND_UNEXPECTED_REQUEST');
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${apiKey}`);
      const response = await fetchFn(endpoint, {
        ...init,
        headers,
        redirect: 'error',
        signal: init.signal ? AbortSignal.any([init.signal, lifetime]) : lifetime
      });
      if (response.redirected || (response.url && response.url !== endpoint)) {
        void response.body?.cancel().catch(() => {});
        fail('WIND_FUND_UNEXPECTED_REQUEST');
      }
      if (!response.ok) {
        wireError = ({ 401: 'WIND_FUND_AUTHENTICATION', 403: 'WIND_FUND_FORBIDDEN', 429: 'WIND_FUND_RATE_LIMIT' })[response.status] ?? 'WIND_FUND_TRANSPORT_ERROR';
        void response.body?.cancel().catch(() => {});
        return new Response(null, { status: response.status });
      }
      return boundedResponse(response, () => { wireError = 'WIND_FUND_RESPONSE_LIMIT'; });
    }
  });
  const client = new Client({ name: 'open-etf-agent-wind-fund', version: '0.38.0' });
  try {
    await client.connect(transport, { timeout: timeoutMs, signal: lifetime });
    const result = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: timeoutMs, signal: lifetime });
    if (onResponseShape) {
      // Diagnostic callback errors do not change the classification of the vendor result.
      try { void Promise.resolve(onResponseShape(windResponseShape(result))).catch(() => {}); }
      catch { /* Local diagnostic only. */ }
    }
    try { return normalizeDailyClose(result, requested); }
    catch (error) { if (error.code?.startsWith('WIND_FUND_')) throw error; fail('WIND_FUND_INVALID_RESPONSE'); }
  } catch (error) {
    // Do not expose SDK/provider bodies, headers, URLs supplied in errors, or cancellation reasons.
    if (signal?.aborted) fail('WIND_FUND_ABORTED');
    if (wireError === 'WIND_FUND_RESPONSE_LIMIT') fail(wireError);
    if (deadline.aborted) fail('WIND_FUND_TIMEOUT');
    if (wireError) fail(wireError);
    if (['WIND_FUND_INVALID_RESPONSE', 'WIND_FUND_BUSINESS_ERROR', 'WIND_FUND_RESPONSE_LIMIT', 'WIND_FUND_NO_DATA'].includes(error.code)) fail(error.code);
    fail('WIND_FUND_TRANSPORT_ERROR');
  } finally {
    await transport.close();
  }
}

function assertBusinessSuccess(value) {
  if (!record(value)) return;
  if (value.error != null || (value.ok !== undefined && value.ok !== true)) fail('WIND_FUND_BUSINESS_ERROR');
  if ('mcp_tool_error_code' in value && value.mcp_tool_error_code !== 0 && value.mcp_tool_error_code !== '0') fail('WIND_FUND_BUSINESS_ERROR');
  if (record(value.data) && 'code' in value.data) {
    const code = String(value.data.code);
    if (!/^(0|2\d\d)$/.test(code)) fail('WIND_FUND_BUSINESS_ERROR');
  }
}

function normalizeDailyClose(result, query) {
  if (result.isError) fail('WIND_FUND_BUSINESS_ERROR');
  if (!Array.isArray(result.content) || result.content.length > 1 || result.content.some(part => part.type !== 'text')) fail('WIND_FUND_INVALID_RESPONSE');
  const text = result.content[0]?.text;
  let inner;
  if (typeof text === 'string') {
    try { inner = JSON.parse(text); }
    catch { /* Optional narrative is not financial data. */ }
  }
  assertBusinessSuccess(inner);
  assertBusinessSuccess(result.structuredContent);
  const primary = result.structuredContent ?? inner;
  const { rows, identityConfirmation } = normalizeRows(primary, query);
  if (result.structuredContent && record(inner?.data) &&
      JSON.stringify(rows) !== JSON.stringify(normalizeRows(inner, query).rows)) fail('WIND_FUND_INVALID_RESPONSE');
  return {
    schemaVersion: 'wind-fund-daily-close@1',
    source: { provider: 'Wind', domain: 'fund_data', tool, priceField: 'MATCH', period: '1d', adjustment: 'unadjusted', suspended: 'excluded-by-request' },
    windCode: query.windCode,
    beginDate: query.beginDate,
    endDate: query.endDate,
    asOf: rows.at(-1).date,
    identityConfirmation,
    rows
  };
}

// Preserve Wind's stated trading date; UTC conversion can shift it a day.
function tradingDate(value) {
  if (typeof value !== 'string') fail('WIND_FUND_INVALID_RESPONSE');
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  const iso = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  const date = compact ? compact.slice(1).join('-') : iso && Number.isFinite(Date.parse(value)) ? iso[1] : value;
  try { day(date); } catch { fail('WIND_FUND_INVALID_RESPONSE'); }
  return date;
}

function normalizeRows(value, query) {
  const table = value?.data;
  if (!record(table) || !Array.isArray(table.columns) || !Array.isArray(table.rows) ||
      table.columns.length < 2 || table.columns.length > 64 || table.rows.length > maxDays) fail('WIND_FUND_INVALID_RESPONSE');
  const columns = table.columns.map(column => column?.name);
  if (columns.some(name => typeof name !== 'string' || !name || name.length > 100) || new Set(columns).size !== columns.length) fail('WIND_FUND_INVALID_RESPONSE');
  const dateAt = columns.indexOf('TIME');
  const closeAt = columns.indexOf('MATCH');
  const codes = columns.flatMap((name, index) => ['Wind代码', 'WIND代码', 'windcode'].includes(name) ? [index] : []);
  if (dateAt < 0 || closeAt < 0) fail('WIND_FUND_INVALID_RESPONSE');
  if (!table.rows.length) fail('WIND_FUND_NO_DATA');
  const seen = new Set();
  const rows = table.rows.map(row => {
    if (!Array.isArray(row) || row.length !== columns.length || codes.some(index => row[index] !== query.windCode)) fail('WIND_FUND_INVALID_RESPONSE');
    const date = tradingDate(row[dateAt]);
    if (date < query.beginDate || date > query.endDate || seen.has(date)) fail('WIND_FUND_INVALID_RESPONSE');
    const rawClose = row[closeAt];
    const close = typeof rawClose === 'string' && /^\d+(\.\d+)?$/.test(rawClose) ? Number(rawClose) : rawClose;
    if (!Number.isFinite(close) || close <= 0) fail('WIND_FUND_INVALID_RESPONSE');
    seen.add(date);
    return { date, close };
  }).sort((a, b) => a.date < b.date ? -1 : 1);
  return { rows, identityConfirmation: codes.length ? 'response-column' : 'request-only' };
}
