import {createHmac} from 'node:crypto';
import {join} from 'node:path';
import {ensureSafeDirectory,publishImmutable} from './storage-files.mjs';

const endpoint=new Map([['eu','https://cloud.langfuse.com'],['us','https://us.cloud.langfuse.com'],['jp','https://jp.cloud.langfuse.com']]);
const codeSet=new Set(['ROOT_BUDGET_EXHAUSTED','ROUND_LIMIT','TOOL_LIMIT','TIMEOUT','EXECUTION_FAILED','CANCELLED','MODEL_OUTCOME_UNKNOWN','TOOL_OUTCOME_UNKNOWN','PROVIDER_PROTOCOL_INVALID','PROVIDER_OUTPUT_INCOMPLETE','REPORT_REQUIRED']);
const key=(s,prefix)=>typeof s==='string'&&s.startsWith(prefix)&&/^[A-Za-z0-9_-]{12,200}$/.test(s);
const ID=/^[A-Za-z0-9_.:/@-]{1,96}$/;
const safeTime=(t,fallback)=>Number.isSafeInteger(t)&&t>0?t:fallback;
const nanos=t=>(BigInt(t)*1000000n).toString();
const attr=(key,v)=>({key,value:{stringValue:String(v)}});
const metadata=(name,v)=>attr('langfuse.observation.metadata.'+name,v);
function cleanCode(code) {
  if(typeof code!=='string')return null;
  if(codeSet.has(code)||/^PROVIDER_HTTP_[1-5]\d\d$/.test(code))return code;
  return 'OTHER_RUNTIME_FAILURE';
}
function tokenUsage(value) {
  const out={};
  for(const [from,to] of [['prompt_tokens','input'],['completion_tokens','output'],['total_tokens','total']]){
    if(Number.isSafeInteger(value?.[from])&&value[from]>=0)out[to]=value[from];
  }
  return Object.keys(out).length?out:null;
}
function integer(n){return Number.isSafeInteger(n)&&n>=0?n:null;}
export function prepareOwnerLangfuse(env={}, {send=globalThis.fetch,now=Date.now}={}) {
  if(env.ETF_LANGFUSE_ENABLED!=='1')return null;
  const origin=endpoint.get(env.ETF_LANGFUSE_REGION??'us');
  const publicKey=env.ETF_LANGFUSE_PUBLIC_KEY,secret=env.ETF_LANGFUSE_SECRET_KEY;
  const salt=env.ETF_LANGFUSE_TRACE_SALT;
  if(!origin||!key(publicKey,'pk-lf-')||!key(secret,'sk-lf-')||!key(salt,'trace-')||salt.length<38||typeof send!=='function')return null;
  const auth='Basic '+Buffer.from(publicKey+':'+secret).toString('base64');
  const id=(kind,...parts)=>createHmac('sha256',salt).update(JSON.stringify([kind,...parts])).digest('hex');
  let pending=0;
  const work=new Set();
  function start(){
    const opened=now(), attempts=new Map(),tools=new Map(); let captured=false;
    return {
      // Called at existing execution boundaries; never await, throw, or retain raw records.
      observe(fact) {
        if(fact?.type==='model-transport'){
          const ord=integer(fact.ordinal);
          if(!ord||ord>200||attempts.has(ord)||attempts.size>=100||!['responded','http-error','protocol-error','unknown'].includes(fact.status))return;
          attempts.set(ord,{
            ord, at:safeTime(fact.at,opened), end:safeTime(fact.end,opened), status:fact.status, code:cleanCode(fact.code),
            model:typeof fact.model==='string'&&ID.test(fact.model)&&!fact.model.includes('://')?fact.model:null,
            usage:tokenUsage(fact.usage),
          });
        } else if(fact?.type==='tool-result'){
          const ordinal=typeof fact.toolId==='string'&&fact.toolId.length>0&&fact.toolId.length<=128?id('tool-call',fact.toolId):null;
          if(!ordinal||tools.has(ordinal)||tools.size>=200||!['succeeded','failed','rejected','unknown'].includes(fact.status)
            ||typeof fact.name!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(fact.name))return;
          tools.set(ordinal,{ordinal,at:safeTime(fact.at,opened),duration:Math.round(Math.max(0,Math.min(3600000,Number(fact.duration)||0))),name:fact.dispatched===true?fact.name:'not-dispatched',status:fact.status,dispatched:fact.dispatched===true});
        }
      },
      finish(projectDir,final){
        if(captured||pending>=12||!final||!['completed','failed','cancelled'].includes(final.status)
          ||typeof final.runId!=='string'||!ID.test(final.runId))return;
        captured=true; pending++;
        const traceId=id('trace',final.runId).slice(0,32), root=id('root',final.runId).slice(0,16), end=safeTime(now(),opened);
        const same=(kind,ord)=>id(kind,final.runId,ord).slice(0,16);
        const span=(name,type,spanId,start,stop,attributes,parentSpanId,ok)=>({
          traceId,spanId,...(parentSpanId?{parentSpanId}:{}),name,kind:1,
          startTimeUnixNano:nanos(start),endTimeUnixNano:nanos(Math.max(start,stop)),status:{code:ok?1:2},
          attributes:[attr('langfuse.trace.name','open-etf-agent research'),attr('langfuse.observation.type',type),...attributes],
        });
        const code=cleanCode(final.code);
        const spans=[span('Research Run','agent',root,opened,end,[
          metadata('runtime_status',final.status),metadata('delivery_status',final.delivery==='publication'?'published':final.delivery==='report'?'report-saved':final.delivery==='not-created'?'not-created':'unavailable'),
          ...(code?[metadata('runtime_code',code)]:[]),
          ...['modelUsed','toolUsed','modelLimit','toolLimit'].flatMap(k=>integer(final[k])===null?[]:[metadata(k,final[k])]),
        ],null,final.status==='completed')];
        for(const a of attempts.values())spans.push(span('Model dispatch','generation',same('model',a.ord),a.at,a.end,[
          metadata('dispatch_status',a.status),metadata('accounting_status','not-exported'),
          ...(a.code?[metadata('runtime_code',a.code)]:[]),
          ...(a.model?[attr('langfuse.observation.model.name',a.model)]:[]),
          ...(a.usage?[attr('langfuse.observation.usage_details',JSON.stringify(a.usage))]:[]),
        ],root,a.status==='responded'));
        for(const t of tools.values())spans.push(span('Tool result','tool',same('tool',t.ordinal),Math.max(opened,t.at-t.duration),t.at,[
          metadata('tool_name',t.name),metadata('tool_status',t.status),metadata('tool_dispatched',t.dispatched),
        ],root,t.status==='succeeded'));
        if(['publication','report'].includes(final.delivery))spans.push(span('Delivery confirmed','event',same('delivery',1),end,end,[metadata('readback',final.delivery)],root,true));
        const payload=JSON.stringify({resourceSpans:[{resource:{attributes:[attr('service.name','open-etf-agent')]},scopeSpans:[{scope:{name:'open-etf-agent.owner-telemetry'},spans}]}]});
        const flight=Promise.resolve().then(async()=>{
          const directory=await ensureSafeDirectory(join(projectDir,'langfuse-export'));
          try{await publishImmutable(directory,traceId+'.json',Buffer.from(JSON.stringify({schemaVersion:'telemetry-export-intent@1',traceId})));}
          catch(error){if(error.code==='EEXIST')return;throw error;}
          // Once a delivery is ambiguous do not retry the OTLP export, and never retry the research.
          let state='unknown';
          try {
            const response=await send(origin+'/api/public/otel/v1/traces',{method:'POST',redirect:'error',signal:AbortSignal.timeout(4000),headers:{
              authorization:auth,'content-type':'application/json','x-langfuse-ingestion-version':'4',
            },body:payload});
            if(!response.ok)state='rejected';
            else{
              const reader=response.body?.getReader(), parts=[];let bytes=0;
              if(reader)try{for(;;){
                const v=await reader.read();if(v.done)break;
                bytes+=v.value.length;if(bytes>8192){await reader.cancel();break;}
                parts.push(v.value);
              }}finally{reader.releaseLock();}
              if(bytes<=8192){const body=bytes?JSON.parse(Buffer.concat(parts).toString('utf8')):{};
                if(body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>k==='partialSuccess')){
                  const rejected=body.partialSuccess?.rejectedSpans;
                  if(rejected===undefined||/^[0-9]+$/.test(String(rejected)))
                    state=Number(rejected)>0?'partial':'transport-accepted';
                }
              }
            }
          } catch {}
          await publishImmutable(directory,traceId+'.settled.json',Buffer.from(JSON.stringify({schemaVersion:'telemetry-export-result@1',state})));
        }).catch(()=>{}).finally(()=>{pending--;work.delete(flight);});
        work.add(flight);
      },
    };
  }
  return {start,drain:()=>Promise.allSettled([...work])};
}
