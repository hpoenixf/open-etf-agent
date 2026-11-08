import dns from 'node:dns';
import https from 'node:https';
import {createHash} from 'node:crypto';
import robotsParser from 'robots-parser';
import {WEB_USER_AGENT,normalizeWebUrl,publicAddresses,webLimits,webFailure,boundedRobotsText,normalizeRobotsOctets} from './web-policy.mjs';
import {extractWebText} from './web-extraction.mjs';
export {WEB_LIMITS,WEB_USER_AGENT,normalizeWebUrl} from './web-policy.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const redirectCodes=new Set([301,302,303,307,308]);
const aborted=signal=>{if(signal.aborted)throw signal.reason;};
function resolveAddress(hostname,signal,timeoutMs){
 return new Promise((resolve,reject)=>{
  let settled=false;const timer=setTimeout(()=>done(webFailure('WEB_DNS_TIMEOUT')),timeoutMs);
  const abort=()=>done(signal.reason);function done(error,value){if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve(value);}
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
  // The OS lookup may complete after cancellation; its result is then ignored.
  // No HTTP dispatch occurs before successful complete-address validation.
  dns.lookup(hostname,{all:true,verbatim:true},(error,records)=>{if(error){done(webFailure('WEB_DNS_UNAVAILABLE'));return;}try{done(null,publicAddresses(records)[0]);}catch(error){done(error);}});
 });
}
function requestBytes(url,address,signal,maximum,state){
 return new Promise((resolve,reject)=>{
  let request,response,settled=false,ended=false;const chunks=[];let bytes=0;
  const done=(error,value)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);if(error){response?.destroy();request?.destroy();reject(error);}else resolve(value);};
  const abort=()=>done(signal.reason);signal.addEventListener('abort',abort,{once:true});if(signal.aborted){abort();return;}
  try{
   state.requests++;
   request=https.request(url,{method:'GET',agent:false,maxHeaderSize:8192,rejectUnauthorized:true,servername:url.hostname,lookup:(_host,options,callback)=>options?.all?callback(null,[address]):callback(null,address.address,address.family),headers:{'User-Agent':WEB_USER_AGENT,'Accept':'text/html, text/plain;q=0.9','Accept-Encoding':'identity'}},res=>{
    response=res;const status=res.statusCode,headers=res.headers;
    if(!Number.isSafeInteger(status)){done(webFailure('WEB_HTTP_INVALID'));return;}
    const result={url:url.href,status,contentType:headers['content-type']??null,location:headers.location??null,body:Buffer.alloc(0)};
    state.responses++;
    if(status!==200){res.destroy();done(null,result);return;}
    const encoding=headers['content-encoding'];if(encoding&&encoding.toLowerCase()!=='identity'){done(webFailure('WEB_CONTENT_ENCODING'));return;}
    const length=headers['content-length'];if(length!==undefined&&(!/^[0-9]+$/.test(length)||Number(length)>maximum||Number(length)>state.remainingBytes)){done(webFailure('WEB_BODY_LIMIT'));return;}
    res.on('data',chunk=>{if(settled)return;const b=Buffer.from(chunk);bytes+=b.length;state.receivedBytes+=b.length;state.remainingBytes-=b.length;if(bytes>maximum||state.remainingBytes<0){done(webFailure('WEB_BODY_LIMIT'));return;}chunks.push(b);});
    res.once('end',()=>{ended=true;done(null,{...result,body:Buffer.concat(chunks)});});
    res.once('error',()=>done(webFailure('WEB_HTTP_INTERRUPTED')));res.once('aborted',()=>done(webFailure('WEB_HTTP_INTERRUPTED')));res.once('close',()=>{if(!ended&&!settled)done(webFailure('WEB_HTTP_INTERRUPTED'));});
   });
   request.once('error',()=>done(webFailure('WEB_NETWORK_UNAVAILABLE')));
   // Count before construction because the client may begin connecting early.
   request.end();
  }catch(error){done(error?.code?.startsWith('WEB_')?error:webFailure('WEB_NETWORK_UNAVAILABLE'));}
 });
}
function httpFailure(status){if(status===401||status===403)return webFailure('WEB_ACCESS_DENIED',{httpStatus:status});if(status===429)return webFailure('WEB_RATE_LIMITED',{httpStatus:status});return webFailure('WEB_HTTP_STATUS',{httpStatus:status});}
/** Explicitly admitted pages only. This API accepts no transport/proxy injection. */
export async function acquireWebPage({url,allowedUrls,signal,limits:input}={}){
 const limits=webLimits(input),requestedUrl=normalizeWebUrl(url);
 if(!Array.isArray(allowedUrls)||allowedUrls.length<1||allowedUrls.length>16)throw webFailure('WEB_AUTHORITY_INVALID');
 const allowed=new Set(allowedUrls.map(normalizeWebUrl));if(allowed.size!==allowedUrls.length||!allowed.has(requestedUrl))throw webFailure('WEB_URL_NOT_ADMITTED');
 const deadlineAt=Date.now()+limits.timeoutMs;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(webFailure('WEB_TIMEOUT')),limits.timeoutMs),forward=()=>controller.abort(webFailure('WEB_CANCELLED'));
 signal?.addEventListener('abort',forward,{once:true});if(signal?.aborted)forward();
 const state={requests:0,responses:0,receivedBytes:0,remainingBytes:limits.totalBytes},redirects=[],robots=[],cache=new Map();
 function checkDeadline(){if(Date.now()>=deadlineAt&&!controller.signal.aborted)controller.abort(webFailure('WEB_TIMEOUT'));aborted(controller.signal);}
 async function fetchOne(href,maximum){checkDeadline();if(state.requests>=limits.requests)throw webFailure('WEB_REQUEST_LIMIT');const u=new URL(normalizeWebUrl(href)),address=await resolveAddress(u.hostname,controller.signal,Math.min(limits.dnsMs,limits.timeoutMs));aborted(controller.signal);return requestBytes(u,address,controller.signal,maximum,state);}
 async function rulesFor(page){
  const origin=new URL(page).origin;if(cache.has(origin))return cache.get(origin);
  let href=origin+'/robots.txt',redirectCount=0;const hops=[];
  while(true){const response=await fetchOne(href,limits.robotsBytes);hops.push({url:href,status:response.status});
   if(redirectCodes.has(response.status)){
    if(++redirectCount>limits.redirects||typeof response.location!=='string')throw webFailure('WEB_ROBOTS_REDIRECT');
    const next=normalizeWebUrl(new URL(response.location,href).href),u=new URL(next);
    if(u.origin!==origin||u.pathname!=='/robots.txt'||u.search)throw webFailure('WEB_ROBOTS_REDIRECT');href=next;continue;
   }
   if(response.status===404||response.status===410){const fact={url:href,status:response.status,sha256:null,bytes:0,hops};robots.push(fact);cache.set(origin,null);return null;}
   if(response.status!==200)throw httpFailure(response.status);
   let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(response.body);}catch{throw webFailure('WEB_ROBOTS_INVALID');}
   const normalized=boundedRobotsText(text),parser=robotsParser(href,normalized);
   const fact={url:href,status:200,sha256:digest(response.body),bytes:response.body.length,hops};robots.push(fact);cache.set(origin,parser);return parser;
  }
 }
 try{
  let href=requestedUrl;
  for(let i=0;;i++){
   const rules=await rulesFor(href);aborted(controller.signal);
   if(rules&&rules.isAllowed(normalizeRobotsOctets(href),WEB_USER_AGENT)!==true)throw webFailure('WEB_ROBOTS_DISALLOWED');
   const response=await fetchOne(href,limits.bodyBytes);
   if(redirectCodes.has(response.status)){
    if(i>=limits.redirects||typeof response.location!=='string')throw webFailure('WEB_REDIRECT_LIMIT');
    const next=normalizeWebUrl(new URL(response.location,href).href);if(!allowed.has(next))throw webFailure('WEB_REDIRECT_NOT_ADMITTED');redirects.push({url:href,status:response.status,location:next});href=next;continue;
   }
   if(response.status!==200)throw httpFailure(response.status);
   aborted(controller.signal);const extraction=extractWebText(response.body,response.contentType,{limits});checkDeadline();
   return {body:response.body,requestedUrl,finalUrl:href,fetchedAt:new Date().toISOString(),contentType:response.contentType,redirects,robots,...extraction,requestCount:state.requests};
  }
 }catch(error){
  const safe=error?.code?.startsWith('WEB_')?error:webFailure('WEB_ACQUISITION_FAILED');safe.requestCount=state.requests;safe.responseCount=state.responses;safe.receivedBytes=state.receivedBytes;safe.dispatchState=state.requests===0?'not-dispatched':state.responses<state.requests?'outcome-unknown':'response-observed';safe.automaticReplayAllowed=false;throw safe;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',forward);}
}
