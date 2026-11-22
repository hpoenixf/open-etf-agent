import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openOwnerWind, OWNER_WIND_TOOL_NAMES, prepareOwnerWind } from '../src/gui-owner-wind.mjs';

const key = 'synthetic-wind-fixture-key';
const q = { windCode: '588200.SH', beginDate: '2026-06-01', endDate: '2026-06-03' };
const info = { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '1.0.0' } };
const table = {
  columns: [{ name: 'TIME' }, { name: 'MATCH' }, { name: 'Wind代码' }, { name: 'unselected' }],
  rows: [['2026-06-03', 1.35, q.windCode, 'UNEXPOSED_VENDOR_VALUE']]
};
function adapter({onCall} = {}) {
  const sends = [];
  const fetchFn = async (url, init) => {
    assert.equal(url, 'https://mcp.wind.com.cn/vserver_fund_data/mcp/');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.get('authorization'), 'Bearer ' + key);
    const payload = JSON.parse(init.body);
    sends.push(payload);
    if (payload.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (payload.method === 'tools/call' && onCall) return onCall(init.signal);
    const result = payload.method === 'initialize' ? info : { content: [{ type: 'text', text: JSON.stringify({ data: table }) }] };
    return Response.json({ jsonrpc:'2.0', id:payload.id, result }, { headers: { 'mcp-session-id': 'synthetic-session' } });
  };
  return { sends, fetchFn };
}

test('Wind explicit opt-in, secret not serializable, identical dry/runtime tool definition, no startup I/O', async () => {
  const { fetchFn, sends } = adapter();
  assert.equal(prepareOwnerWind(undefined, { WIND_API_KEY: key }), null);
  assert.equal(prepareOwnerWind(false, { WIND_API_KEY: key }), null);
  assert.throws(() => prepareOwnerWind('on', { WIND_API_KEY: key }), { code:'GUI_WIND_CONFIG_INVALID' });
  for (const env of [{}, { WIND_API_KEY:'' }, { WIND_API_KEY:'an\ninjected header' }]) assert.throws(() => prepareOwnerWind(true, env), { code:'GUI_WIND_KEY_REQUIRED' });
  const settings = prepareOwnerWind(true, { WIND_API_KEY:key });
  assert.equal(JSON.stringify(settings), '{}');
  const dry = await openOwnerWind({ fetchFn });
  const live = await openOwnerWind({ settings, fetchFn });
  const definitions = ({extensions}) => extensions.map(({name,description,parameters}) => ({name,description,parameters}));
  assert.deepEqual(dry.extensions.map(t=>t.name), OWNER_WIND_TOOL_NAMES);
  assert.deepEqual(definitions(dry), definitions(live));
  await assert.rejects(dry.extensions[0].execute(q), { code:'GUI_WIND_KEY_REQUIRED' });
  for(const invalid of [{...q, windCode:'101588.HK'}, {...q, endDate:'2026-07-04'}, {...q, endDate:'2026-06-00'}, {...q, endpoint:'https://example.com'}]) {
    await assert.rejects(live.extensions[0].execute(invalid), { code:'GUI_WIND_INVALID_QUERY' });
  }
  assert.equal(sends.length, 0);
  await dry.close();
  await live.close();
});

test('one typed read-only vendor tool; no discovery, private response fields or replay', async () => {
  const { fetchFn, sends } = adapter();
  const wind = await openOwnerWind({ settings: prepareOwnerWind(true, { WIND_API_KEY:key }), fetchFn });
  const extension = wind.extensions[0];
  const value = await extension.execute(q);
  assert.deepEqual(sends.map(x=>x.method), ['initialize', 'notifications/initialized', 'tools/call']);
  assert.deepEqual(sends.at(-1).params, { name:'get_fund_kline', arguments: { windcode:q.windCode, begin_date:q.beginDate, end_date:q.endDate, period:'10', aftype:'2', issusp:'0' } });
  assert.equal(value.source.provider,'Wind');
  assert.deepEqual(value.rows,[{date:'2026-06-03',close:1.35}]);
  assert.equal(value.identityConfirmation,'response-column');
  assert.doesNotMatch(JSON.stringify(value), /UNEXPOSED_VENDOR_VALUE|synthetic-wind-fixture-key/);
  assert.throws(() => extension.verifyResult({ ...value, asOf:'2026-06-01' }, { call:{ arguments:q } }), { code:'GUI_WIND_RESULT_CHANGED' });
  assert.throws(() => extension.verifyResult(value, { call:{ arguments:{ ...q, windCode:'588201.SH' } } }), { code:'GUI_WIND_RESULT_CHANGED' });
  assert.equal(extension.reconcile, undefined);
  await assert.rejects(extension.execute(q), { code:'GUI_WIND_REQUEST_ALREADY_ATTEMPTED' });
  assert.equal(sends.length,3);
  await wind.close();
});

test('Wind 429 and aborted in-flight requests are not retried or reconciled', async () => {
  for (const abort of [false,true]) {
    const controller = new AbortController();
    const { fetchFn, sends } = adapter({onCall: async signal => {
      if (abort) { controller.abort(); signal.throwIfAborted(); }
      return new Response('UNEXPOSED_PROVIDER_ERROR', {status:429});
    }});
    const wind = await openOwnerWind({settings:prepareOwnerWind(true,{WIND_API_KEY:key}),fetchFn});
    const extension = wind.extensions[0];
    await assert.rejects(extension.execute(q,{signal:controller.signal}), {code:abort?'WIND_FUND_ABORTED':'WIND_FUND_RATE_LIMIT'});
    await assert.rejects(extension.execute(q), {code:'GUI_WIND_REQUEST_ALREADY_ATTEMPTED'});
    assert.deepEqual(sends.map(x=>x.method), ['initialize','notifications/initialized','tools/call']);
    await wind.close();
  }
});
