import { fetchWindFundDailyClose } from './wind-fund.mjs';

export const OWNER_WIND_TOOL_NAMES = Object.freeze(['wind_fund_daily_close']);
const fail = code => { throw Object.assign(new Error(code), { code }); };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => isRecord(value) && Object.keys(value).sort().join(',') === keys;
const credentials = new WeakMap();
const fundCode = /^[0-9]{6}\.(SH|SZ)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function timestamp(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) fail('GUI_WIND_INVALID_QUERY');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) fail('GUI_WIND_INVALID_QUERY');
  return ms;
}

function validate(query) {
  if (!exact(query, 'beginDate,endDate,windCode') || typeof query.windCode !== 'string' || !fundCode.test(query.windCode)) fail('GUI_WIND_INVALID_QUERY');
  const days = (timestamp(query.endDate) - timestamp(query.beginDate)) / 86_400_000 + 1;
  if (days < 1 || days > 31) fail('GUI_WIND_INVALID_QUERY');
}

// No derived source IDs: these are normalized vendor observations supplied as
// untrusted data to the selected model, not immutable cited report evidence.
function verifyResult(value, { call } = {}) {
  const q = call?.arguments;
  validate(q);
  if (!exact(value, 'asOf,beginDate,endDate,identityConfirmation,rows,schemaVersion,source,windCode') ||
      value.schemaVersion !== 'wind-fund-daily-close@1' ||
      value.windCode !== q.windCode || value.beginDate !== q.beginDate || value.endDate !== q.endDate ||
      !['request-only', 'response-column'].includes(value.identityConfirmation) ||
      !exact(value.source, 'adjustment,domain,period,priceField,provider,suspended,tool') ||
      value.source.provider !== 'Wind' || value.source.domain !== 'fund_data' ||
      value.source.tool !== 'get_fund_kline' || value.source.priceField !== 'MATCH' ||
      value.source.period !== '1d' || value.source.adjustment !== 'unadjusted' ||
      value.source.suspended !== 'excluded-by-request' ||
      !Array.isArray(value.rows) || !value.rows.length || value.rows.length > 31) fail('GUI_WIND_RESULT_CHANGED');
  let previous = '';
  for (const row of value.rows) {
    if (!exact(row, 'close,date') || typeof row.date !== 'string' ||
        row.date < q.beginDate || row.date > q.endDate || row.date <= previous ||
        !Number.isFinite(row.close) || row.close <= 0) fail('GUI_WIND_RESULT_CHANGED');
    try { timestamp(row.date); } catch { fail('GUI_WIND_RESULT_CHANGED'); }
    previous = row.date;
  }
  if (value.asOf !== previous) fail('GUI_WIND_RESULT_CHANGED');
}

// Opt-in must be owned by the server deployer. Presence of a secret alone is
// not permission to send questions/data or call vendor tools. No secret is
// serializable even if this returned launch setting accidentally gets logged.
export function prepareOwnerWind(input, env = process.env) {
  if (input === undefined || input === false) return null;
  if (input !== true) fail('GUI_WIND_CONFIG_INVALID');
  const key = Object.hasOwn(env, 'WIND_API_KEY') ? env.WIND_API_KEY : null;
  if (typeof key !== 'string' || !/^[\x21-\x7e]{1,512}$/.test(key)) fail('GUI_WIND_KEY_REQUIRED');
  const setting = Object.freeze({});
  credentials.set(setting, key);
  return setting;
}

// Call only for a frozen enabled profile. Admission calls without settings and
// gets identical definitions; all vendor I/O occurs lazily inside execute.
export async function openOwnerWind({ settings, signal: runSignal, fetchFn = globalThis.fetch } = {}) {
  const controller = new AbortController();
  const attempted = new Set();
  const key = settings && credentials.get(settings);
  const close = async () => { controller.abort(); };
  const tool = {
    name: OWNER_WIND_TOOL_NAMES[0],
    description: 'Read Wind fund market data: daily unadjusted exchange closing prices for one six-digit Shanghai (.SH) or Shenzhen (.SZ) fund code and an explicit inclusive window of up to 31 calendar days. Not NAV, not adjusted return, not real-time intraday quotes. Missing trading days are not zero. Report date, basis, vendor and request-only identity if applicable; do not claim this is a verified report citation.',
    parameters: {
      type: 'object',
      properties: {
        windCode: { type: 'string', pattern: fundCode.source },
        beginDate: { type: 'string', pattern: datePattern.source },
        endDate: { type: 'string', pattern: datePattern.source }
      },
      required: ['windCode', 'beginDate', 'endDate'],
      additionalProperties: false
    },
    validate,
    verifyResult,
    async execute(args, { signal } = {}) {
      validate(args);
      if (!key) fail('GUI_WIND_KEY_REQUIRED');
      const signals = [controller.signal, ...[runSignal, signal].filter(Boolean)];
      if (signals.some(s => s.aborted)) fail('WIND_FUND_ABORTED');
      const queryId = JSON.stringify([args.windCode, args.beginDate, args.endDate]);
      if (attempted.has(queryId)) fail('GUI_WIND_REQUEST_ALREADY_ATTEMPTED');
      attempted.add(queryId);
      // The original adapter owns endpoint and arguments, timeouts, response
      // bounds, status normalization, redirect refusal, and single dispatch.
      const result = await fetchWindFundDailyClose(args, { apiKey: key, signal: AbortSignal.any(signals), fetchFn });
      verifyResult(result, { call: { arguments: args } });
      return result;
    }
    // No reconciliation/recovery adapter: host retains native unknown/fencing
    // rather than replaying a vendor call whose transport outcome is unknown.
  };
  return { extensions: [tool], close };
}
