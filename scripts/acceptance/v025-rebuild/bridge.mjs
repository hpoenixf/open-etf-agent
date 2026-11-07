import {createHash} from 'node:crypto';
export const ENDPOINT='https://opencode.ai/inference/go/openai/v1/chat/completions';
export const MODEL='deepseek-v4.1-flash';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
// Parse JSON without accepting ambiguous duplicate keys, including escaped aliases.
export function parseUniqueJSON(text){
 const parsed=JSON.parse(text);let at=0;
 const ws=()=>{while(/\s/.test(text[at]??'')&&at<text.length)at++;};
 function string(){const start=at++;while(at<text.length){if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"')return JSON.parse(text.slice(start,at));}fail('BRIDGE_JSON');}
 function value(depth=0){if(depth>128)fail('BRIDGE_JSON_DEPTH');ws();if(text[at]==='"'){string();return;}if(text[at]==='{'){at++;ws();const keys=new Set();if(text[at]==='}'){at++;return;}for(;;){ws();const key=string();if(keys.has(key))fail('BRIDGE_DUPLICATE_KEY');keys.add(key);ws();at++;value(depth+1);ws();if(text[at++]==='}')return;}}if(text[at]==='['){at++;ws();if(text[at]===']'){at++;return;}for(;;){value(depth+1);ws();if(text[at++]===']')return;}}while(at<text.length&&!/[\s,}\]]/.test(text[at]))at++;}
 value();return parsed;
}
// Only public protocol enums may be retained; arbitrary error text is never evidence text.
function errorDiagnostic(parsed){
 const error=parsed?.error;const out={};
 const allowed={type:new Set(['invalid_request_error','authentication_error','permission_error','rate_limit_error','server_error']),code:new Set(['invalid_api_key','invalid_request','invalid_request_error','model_not_found','rate_limit_exceeded','insufficient_quota','unsupported_parameter','invalid_value']),param:new Set(['model','messages','tools','tool_choice','n','stream','max_tokens','temperature','response_format','stream_options'])};
 for(const key of ['type','code','param'])if(error&&Object.hasOwn(error,key)){const value=error[key];if(typeof value==='string'&&allowed[key].has(value))out[key]=value;else{const bytes=Buffer.from(JSON.stringify(value)??'undefined');out[key+'Omitted']={sha256:hash(bytes),bytes:bytes.length};}}
 if(error&&Object.hasOwn(error,'message')){const bytes=Buffer.from(JSON.stringify(error.message));out.messageOmitted={sha256:hash(bytes),bytes:bytes.length};}
 return out;
}
function contextCopy(c){
 if(!c||!['main','child','summary'].includes(c.role)||!['main','summary','compaction','child'].includes(c.purpose)||!Number.isSafeInteger(c.modelOrdinal)||c.modelOrdinal<1||typeof c.runId!=='string'||typeof c.rootId!=='string'||c.runId.length>256||c.rootId.length>256||!/^[a-f0-9]{64}$/.test(c.inputHash))fail('BRIDGE_CONTEXT');
 return Object.freeze({role:c.role,rootId:c.rootId,runId:c.runId,modelOrdinal:c.modelOrdinal,purpose:c.purpose,inputHash:c.inputHash});
}
// Engineering adapter only. sink methods must durably commit before resolving.
// The sink is independently owned, never Session or a replacement product ledger.
export function createBridge({sink,sessionId,fetchImpl,timeoutMs=120000}){
 if(!sink||['reserve','recordBody','recordGo','recordAdoption','stop'].some(k=>typeof sink[k]!=='function')||typeof fetchImpl!=='function'||!/^[A-Za-z0-9_-]{1,100}$/.test(sessionId)||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)fail('BRIDGE_CONFIGURATION');
 let stopped=false,active=false,adopting=false,pending=null;
 async function stop(ticket,reason,detail={}){stopped=true;await sink.stop({ticket,reason,...detail});}
 async function fetchBridge(url,init,requestContext){
  if(stopped)fail('BRIDGE_STOPPED');
  if(active||pending){await stop(pending?.ticket??null,'BRIDGE_SERIAL_OR_ADOPTION');fail('BRIDGE_SERIAL_OR_ADOPTION');}
  active=true;let ticket=null,timer,reader,controller;let removeAbort=()=>{};let responseStatus=null;
  try{
   if(String(url)!==ENDPOINT||init?.method!=='POST'||init.redirect!=='error'||typeof init.body!=='string')fail('BRIDGE_REQUEST');
   const bytes=Buffer.from(init.body);if(bytes.length>1048576)fail('BRIDGE_INPUT_LIMIT');
   const body=parseUniqueJSON(init.body);if(body.model!==MODEL||body.stream!==false||body.n!==1||!Array.isArray(body.messages)||!Array.isArray(body.tools))fail('BRIDGE_REQUEST');
   const headers=new Headers(init.headers);const auth=headers.get('authorization');if(!auth?.startsWith('Bearer ')||auth.length<12)fail('BRIDGE_AUTHORIZATION');
   const secret=auth.slice(7),context=contextCopy(requestContext);
   init.signal?.throwIfAborted();
   ticket=await sink.reserve({context,requestSha256:hash(bytes),requestBytes:bytes.length});
   if(!ticket||typeof ticket.id!=='string')fail('BRIDGE_TICKET');
   if(stopped)fail('BRIDGE_STOPPED');
   controller=new AbortController();const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});removeAbort=()=>init.signal?.removeEventListener('abort',abort);if(init.signal?.aborted)abort();
   const deadline=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Object.assign(new Error('BRIDGE_ABORTED'),{code:'BRIDGE_ABORTED'})),{once:true});timer=setTimeout(abort,timeoutMs);});
   const bounded=p=>Promise.race([p,deadline]);
   controller.signal.throwIfAborted();
   headers.set('user-agent','open-etf-agent-rebuild-acceptance/0.25');headers.set('x-opencode-session',sessionId);
   const response=await bounded(fetchImpl(url,{...init,headers,signal:controller.signal}));responseStatus=response.status;
   if(response.redirected||response.url&&response.url!==ENDPOINT)fail('BRIDGE_REDIRECT');
   if(response.status!==200)await stop(ticket,'BRIDGE_HTTP',{httpStatus:response.status});
   reader=response.body?.getReader();if(!reader)fail('BRIDGE_BODY');
   const parts=[];let size=0;
   for(;;){const {done,value}=await bounded(reader.read());if(done)break;if(!(value instanceof Uint8Array))fail('BRIDGE_BODY');size+=value.length;if(size>1048576)fail('BRIDGE_BODY_LIMIT');parts.push(Buffer.from(value));}
   const raw=Buffer.concat(parts),sha=hash(raw);const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
   // Check decoded JSON too: escaped echoes must not enter the evidence store.
   if(text.includes(secret))fail('BRIDGE_CREDENTIAL_ECHO');
   let parsed;try{parsed=parseUniqueJSON(text);}catch(error){if(response.status===200)throw error;}
   if(parsed&&JSON.stringify(parsed).includes(secret))fail('BRIDGE_CREDENTIAL_ECHO');
   if(response.status!==200){await stop(ticket,'BRIDGE_HTTP',{httpStatus:response.status,bodySha256:sha,bodyBytes:raw.length,errorPreview:'[provider error body omitted]',errorDiagnostic:errorDiagnostic(parsed)});fail('BRIDGE_HTTP');}
   if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail('BRIDGE_CONTENT_TYPE');
   const u=parsed?.usage,p=u?.opencode;
   if(u?.cost!==0||p?.billing_source!=='go'||p?.estimated!==undefined&&p.estimated!==false||u?.estimated!==undefined&&u.estimated!==false)fail('BRIDGE_COST_OR_ESTIMATE');
   await bounded(sink.recordBody({ticket,context,bodySha256:sha,bytes:raw}));
   await bounded(sink.recordGo({ticket,context,bodySha256:sha,bodyBytes:raw.length,httpStatus:200,cost:0,billingSource:'go',estimated:false}));
   if(stopped)fail('BRIDGE_STOPPED');
   pending={ticket,bodySha256:sha,context};
   return new Response(raw,{status:200,headers:{'content-type':response.headers.get('content-type')}});
  }catch(error){if(!stopped)await stop(ticket,/^BRIDGE_[A-Z_]+$/.test(error?.code??'')?error.code:'BRIDGE_RESPONSE_UNKNOWN',{httpStatus:responseStatus});fail(stopped?'BRIDGE_STOPPED':'BRIDGE_RESPONSE_UNKNOWN');}
  finally{clearTimeout(timer);removeAbort();active=false;if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}}
 }
 return{
  fetchImpl:fetchBridge,
  state:()=>({stopped,active,adopting,pending:pending?structuredClone(pending):null}),
  async adopt({ticketId,bodySha256,evidence}){
   const captured=pending;
   if(adopting){await stop(captured?.ticket??null,'BRIDGE_ADOPTION_CONCURRENT');fail('BRIDGE_STOPPED');}
   if(stopped||active||!captured||captured.ticket.id!==ticketId||captured.bodySha256!==bodySha256||!evidence||typeof evidence!=='object')fail('BRIDGE_ADOPTION');
   adopting=true;
   try{await sink.recordAdoption({...captured,evidence});if(stopped)fail('BRIDGE_STOPPED');if(pending!==captured)fail('BRIDGE_ADOPTION');pending=null;}
   catch{await stop(captured.ticket,'BRIDGE_ADOPTION_UNKNOWN');fail('BRIDGE_STOPPED');}
   finally{adopting=false;}
  },
  async reject(reason='BRIDGE_NATIVE_REJECTED'){if(!/^BRIDGE_[A-Z_]+$/.test(reason))fail('BRIDGE_REASON');await stop(pending?.ticket??null,reason);}
 };
}
