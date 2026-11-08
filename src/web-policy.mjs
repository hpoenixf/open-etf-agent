import ipaddr from 'ipaddr.js';
export const WEB_USER_AGENT = 'OpenETFResearch';
export const WEB_LIMITS = Object.freeze({bodyBytes:262144,robotsBytes:65536,totalBytes:524288,timeoutMs:30000,dnsMs:3000,redirects:3,requests:16,nodes:40000,textBytes:262144});
export function webFailure(code,details={}){return Object.assign(new Error(code),{code,requestCount:0,responseCount:0,receivedBytes:0,dispatchState:'not-dispatched',automaticReplayAllowed:false,...details});}
export function normalizeWebUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f\\]/.test(value)||!value.startsWith('https://')||value.includes('#'))throw webFailure('WEB_URL_INVALID');
 let u;try{u=new URL(value);}catch{throw webFailure('WEB_URL_INVALID');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||u.hostname.endsWith('.')||u.hostname.startsWith('[')||ipaddr.isValid(u.hostname)||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/.test(u.hostname))throw webFailure('WEB_URL_INVALID');
 if(u.href.length>2048)throw webFailure('WEB_URL_INVALID');return u.href;
}
export function publicAddresses(records){
 if(!Array.isArray(records)||records.length<1||records.length>16)throw webFailure('WEB_DNS_UNAVAILABLE');
 const out=[];
 for(const r of records){
  if(!r||typeof r.address!=='string'||![4,6].includes(r.family))throw webFailure('WEB_DNS_UNAVAILABLE');
  let a;try{a=ipaddr.parse(r.address);}catch{throw webFailure('WEB_DNS_UNAVAILABLE');}
  if((a.kind()==='ipv4'?4:6)!==r.family||a.range()!=='unicast'||(a.kind()==='ipv6'&&a.isIPv4MappedAddress()))throw webFailure('WEB_ADDRESS_NOT_PUBLIC');
  out.push({address:a.toString(),family:r.family});
 }
 return out;
}
export function webLimits(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(WEB_LIMITS,k)))throw webFailure('WEB_LIMIT_INVALID');
 const value={...WEB_LIMITS,...input};for(const [k,v] of Object.entries(value))if(!Number.isSafeInteger(v)||v<1||v>WEB_LIMITS[k])throw webFailure('WEB_LIMIT_INVALID');return Object.freeze(value);
}
export function normalizeRobotsOctets(value){
 // RFC 9309 comparison: decode percent-encoded ASCII unreserved octets only;
 // preserve reserved octets, and encode literal non-ASCII as UTF-8 octets.
 return value.replace(/%[0-9a-f]{2}|[^\x00-\x7f]/giu,c=>{
  if(c.startsWith('%')){const n=parseInt(c.slice(1),16),s=String.fromCharCode(n);return /[A-Za-z0-9._~-]/.test(s)?s:c.toUpperCase();}
  return [...Buffer.from(c)].map(n=>'%'+n.toString(16).toUpperCase().padStart(2,'0')).join('');
 });
}
export function boundedRobotsText(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>WEB_LIMITS.robotsBytes||text.includes('\0'))throw webFailure('WEB_ROBOTS_INVALID');
 const lines=text.split(/\r\n|\n|\r/);if(lines.length>2048)throw webFailure('WEB_ROBOTS_WORK_LIMIT');
 let agents=0,rules=0,total=0,work=0,inRules=false;const out=[];
 for(const raw of lines){
  if(raw.length>2048)throw webFailure('WEB_ROBOTS_WORK_LIMIT');
  const line=raw.split('#',1)[0].trim(),colon=line.indexOf(':');if(colon<0){out.push(line);continue;}
  const key=line.slice(0,colon).trim().toLowerCase(),value=line.slice(colon+1).trim();
  if(key==='user-agent'){
   if(inRules){agents=0;rules=0;inRules=false;}
   agents++;if(agents>32||value.length>128)throw webFailure('WEB_ROBOTS_WORK_LIMIT');
   out.push('User-agent: '+value);
  }else if(key==='allow'||key==='disallow'){
   inRules=true;rules++;total+=Math.max(1,agents);work+=Math.max(1,agents)*normalizeRobotsOctets(value).length;
   // Bound dependency expansion before allocation, including duplicate agents.
   if(rules>256||total>512||work>8192||value.length>1024||(value.match(/\*/g)||[]).length>1)throw webFailure('WEB_ROBOTS_WORK_LIMIT');
   out.push(key+': '+normalizeRobotsOctets(value));
  }else if(key==='crawl-delay'&&value!=='0'){throw webFailure('WEB_ROBOTS_DELAY_UNSUPPORTED');}else out.push(line);
 }
 return out.join('\n');
}
