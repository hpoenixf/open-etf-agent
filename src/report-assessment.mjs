import {isDeepStrictEqual} from 'node:util';
import {sha256} from './source.mjs';
import {REPORT_TEXT_MAX_BYTES} from './report.mjs';
export const assessmentCanonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const assessmentHash=v=>sha256(assessmentCanonical(v));
const fail=()=>{throw Object.assign(new Error('INVALID_REPORT_ASSESSMENT'),{code:'INVALID_REPORT_ASSESSMENT'});};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const REPORT_ASSESSMENT_WARNING='引用已降级。原始回答保留如下；Report 未生成。已核验来源仅表示原文身份和字节通过验证，不代表回答的金融数字、计算结论或语义已核验。未核验引用不可作为证据。';
// Pure assessment of an already verified Result-owner basis. The Host owns byte,
// scope and attachment checks; Session binds this exact proof to its original call.
export function prepareReportAssessment({call,basis,runId,grantId,scopeHash}){
 const a=call?.arguments;
 if(!exact(call,['id','name','arguments'])||call.name!=='save_report'||typeof call.id!=='string'||!call.id||call.id.length>200||/[\u0000-\u001f]/.test(call.id)||!exact(a,a?.attachmentIds===undefined?['text','sourceIds']:['text','sourceIds','attachmentIds'])||typeof a.text!=='string'||!a.text.trim()||Buffer.byteLength(a.text)>REPORT_TEXT_MAX_BYTES||a.text.includes('\0')||Buffer.from(a.text).toString('utf8')!==a.text||!Array.isArray(a.sourceIds)||!a.sourceIds.length||a.sourceIds.length>64||new Set(a.sourceIds).size!==a.sourceIds.length||a.sourceIds.some(id=>typeof id!=='string'||!id||id.length>200||/[\u0000-\u001f]/.test(id))||a.attachmentIds!==undefined&&(!Array.isArray(a.attachmentIds)||a.attachmentIds.length>16||new Set(a.attachmentIds).size!==a.attachmentIds.length||a.attachmentIds.some(id=>typeof id!=='string'||!/^artifact:sha256:[a-f0-9]{64}$/.test(id)))||!Array.isArray(basis)||basis.length>64||!hex(scopeHash)||typeof runId!=='string'||!runId||typeof grantId!=='string'||!grantId)fail();
 const citations=a.sourceIds.map((sourceId,index)=>{const ref=basis.find(r=>r.kind==='source'&&r.sourceId===sourceId);return{marker:`[${index+1}]`,sourceId,status:ref?'verified-source':'unverified',...(ref?{resultRef:ref.resultRef,sha256:ref.sha256}:{reason:'Exact source ID was not acquired in this Run'})};});
 const calculations=basis.filter(r=>r.kind==='calculation').map((r,index)=>({marker:`[C${index+1}]`,resultRef:r.resultRef,status:'verified-calculation'}));
 const allMarkers=[...new Set([...a.text.matchAll(/\[(C?)([0-9]+)\]/g)].map(m=>m[0]))].map(marker=>{const m=/^\[(C?)([0-9]+)\]$/.exec(marker),entry=(m[1]?calculations:citations)[Number(m[2])-1];return{marker,status:entry?.status??'unverified',...(entry?.status==='unverified'?{reason:entry.reason}:!entry?{reason:'No acquired result for this numbered citation'}:{})};});
 if(!citations.some(c=>c.status==='unverified')&&!allMarkers.some(m=>m.status==='unverified'))return null;
 return{schemaVersion:'report-citation-assessment@1',runId,grantId,callId:call.id,scopeHash,requestHash:assessmentHash(call),basis:structuredClone(basis),basisHash:assessmentHash(basis),sourceIds:[...a.sourceIds],...(a.attachmentIds===undefined?{}:{attachmentIds:[...a.attachmentIds]}),citations,calculations,markers:allMarkers.slice(0,512),markerAudit:{total:allMarkers.length,returned:Math.min(allMarkers.length,512),complete:allMarkers.length<=512,unverified:allMarkers.filter(m=>m.status==='unverified').length},semanticStatus:'unreviewed',warning:REPORT_ASSESSMENT_WARNING};
}
export function validateReportAssessment(value,text){
 if(!value||value.schemaVersion!=='report-citation-assessment@1')fail();
 const expected=prepareReportAssessment({call:{id:value.callId,name:'save_report',arguments:{text,sourceIds:value.sourceIds,...(value.attachmentIds===undefined?{}:{attachmentIds:value.attachmentIds})}},basis:value.basis,runId:value.runId,grantId:value.grantId,scopeHash:value.scopeHash});
 if(!expected||!isDeepStrictEqual(value,expected))fail();return expected;
}
// Called by Session before publication, never by a Reader. It proves the body is
// the original settled singleton candidate and binds it to this Run's Host state.
export function verifyReportDeliveryState(state,prepared){
 const s=state.snapshot,h=s?.host,a=s?.messages?.at(-1)?.result?.deliveryAssessment,group=s?.messages?.at(-2),message=s?.messages?.at(-1),call=group?.calls?.[0],r=message?.result;
 if(state.parentRunId!==null||state.rootId!==state.runId||state.status!=='active'||state.rootStatus!=='active'||state.definition.config.documentProtection||state.definition.config.allowedTools!==undefined&&!state.definition.config.allowedTools.includes('save_report')||s.phase!=='result-consumed'||s.gatewayOutcome!=='settled'||s.inFlight||s.unknownEffects?.length!==0||s.partialEffects?.length!==0||s.hookErrors?.length!==0||h?.schemaVersion!=='tool-host@2'||h.saveAttempted!==false||h.receipt!==null||group?.role!=='assistant'||group.calls.length!==1||message?.role!=='tool'||call?.name!=='save_report'||call.id!==message.callId||r?.callId!==call.id||r.status!=='rejected'||r.dispatched!==false||Object.keys(r).some(k=>!['callId','status','dispatched','error','durationMs','deliveryAssessment'].includes(k))||r.error!=='REPORT_CITATIONS_DEGRADED'||!Number.isFinite(r.durationMs)||r.durationMs<0||!isDeepStrictEqual(publicReportAssessment(a,prepared.content.text),prepared.content.assessment)||!isDeepStrictEqual(s.proposal?.calls,group.calls)||s.cursor!==1||s.result!==null||!isDeepStrictEqual(h.results,a.basis)||a.runId!==state.runId||a.grantId!==state.definition.grantId||a.scopeHash!==assessmentHash({definitionsHash:h.definitionsHash,allowedDocuments:state.definition.config.allowedDocuments??null})||a.requestHash!==assessmentHash(call)||prepared.content.text!==call.arguments.text)fail();
 validateReportAssessment(a,prepared.content.text);return true;
}

// Only this bounded public projection enters Publication; storage paths, grants,
// private Result descriptors and the full owner proof remain in the checkpoint.
export function publicReportAssessment(proof,text){
 validateReportAssessment(proof,text);
 return {schemaVersion:'published-citation-assessment@1',proofHash:assessmentHash(proof),textSha256:sha256(text),citations:structuredClone(proof.citations),calculations:structuredClone(proof.calculations),markers:structuredClone(proof.markers),markerAudit:structuredClone(proof.markerAudit),semanticStatus:proof.semanticStatus,warning:proof.warning};
}
export function validatePublicReportAssessment(a,text){
 if(!exact(a,['schemaVersion','proofHash','textSha256','citations','calculations','markers','markerAudit','semanticStatus','warning'])||a.schemaVersion!=='published-citation-assessment@1'||!hex(a.proofHash)||a.textSha256!==sha256(text)||a.semanticStatus!=='unreviewed'||a.warning!==REPORT_ASSESSMENT_WARNING||!Array.isArray(a.citations)||a.citations.length<1||a.citations.length>64||!Array.isArray(a.calculations)||a.calculations.length>64||!Array.isArray(a.markers)||a.markers.length>512)fail();
 for(const [i,c] of a.citations.entries()){
  if(c.marker!==`[${i+1}]`||typeof c.sourceId!=='string'||!c.sourceId||c.sourceId.length>200)fail();
  if(c.status==='verified-source'){if(!exact(c,['marker','sourceId','status','resultRef','sha256'])||!/^result:sha256:[a-f0-9]{64}$/.test(c.resultRef)||!hex(c.sha256))fail();}
  else if(c.status!=='unverified'||!exact(c,['marker','sourceId','status','reason'])||c.reason!=='Exact source ID was not acquired in this Run')fail();
 }
 for(const [i,c] of a.calculations.entries())if(!exact(c,['marker','resultRef','status'])||c.marker!==`[C${i+1}]`||c.status!=='verified-calculation'||!/^calculation:sha256:[a-f0-9]{64}$/.test(c.resultRef))fail();
 const markers=[...new Set([...text.matchAll(/\[(C?)([0-9]+)\]/g)].map(m=>m[0]))].map(marker=>{const m=/^\[(C?)([0-9]+)\]$/.exec(marker),entry=(m[1]?a.calculations:a.citations)[Number(m[2])-1];return{marker,status:entry?.status??'unverified',...(entry?.status==='unverified'?{reason:entry.reason}:!entry?{reason:'No acquired result for this numbered citation'}:{})};});
 if(!isDeepStrictEqual(a.markers,markers.slice(0,512))||!isDeepStrictEqual(a.markerAudit,{total:markers.length,returned:Math.min(markers.length,512),complete:markers.length<=512,unverified:markers.filter(m=>m.status==='unverified').length})||!a.citations.some(c=>c.status==='unverified')&&!markers.some(m=>m.status==='unverified'))fail();
 return structuredClone(a);
}
