import https from 'node:https';
import {isIP} from 'node:net';
import ipaddr from 'ipaddr.js';
import {createHash} from 'node:crypto';
import {webFailure,publicAddresses} from './web-policy.mjs';
export const PLATFORM_PROFILE='platform-doh-pinned@1';
const DNS_HOST='cloudflare-dns.com';
export function platformProxyConfig(env=process.env){
 const raw=env.https_proxy||env.HTTPS_PROXY;
 if(!raw||env.NODE_USE_ENV_PROXY==='0')throw webFailure('WEB_PLATFORM_PROXY_REQUIRED');
 let proxy;try{proxy=new URL(raw);}catch{throw webFailure('WEB_PLATFORM_PROXY_INVALID');}
 if(!['http:','https:'].includes(proxy.protocol)||/[\r\n]/.test(raw)||proxy.search||proxy.hash||proxy.pathname!=='/')throw webFailure('WEB_PLATFORM_PROXY_INVALID');
 if(process.versions.node!=='26.11.1')throw webFailure('WEB_PLATFORM_RUNTIME_UNQUALIFIED');
 const noProxy=env.no_proxy||env.NO_PROXY||'';
 return {proxy:proxy.href,noProxy,noProxyRules:parseNoProxy(noProxy)};
}
const preparedProfiles=new WeakMap();
export function prepareWebNetworkProfile(name='system-direct@1'){
 if(!['system-direct@1',PLATFORM_PROFILE].includes(name))throw webFailure('WEB_NETWORK_PROFILE_INVALID');
 const token=Object.freeze({networkProfile:name});
 preparedProfiles.set(token,name===PLATFORM_PROFILE?Object.freeze(platformProxyConfig()):null);return token;
}
export function readPreparedWebNetworkProfile(token,name){
 if(!token||!preparedProfiles.has(token)||token.networkProfile!==name)throw webFailure('WEB_NETWORK_PROFILE_INVALID');
 return preparedProfiles.get(token);
}
function selectorAddress(value){
 if(!isIP(value))return null;
 const parsed=ipaddr.parse(value);
 if(parsed.kind()==='ipv6'&&['ipv4Mapped','rfc6145','rfc6052','6to4','teredo'].includes(parsed.range()))throw webFailure('WEB_PLATFORM_NO_PROXY_UNSUPPORTED');
 return {address:parsed.toString(),family:parsed.kind()};
}
function parseNoProxy(list){
 const unsupported=()=>{throw webFailure('WEB_PLATFORM_NO_PROXY_UNSUPPORTED');};
 if(typeof list!=='string'||Buffer.byteLength(list)>8192)unsupported();
 const tokens=list.split(',');if(tokens.length>128)unsupported();
 const rules=[];
 for(const raw of tokens){
  const token=raw.trim().toLowerCase();if(!token)continue;
  if(token.length>256||/[\s\[\]\\%]/.test(token))unsupported();
  if(token==='*'){rules.push(Object.freeze({kind:'all'}));continue;}
  if(token.includes('/')){
   const pieces=token.split('/');if(pieces.length!==2||!/^(0|[1-9][0-9]{0,2})$/.test(pieces[1]))unsupported();
   const address=selectorAddress(pieces[0]),prefix=Number(pieces[1]);
   if(!address||prefix>(address.family==='ipv4'?32:128))unsupported();
   rules.push(Object.freeze({kind:'cidr',...address,prefix}));continue;
  }
  // Entire IPv6 is interpreted before a possible hostname:port suffix.
  const address=selectorAddress(token);if(address){rules.push(Object.freeze({kind:'ip',...address}));continue;}
  let name=token,port=null;
  if(token.includes(':')){const pair=token.split(':');if(pair.length!==2||!/^[1-9][0-9]{0,4}$/.test(pair[1])||Number(pair[1])>65535)unsupported();[name]=pair;port=Number(pair[1]);}
  const ip=selectorAddress(name);if(ip){rules.push(Object.freeze({kind:'ip',...ip,port}));continue;}
  const kind=name.startsWith('*.')?'wildcard':name.startsWith('.')?'suffix':'host';
  const hostname=kind==='wildcard'?name.slice(2):kind==='suffix'?name.slice(1):name;
  if(!hostname||hostname.length>253||/^[0-9.]+$/.test(hostname)||/^\d.*-/.test(hostname)||!hostname.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))unsupported();
  rules.push(Object.freeze({kind,hostname,port}));
 }
 return Object.freeze(rules);
}
function checkNoProxy(host,address,rules){
 const target=ipaddr.parse(address);
 for(const rule of rules){
  if(rule.port!==undefined&&rule.port!==null&&rule.port!==443)continue;
  let match=rule.kind==='all';
  if(rule.kind==='ip'||rule.kind==='cidr')match=rule.family===target.kind()&&(rule.kind==='ip'?target.toString()===rule.address:target.match(ipaddr.parse(rule.address),rule.prefix));
  else if(rule.kind==='host')match=host===rule.hostname;
  else if(rule.kind==='suffix')match=host===rule.hostname||host.endsWith('.'+rule.hostname);
  else if(rule.kind==='wildcard')match=host.endsWith('.'+rule.hostname);
  if(match)throw webFailure('WEB_PLATFORM_NO_PROXY_CONFLICT');
 }
}
export function platformPinnedTransport(original,address,signal,config){
 checkNoProxy(original.hostname,address.address,config.noProxyRules??parseNoProxy(config.noProxy));
 const agent=new https.Agent({proxyEnv:{HTTPS_PROXY:config.proxy},keepAlive:false,maxCachedSessions:0});
 const sockets=new Set();let closed=false,connectionAttempts=0;
 const own=socket=>{if(!socket)return;if(closed||signal.aborted){socket.destroy();return;}sockets.add(socket);socket.once('close',()=>sockets.delete(socket));};
 const originalCreate=agent.createConnection;
 agent.createConnection=function(options,callback){
  if(closed||signal.aborted){queueMicrotask(()=>callback(webFailure('WEB_CANCELLED')));return undefined;}
  connectionAttempts++;
  const socket=originalCreate.call(this,options,(error,lateSocket)=>{
   own(lateSocket);
   if(closed||signal.aborted){lateSocket?.destroy();callback(error??webFailure('WEB_CANCELLED'));return;}
   callback(error,lateSocket);
  });
  own(socket);return socket;
 };
 const dispose=()=>{closed=true;signal.removeEventListener('abort',dispose);for(const socket of sockets)socket.destroy();sockets.clear();agent.destroy();};
 signal.addEventListener('abort',dispose,{once:true});if(signal.aborted)dispose();
 const url=new URL(original);url.hostname=isIP(address.address)===6?`[${address.address}]`:address.address;
 return {url,options:{agent,servername:original.hostname,rejectUnauthorized:true,headers:{Host:original.host}},get connectionAttempts(){return connectionAttempts;},dispose};
}
function sameDnsName(value,host){return typeof value==='string'&&/^[A-Za-z0-9.-]+$/.test(value)&&value.replace(/\.$/,'').toLowerCase()===host;}
export function validateDnsAnswer(body,host,type){
 if(!Buffer.isBuffer(body)||body.length>8192)throw webFailure('WEB_PLATFORM_DNS_INVALID');
 let result;try{result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{throw webFailure('WEB_PLATFORM_DNS_INVALID');}
 const rr=type==='A'?1:28;
 if(!result||result.Status!==0||result.TC!==false||!Array.isArray(result.Question)||result.Question.length!==1||!sameDnsName(result.Question[0]?.name,host)||result.Question[0]?.type!==rr)throw webFailure('WEB_PLATFORM_DNS_INVALID');
 if(result.Answer!==undefined&&!Array.isArray(result.Answer)||result.Answer?.length>16)throw webFailure('WEB_PLATFORM_DNS_INVALID');
 const answers=result.Answer??[],records=[];
 for(const a of answers){if(!a||!sameDnsName(a.name,host)||a.type!==rr||typeof a.data!=='string'||isIP(a.data)!==(rr===1?4:6))throw webFailure('WEB_PLATFORM_DNS_INVALID');records.push({address:a.data,family:rr===1?4:6});}
 // Authority/additional can contain only a bounded SOA negative proof; reject
 // CNAME and unknown resource records anywhere rather than chase aliases.
 for(const field of ['Authority','Additional'])if(result[field]!==undefined){if(!Array.isArray(result[field])||result[field].length>16||result[field].some(a=>!a||a.type!==6))throw webFailure('WEB_PLATFORM_DNS_INVALID');}
 if(records.length)publicAddresses(records);
 return {records,observation:{type,status:result.Status,truncated:false,bodyBase64:body.toString('base64'),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),addresses:records.map(r=>r.address)}};
}
export function createPlatformResolver(fetchPinned,observations){
 const cache=new Map();
 return async host=>{
  if(cache.has(host))return cache.get(host);
  const records=[],families=[];
  for(const type of ['A','AAAA']){
   const url=new URL(`https://${DNS_HOST}/dns-query`);url.search=new URLSearchParams({name:host,type}).toString();
   const response=await fetchPinned(url,{address:'1.1.1.1',family:4},8192,{'Accept':'application/dns-json'});
   if(response.status!==200)throw webFailure(response.status===429?'WEB_RATE_LIMITED':[401,403].includes(response.status)?'WEB_ACCESS_DENIED':'WEB_PLATFORM_DNS_STATUS',{httpStatus:response.status});
   if(!/^application\/(?:dns-json|json)(?:\s*;\s*charset=utf-8)?$/i.test(response.contentType??''))throw webFailure('WEB_PLATFORM_DNS_INVALID');
   const checked=validateDnsAnswer(response.body,host,type);records.push(...checked.records);families.push(checked.observation);
  }
  if(!records.length)throw webFailure('WEB_PLATFORM_DNS_EMPTY');
  const address=publicAddresses(records)[0];observations.push({host,families,selectedAddress:address.address});cache.set(host,address);return address;
 };
}
