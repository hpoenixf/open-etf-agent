import {validWebTextProfile} from './web-text-pages.mjs';
import {sha256} from './source.mjs';
import {validateDnsAnswer} from './web-platform-profile.mjs';
import {normalizeWebUrl, publicAddresses, WEB_LIMITS} from './web-policy.mjs';

export const ACQUISITION_LIMITS=Object.freeze({urls:4,originalBytes:524288,textBytes:524288,timeoutMs:30000,requests:16});
export const ACQUISITION_PLATFORM_LIMITS=Object.freeze({...ACQUISITION_LIMITS,networkBytes:1048576});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=()=>{throw Object.assign(new Error('WEB_ACQUISITION_RECORD_INVALID'),{code:'WEB_ACQUISITION_RECORD_INVALID'});};
export const acquisitionBytes=value=>Buffer.from(JSON.stringify(value));
export const acquisitionHash=value=>sha256(acquisitionBytes(value));
export function normalizeWebAcquisitionPlan(value){
 const platform=value?.schemaVersion==='web-acquisition-plan@2',limits=platform?ACQUISITION_PLATFORM_LIMITS:ACQUISITION_LIMITS;
 if(!exact(value,'schemaVersion,projectId,acquisitionId,baseManifestSha256,urls,allowedUrls,profile,limits'+(platform?',networkProfile':''))||(!platform&&value.schemaVersion!=='web-acquisition-plan@1')||!id(value.projectId)||!id(value.acquisitionId)||(value.baseManifestSha256!==null&&!hex(value.baseManifestSha256))||value.profile!=='public-static-web@1'||(platform&&value.networkProfile!=='platform-doh-pinned@1')||!exact(value.limits,Object.keys(limits).join(','))||Object.entries(limits).some(([k,v])=>value.limits[k]!==v))fail();
 const urls=(list,max)=>{if(!Array.isArray(list)||!list.length||list.length>max||Object.keys(list).length!==list.length)fail();const out=list.map(normalizeWebUrl);if(new Set(out).size!==out.length||out.some((u,i)=>u!==list[i]))fail();return out;};
 const selected=urls(value.urls,4),allowed=urls(value.allowedUrls,16);if(selected.some(u=>!allowed.includes(u)))fail();
 return {schemaVersion:value.schemaVersion,projectId:value.projectId,acquisitionId:value.acquisitionId,baseManifestSha256:value.baseManifestSha256,urls:selected,allowedUrls:allowed,profile:value.profile,limits:{...limits},...(platform?{networkProfile:value.networkProfile}:{})};
}
// Strict archived transport facts. They describe an observation, not permission
// to make a later request. Request policy remains in the transport owner.
export function validateWebTransportRecord(value,plan){
 const platform=value?.schemaVersion==='web-fetch-observation@2';
 if(platform!==(plan.schemaVersion==='web-acquisition-plan@2')||!exact(value,'schemaVersion,requestedUrl,finalUrl,retrievedAt,originalSha256,originalBytes,originalMediaType,extraction,textSha256,redirects,robots,requestCount'+(platform?',networkProfile,dnsObservations,receivedBytes,proxyConnectionAttempts':''))||(!platform&&value.schemaVersion!=='web-fetch-observation@1')||!plan.urls.includes(value.requestedUrl)||!plan.allowedUrls.includes(value.finalUrl)||!hex(value.originalSha256)||!hex(value.textSha256)||!Number.isSafeInteger(value.originalBytes)||value.originalBytes<1||value.originalBytes>WEB_LIMITS.bodyBytes||!['text/html','text/plain'].includes(value.originalMediaType)||!Number.isSafeInteger(value.requestCount)||value.requestCount<1||value.requestCount>ACQUISITION_LIMITS.requests)fail();
 if(typeof value.retrievedAt!=='string'||!Number.isFinite(Date.parse(value.retrievedAt))||new Date(value.retrievedAt).toISOString()!==value.retrievedAt||!exact(value.extraction,'profile,coverage,visualInspection')||!validWebTextProfile(value.extraction.profile,value.originalMediaType)||value.extraction.coverage!=='static-text-only'||value.extraction.visualInspection!=='not-performed')fail();
 if(!Array.isArray(value.redirects)||value.redirects.length>WEB_LIMITS.redirects||!Array.isArray(value.robots)||!value.robots.length||value.robots.length>WEB_LIMITS.requests||acquisitionBytes(value).length>(platform?131072:32768))fail();
 const redirectStatuses=[301,302,303,307,308],origins=new Set();let current=value.requestedUrl;
 for(const r of value.redirects){if(!exact(r,'url,status,location')||r.url!==current||!redirectStatuses.includes(r.status)||!plan.allowedUrls.includes(r.location))fail();origins.add(new URL(current).origin);current=r.location;}
 if(current!==value.finalUrl)fail();origins.add(new URL(current).origin);const seen=new Set();let counted=value.redirects.length+1;
 for(const r of value.robots){
  if(!exact(r,'url,status,sha256,bytes,hops')||![200,404,410].includes(r.status)||!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>WEB_LIMITS.robotsBytes||(r.status===200?!hex(r.sha256):r.sha256!==null||r.bytes!==0)||!Array.isArray(r.hops)||!r.hops.length||r.hops.length>WEB_LIMITS.redirects+1)fail();
  const u=new URL(normalizeWebUrl(r.url));if(!origins.has(u.origin)||seen.has(u.origin)||u.pathname!=='/robots.txt'||u.search)fail();seen.add(u.origin);
  for(const [i,h]of r.hops.entries()){if(!exact(h,'url,status')||normalizeWebUrl(h.url)!==h.url||new URL(h.url).origin!==u.origin||new URL(h.url).pathname!=='/robots.txt'||new URL(h.url).search||(i===r.hops.length-1?h.status!==r.status:!redirectStatuses.includes(h.status)))fail();}
  if(r.hops.at(-1).url!==r.url)fail();counted+=r.hops.length;
 }
 if(seen.size!==origins.size)fail();
 if(platform){
  if(value.networkProfile!==plan.networkProfile||!Array.isArray(value.dnsObservations)||value.dnsObservations.length!==origins.size||!Number.isSafeInteger(value.receivedBytes)||value.receivedBytes<0||value.receivedBytes>plan.limits.networkBytes||!Number.isSafeInteger(value.proxyConnectionAttempts)||value.proxyConnectionAttempts<0||value.proxyConnectionAttempts>value.requestCount)fail();
  const hosts=new Set([...origins].map(origin=>new URL(origin).hostname)),dnsHosts=new Set();let received=value.originalBytes+value.robots.reduce((n,r)=>n+r.bytes,0);
  for(const d of value.dnsObservations){
   if(!exact(d,'host,families,selectedAddress')||!hosts.has(d.host)||dnsHosts.has(d.host)||!Array.isArray(d.families)||d.families.length!==2)fail();dnsHosts.add(d.host);const accepted=[];
   for(const [i,f]of d.families.entries()){
    if(!exact(f,'type,status,truncated,bodyBase64,bytes,sha256,addresses')||f.type!==['A','AAAA'][i]||typeof f.bodyBase64!=='string'||f.bodyBase64.length>10924||!Number.isSafeInteger(f.bytes)||f.bytes<1||f.bytes>8192||!hex(f.sha256))fail();
    const raw=Buffer.from(f.bodyBase64,'base64');if(raw.toString('base64')!==f.bodyBase64||raw.length!==f.bytes||sha256(raw)!==f.sha256)fail();
    const checked=validateDnsAnswer(raw,d.host,f.type);if(JSON.stringify(checked.observation)!==JSON.stringify(f))fail();accepted.push(...checked.records);received+=raw.length;
   }
   if(!accepted.length||d.selectedAddress!==publicAddresses(accepted)[0].address)fail();counted+=2;
  }
  if(dnsHosts.size!==hosts.size||received!==value.receivedBytes)fail();
 }
 if(counted!==value.requestCount)fail();
 return structuredClone(value);
}

// Terminal counters are local owner observations, never remote settlement.
// Missing knowledge stays null rather than being converted into zero.
export function validateWebAcquisitionTerminal(value,plan){
 const platform=plan.schemaVersion==='web-acquisition-plan@2';
 const common='schemaVersion,projectId,acquisitionId,admissionSha256,status,manifestSha256,completedPages,requestCount,unknownRequests,automaticReplayAllowed'+(platform?',networkProfile,receivedBytes':'');
 const success=value?.status==='succeeded',failure=value?.status==='failed';
 if((!success&&!failure)||!exact(value,common+(success?',originalBytes,textBytes':',dispatchOutcomeKnown,code'))||value.schemaVersion!==(platform?'web-acquisition-terminal@2':'web-acquisition-terminal@1')||value.projectId!==plan.projectId||value.acquisitionId!==plan.acquisitionId||value.admissionSha256!==acquisitionHash(plan)||value.automaticReplayAllowed!==false)fail();
 const bounded=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
 if(!bounded(value.completedPages,plan.urls.length)||!bounded(value.requestCount,plan.limits.requests)||value.requestCount<value.completedPages)fail();
 if(platform&&(value.networkProfile!==plan.networkProfile||!bounded(value.receivedBytes,success?plan.limits.networkBytes:Number.MAX_SAFE_INTEGER)))fail();
 if(success){
  if(!hex(value.manifestSha256)||value.completedPages!==plan.urls.length||value.unknownRequests!==0||!bounded(value.originalBytes,plan.limits.originalBytes)||value.originalBytes<value.completedPages||!bounded(value.textBytes,plan.limits.textBytes)||value.textBytes<value.completedPages)fail();
 }else if(value.manifestSha256!==null||typeof value.dispatchOutcomeKnown!=='boolean'||typeof value.code!=='string'||!/^[A-Z][A-Z0-9_]{1,80}$/.test(value.code)||(value.dispatchOutcomeKnown?!bounded(value.unknownRequests,value.requestCount):value.unknownRequests!==null))fail();
 return structuredClone(value);
}
