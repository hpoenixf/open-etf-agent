import {open,constants} from 'node:fs/promises';
import {join} from 'node:path';
import {publishImmutable,safeDirectory} from './storage-files.mjs';
import {sha256} from './source.mjs';
export const REPORT_TEXT_MAX_BYTES = 256 * 1024;
export function validateProtectedReportReceipt(value){
 const keys=['operationId','fileId','path','sha256','bytes','mediaType','artifactId','revisionId','attachmentIds'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(',')||typeof value.operationId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(value.operationId)||value.operationId.includes('://')||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256)||value.fileId!=='sha256:'+value.sha256||value.path!=='report.md'||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>1048576||value.mediaType!=='text/markdown; charset=utf-8'||typeof value.artifactId!=='string'||typeof value.revisionId!=='string'||!/^artifact:sha256:[a-f0-9]{64}$/.test(value.artifactId)||!/^revision:sha256:[a-f0-9]{64}$/.test(value.revisionId)||!Array.isArray(value.attachmentIds)||value.attachmentIds.length>16||new Set(value.attachmentIds).size!==value.attachmentIds.length||value.attachmentIds.some(id=>typeof id!=='string'||!/^artifact:sha256:[a-f0-9]{64}$/.test(id)||id===value.artifactId)||Object.keys(value.attachmentIds).length!==value.attachmentIds.length||!Object.keys(value.attachmentIds).every((key,index)=>key===String(index)))throw Object.assign(new Error('INVALID_PROTECTED_REPORT_RECEIPT'),{code:'INVALID_PROTECTED_REPORT_RECEIPT'});
 return structuredClone(value);
}
async function verifySavedFile(directory,name,expected){
 await safeDirectory(directory);const file=await open(join(directory,name),constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const stat=await file.stat();if(!stat.isFile()||stat.size!==expected.length||stat.size>5242880)throw Object.assign(new Error('PROTECTED_REPORT_FILE_MISMATCH'),{code:'PROTECTED_REPORT_FILE_MISMATCH'});const bytes=Buffer.alloc(expected.length+1);let at=0;while(at<bytes.length){const {bytesRead}=await file.read(bytes,at,bytes.length-at);if(!bytesRead)break;at+=bytesRead;}if(at!==expected.length||!bytes.subarray(0,at).equals(expected))throw Object.assign(new Error('PROTECTED_REPORT_FILE_MISMATCH'),{code:'PROTECTED_REPORT_FILE_MISMATCH'});}finally{await file.close();}
}
export async function saveReport({directory,store,text,selected,resultRefs,calculations,methods,attachmentIds=[],callId,signal,protectedOutput}){
 if(store.protection&&(typeof protectedOutput?.register!=='function'||!Array.isArray(protectedOutput.dependencies)))throw Object.assign(new Error('PROTECTED_REPORT_OWNER_REQUIRED'),{code:'PROTECTED_REPORT_OWNER_REQUIRED'});
 const citations=selected.map((s,i)=>`- [${i+1}] ${s.sourceId}: ${s.name}, version ${s.version}, physical page ${s.page}; SHA-256 ${s.sha256}; ResultRef ${resultRefs[i].resultRef}${s.pdf?`; original PDF SHA-256 ${s.pdf.originalSha256}; ${s.pdf.originalBytes} bytes; ${s.pdf.originalArtifactId}; parser ${s.pdf.parser}; selected physical page ${s.page}/${s.pdf.pageCount}; text-layer only, visual inspection not performed`:""}`).join('\n');
 const numeric=calculations.map((c,i)=>{
  const b=c.value.binding;
  const provenance=b?`; source ${b.sourceRef}; SHA-256 ${b.contentHash}; selected rows ${b.coverage.rowIndices.join(',')} (${b.coverage.returned}/${b.coverage.total} stored rows); baseline ${b.baseline.rowId} at ${b.baseline.rowIndex}, current ${b.current.rowId} at ${b.current.rowIndex}; window complete ${b.coverage.complete}; stored table complete ${b.coverage.storedTableComplete}; currency ${b.currency}; dataAsOf ${b.dataAsOf}; synthetic same-snapshot comparison, not upstream completeness or semantic review`:'';
  return `- [C${i+1}] ${c.value.calculation}: inputs ${JSON.stringify(c.value.inputs)}; difference ${c.value.difference} ${c.value.unit}; current/baseline ${c.value.ratio}; increase/baseline ${c.value.increaseRatio}; ${c.ref.resultRef}${provenance}`;
 }).join('\n');
 const links=attachmentIds.length?'\n\n## Registered attachments\n\n'+attachmentIds.map(id=>'- '+id).join('\n'):'';
 const content=text+'\n\n## Acquired sources\n\n'+citations+(numeric?'\n\n## Actual numeric derivations\n\n'+numeric:'')+links+'\n';const bytes=Buffer.from(content);const partialPaths=[];const artifactEffects=[];
 try{
  const artifact=await store.put({format:'markdown',content},{signal});artifactEffects.push({kind:'artifact',artifactId:artifact.artifactId});
  const revision=await store.revise({reportId:artifact.artifactId,attachmentIds,sources:selected,...(store.protection?{dependencies:protectedOutput.dependencies}:{})},{signal});artifactEffects.push({kind:'revision',revisionId:revision.revisionId});
  const receipt={operationId:callId,fileId:'sha256:'+sha256(bytes),path:'report.md',sha256:sha256(bytes),bytes:bytes.length,mediaType:artifact.mediaType,artifactId:artifact.artifactId,revisionId:revision.revisionId,attachmentIds:[...attachmentIds]};
  const attachmentRecords=[];for(const id of attachmentIds){const {bytes,...metadata}=await store.read(id);attachmentRecords.push({...metadata,bytes:bytes.length});}
  const manifest={artifacts:{report:artifact,attachments:attachmentRecords},schemaVersion:store.protection?'open-etf-protected-report@1':'open-etf-report@1',...(store.protection?{protection:store.protection}:{}),synthetic:selected.every(source=>!source.pdf||source.pdf.synthetic),semanticStatus:'unreviewed',receipt,sources:selected,resultRefs,calculations,methods};
  const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await publishImmutable(directory,'report.md',bytes,signal);partialPaths.push('report.md');await publishImmutable(directory,'manifest.json',manifestBytes,signal);partialPaths.push('manifest.json');if(store.protection){const proof=await store.protectedOutputProof(receipt);await verifySavedFile(directory,'report.md',bytes);await verifySavedFile(directory,'manifest.json',manifestBytes);signal?.throwIfAborted();await protectedOutput.register(proof);}return receipt;
 }catch(error){error.partialPaths=partialPaths;error.artifactEffects=[...artifactEffects,...(error.artifactEffects||[])];throw error;}
}
