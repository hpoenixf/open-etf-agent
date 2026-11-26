// Isolated linked-PDF source owner. Reads never fetch or parse again.
// A host resolver supplies already committed, same-run consumed HTML evidence.
// No URL, transport options, paths or permission flags are model tool parameters.
import {mkdir,open,constants} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {readProjectJson} from './research-project.mjs';
import {ensureSafeDirectory,safeDirectory,publishImmutable} from './storage-files.mjs';
import {verifyWebPdfLink} from './web-extraction.mjs';
import {acquireApprovedWebPdf} from './web-transport.mjs';
import {WEB_LIMITS} from './web-policy.mjs';
import {WEB_TEXT_PAGE_BYTES,webTextPageSizes} from './web-text-pages.mjs';
import {pdfSnapshotBinding,prepareUploadedPdfSnapshot} from './pdf-input.mjs';

const digest=x=>createHash('sha256').update(x).digest('hex');
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(x);
const linkRef=x=>typeof x==='string'&&/^web-pdf-link:sha256:[a-f0-9]{64}$/.test(x);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const syncDir=async path=>{const handle=await open(path,constants.O_RDONLY);try{await handle.sync();}finally{await handle.close();}};
const pageSnapshot=snapshot=>({originalSha256:snapshot.originalSha256,originalBytes:snapshot.originalBytes,
 parser:snapshot.parser,parserWorkerSha256:snapshot.parserWorkerSha256,pages:snapshot.pages});
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function verifyPageSnapshot(value){
 return value&&Object.keys(value).sort().join(',')==='originalBytes,originalSha256,pages,parser,parserWorkerSha256'&&
  hex(value.originalSha256)&&hex(value.parserWorkerSha256)&&typeof value.parser==='string'&&
  Number.isSafeInteger(value.originalBytes)&&value.originalBytes>=5&&value.originalBytes<=WEB_LIMITS.bodyBytes&&
  Array.isArray(value.pages)&&value.pages.length>=1&&value.pages.length<=16&&
  value.pages.every(t=>typeof t==='string'&&t.isWellFormed()&&Buffer.byteLength(t)<=65536);
}
const successful=(r,url)=>r?.requestedUrl===url&&r?.finalUrl===url&&Array.isArray(r.redirects)&&r.redirects.length===0;
const unavailableCodes=new Set(['WEB_ACCESS_DENIED','WEB_ROBOTS_DISALLOWED','WEB_REDIRECT_NOT_ADMITTED','WEB_HTTP_STATUS',
 'WEB_DNS_UNAVAILABLE','WEB_ROBOTS_INVALID','WEB_CONTENT_ENCODING','WEB_REDIRECT_LIMIT',
 'WEB_BODY_LIMIT','WEB_PDF_CONTENT_TYPE','WEB_PDF_INVALID_MAGIC','WEB_TIMEOUT','WEB_RATE_LIMITED','WEB_ADDRESS_NOT_PUBLIC',
 'PDF_LIMIT_PAGES','PDF_LIMIT_TEXT','PDF_ENCRYPTED','PDF_INVALID_FORMAT','PDF_PARSE_FAILED','PDF_TIMEOUT']);

export function openLinkedWebPdfOwner({projectDir,authority,resolveConsumedHtml,fetchPdf=acquireApprovedWebPdf,networkProfile}={}){
 if(!authority||authority.kind!=='authenticated-owner-public-web'||authority.protected!==false||
    !id(authority.projectId)||!id(authority.runId)||!id(authority.accountId)||typeof resolveConsumedHtml!=='function')
  fail('WEB_PDF_SCOPE_DENIED');
 const scope=Object.freeze({projectId:authority.projectId,runId:authority.runId,accountId:authority.accountId});
 // Resolvers and transport are constructor-only capabilities owned by the host.
 async function context(linkId){
  if(!linkRef(linkId))fail('WEB_PDF_LINK_UNKNOWN');
  const source=await resolveConsumedHtml(linkId,scope);
  if(!source||!isDeepStrictEqual(source.scope,scope)||source.status!=='consumed'||source.protected!==false||
     typeof source.acquisitionId!=='string'||!id(source.acquisitionId))fail('WEB_PDF_LINK_UNKNOWN');
  const {body,contentType,finalUrl,originalSha256}=source;
  const link=verifyWebPdfLink(body,contentType,{finalUrl,originalSha256,linkId,allowPublicNavigation:source.allowPublicNavigation!==false});
  if(!link)fail('WEB_PDF_LINK_UNKNOWN');
  const route=source.networkProfile??networkProfile??'system-direct@1';
  if(!['system-direct@1','platform-doh-pinned@1'].includes(route))fail('WEB_PDF_SCOPE_DENIED');
  const binding={schemaVersion:'web-linked-pdf-admission@1',scope,linkId,parentAcquisitionId:source.acquisitionId,
   parentFinalUrl:finalUrl,parentSha256:originalSha256,downloadUrl:link.url,networkProfile:route};
  return {binding,key:digest(JSON.stringify(binding))};
 }
 async function readRecord(directory,binding){
  let record;
  try{record=await readProjectJson(join(directory,'final.json'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(record?.schemaVersion!=='web-linked-pdf-record@1'||!isDeepStrictEqual(record.binding,binding))
   fail('WEB_PDF_RECORD_CHANGED');
  if(record.status==='unavailable'&&unavailableCodes.has(record.code))return record;
  if(record.status!=='saved'||typeof record.retrievedAt!=='string'||!Number.isFinite(Date.parse(record.retrievedAt)))
   fail('WEB_PDF_RECORD_CHANGED');
  const snapshot=record.snapshot;
  if(!verifyPageSnapshot(snapshot)||!hex(record.snapshotBinding?.snapshotSha256)||
     ['originalSha256','originalBytes','parser','parserWorkerSha256'].some(k=>record.snapshotBinding[k]!==snapshot[k])||
     digest(JSON.stringify([record.snapshotBinding,snapshot]))!==record.pageSnapshotSha256)
   fail('WEB_PDF_RECORD_CHANGED');
  return {...record,snapshot};
 }
 const safeSummary=(record)=>{
  if(!record)return {kind:'web-pdf-acquisition@1',status:'unknown'};
  if(record.status==='unavailable')return {kind:'web-pdf-acquisition@1',status:'unavailable',code:record.code};
  return {kind:'web-pdf-acquisition@1',status:'saved',originalSha256:record.snapshot.originalSha256,pages:record.snapshot.pages.length};
 };
 async function existing(context){
  const root=join(await safeDirectory(projectDir),'web-linked-pdf');
  const directory=join(root,context.key);
  try{await safeDirectory(directory);}catch(e){if(e.code==='ENOENT')return null;throw e;}
  return readRecord(directory,context.binding);
 }
 return Object.freeze({
  async acquire(linkId,{signal}={}){
   signal?.throwIfAborted();
   const proven=await context(linkId);
   const root=await ensureSafeDirectory(join(await safeDirectory(projectDir),'web-linked-pdf')),directory=join(root,proven.key);
   try{await mkdir(directory,{mode:0o700});}catch(e){if(e.code==='EEXIST')return safeSummary(await readRecord(directory,proven.binding));throw e;}
   await syncDir(root);
   const base={schemaVersion:'web-linked-pdf-record@1',binding:proven.binding};
   let result;
   try{
    let response;
    try{response=await fetchPdf({url:proven.binding.downloadUrl,signal,networkProfile:proven.binding.networkProfile});}
    catch(e){
     if(!['not-dispatched','response-observed'].includes(e?.dispatchState))
      throw Object.assign(new Error(e?.code??'WEB_PDF_OUTCOME_UNKNOWN'),{code:e?.code??'WEB_PDF_OUTCOME_UNKNOWN',dispatchState:'outcome-unknown'});
     throw e;
    }
    signal?.throwIfAborted();
    if(!successful(response,proven.binding.downloadUrl))fail('WEB_PDF_RESPONSE_UNBOUND');
    if(typeof response.contentType!=='string'||response.contentType.trim().toLowerCase()!=='application/pdf')fail('WEB_PDF_CONTENT_TYPE');
    if(!Buffer.isBuffer(response.body)||response.body.length>WEB_LIMITS.bodyBytes)fail('WEB_BODY_LIMIT');
    if(!response.body.subarray(0,5).equals(Buffer.from('%PDF-')))fail('WEB_PDF_INVALID_MAGIC');
    if(typeof response.fetchedAt!=='string'||!Number.isFinite(Date.parse(response.fetchedAt)))fail('WEB_PDF_RESPONSE_UNBOUND');
    const snapshot=await prepareUploadedPdfSnapshot(response.body,{signal});
    const binding=pdfSnapshotBinding(snapshot),pages=pageSnapshot(snapshot);
    if(!verifyPageSnapshot(pages))fail('WEB_PDF_RECORD_CHANGED');
    result={...base,status:'saved',retrievedAt:response.fetchedAt,snapshotBinding:binding,snapshot:pages,
     pageSnapshotSha256:digest(JSON.stringify([binding,pages]))};
   }catch(e){
    // Only explicit, settled facts may become unavailable. Unobserved transport
    // outcomes or host failure leave the reservation held and non-replayed.
    if(!unavailableCodes.has(e.code)||e.dispatchState==='outcome-unknown')throw e;
    result={...base,status:'unavailable',code:e.code};
   }
   signal?.throwIfAborted();
   await publishImmutable(directory,'final.json',Buffer.from(JSON.stringify(result)),signal);
   await syncDir(directory);
   return safeSummary(result);
  },
  async readPage(linkId,page){
   if(!Number.isSafeInteger(page)||page<1)fail('WEB_PDF_PAGE_INVALID');
   const proven=await context(linkId),record=await existing(proven);
   if(record?.status!=='saved')return safeSummary(record);
   if(page>record.snapshot.pages.length)fail('WEB_PDF_PAGE_INVALID');
   const text=record.snapshot.pages[page-1];
   if(webTextPageSizes(text).some(n=>n>WEB_TEXT_PAGE_BYTES))return {kind:'web-pdf-page-unavailable@1',status:'unavailable',code:'WEB_PDF_PAGE_TEXT_LIMIT',page};
   if(!text.trim())return {kind:'web-pdf-page-unavailable@1',status:'unavailable',code:'WEB_PDF_NO_EXTRACTABLE_TEXT',page};
   return {kind:'web-pdf-original-page',url:record.binding.downloadUrl,retrievedAt:record.retrievedAt,
    originalSha256:record.snapshot.originalSha256,page,pages:record.snapshot.pages.length,text,sha256:digest(text),
    sourceRef:'web-pdf-page:sha256:'+digest(JSON.stringify([proven.key,record.snapshotBinding.snapshotSha256,page,digest(text)]))};
  }
 });
}
