import {open,constants,lstat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ensureSafeDirectory,safeDirectory} from './storage-files.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const count=value=>Number.isSafeInteger(value)&&value>=0;
export async function openLiveLedger({directory,capCny}={}){
  if(capCny!==undefined&&(!finite(capCny)||capCny<100||capCny>100000))fail('LIVE_COST_LIMIT');directory=await ensureSafeDirectory(directory);const lockPath=join(directory,'writer.lock');let lock,file,owned;let closed=false;let queue=Promise.resolve();
  async function cleanup(){await file?.close();file=null;if(lock){await lock.close();lock=null;const current=await lstat(lockPath).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(current?.isFile()&&owned&&current.dev===owned.dev&&current.ino===owned.ino)await unlink(lockPath);}}
  const attempts=new Map();let header;
  try{
    try{lock=await open(lockPath,'wx',0o600);owned=await lock.stat();}catch(error){if(error.code==='EEXIST')fail('LIVE_LEDGER_OWNED');throw error;}
    file=await open(join(directory,'requests.jsonl'),constants.O_RDWR|constants.O_CREAT|constants.O_APPEND|constants.O_NOFOLLOW,0o600);const stat=await file.stat();if(!stat.isFile()||(stat.mode&0o077)||stat.size>2097152)fail('LIVE_LEDGER_INVALID');
    const buffer=Buffer.alloc(2097153);let at=0;while(at<buffer.length){const{bytesRead}=await file.read(buffer,at,buffer.length-at,at);if(!bytesRead)break;at+=bytesRead;}if(at>2097152)fail('LIVE_LEDGER_INVALID');const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,at));if(text&&!text.endsWith('\n'))fail('LIVE_LEDGER_INCOMPLETE');const events=text.trim()?text.trim().split('\n').map(line=>JSON.parse(line)):[];
    if(events.length){header=events.shift();if(header.type!=='budget'||header.schemaVersion!=='public-live-budget@1'||!finite(header.capCny)||header.capCny<100||header.capCny>100000||(capCny!==undefined&&header.capCny!==capCny)||header.reserveCny!==100||header.maxRequests!==40||header.perVersionMax!==8||header.conservativeCnyPerUsd!==20)fail('LIVE_LEDGER_SCOPE');
      for(const event of events){if(event.type==='reserved'){if(typeof event.id!=='string'||attempts.has(event.id)||!/^v0[1-5]$/.test(event.version)||!/^([a-f0-9]{40})$/.test(event.pin)||event.reserveCny!==100||!count(event.requestBytes)||event.requestBytes>32768)fail('LIVE_LEDGER_INVALID');attempts.set(event.id,{...event,observation:null});}else if(event.type==='settled'&&attempts.has(event.id)&&attempts.get(event.id).observation===null){attempts.get(event.id).observation=validateObservation(event.observation);}else fail('LIVE_LEDGER_INVALID');}
    }else{header={type:'budget',schemaVersion:'public-live-budget@1',capCny:capCny??100000,reserveCny:100,maxRequests:40,perVersionMax:8,conservativeCnyPerUsd:20};await file.write(JSON.stringify(header)+'\n');await file.sync();}
  }catch(error){await cleanup();throw error;}
  const inheritedUnknown=new Set([...attempts.values()].filter(value=>value.observation===null).map(value=>value.id));
  function snapshot(){const values=[...attempts.values()].map(value=>({...structuredClone(value),outcome:inheritedUnknown.has(value.id)?'unknown-from-prior-owner':value.observation?.status??'reserved-current-owner'}));return{capCny:header.capCny,reservedCny:values.length*100,accountedCny:values.reduce((sum,a)=>sum+Math.max(100,finite(a.observation?.costUsd)?a.observation.costUsd*20:0),0),blocked:inheritedUnknown.size>0||values.some(a=>a.observation&&(a.observation.status!=='completed'||a.observation.costAnomaly)),attempts:values};}
  function serialize(work){if(closed)fail('LIVE_LEDGER_CLOSED');const operation=queue.then(work);queue=operation.catch(()=>{});return operation;}
  async function append(event){await safeDirectory(directory);await file.write(JSON.stringify(event)+'\n');await file.sync();}
  return{
    async reserve({version,pin,requestBytes}){return serialize(async()=>{if(!/^v0[1-5]$/.test(version)||!/^([a-f0-9]{40})$/.test(pin)||!count(requestBytes)||requestBytes>32768)fail('LIVE_SCOPE');const state=snapshot();if(state.blocked)fail('PROVIDER_STOPPED');if(state.attempts.length>=40||state.attempts.filter(a=>a.version===version).length>=8)fail('LIVE_REQUEST_LIMIT');if(state.accountedCny+100>header.capCny)fail('LIVE_COST_LIMIT');const event={type:'reserved',id:randomUUID(),version,pin,requestBytes,reserveCny:100};await append(event);attempts.set(event.id,{...event,observation:null});return event.id;});},
    async settle(id,observation){return serialize(async()=>{if(!attempts.has(id)||attempts.get(id).observation!==null)fail('LIVE_LEDGER_IDENTITY');observation=validateObservation(observation);await append({type:'settled',id,observation});attempts.get(id).observation=observation;});},
    async snapshot(){await queue;return snapshot();},async close(){if(closed)return;closed=true;await queue;await cleanup();}
  };
}
function validateObservation(value){
  if(!value||!['completed','http-error','network-error','response-error','cancelled'].includes(value.status)||!(value.httpStatus===null||Number.isInteger(value.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599)||!(value.costUsd===null||finite(value.costUsd))||!(value.listCostUsd===null||finite(value.listCostUsd))||!(value.allowanceUsd===null||finite(value.allowanceUsd))||!(value.billingSource===null||['free','balance','go','go-plus','byok'].includes(value.billingSource))||typeof value.costAnomaly!=='boolean'||typeof value.estimated!=='boolean')fail('LIVE_OBSERVATION_INVALID');
  const tokens={};for(const key of ['prompt_tokens','completion_tokens','total_tokens'])if(count(value.tokens?.[key]))tokens[key]=value.tokens[key];return{status:value.status,httpStatus:value.httpStatus,costUsd:value.costUsd,listCostUsd:value.listCostUsd,allowanceUsd:value.allowanceUsd,billingSource:value.billingSource,costAnomaly:value.costAnomaly,estimated:value.estimated,tokens};
}
function usageObservation(response,parsed){
  const usage=parsed?.usage;const provider=usage?.opencode;let costAnomaly=false;
  const money=(object,key)=>{if(object?.[key]===undefined)return null;if(!finite(object[key])){costAnomaly=true;return null;}return object[key];};
  const costUsd=money(usage,'cost'),listCostUsd=money(provider,'list_cost'),allowanceUsd=money(provider,'allowance');let billingSource=provider?.billing_source??null;if(billingSource!==null&&!['free','balance','go','go-plus','byok'].includes(billingSource)){costAnomaly=true;billingSource=null;}if(finite(costUsd)&&costUsd*20>100)costAnomaly=true;
  return validateObservation({status:response.ok?'completed':'http-error',httpStatus:response.status,costUsd,listCostUsd,allowanceUsd,billingSource,costAnomaly,estimated:provider?.estimated===true,tokens:usage});
}
export function createControlledFetch({configuration,ledger,version,pin,sessionId,fetchImpl=globalThis.fetch}){
  if(typeof configuration?.apiKey!=='string'||typeof configuration.endpoint!=='string'||typeof configuration.model!=='string'||typeof sessionId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(sessionId)||typeof ledger?.reserve!=='function')fail('LIVE_SCOPE');
  return async(url,init)=>{
    init?.signal?.throwIfAborted();let body;try{body=JSON.parse(init.body);}catch{fail('LIVE_SCOPE');}
    if(String(url)!==configuration.endpoint||init.method!=='POST'||body.model!==configuration.model||body.stream!==false||body.n!==1||!Array.isArray(body.messages)||!Array.isArray(body.tools)||Object.keys(body).some(key=>!['model','stream','n','messages','tools'].includes(key)))fail('LIVE_SCOPE');
    const requestBody=JSON.stringify({...body,max_tokens:2048});const requestBytes=Buffer.byteLength(requestBody);if(requestBytes>32768)fail('LIVE_INPUT_LIMIT');
    const id=await ledger.reserve({version,pin,requestBytes});const controller=new AbortController();const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});if(init.signal?.aborted)abort();const timer=setTimeout(abort,60000);let settled=false;
    try{
      const response=await fetchImpl(configuration.endpoint,{method:'POST',redirect:'error',signal:controller.signal,headers:{authorization:'Bearer '+configuration.apiKey,'content-type':'application/json','user-agent':'open-etf-agent-validation/0.5','x-opencode-session':sessionId},body:requestBody});
      const reader=response.body?.getReader();if(!reader)fail('LIVE_RESPONSE_INVALID');const parts=[];let size=0;
      try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();fail('LIVE_RESPONSE_LIMIT');}parts.push(value);}}finally{reader.releaseLock();}
      const bytes=Buffer.concat(parts);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes(configuration.apiKey))fail('LIVE_CREDENTIAL_ECHO');let parsed;try{parsed=JSON.parse(text);}catch{if(response.ok)fail('LIVE_RESPONSE_INVALID');parsed={};}
      const observation=usageObservation(response,parsed);await ledger.settle(id,observation);settled=true;if(observation.costAnomaly)fail('LIVE_COST_ANOMALY');return new Response(bytes,{status:response.status,headers:{'content-type':'application/json'}});
    }catch(error){if(!settled)await ledger.settle(id,{status:controller.signal.aborted?'cancelled':error.code?.startsWith('LIVE_RESPONSE')?'response-error':'network-error',httpStatus:null,costUsd:null,listCostUsd:null,allowanceUsd:null,billingSource:null,costAnomaly:false,estimated:false,tokens:{}});if(error.code?.startsWith('LIVE_'))throw error;fail(controller.signal.aborted?'LIVE_CANCELLED':'LIVE_NETWORK_ERROR');}
    finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
  };
}
