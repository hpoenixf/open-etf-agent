import {validWebTextProfile,webTextPageLimit,validWebTextPage} from './web-text-pages.mjs';
import {createHash} from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(v);
const fail=()=>{throw Object.assign(new Error('INVALID_WEB_SOURCE'),{code:'INVALID_WEB_SOURCE'});};
const dense=(v,n)=>Array.isArray(v)&&v.length<=n&&Object.keys(v).length===v.length&&Object.keys(v).every((k,i)=>k===String(i));
function url(value){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))fail();
 let u;try{u=new URL(value);}catch{fail();}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||value.includes('#')||u.href!==value)fail();
 return value;
}
// This is an immutable observation validator, not network or permission admission.
// The acquisition owner separately validates public destinations and authorization.
export function normalizeWebProvenance(input){
 if(!exact(input,'schemaVersion,acquisitionId,projectId,baseManifestSha256,admissionSha256,transportSha256,requestedUrl,finalUrl,retrievedAt,originalSha256,originalBytes,originalMediaType,extraction,pageMap')||input.schemaVersion!=='web-source@1'||!id(input.acquisitionId)||!id(input.projectId)||(input.baseManifestSha256!==null&&!hex(input.baseManifestSha256))||!hex(input.admissionSha256)||!hex(input.transportSha256)||!hex(input.originalSha256)||!Number.isSafeInteger(input.originalBytes)||input.originalBytes<1||input.originalBytes>262144||!['text/html','text/plain'].includes(input.originalMediaType))fail();
 if(typeof input.retrievedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.retrievedAt)||!Number.isFinite(Date.parse(input.retrievedAt))||new Date(input.retrievedAt).toISOString()!==input.retrievedAt)fail();
 const e=input.extraction;
 if(!exact(e,'profile,coverage,visualInspection')||!validWebTextProfile(e.profile,input.originalMediaType)||e.coverage!=='static-text-only'||e.visualInspection!=='not-performed')fail();
 if(!dense(input.pageMap,16)||!input.pageMap.length)fail();let total=0;
 const pageMap=input.pageMap.map((p,i)=>{if(!exact(p,'page,sha256,bytes')||p.page!==i+1||!hex(p.sha256)||!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>webTextPageLimit(e.profile)||(total+=p.bytes)>524288)fail();return Object.freeze({page:p.page,sha256:p.sha256,bytes:p.bytes});});
 return Object.freeze({schemaVersion:'web-source@1',acquisitionId:input.acquisitionId,projectId:input.projectId,baseManifestSha256:input.baseManifestSha256,admissionSha256:input.admissionSha256,transportSha256:input.transportSha256,requestedUrl:url(input.requestedUrl),finalUrl:url(input.finalUrl),retrievedAt:input.retrievedAt,originalSha256:input.originalSha256,originalBytes:input.originalBytes,originalMediaType:input.originalMediaType,extraction:Object.freeze({profile:e.profile,coverage:e.coverage,visualInspection:e.visualInspection}),pageMap:Object.freeze(pageMap)});
}
export function webProvenanceSha256(input){return hash(JSON.stringify(normalizeWebProvenance(input)));}
export function webDocumentIdentity(input){const web=normalizeWebProvenance(input);return {id:'web:'+hash(JSON.stringify(web)),version:'web-source-v1'};}
export function webOriginalArtifactId(input){const web=normalizeWebProvenance(input);return 'artifact:sha256:'+hash(JSON.stringify({sha256:web.originalSha256,format:'web-original',mediaType:'application/octet-stream'}));}
export function webOriginalBytes(input,base64){
 const web=normalizeWebProvenance(input);
 if(typeof base64!=='string'||base64.length>349528||!base64.length||base64.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))fail();
 const bytes=Buffer.from(base64,'base64');if(bytes.toString('base64')!==base64||bytes.length!==web.originalBytes||hash(bytes)!==web.originalSha256)fail();return bytes;
}
export function validateWebPage(source){
 const web=normalizeWebProvenance(source.web),identity=webDocumentIdentity(web),p=web.pageMap[source.page-1];
 if(!validWebTextPage(source.text,web.extraction.profile)||source.pdf!==undefined||source.documentId!==identity.id||source.version!==identity.version||source.sourceId!==`${identity.id}@${identity.version}:p${source.page}`||!p||p.sha256!==source.sha256||p.bytes!==Buffer.byteLength(source.text))fail();
 return web;
}
