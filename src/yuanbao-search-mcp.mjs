// Fixed, opt-in Tencent WSA transport. Tool discovery and original page reading
// stay with the existing owner; no third-party tool names or endpoints are accepted.
export const YUANBAO_MCP_ENDPOINT='https://api.wsa.cloud.tencent.com/Mcp';
const version='2025-06-18';
const limit=512*1024;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const invalid=()=>fail('WEB_SEARCH_RESPONSE_INVALID');
const parse=text=>{try{return JSON.parse(text);}catch{invalid();}};
const media=r=>(r.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
const uniqueResult=(v,id)=>{
 if(v?.jsonrpc!=='2.0'||v.id!==id||Object.hasOwn(v,'result')===Object.hasOwn(v,'error'))invalid();
 if(v.error)fail('WEB_SEARCH_PROVIDER_ERROR');
 if(!v.result||typeof v.result!=='object'||Array.isArray(v.result))invalid();
 return v.result;
};
async function readMessage(r,id){
 const contentType=media(r);
 if(!['application/json','text/event-stream'].includes(contentType)){await r.body?.cancel();invalid();}
 const reader=r.body?.getReader();if(!reader)invalid();
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let bytes=0,text='',data=[];
 const frame=()=>{
  if(!data.length)return;
  const msg=parse(data.join('\n'));data=[];
  // Notifications may interleave with the matching response. Unsupported
  // server-initiated requests are never executed; a matching result is needed.
  if(msg?.jsonrpc==='2.0'&&msg.id===id)return uniqueResult(msg,id);
 };
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(!done&&((bytes+=value.byteLength)>limit))fail('WEB_SEARCH_BODY_LIMIT');
   try{text+=done?decoder.decode():decoder.decode(value,{stream:true});}catch{invalid();}
   if(contentType==='application/json'){if(done)return uniqueResult(parse(text),id);continue;}
   let i;
   while((i=text.indexOf('\n'))>=0){
    const line=text.slice(0,i).replace(/\r$/,'');text=text.slice(i+1);
    if(!line){const result=frame();if(result)return result;}
    else if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));
   }
   if(done)invalid();
  }
 }finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
}
export async function callYuanbaoSearchMcp({query,id,signal,fetchImpl,authorization}){
 const bound=AbortSignal.any([signal??new AbortController().signal,AbortSignal.timeout(90000)]);
 let session;
 const post=async(method,params,requestId,initialized=false)=>{
  const r=await fetchImpl(YUANBAO_MCP_ENDPOINT,{
   method:'POST',redirect:'error',signal:bound,
   headers:{authorization,'content-type':'application/json',accept:'application/json, text/event-stream',
    ...(initialized?{'mcp-protocol-version':version}:{}),...(session?{'mcp-session-id':session}:{})},
   body:JSON.stringify({jsonrpc:'2.0',...(requestId===undefined?{}:{id:requestId}),method,...(params?{params}:{})}),
  });
  if(!r.ok){await r.body?.cancel();fail(({401:'WEB_SEARCH_AUTH',402:'WEB_SEARCH_PAYMENT_REQUIRED',403:'WEB_SEARCH_FORBIDDEN',429:'WEB_SEARCH_QUOTA'})[r.status]??'WEB_SEARCH_PROVIDER_ERROR');}
  if(requestId===undefined){
   await r.body?.cancel();if(r.status!==202)invalid();return;
  }
  if(method==='initialize'){
   session=r.headers.get('mcp-session-id')??undefined;
   if(session!==undefined&&(!/^[\x21-\x7e]{1,256}$/.test(session))){session=undefined;await r.body?.cancel();invalid();}
  }
  return readMessage(r,requestId);
 };
 try{
  const initialized=await post('initialize',{protocolVersion:version,capabilities:{},clientInfo:{name:'open-etf-agent',version:'1'}},id+'-init');
  if(initialized.protocolVersion!==version||!initialized.capabilities?.tools)invalid();
  await post('notifications/initialized',undefined,undefined,true);
  const result=await post('tools/call',{name:'SearchPro',arguments:{Query:query,Mode:0,Cnt:10}},id+'-search',true);
  let payload=result.structuredContent;
  if(payload===undefined){
   if(!Array.isArray(result.content)||result.content.length!==1||result.content[0]?.type!=='text'||typeof result.content[0].text!=='string'){
    if(result.isError===true)fail('WEB_SEARCH_PROVIDER_ERROR');invalid();
   }
   try{payload=JSON.parse(result.content[0].text);}catch{if(result.isError===true)fail('WEB_SEARCH_PROVIDER_ERROR');invalid();}
  }
  if(result.isError===true&&!payload?.Response?.Error&&!payload?.Error)fail('WEB_SEARCH_PROVIDER_ERROR');
  return payload;
 }finally{
  if(session&&!bound.aborted){
   // Ending the session is best-effort cleanup, not another search. An
   // unsupported DELETE never changes the original tool outcome.
   try{
    const r=await fetchImpl(YUANBAO_MCP_ENDPOINT,{method:'DELETE',redirect:'error',
     signal:AbortSignal.any([bound,AbortSignal.timeout(1500)]),headers:{authorization,'mcp-protocol-version':version,'mcp-session-id':session}});
    void r.body?.cancel().catch(()=>{});
   }catch{}
  }
 }
}
