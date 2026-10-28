import {publishImmutable} from './storage-files.mjs';
import {sha256} from './source.mjs';
export async function saveReport({directory,store,text,selected,resultRefs,calculations,methods,attachmentIds=[],callId,signal}){
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
  const revision=await store.revise({reportId:artifact.artifactId,attachmentIds,sources:selected},{signal});artifactEffects.push({kind:'revision',revisionId:revision.revisionId});
  const receipt={operationId:callId,fileId:'sha256:'+sha256(bytes),path:'report.md',sha256:sha256(bytes),bytes:bytes.length,mediaType:artifact.mediaType,artifactId:artifact.artifactId,revisionId:revision.revisionId,attachmentIds:[...attachmentIds]};
  const attachmentRecords=[];for(const id of attachmentIds){const {bytes,...metadata}=await store.read(id);attachmentRecords.push({...metadata,bytes:bytes.length});}
  const manifest={artifacts:{report:artifact,attachments:attachmentRecords},schemaVersion:'open-etf-report@1',synthetic:selected.every(source=>!source.pdf||source.pdf.synthetic),semanticStatus:'unreviewed',receipt,sources:selected,resultRefs,calculations,methods};
  await publishImmutable(directory,'report.md',bytes,signal);partialPaths.push('report.md');await publishImmutable(directory,'manifest.json',JSON.stringify(manifest,null,2)+'\n',signal);partialPaths.push('manifest.json');return receipt;
 }catch(error){error.partialPaths=partialPaths;error.artifactEffects=[...artifactEffects,...(error.artifactEffects||[])];throw error;}
}
