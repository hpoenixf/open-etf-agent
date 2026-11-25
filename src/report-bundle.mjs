import {constants} from 'node:fs';
import {lstat,mkdir,open,readdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {sha256} from './source.mjs';
import {publishImmutable,safeDirectory} from './storage-files.mjs';

const schemaVersion='offline-report-bundle@1';
const memberLimits={'report.md':256*1024,'citations.json':256*1024,'manifest.json':4096};
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const validHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

function reportBody(view,run){
  const {receipt,report,revision}=view;
  const messages=run.snapshot.messages;
  const operations=messages.filter(m=>m.role==='tool'&&m.callId===receipt.operationId);
  const [entry]=operations;
  const declared=messages.flatMap(m=>m.calls??[]).find(c=>c.id===receipt.operationId);
  const call=entry?.result?.effective??declared;
  const body=call?.arguments?.text;
  if(operations.length!==1||entry.result.status!=='succeeded'||entry.result.dispatched!==true||
    !isDeepStrictEqual(entry.result.value,receipt)||call?.id!==receipt.operationId||
    call.name!=='save_report'||typeof body!=='string'||!body||
    !isDeepStrictEqual(call.arguments.sourceIds,revision.sources.map(s=>s.sourceId))||
    !report.text.startsWith(body+'\n\n## Acquired sources\n')||sha256(report.text)!==receipt.sha256||
    report.artifactId!==receipt.artifactId||revision.revisionId!==receipt.revisionId){
    fail('REPORT_BODY_IDENTITY_UNAVAILABLE');
  }
  return Buffer.from(body);
}

async function publicCitationIndex({projectDir,definition,revision}){
  const sources=revision.sources;
  const publicCitations=[];
  if(sources.some(s=>s.web)&&definition.sourceManifestSha256){
    const [{loadProjectSources},{normalizeWebUrl}]=await Promise.all([
      import('./project-sources.mjs'),import('./web-policy.mjs')
    ]);
    // Bind the stored report's public references to the original admitted Web
    // catalog. Local documents, raw excerpts and transport records stay local.
    const {catalog}=await loadProjectSources({projectDir,manifestSha256:definition.sourceManifestSha256});
    for(const [index,source] of sources.entries()){
      if(!source.web||source.web.finalUrl.includes('?'))continue;
      const doc=catalog?.documents.find(d=>d.id===source.documentId);
      if(!doc?.web||doc.web.projectId!==definition.projectId||!isDeepStrictEqual(doc.web,source.web)||
        doc.version!==source.version||doc.pages[source.page-1]!==source.text||
        normalizeWebUrl(doc.web.finalUrl)!==doc.web.finalUrl)continue;
      publicCitations.push({
        number:index+1,url:doc.web.finalUrl,retrievedAt:doc.web.retrievedAt,
        location:{page:null,section:null,extractionChunk:source.page},
      });
    }
  }
  return {publicCitations,omittedCitations:sources.length-publicCitations.length};
}

export async function exportReportBundle({projectDir,runId,directory}){
  const {readResearchOutput,inspectResearchTask}=await import('./research-project.mjs');
  const view=await readResearchOutput({projectDir,runId});
  if(view.kind!=='report'||view.publicationStatus!=='published')fail('PUBLISHED_REPORT_REQUIRED');
  const {definition,run}=await inspectResearchTask({projectDir,runId});
  if(definition.config.documentProtection||run?.rootId!==view.runId||run.parentRunId!==null)fail('PUBLISHED_REPORT_REQUIRED');
  const report=reportBody(view,run);
  const citations=json(await publicCitationIndex({projectDir,definition,revision:view.revision}));
  const payload={
    schemaVersion,
    reportVersion:{artifactRevision:view.revision.revisionId,publicationRevision:view.publication.receipt.revision},
    files:{'report.md':{bytes:report.length,sha256:sha256(report)},'citations.json':{bytes:citations.length,sha256:sha256(citations)}},
  };
  const manifest=json({...payload,checksum:sha256(json(payload))});
  directory=resolve(directory);
  await safeDirectory(dirname(directory));
  await mkdir(directory,{mode:0o700});
  await publishImmutable(directory,'report.md',report);
  await publishImmutable(directory,'citations.json',citations);
  await publishImmutable(directory,'manifest.json',manifest);
  return {schemaVersion,manifestSha256:sha256(manifest)};
}

async function readMember(directory,name){
  const limit=memberLimits[name];
  const path=join(directory,name);
  const entry=await lstat(path);
  if(!entry.isFile()||entry.size>limit)fail('INVALID_BUNDLE_MEMBER');
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size>limit)fail('INVALID_BUNDLE_MEMBER');
    const buffer=Buffer.alloc(limit+1);
    let offset=0;
    while(offset<buffer.length){
      const {bytesRead}=await handle.read(buffer,offset,buffer.length-offset,offset);
      if(!bytesRead)break;
      offset+=bytesRead;
    }
    if(offset>limit)fail('INVALID_BUNDLE_MEMBER');
    return buffer.subarray(0,offset);
  }finally{await handle.close();}
}

export async function verifyReportBundle({directory,expectedManifest}){
  directory=await safeDirectory(directory);
  const entries=(await readdir(directory)).sort();
  if(!isDeepStrictEqual(entries,Object.keys(memberLimits).sort()))fail('INVALID_BUNDLE_FILES');
  const bytes=await readMember(directory,'manifest.json');
  const manifestSha256=sha256(bytes);
  if(expectedManifest!==undefined&&expectedManifest!==manifestSha256)fail('MANIFEST_CHECKSUM_MISMATCH');
  const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const {schemaVersion:version,reportVersion,files,checksum}=manifest;
  const payload={schemaVersion:version,reportVersion,files};
  if(version!==schemaVersion||!/^revision:sha256:[a-f0-9]{64}$/.test(reportVersion?.artifactRevision)||
    ![1,2,3].includes(reportVersion?.publicationRevision)||checksum!==sha256(json(payload))||
    !bytes.equals(json({...payload,checksum}))||!isDeepStrictEqual(Object.keys(files??{}).sort(),['citations.json','report.md'])){
    fail('INVALID_BUNDLE_MANIFEST');
  }
  for(const name of ['report.md','citations.json']){
    const data=await readMember(directory,name);
    if(!validHash(files[name]?.sha256)||files[name].sha256!==sha256(data)||files[name].bytes!==data.length)fail('BUNDLE_CHECKSUM_MISMATCH');
  }
  return {schemaVersion,manifestSha256,verified:true};
}
