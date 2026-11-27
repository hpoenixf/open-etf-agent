import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {openOwnerWeb,OWNER_LINKED_PDF_REVISION,OWNER_LINKED_PDF_LOCAL_MISS,OWNER_WEB_PAGE,OWNER_WEB_CONTINUE,OWNER_WEB_LINKED_PDF,OWNER_WEB_EXCERPTS,OWNER_WEB_EXCERPTS_LOCAL_MISS,OWNER_WEB_EXCERPTS_URL_MISS} from './gui-owner-web.mjs';
import {publicPdfNavigationQuery} from './public-pdf-navigation.mjs';
import {normalizeWebUrl} from './web-policy.mjs';
import {WEB_TEXT_MAX_PAGES,WEB_TEXT_PAGE_BYTES} from './web-text-pages.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const isHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const isCallId=value=>typeof value==='string'&&value.length>=1&&value.length<=200&&!/[\u0000-\u001f]/.test(value);
const originalTool=name=>name===OWNER_WEB_PAGE||name===OWNER_WEB_CONTINUE||name===OWNER_WEB_LINKED_PDF;
const maxMessages=512,maxCalls=512,maxChecks=8,maxRows=4,maxBytes=262144;

const webRef=value=>`WEB:${value.manifestSha256}:${value.page}`;
function readRow({projectId,runId},value,markers){
 const {url,retrievedAt,page,pages,text,textSha256,manifestSha256,originalSha256}=value;
 if(normalizeWebUrl(url)!==url||url.includes('?')||typeof retrievedAt!=='string'||
    new Date(retrievedAt).toISOString()!==retrievedAt||
    !Number.isSafeInteger(page)||!Number.isSafeInteger(pages)||page<1||pages<page||pages>WEB_TEXT_MAX_PAGES||
    typeof text!=='string'||!text||!text.isWellFormed()||Buffer.byteLength(text)>WEB_TEXT_PAGE_BYTES||
    ![textSha256,manifestSha256,originalSha256].every(isHash)||digest(text)!==textSha256)return null;
 return {id:'source-'+digest(JSON.stringify([projectId,runId,manifestSha256,originalSha256,page,textSha256])),
  kind:'web-original-excerpt',url,retrievedAt,page,pages,text,sha256:textSha256,
  ...(markers.has(webRef(value))?{citationRef:webRef(value),cited:true}:{})};
}

function readPdfRow(value,markers){
 const {url,retrievedAt,page,pages,text,sha256,originalSha256,sourceRef}=value;
 if(normalizeWebUrl(url)!==url||(url.includes('?')&&!publicPdfNavigationQuery(new URL(url)))||new Date(retrievedAt).toISOString()!==retrievedAt||
    !Number.isSafeInteger(page)||!Number.isSafeInteger(pages)||page<1||page>pages||pages>16||
    typeof text!=='string'||!text.trim()||!text.isWellFormed()||Buffer.byteLength(text)>65536||
    ![sha256,originalSha256].every(isHash)||digest(text)!==sha256||
    !/^web-pdf-page:sha256:[a-f0-9]{64}$/.test(sourceRef))return null;
 return {id:sourceRef,kind:'web-pdf-original-page',url,retrievedAt,page,pages,text,sha256,originalSha256,cited:markers.has(sourceRef)};
}
// Exact owner Root snapshot only. Native consumed tool results are not the
// model's working context, a search preview, or statements in the answer.
// verifyResult reopens immutable local receipts/bytes; no execute is called.
export async function readOwnerWebSources({projectDir,definition,run,publication}){
 const output=(availability,readSources=[])=>({availability,readSources});
 if(!run||definition.runId!==run.runId||run.rootId!==run.runId||run.parentRunId!==null||
    publication?.receipt?.runId!==run.runId||publication.receipt.rootId!==run.rootId)return output('unavailable');
 if(definition.sourceManifestSha256!==null||definition.config?.ownerConnectivity?.web!==true)return output('none');
 const {messages,phase,proposal}=run.snapshot??{};
 if((phase!=='terminal'&&!(phase==='proposal-sealed'&&proposal?.kind==='final'))||
    !Array.isArray(messages)||messages.length>maxMessages)return output('unavailable');

 const linkedPdf=[OWNER_LINKED_PDF_REVISION,OWNER_LINKED_PDF_LOCAL_MISS].includes(definition.ownerLinkedPdfRevision)&&definition.config.ownerConnectivity.linkedPdf===true;
 const canonicalBody=publication.content?.text??'';
 const markers=new Set(linkedPdf?[...canonicalBody.matchAll(/\[\[PDF:(web-pdf-page:sha256:[a-f0-9]{64})\]\]/g)].map(match=>match[1]):[]);
 const webMarkers=new Set([...canonicalBody.matchAll(/\[\[(WEB:[a-f0-9]{64}:[1-9][0-9]{0,3})\]\]/g)].map(match=>match[1]));
 const used=new Set(),replyIds=new Set(),duplicates=new Set(),candidates=[];
 let count=0,omitted=false;
 const observe=(set,id)=>{if(set.has(id))duplicates.add(id);set.add(id);};
 for(let i=0;i<messages.length;i++){
  const group=messages[i];
  if(group?.role==='tool'){observe(replyIds,group.callId);continue;}
  if(group?.role!=='assistant'||!Array.isArray(group.calls))continue;
  count+=group.calls.length;if(count>maxCalls)return output('unavailable');
  for(const [offset,call] of group.calls.entries()){
   observe(used,call?.id);
   if(!originalTool(call?.name))continue;
   const reply=messages[i+1+offset],result=reply?.result;
   if(!isCallId(call.id)||reply?.role!=='tool'||reply.callId!==call.id||result?.callId!==call.id){omitted=true;continue;}
   if(result.status!=='succeeded'||result.dispatched!==true)continue;
   if((result.effective&&!isDeepStrictEqual(result.effective,call))||
      (result.original&&!isDeepStrictEqual(result.original,call))){omitted=true;continue;}
   if(result.value?.kind==='public-web-continuation-unavailable@1'||result.value?.kind==='public-web-page-unavailable@1')continue;
   if(linkedPdf&&call.name===OWNER_WEB_LINKED_PDF&&result.value?.status==='unavailable')continue;
   if(!['public-web-page@1','public-web-page@2',...(linkedPdf?['web-pdf-original-page']:[])].includes(result.value?.kind)){omitted=true;continue;}
   candidates.push({call,value:result.value});
  }
 }
 const deny=()=>{throw new Error('OWNER_SOURCE_READ_ONLY');};
 const tools=openOwnerWeb({profile:{web:true,...(linkedPdf?{linkedPdf:true}:{})},projectDir,projectId:definition.projectId,runId:run.runId,
  excerptRevision:definition.ownerWebExcerptRevision,linkedPdfRevision:definition.ownerLinkedPdfRevision,readRun:()=>run,transport:{acquire:deny,searchFetch:deny,fetchPdf:deny}});
 const verifiedMarkers=new Set(),verifiedWebMarkers=new Set();
 const withExcerpts=[OWNER_WEB_EXCERPTS,OWNER_WEB_EXCERPTS_LOCAL_MISS,OWNER_WEB_EXCERPTS_URL_MISS].includes(definition.ownerWebExcerptRevision);
 // Retained-row limits prioritize explicitly cited pages over uncited reading.
 const cited=value=>markers.has(value.sourceRef)||webMarkers.has(webRef(value));
 if(markers.size||webMarkers.size)candidates.sort((a,b)=>Number(cited(b.value))-Number(cited(a.value)));
 const ids=new Set(),readSources=[];let bytes=0,checks=0;
 for(const {call,value} of candidates){
  const isPdf=call.name===OWNER_WEB_LINKED_PDF&&linkedPdf;
  if(duplicates.has(call.id)||value.kind!==(isPdf?'web-pdf-original-page':withExcerpts?'public-web-page@2':'public-web-page@1')){omitted=true;continue;}
  let row;
  try{row=isPdf?readPdfRow(value,markers):readRow({projectId:definition.projectId,runId:run.runId},value,webMarkers);}catch{omitted=true;continue;}
  if(!row){omitted=true;continue;}
  const {id}=row;
  if(ids.has(id))continue;
  const size=Buffer.byteLength(JSON.stringify(row))+1;
  if(readSources.length>=maxRows||bytes+size>maxBytes||checks>=maxChecks){omitted=true;continue;}
  checks++;
  try{
   const tool=tools.find(entry=>entry.name===call.name);
   if(!tool){omitted=true;continue;}
   await tool.verifyResult(value,{call});
  }catch{omitted=true;continue;}
  if(isPdf&&row.cited)verifiedMarkers.add(row.id);
  if(!isPdf&&row.cited)verifiedWebMarkers.add(row.citationRef);
  ids.add(id);readSources.push(row);bytes+=size;
 }
 if(verifiedMarkers.size!==markers.size||verifiedWebMarkers.size!==webMarkers.size)omitted=true;
 return output(omitted?(readSources.length?'partial':'unavailable'):(readSources.length?'available':'none'),readSources);
}
