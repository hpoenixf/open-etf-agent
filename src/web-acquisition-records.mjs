import {sha256} from './source.mjs';
import {normalizeWebUrl, WEB_LIMITS} from './web-policy.mjs';

export const ACQUISITION_LIMITS=Object.freeze({urls:4,originalBytes:524288,textBytes:524288,timeoutMs:30000,requests:16});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v);
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=()=>{throw Object.assign(new Error('WEB_ACQUISITION_RECORD_INVALID'),{code:'WEB_ACQUISITION_RECORD_INVALID'});};
export const acquisitionBytes=value=>Buffer.from(JSON.stringify(value));
export const acquisitionHash=value=>sha256(acquisitionBytes(value));
export function normalizeWebAcquisitionPlan(value){
 if(!exact(value,'schemaVersion,projectId,acquisitionId,baseManifestSha256,urls,allowedUrls,profile,limits')||value.schemaVersion!=='web-acquisition-plan@1'||!id(value.projectId)||!id(value.acquisitionId)||(value.baseManifestSha256!==null&&!hex(value.baseManifestSha256))||value.profile!=='public-static-web@1'||(!exact(value.limits,Object.keys(ACQUISITION_LIMITS).join(','))||Object.entries(ACQUISITION_LIMITS).some(([k,v])=>value.limits[k]!==v)))fail();
 const urls=(list,max)=>{if(!Array.isArray(list)||!list.length||list.length>max||Object.keys(list).length!==list.length)fail();const out=list.map(normalizeWebUrl);if(new Set(out).size!==out.length||out.some((u,i)=>u!==list[i]))fail();return out;};
 const selected=urls(value.urls,4),allowed=urls(value.allowedUrls,16);if(selected.some(u=>!allowed.includes(u)))fail();
 return {schemaVersion:value.schemaVersion,projectId:value.projectId,acquisitionId:value.acquisitionId,baseManifestSha256:value.baseManifestSha256,urls:selected,allowedUrls:allowed,profile:value.profile,limits:{...ACQUISITION_LIMITS}};
}
// Strict archived transport facts. They describe an observation, not permission
// to make a later request. Request policy remains in the transport owner.
export function validateWebTransportRecord(value,plan){
 if(!exact(value,'schemaVersion,requestedUrl,finalUrl,retrievedAt,originalSha256,originalBytes,originalMediaType,extraction,textSha256,redirects,robots,requestCount')||value.schemaVersion!=='web-fetch-observation@1'||!plan.urls.includes(value.requestedUrl)||!plan.allowedUrls.includes(value.finalUrl)||!hex(value.originalSha256)||!hex(value.textSha256)||!Number.isSafeInteger(value.originalBytes)||value.originalBytes<1||value.originalBytes>WEB_LIMITS.bodyBytes||!['text/html','text/plain'].includes(value.originalMediaType)||!Number.isSafeInteger(value.requestCount)||value.requestCount<1||value.requestCount>ACQUISITION_LIMITS.requests)fail();
 if(typeof value.retrievedAt!=='string'||!Number.isFinite(Date.parse(value.retrievedAt))||new Date(value.retrievedAt).toISOString()!==value.retrievedAt||!exact(value.extraction,'profile,coverage,visualInspection')||value.extraction.profile!==(value.originalMediaType==='text/html'?'static-html-parse5@8.1.0':'utf8-text@1')||value.extraction.coverage!=='static-text-only'||value.extraction.visualInspection!=='not-performed')fail();
 if(!Array.isArray(value.redirects)||value.redirects.length>WEB_LIMITS.redirects||!Array.isArray(value.robots)||!value.robots.length||value.robots.length>WEB_LIMITS.requests||acquisitionBytes(value).length>32768)fail();
 const redirectStatuses=[301,302,303,307,308],origins=new Set();let current=value.requestedUrl;
 for(const r of value.redirects){if(!exact(r,'url,status,location')||r.url!==current||!redirectStatuses.includes(r.status)||!plan.allowedUrls.includes(r.location))fail();origins.add(new URL(current).origin);current=r.location;}
 if(current!==value.finalUrl)fail();origins.add(new URL(current).origin);const seen=new Set();let counted=value.redirects.length+1;
 for(const r of value.robots){
  if(!exact(r,'url,status,sha256,bytes,hops')||![200,404,410].includes(r.status)||!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>WEB_LIMITS.robotsBytes||(r.status===200?!hex(r.sha256):r.sha256!==null||r.bytes!==0)||!Array.isArray(r.hops)||!r.hops.length||r.hops.length>WEB_LIMITS.redirects+1)fail();
  const u=new URL(normalizeWebUrl(r.url));if(!origins.has(u.origin)||seen.has(u.origin)||u.pathname!=='/robots.txt'||u.search)fail();seen.add(u.origin);
  for(const [i,h]of r.hops.entries()){if(!exact(h,'url,status')||normalizeWebUrl(h.url)!==h.url||new URL(h.url).origin!==u.origin||new URL(h.url).pathname!=='/robots.txt'||new URL(h.url).search||(i===r.hops.length-1?h.status!==r.status:!redirectStatuses.includes(h.status)))fail();}
  if(r.hops.at(-1).url!==r.url)fail();counted+=r.hops.length;
 }
 if(seen.size!==origins.size||counted!==value.requestCount)fail();
 return structuredClone(value);
}

// Terminal counters are local owner observations, never remote settlement.
// Missing knowledge stays null rather than being converted into zero.
export function validateWebAcquisitionTerminal(value,plan){
 const common='schemaVersion,projectId,acquisitionId,admissionSha256,status,manifestSha256,completedPages,requestCount,unknownRequests,automaticReplayAllowed';
 const success=value?.status==='succeeded',failure=value?.status==='failed';
 if((!success&&!failure)||!exact(value,common+(success?',originalBytes,textBytes':',dispatchOutcomeKnown,code'))||value.schemaVersion!=='web-acquisition-terminal@1'||value.projectId!==plan.projectId||value.acquisitionId!==plan.acquisitionId||value.admissionSha256!==acquisitionHash(plan)||value.automaticReplayAllowed!==false)fail();
 const bounded=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
 if(!bounded(value.completedPages,plan.urls.length)||!bounded(value.requestCount,plan.limits.requests)||value.requestCount<value.completedPages)fail();
 if(success){
  if(!hex(value.manifestSha256)||value.completedPages!==plan.urls.length||value.unknownRequests!==0||!bounded(value.originalBytes,plan.limits.originalBytes)||value.originalBytes<value.completedPages||!bounded(value.textBytes,plan.limits.textBytes)||value.textBytes<value.completedPages)fail();
 }else if(value.manifestSha256!==null||typeof value.dispatchOutcomeKnown!=='boolean'||typeof value.code!=='string'||!/^[A-Z][A-Z0-9_]{1,80}$/.test(value.code)||(value.dispatchOutcomeKnown?!bounded(value.unknownRequests,value.requestCount):value.unknownRequests!==null))fail();
 return structuredClone(value);
}
