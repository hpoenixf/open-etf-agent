import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { listMcpTools } from './mcp.mjs';

const endpoint = new URL('https://mcp.wind.com.cn/vserver_fund_data/mcp/');
const prefix = 'wind_';
const fail = reason => { const code='WIND_RESEARCH_'+reason; throw Object.assign(new Error(code),{code}); };
const obj = (properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const choice = (...values)=>({type:'string',enum:values});
const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const text=(pattern,maxLength=100)=>({type:'string',pattern,maxLength,minLength:1});
const listed=text('^\\d{6}\\.(?:SH|SZ)$',9);
const symbol=text('^\\d{6}\\.(?:SH|SZ|OF)$',9);
const date=text('^\\d{4}-\\d{2}-\\d{2}$',10);
const periods={'1min':'1','5min':'3','10min':'4','15min':'5','30min':'6','60min':'7','120min':'8','240min':'9','1d':'10','1w':'11','1mo':'12','1y':'13','1q':'14','6mo':'15'};
const adjustments={unadjusted:'2',forward:'0',backward:'1'};
const indicators={last_trade_date:'最新交易日',trade_time:'交易时间',last_price:'最新成交价',previous_close:'前收盘价',open:'今日开盘价',high:'今日最高价',low:'今日最低价',volume:'成交量',turnover_value:'成交额',turnover_rate:'换手率',change:'涨跌幅',iopv:'IOPV',premium_discount:'贴水率',unit_nav:'最新净值',fund_size:'基金规模'};
const dates=(from,to)=>{
  if(from>to)fail('ARGUMENT');
};
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const family=(description,metrics)=>({
  description,parameters:obj({fundCode:symbol,metric:choice(...Object.keys(metrics)),dateFrom:date,dateTo:date},['fundCode','metric']),requiredWire:['question'],
  encode(a){
    if(a.dateTo&&!a.dateFrom)fail('ARGUMENT');
    if(a.dateTo)dates(a.dateFrom,a.dateTo);
    const range=a.dateFrom?a.dateTo?'; 区间 '+a.dateFrom+' 至 '+a.dateTo:'; 截至 '+a.dateFrom:'';
    return {question:'查询公开基金 '+a.fundCode+' 的 '+metrics[a.metric]+range};
  }
});
const categories={etf:'ETF',equity:'股票型基金',bond:'债券型基金',mixed:'混合型基金',money_market:'货币市场基金',index:'指数基金',lof:'LOF'};
const searchMetrics={one_year_return:'近一年收益率',management_fee:'管理费率',size:'基金规模',max_drawdown:'最大回撤'};
const comparisons={above:'高于',at_least:'不低于',below:'低于',at_most:'不高于'};
const units={percent:'%',cny_million:'百万元'};
const defs={
  get_fund_price_indicators:{
    description:'Read the latest exchange quote snapshot for listed funds. This is not NAV.',
    parameters:obj({fundCode:listed,fundCodes:{type:'array',items:listed,minItems:1,maxItems:50,uniqueItems:true},indicators:{type:'array',items:choice(...Object.keys(indicators)),minItems:1,maxItems:Object.keys(indicators).length,uniqueItems:true}}),
    requiredWire:['windcode'], optionalWire:['indexes'],
    encode(a){
      if(Boolean(a.fundCode)===Boolean(a.fundCodes))fail('ARGUMENT');
      return {windcode:a.fundCode??a.fundCodes.join(','),...(a.indicators?{indexes:a.indicators.map(x=>indicators[x]).join(',')}:{})};
    }
  },
  get_fund_kline:{
    description:'Read listed fund exchange price bars. Daily and unadjusted by default; never substitute for NAV.',
    parameters:obj({fundCode:listed,dateFrom:date,dateTo:date,period:choice(...Object.keys(periods)),adjustment:choice(...Object.keys(adjustments)),count:integer(-512,512)},['fundCode','dateFrom','dateTo']),
    requiredWire:['windcode','begin_date','end_date'],optionalWire:['period','aftype','issusp','count'],
    encode(a){dates(a.dateFrom,a.dateTo);return {windcode:a.fundCode,begin_date:a.dateFrom,end_date:a.dateTo,period:periods[a.period??'1d'],aftype:adjustments[a.adjustment??'unadjusted'],issusp:'0',...(a.count===undefined?{}:{count:a.count})};}
  },
  get_fund_quote:{
    description:'Read intraday exchange prices for a listed fund. Not a daily NAV or K-line.',
    parameters:obj({fundCode:listed,dateFrom:date,dateTo:date,count:integer(-512,512)},['fundCode']),
    requiredWire:['windcode'],optionalWire:['begin','end','count'],
    encode(a){if(a.dateTo&&!a.dateFrom)fail('ARGUMENT');if(a.dateTo)dates(a.dateFrom,a.dateTo);return {windcode:a.fundCode,...(a.dateFrom?{begin:a.dateFrom}:{}),...(a.dateTo?{end:a.dateTo}:{}),...(a.count===undefined?{}:{count:a.count})};}
  },
  get_fund_info:family('Read a public fund profile and reference attributes.',{profile:'产品档案与投资类型',benchmark:'业绩比较基准',fees:'公开费率',managers:'基金经理'}),
  get_fund_financials:family('Read disclosed fund financial data and distributions.',{distributions:'分红次数、单位分红、分红总额与日期',financial_statements:'定期财务报表',net_assets:'报告期资产净值'}),
  get_fund_holdings:family('Read publicly disclosed fund holdings and portfolio aggregates at a reporting period.',{asset_mix:'资产类别构成',top_holdings:'披露的重仓证券或基金',industry:'行业配置',concentration:'持股集中度',valuation:'披露组合估值',turnover:'基金换手率'}),
  get_fund_company_info:family('Read the publicly disclosed manager/company details associated with a fund.',{profile:'管理人公司基本档案',scale:'管理人规模',contacts:'管理人公开联系方式'}),
  get_fund_holders:family('Read publicly disclosed fund shareholder structure.',{holder_structure:'持有人结构',size:'资产净值与基金份额',holder_count:'持有人户数',institutional_ratio:'机构持有比例'}),
  get_fund_performance:family('Read unit NAV and other disclosed fund performance data by metric; do not use exchange prices as NAV.',{unit_nav:'单位净值与观察日期',cumulative_nav:'累计净值与观察日期',adjusted_nav:'复权净值与观察日期',returns:'基金收益率',risk:'披露的风险指标'}),
  search_funds:{
    description:'Screen across funds using a structured category and threshold. Do not use for a named instrument.',
    parameters:obj({category:choice(...Object.keys(categories)),metric:choice(...Object.keys(searchMetrics)),comparison:choice(...Object.keys(comparisons)),threshold:text('^-?\\d{1,9}(?:\\.\\d{1,4})?$',15),unit:choice(...Object.keys(units))},['category']),
    requiredWire:['question'],
    encode(a){
      const keys=['metric','comparison','threshold','unit'];
      if(!keys.some(k=>own(a,k)))return {question:'筛选公开市场'+categories[a.category]+'；只需要返回匹配的基金代码与名称'};
      if(!keys.every(k=>own(a,k)))fail('ARGUMENT');
      if((a.metric==='size')!==(a.unit==='cny_million')||(a.metric!=='one_year_return'&&a.metric!=='max_drawdown'&&Number(a.threshold)<0))fail('ARGUMENT');
      return {question:'筛选公开市场'+categories[a.category]+'；'+searchMetrics[a.metric]+comparisons[a.comparison]+a.threshold+units[a.unit]+'；只需要返回匹配的基金代码与名称'};
    }
  }
};
const toolNames=['wind_available_tools',...Object.keys(defs).map(x=>prefix+x)];
export const isWindResearchTool=name=>toolNames.includes(name);
const isObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const own=(o,k)=>Object.hasOwn(o,k);
function validate(schema,value,key){
  if(schema.enum&&!schema.enum.includes(value))fail('ARGUMENT');
  if(schema.type==='object'){
    if(!isObject(value)||Object.keys(value).some(x=>!own(schema.properties,x))||schema.required.some(x=>!own(value,x)))fail('ARGUMENT');
    for(const [k,v] of Object.entries(value))validate(schema.properties[k],v,k);
  }else if(schema.type==='array'){
    if(!Array.isArray(value)||value.length<schema.minItems||value.length>schema.maxItems||new Set(value).size!==value.length)fail('ARGUMENT');
    for(const item of value)validate(schema.items,item);
  }else if(schema.type==='string'){
    if(typeof value!=='string'||(schema.pattern&&!new RegExp(schema.pattern).test(value))||(schema.maxLength&&value.length>schema.maxLength))fail('ARGUMENT');
    if((key==='dateFrom'||key==='dateTo')&&!validDay(value))fail('ARGUMENT');
  }else if(schema.type==='integer'){
    if(!Number.isSafeInteger(value)||value<schema.minimum||value>schema.maximum)fail('ARGUMENT');
  }
}
const compareWire = (tool,def,encoded) => {
  const s=tool?.inputSchema;
  const expected=[...def.requiredWire,...(def.optionalWire??[])];
  if(s?.type!=='object'||!isObject(s.properties)||!Array.isArray(s.required??[]))return false;
  if((s.required??[]).some(k=>!expected.includes(k)))return false;
  if(def.requiredWire.some(k=>!own(s.properties,k)||(s.properties[k]?.type!==(k==='count'?'integer':'string'))))return false;
  if(encoded){
    if((s.required??[]).some(k=>!own(encoded,k)))return false;
    for(const [k,v] of Object.entries(encoded)){
      const p=s.properties[k];
      if(!p||p.type!==(k==='count'?'integer':'string')||p.enum&&!p.enum.includes(v)||p.const!==undefined&&p.const!==v)return false;
      if(typeof v==='number'&&(v<(p.minimum??-Infinity)||v>(p.maximum??Infinity)))return false;
      if(typeof v==='string'&&(v.length<(p.minLength??0)||v.length>(p.maxLength??Infinity)))return false;
    }
  }
  return true;
};
const safeColumn = /^[a-zA-Z0-9\p{Script=Han}][a-zA-Z0-9\p{Script=Han}\s_().%/%·（）+-]{0,63}$/u;
const isSensitive=s=>typeof s==='string'&&/https?:\/\/|\b(?:Bearer\s+|sk[-_]|oc_sk_|api[_ -]?key)|[\u0000-\u001f\u007f]/i.test(s);
const clearError=e=>e===undefined||e===null||e===false||e===0||e==='0'||e==='';
function parseBusiness(o) {
  if(!isObject(o))fail('RESULT');
  if(!clearError(o.error)||!clearError(o.mcp_tool_error_code)||o.success===false)fail('BUSINESS');
}
function tablePayload(payload){
  parseBusiness(payload);
  const envelope=own(payload,'data')?payload.data:payload;
  parseBusiness(envelope);
  let table=envelope;
  if(own(envelope,'data')){
    const tables=envelope.data;
    if(!Array.isArray(tables)||tables.length!==1||!isObject(tables[0]))fail('RESULT');
    table=tables[0];
    parseBusiness(table);
    if(own(table,'data'))fail('RESULT');
  }
  if(!Array.isArray(table.columns)||!Array.isArray(table.rows)||!table.columns.length)fail('RESULT');
  if(table.columns.length>64||table.rows.length>512)fail('RESULT');
  return table;
}
function extractTable(result){
  if(result?.isError)fail('BUSINESS');
  const contents=result?.content??[];
  if(!Array.isArray(contents)||contents.length>1||contents.some(x=>x?.type!=='text'||typeof x.text!=='string'||x.text.length>262144))fail('RESULT');
  let textTable;
  if(contents.length){
    let payload;
    try{payload=JSON.parse(contents[0].text);}catch{fail('RESULT');}
    textTable=tablePayload(payload);
  }
  if(result?.structuredContent!==undefined){
    const structured=tablePayload(result.structuredContent);
    if(textTable&&JSON.stringify(structured)!==JSON.stringify(textTable))fail('RESULT');
    return structured;
  }
  if(!textTable)fail('RESULT');
  return textTable;
}
const normalizeCode=s=>typeof s==='string'&&/^\d{6}\.(?:SH|SZ|OF)$/.test(s.trim().toUpperCase())?s.trim().toUpperCase():null;
const codeField=s=>/^(?:Wind代码|基金代码|证券代码|windcode|fund_code|fundcode|symbol)$/i.test(s);
const timeField=s=>/^(?:TIME|date|trade_date|日期|交易日期|交易日|时间|净值日期)$/i.test(s);
const closeField=s=>/^(?:MATCH|CLOSE|收盘|收盘价|收盘价格)$/i.test(s);
const klineDay=v=>{
  if(typeof v!=='string')return null;
  const parsed=v.match(/^(\d{4}-\d{2}-\d{2})(?:$|T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$)/)?.[1];
  return validDay(parsed)?parsed:null;
};
const baseFor=(name,args)=>name==='get_fund_kline'?{adjustment:args.adjustment??'unadjusted',period:args.period??'1d',suspendedRequested:false}:name==='get_fund_performance'?'fund-performance-or-nav':name==='get_fund_quote'?'intraday-exchange-price':name==='get_fund_price_indicators'?'market-snapshot':name==='get_fund_holdings'?'reported-holdings':'provider-defined-fund-fields';
function normalize(name,args,result,key){
  const table=extractTable(result);
  const common={kind:'wind-fund-observations@1',provider:'Wind',tool:name,request:args,evidenceKind:'normalized-vendor-observation',basis:baseFor(name,args)};
  if(!table.rows.length)return {...common,status:'no-data'};
  if(!table.columns.length)fail('RESULT');
  const picked=[];
  for(const [i,c] of table.columns.entries()){
    const f=typeof c==='string'?c:c?.name;
    if(typeof f!=='string'||!safeColumn.test(f)||isSensitive(f)||f.includes(key))continue;
    const rawUnit=isObject(c)?c.unit:null;
    const unit=typeof rawUnit==='string'&&rawUnit.length<=16&&/^[a-z0-9\p{Script=Han}%./() -]+$/iu.test(rawUnit)&&!isSensitive(rawUnit)&&!rawUnit.includes(key)?rawUnit:null;
    picked.push({i,f,unit});
  }
  const fields=picked.map(x=>x.f),units=picked.map(x=>x.unit);
  if(!fields.length||new Set(fields).size!==fields.length)fail('RESULT');
  const rows=table.rows.map(source=>{
    if(!Array.isArray(source)||source.length!==table.columns.length)fail('RESULT');
    return picked.map(({i})=>{
      const v=source[i];
      if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
      if(typeof v!=='string'||v.length>256||v.includes(key)||isSensitive(v))fail('RESULT');
      return v;
    });
  });
  const requested=args.fundCodes??(args.fundCode?[args.fundCode]:null);
  // A holding security's code is not the requested parent fund's identity.
  const ids=fields.flatMap((s,i)=>codeField(s)&&(!['get_fund_holdings','get_fund_company_info','get_fund_holders'].includes(name)||/^(?:基金代码|fund_code|fundcode)$/i.test(s))?[i]:[]);
  if(ids.length&&requested)for(const row of rows)for(const i of ids)if(!requested.includes(normalizeCode(row[i])))fail('RESULT_IDENTITY');
  if(name==='search_funds'&&(!ids.length||rows.some(row=>!ids.some(i=>normalizeCode(row[i])))))fail('RESULT_IDENTITY');
  let observedThrough;
  if(name==='get_fund_kline'){
    const ti=fields.findIndex(timeField),ci=fields.findIndex(closeField);
    if(ti<0||ci<0)fail('RESULT_BASIS');
    const seen=new Set(),intraday=/^\d+min$/.test(args.period??'1d');
    for(const row of rows){
      const day=klineDay(row[ti]), id=intraday?Date.parse(row[ti]):day;
      const price=typeof row[ci]==='string'&&/^[+-]?\d+(?:\.\d+)?$/.test(row[ci])?Number(row[ci]):row[ci];
      const identity=String(ids.length?row[ids[0]]:'')+'/'+id;
      if(!day||day<args.dateFrom||day>args.dateTo||intraday&&!Number.isFinite(id)||seen.has(identity)||!Number.isFinite(price)||price<=0)fail('RESULT_BASIS');
      seen.add(identity);if(!observedThrough||day>observedThrough)observedThrough=day;
    }
  }else if(name==='get_fund_performance'&&args.metric==='unit_nav'){
    const i=fields.findIndex(f=>/^(?:单位净值|基金单位净值|NAV|unit_nav)$/i.test(f));
    if(i<0||rows.some(row=>!(typeof row[i]==='number'||typeof row[i]==='string'&&/^\d+(?:\.\d+)?$/.test(row[i]))||Number(row[i])<=0))fail('RESULT_BASIS');
  }
  const value={...common,...(observedThrough?{observedThrough}:{}),identityConfirmation:!requested?'screening':ids.length?'response-column':'request-only',observations:{columns:fields,...(units.some(u=>u!==null)?{units}:{}),rows}};
  if(Buffer.byteLength(JSON.stringify(value))>65536)fail('RESULT');
  return value;
}

export const WIND_FUND_BINDING=Object.freeze({
  id:'wind-fund-research',version:'1',
  contentSha256:createHash('sha256')
    .update(readFileSync(new URL('./wind-research.mjs',import.meta.url))).update('\0')
    .update(readFileSync(new URL('./mcp.mjs',import.meta.url))).digest('hex')
});
function compatibleCatalog(tool,def) {
  return !(tool.annotations?.destructiveHint===true||tool.annotations?.readOnlyHint===false)&&compareWire(tool,def);
}
export function createWindFundResearch({enabled=false,apiKey,fetchFn=globalThis.fetch,approvedTools,signal,timeoutMs=15000}={}) {
  if(!enabled)return {extensions:[],async close(){}};
  if((apiKey!==undefined&&(typeof apiKey!=='string'||!/^[!-~]{8,512}$/.test(apiKey)))||typeof fetchFn!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)fail('CONFIG');
  if(approvedTools!==undefined&&(!Array.isArray(approvedTools)||approvedTools.some(n=>!isWindResearchTool(n))||new Set(approvedTools).size!==approvedTools.length))fail('CONFIG');
  const allowed=new Set(approvedTools??toolNames);
  const lifetime=new AbortController();
  let client,transport,catalogPromise,cachedFatal=false,closed=false;
  async function close(){
    if(closed)return;
    closed=true;
    signal?.removeEventListener('abort',onAbort);
    lifetime.abort();
    try{await client?.close();}catch{}
    try{await transport?.close();}catch{}
  }
  const onAbort=()=>void close();
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted)onAbort();
  function effectiveSignal(callSignal) {
    const list=[lifetime.signal,...(signal?[signal]:[]),...(callSignal?[callSignal]:[])];
    return AbortSignal.any(list);
  }
  async function guardedFetch(url,init={}) {
    if(closed||String(url)!==String(endpoint))fail('TRANSPORT');
    if(init.method==='GET')return new Response(null,{status:405});
    if(init.method!=='POST')fail('TRANSPORT');
    const headers=new Headers(init.headers);
    if(headers.get('Authorization')!=='Bearer '+apiKey||typeof init.body!=='string'||init.body.includes(apiKey))fail('TRANSPORT');
    let payload;
    try{payload=JSON.parse(init.body);}catch{fail('TRANSPORT');}
    if(!['initialize','notifications/initialized','tools/list','tools/call'].includes(payload?.method))fail('TRANSPORT');
    const r=await fetchFn(String(endpoint),{...init,headers,redirect:'error',signal:effectiveSignal(init.signal)});
    if(r?.redirected||(r?.url&&r.url!==String(endpoint)))fail('TRANSPORT');
    if([401,403].includes(r?.status))fail('ENTITLEMENT');
    if(r?.status===429)fail('RATE_LIMIT');
    if(!r?.ok)fail('TRANSPORT');
    if(!r.body)return r;
    const limit=256*1024;
    const declared=r.headers.get('content-length');
    if(declared&&(!/^\d+$/.test(declared)||Number(declared)>limit)){await r.body.cancel();fail('RESULT');}
    let size=0;
    const bounded=r.body.pipeThrough(new TransformStream({
      transform(chunk,controller){
        size+=chunk.byteLength;
        if(size>limit)fail('RESULT');
        controller.enqueue(chunk);
      }
    }));
    return new Response(bounded,{status:r.status,statusText:r.statusText,headers:r.headers});
  }
  function mapError(error,callSignal){
    if(callSignal?.aborted)callSignal.throwIfAborted();
    if(signal?.aborted)signal.throwIfAborted();
    if(/^WIND_RESEARCH_[A-Z_]+$/.test(error?.code??''))throw error;
    fail('TRANSPORT');
  }
  function catalog(callSignal) {
    if(!apiKey)fail('KEY_REQUIRED');
    if(closed||cachedFatal)fail('TRANSPORT');
    callSignal?.throwIfAborted();
    catalogPromise??=(async()=>{
      const csignal=effectiveSignal(callSignal);
      client=new Client({name:'open-etf-agent-wind',version:'0.38.1'},{capabilities:{}});
      client.onerror=()=>{cachedFatal=true;};
      transport=new StreamableHTTPClientTransport(endpoint,{requestInit:{headers:{Authorization:'Bearer '+apiKey}},fetch:guardedFetch});
      try {
        await client.connect(transport,{timeout:timeoutMs,signal:csignal});
        const list=await listMcpTools(client,{timeoutMs,signal:csignal,fatal:()=>cachedFatal,maxPages:4,maxTools:32});
        return new Map(list.tools.filter(t=>own(defs,t.name)&&compatibleCatalog(t,defs[t.name])).map(t=>[t.name,t]));
      }catch(e){await close();mapError(e,callSignal);}
    })();
    return catalogPromise;
  }
  const extensions=[];
  if(allowed.has('wind_available_tools')){
    const parameters=obj();
    extensions.push({
      name:'wind_available_tools',
      description:'List the known public Wind Fund tools advertised for this account. Advertisement is not per-query entitlement.',
      parameters,
      validate(a){validate(parameters,a);},
      async execute(a,{signal:callSignal}={}){
        validate(parameters,a);
        const tools=await catalog(callSignal);
        return {kind:'wind-fund-tool-availability@1',provider:'Wind',accountAdvertisedTools:[...tools.keys()].filter(n=>allowed.has(prefix+n)),availabilityDoesNotGuaranteeQueryAccess:true};
      }
    });
  }
  for(const [name,def] of Object.entries(defs)){
    if(!allowed.has(prefix+name))continue;
    extensions.push({
      name:prefix+name,description:def.description,parameters:def.parameters,
      validate(args){validate(def.parameters,args);def.encode(args);},
      async execute(args,{signal:callSignal}={}){
        validate(def.parameters,args);
        const request=def.encode(args);
        const tools=await catalog(callSignal);
        if(!tools.has(name))fail('TOOL_UNAVAILABLE');
        if(!compareWire(tools.get(name),def,request))fail('TOOL_SCHEMA');
        if(closed||cachedFatal)fail('TRANSPORT');
        let result;
        try {
          result=await client.callTool({name,arguments:request},undefined,{timeout:timeoutMs,signal:effectiveSignal(callSignal)});
        }catch(e){mapError(e,callSignal);}
        if(cachedFatal)fail('TRANSPORT');
        return normalize(name,args,result,apiKey);
      }
    });
  }
  return {extensions,close};
}
