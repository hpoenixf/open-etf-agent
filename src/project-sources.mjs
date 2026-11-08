import {open, constants, realpath, mkdir, lstat} from 'node:fs/promises';
import {resolve, join, dirname, basename, extname} from 'node:path';
import {sha256, normalizeDocumentCatalog, documentCatalogBinding} from './source.mjs';
import {publishImmutable} from './storage-files.mjs';
import {preparePdfSnapshot, normalizePdfSnapshot, pdfSnapshotBinding} from './pdf-input.mjs';
import {normalizeWebProvenance,webDocumentIdentity,webOriginalBytes} from './web-source.mjs';
import {normalizeWebAcquisitionPlan,validateWebTransportRecord,acquisitionHash,ACQUISITION_LIMITS} from './web-acquisition-records.mjs';

export const PROJECT_SOURCE_LIMITS = Object.freeze({files:64, originalBytes:1048576, pageBytes:64000, pages:16, catalogBytes:1048576, pdfs:1});
const fail = code => { throw Object.assign(new Error(code), {code}); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.split(',').sort().join(',');
const cancel = signal => { if(signal?.aborted) fail('PROJECT_SOURCE_CANCELLED'); };
const encode = value => Buffer.from(JSON.stringify(value));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
async function safeDirectory(path, create=false) {
  path=resolve(path);
  try {
    if(create) {
      try { await lstat(path); }
      catch(e) { if(e.code!=='ENOENT') throw e; await safeDirectory(dirname(path),true); await mkdir(path).catch(e=>{if(e.code!=='EEXIST')throw e;}); }
    }
    if(await realpath(path)!==path || !(await lstat(path)).isDirectory()) fail('PROJECT_SOURCE_UNSAFE_PATH');
    return path;
  } catch(e) { if(e.code?.startsWith('PROJECT_SOURCE_'))throw e; fail('PROJECT_SOURCE_UNAVAILABLE'); }
}
async function readBounded(path, limit, signal) {
  let handle;
  try {
    cancel(signal);path=resolve(path);
    if(await realpath(path)!==path)fail('PROJECT_SOURCE_UNSAFE_PATH');
    handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    const before=await handle.stat({bigint:true});
    if(!before.isFile())fail('PROJECT_SOURCE_UNSAFE_PATH');
    if(before.size>BigInt(limit))fail('PROJECT_SOURCE_LIMIT_BYTES');
    const bytes=Buffer.alloc(limit+1);let offset=0;
    while(offset<bytes.length){cancel(signal);const r=await handle.read(bytes,offset,bytes.length-offset);if(!r.bytesRead)break;offset+=r.bytesRead;}
    const after=await handle.stat({bigint:true}), named=await lstat(path,{bigint:true});
    if(offset>limit)fail('PROJECT_SOURCE_LIMIT_BYTES');
    if(['dev','ino','size','mtimeNs','ctimeNs'].some(k=>before[k]!==after[k]||after[k]!==named[k]) || after.size!==BigInt(offset) || await realpath(path)!==path)fail('PROJECT_SOURCE_CHANGED');
    cancel(signal);return bytes.subarray(0,offset);
  }catch(e){if(e.code?.startsWith('PROJECT_SOURCE_'))throw e;fail(e.code==='ELOOP'?'PROJECT_SOURCE_UNSAFE_PATH':'PROJECT_SOURCE_UNAVAILABLE');}
  finally{await handle?.close();}
}
async function directories(projectDir, create) {
  if(typeof projectDir!=='string'||!projectDir||projectDir.includes('\0'))fail('PROJECT_SOURCE_INVALID_INPUT');
  const root=await safeDirectory(projectDir,create);
  const sources=await safeDirectory(join(root,'sources'),create);
  return {objects:await safeDirectory(join(sources,'objects'),create),manifests:await safeDirectory(join(sources,'manifests'),create)};
}
async function put(directory, bytes, suffix, signal) {
  await safeDirectory(directory);cancel(signal);
  const digest=sha256(bytes),name=`${digest}.${suffix}`,path=join(directory,name);
  // Publish only a fully written, fsynced inode. Another importer may win the
  // link race; verify its complete bytes rather than overwriting its object.
  try{await publishImmutable(directory,name,bytes,signal);}
  catch(e){if(e.code!=='EEXIST')throw e;}
  const stored=await readBounded(path,bytes.length,signal);
  if(!stored.equals(bytes))fail('PROJECT_SOURCE_HASH_MISMATCH');return digest;
}
function textDocument(bytes, name) {
  let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('PROJECT_SOURCE_INVALID_UTF8');}
  if(!text.length||text.includes('\0'))fail('PROJECT_SOURCE_EMPTY_OR_BINARY');
  const pages=[];let page='',size=0;
  for(const character of text){const count=Buffer.byteLength(character);if(size+count>64000){pages.push(page);page='';size=0;}page+=character;size+=count;}
  if(page)pages.push(page);if(pages.length>16)fail('PROJECT_SOURCE_LIMIT_PAGES');
  const digest=sha256(bytes);
  return {id:`text:${digest}`,name,version:`utf8-pages-v1:${digest}`,pages};
}
function pageMapFor(document) {
  let offset=0;return document.pages.map((text,index)=>{const startByte=offset;offset+=Buffer.byteLength(text);return {page:index+1,startByte,endByte:offset,sha256:sha256(text)};});
}
function catalogFor(documents) {
  if(!documents.length)return null;
  const id=`selected:${sha256(encode(documents.map(d=>({id:d.id,name:d.name,version:d.version})).sort((a,b)=>a.id.localeCompare(b.id))))}`;
  return normalizeDocumentCatalog({schemaVersion:documents.some(d=>d.web)?'document-catalog@2':'document-catalog@1',id,documents});
}
function validateManifest(m) {
  if(m?.schemaVersion==='project-sources@2'){
    if(!exact(m,'schemaVersion,files,webEntries,acquisition,catalogBinding,pdfBinding')||!Array.isArray(m.files)||m.files.length>64||!Array.isArray(m.webEntries)||!m.webEntries.length||m.webEntries.length>16||m.files.length+m.webEntries.length>64||!exact(m.acquisition,'projectId,id,admissionSha256,baseManifestSha256')||typeof m.acquisition.projectId!=='string'||typeof m.acquisition.id!=='string'||!hash(m.acquisition.admissionSha256)||(m.acquisition.baseManifestSha256!==null&&!hash(m.acquisition.baseManifestSha256)))fail('PROJECT_SOURCE_INVALID_MANIFEST');
    if(m.files.length)validateManifest({schemaVersion:'project-sources@1',files:m.files,catalogBinding:null,pdfBinding:m.pdfBinding});
    if(m.webEntries.some(e=>!exact(e,'receiptSha256,snapshotSha256')||!hash(e.receiptSha256)||!hash(e.snapshotSha256))||new Set(m.webEntries.map(e=>e.receiptSha256)).size!==m.webEntries.length)fail('PROJECT_SOURCE_INVALID_MANIFEST');
    return m;
  }
  if(!exact(m,'schemaVersion,files,catalogBinding,pdfBinding')||m.schemaVersion!=='project-sources@1'||!Array.isArray(m.files)||!m.files.length||m.files.length>64)fail('PROJECT_SOURCE_INVALID_MANIFEST');
  const seen=new Set();let pdfs=0;
  for(const f of m.files){
    if(!exact(f,'kind,name,originalSha256,originalBytes,snapshotSha256,pageMap')||!['text','pdf'].includes(f.kind)||typeof f.name!=='string'||!f.name||f.name.length>200||/[\u0000-\u001f/\\]/.test(f.name)||!hash(f.originalSha256)||!Number.isSafeInteger(f.originalBytes)||f.originalBytes<1||f.originalBytes>1048576||seen.has(f.originalSha256)||(f.kind==='text'?f.snapshotSha256!==null:!hash(f.snapshotSha256)))fail('PROJECT_SOURCE_INVALID_MANIFEST');
    seen.add(f.originalSha256);if(f.kind==='pdf'&&++pdfs>1)fail('PROJECT_SOURCE_LIMIT_PDFS');
  }
  return m;
}
// Explicit selection only. Original filesystem paths are never persisted or revisited on restore.
export async function importProjectSources({projectDir,files,signal}={}) {
  cancel(signal);
  if(!Array.isArray(files)||!files.length||files.length>64||files.some(p=>typeof p!=='string'||!p||p.includes('\0')||p.includes('://')))fail('PROJECT_SOURCE_INVALID_INPUT');
  if(files.some(p=>!['.txt','.md','.markdown','.pdf'].includes(extname(p).toLowerCase())))fail('PROJECT_SOURCE_UNSUPPORTED_TYPE');
  if(files.filter(p=>extname(p).toLowerCase()==='.pdf').length>1)fail('PROJECT_SOURCE_LIMIT_PDFS');
  const dirs=await directories(projectDir,true),entries=[],documents=[],seen=new Set();let pdfSnapshot=null;
  for(const path of files){
    const name=basename(path);if(!name||name.length>200||/[\u0000-\u001f\\]/.test(name))fail('PROJECT_SOURCE_INVALID_INPUT');
    const bytes=await readBounded(path,1048576,signal),digest=sha256(bytes),kind=extname(path).toLowerCase()==='.pdf'?'pdf':'text';
    if(seen.has(digest))fail('PROJECT_SOURCE_DUPLICATE');seen.add(digest);
    let snapshotSha256=null,pageMap=null;
    if(kind==='text'){const document=textDocument(bytes,name);documents.push(document);pageMap=pageMapFor(document);}
    await put(dirs.objects,bytes,kind==='pdf'?'pdf':'bin',signal);
    if(kind==='pdf'){
      pdfSnapshot=await preparePdfSnapshot({input:{path:join(dirs.objects,`${digest}.pdf`)},signal});
      if(pdfSnapshot.originalSha256!==digest)fail('PROJECT_SOURCE_HASH_MISMATCH');
      snapshotSha256=await put(dirs.objects,encode(pdfSnapshot),'json',signal);
    }
    entries.push({kind,name,originalSha256:digest,originalBytes:bytes.length,snapshotSha256,pageMap});
  }
  const catalog=catalogFor(documents),manifest=validateManifest({schemaVersion:'project-sources@1',files:entries,catalogBinding:catalog?documentCatalogBinding(catalog):null,pdfBinding:pdfSnapshot?pdfSnapshotBinding(pdfSnapshot):null});
  const manifestSha256=await put(dirs.manifests,encode(manifest),'json',signal);
  return loadProjectSources({projectDir,manifestSha256,signal});
}
export async function loadProjectSources({projectDir,manifestSha256,signal}={}) {
  cancel(signal);
  if(!hash(manifestSha256))fail('PROJECT_SOURCE_INVALID_MANIFEST');
  const dirs=await directories(projectDir,false);
  const manifestBytes=await readBounded(join(dirs.manifests,`${manifestSha256}.json`),65536,signal);
  if(sha256(manifestBytes)!==manifestSha256)fail('PROJECT_SOURCE_HASH_MISMATCH');
  let manifest;try{manifest=JSON.parse(manifestBytes);}catch{fail('PROJECT_SOURCE_INVALID_MANIFEST');}validateManifest(manifest);
  const documents=[];let pdfSnapshot=null,webAcquisition=null;
  for(const f of manifest.files){
    const bytes=await readBounded(join(dirs.objects,`${f.originalSha256}.${f.kind==='pdf'?'pdf':'bin'}`),1048576,signal);
    if(bytes.length!==f.originalBytes||sha256(bytes)!==f.originalSha256)fail('PROJECT_SOURCE_HASH_MISMATCH');
    if(f.kind==='text'){const document=textDocument(bytes,f.name);if(!same(f.pageMap,pageMapFor(document)))fail('PROJECT_SOURCE_BINDING_MISMATCH');documents.push(document);}
    else{
      if(f.pageMap!==null)fail('PROJECT_SOURCE_INVALID_MANIFEST');
      const snapshotBytes=await readBounded(join(dirs.objects,`${f.snapshotSha256}.json`),3145728,signal);
      if(sha256(snapshotBytes)!==f.snapshotSha256)fail('PROJECT_SOURCE_HASH_MISMATCH');
      try{pdfSnapshot=normalizePdfSnapshot(JSON.parse(snapshotBytes));}catch{fail('PROJECT_SOURCE_INVALID_SNAPSHOT');}
      if(pdfSnapshot.synthetic!==false||pdfSnapshot.originalSha256!==f.originalSha256||pdfSnapshot.originalBytes!==f.originalBytes||!Buffer.from(pdfSnapshot.originalBase64,'base64').equals(bytes))fail('PROJECT_SOURCE_HASH_MISMATCH');
    }
  }
  if(manifest.schemaVersion==='project-sources@2'){
    let project;try{project=JSON.parse(await readBounded(join(resolve(projectDir),'project.json'),2097152,signal));}catch{fail('PROJECT_SOURCE_WEB_PROJECT_CHANGED');}
    if(project.projectId!==manifest.acquisition.projectId)fail('PROJECT_SOURCE_WEB_PROJECT_CHANGED');
    webAcquisition=await loadWebEntries(dirs,manifest,documents,signal);
  }
  const catalog=catalogFor(documents);
  if(!same(manifest.catalogBinding,catalog?documentCatalogBinding(catalog):null)||!same(manifest.pdfBinding,pdfSnapshot?pdfSnapshotBinding(pdfSnapshot):null))fail('PROJECT_SOURCE_BINDING_MISMATCH');
  return {manifest,manifestSha256,catalog,pdfSnapshot,...(webAcquisition?{webAcquisition}:{})};
}

async function readObject(dirs,digest,maximum,signal){
  const bytes=await readBounded(join(dirs.objects,`${digest}.json`),maximum,signal);
  if(sha256(bytes)!==digest)fail('PROJECT_SOURCE_HASH_MISMATCH');
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('PROJECT_SOURCE_INVALID_MANIFEST');}
}
async function readBaseManifest(dirs,digest,signal){
  if(digest===null)return null;
  const bytes=await readBounded(join(dirs.manifests,`${digest}.json`),65536,signal);
  if(sha256(bytes)!==digest)fail('PROJECT_SOURCE_HASH_MISMATCH');
  let m;try{m=JSON.parse(bytes);}catch{fail('PROJECT_SOURCE_INVALID_MANIFEST');}return validateManifest(m);
}
async function loadWebEntries(dirs,manifest,documents,signal){
  const a=manifest.acquisition,plan=normalizeWebAcquisitionPlan(await readObject(dirs,a.admissionSha256,65536,signal));
  if(plan.projectId!==a.projectId||plan.acquisitionId!==a.id||plan.baseManifestSha256!==a.baseManifestSha256||acquisitionHash(plan)!==a.admissionSha256)fail('PROJECT_SOURCE_WEB_ADMISSION_CHANGED');
  const base=await readBaseManifest(dirs,a.baseManifestSha256,signal),prior=base?.webEntries??[];
  if(!same(manifest.files,base?.files??[])||!same(manifest.webEntries.slice(0,prior.length),prior)||manifest.webEntries.length!==prior.length+plan.urls.length)fail('PROJECT_SOURCE_WEB_BASE_CHANGED');
  let originalTotal=0,textTotal=0;const summary={completedPages:0,requestCount:0,originalBytes:0,textBytes:0};
  for(const [index,e]of manifest.webEntries.entries()){
    const web=normalizeWebProvenance(await readObject(dirs,e.receiptSha256,32768,signal));
    if(web.projectId!==a.projectId||sha256(encode(web))!==e.receiptSha256)fail('PROJECT_SOURCE_WEB_ADMISSION_CHANGED');
    const originalPlan=normalizeWebAcquisitionPlan(await readObject(dirs,web.admissionSha256,65536,signal));
    if(originalPlan.projectId!==web.projectId||originalPlan.acquisitionId!==web.acquisitionId||originalPlan.baseManifestSha256!==web.baseManifestSha256||acquisitionHash(originalPlan)!==web.admissionSha256)fail('PROJECT_SOURCE_WEB_ADMISSION_CHANGED');
    const transport=validateWebTransportRecord(await readObject(dirs,web.transportSha256,32768,signal),originalPlan);
    if(['requestedUrl','finalUrl','retrievedAt','originalSha256','originalBytes','originalMediaType'].some(k=>transport[k]!==web[k])||!same(transport.extraction,web.extraction))fail('PROJECT_SOURCE_WEB_TRANSPORT_CHANGED');
    if(index>=prior.length&&(web.admissionSha256!==a.admissionSha256||web.requestedUrl!==plan.urls[index-prior.length]))fail('PROJECT_SOURCE_WEB_ADMISSION_CHANGED');
    const snapshot=await readObject(dirs,e.snapshotSha256,1048576,signal),identity=webDocumentIdentity(web);
    if(!exact(snapshot,'id,name,version,pages')||snapshot.id!==identity.id||snapshot.version!==identity.version||!Array.isArray(snapshot.pages)||snapshot.pages.length!==web.pageMap.length||snapshot.pages.some((text,i)=>typeof text!=='string'||sha256(text)!==web.pageMap[i].sha256||Buffer.byteLength(text)!==web.pageMap[i].bytes)||sha256(snapshot.pages.join(''))!==transport.textSha256)fail('PROJECT_SOURCE_WEB_SNAPSHOT_CHANGED');
    const original=await readBounded(join(dirs.objects,`${web.originalSha256}.bin`),262144,signal);webOriginalBytes(web,original.toString('base64'));
    originalTotal+=original.length;textTotal+=snapshot.pages.reduce((n,text)=>n+Buffer.byteLength(text),0);
    if(originalTotal>ACQUISITION_LIMITS.originalBytes||textTotal>ACQUISITION_LIMITS.textBytes)fail('PROJECT_SOURCE_WEB_LIMIT');
    documents.push({...snapshot,web,originalBase64:original.toString('base64')});
    if(index>=prior.length){summary.completedPages++;summary.requestCount+=transport.requestCount;summary.originalBytes+=original.length;summary.textBytes+=snapshot.pages.reduce((n,text)=>n+Buffer.byteLength(text),0);}
  }
  if(summary.requestCount>plan.limits.requests)fail('PROJECT_SOURCE_WEB_LIMIT');
  return summary;
}

// Internal trusted-host persistence: callers do not mint URL permission here.
// The public acquisition entry dispatches through the fixed transport owner.
export async function persistWebAcquisition({projectDir,admission,observations,signal}={}){
  const plan=normalizeWebAcquisitionPlan(admission);
  if(!Array.isArray(observations)||observations.length!==plan.urls.length)fail('PROJECT_SOURCE_WEB_OBSERVATION_COUNT');
  const base=plan.baseManifestSha256===null?null:await loadProjectSources({projectDir,manifestSha256:plan.baseManifestSha256,signal});
  if(base?.manifest.schemaVersion==='project-sources@2'&&base.manifest.acquisition.projectId!==plan.projectId)fail('PROJECT_SOURCE_WEB_ADMISSION_CHANGED');
  const dirs=await directories(projectDir,true),admissionSha256=await put(dirs.objects,encode(plan),'json',signal),entries=[...(base?.manifest.webEntries??[])],documents=[...(base?.catalog?.documents??[])];
  for(const [i,o]of observations.entries()){
    if(!Buffer.isBuffer(o.body)||!Array.isArray(o.pages)||o.pages.some(t=>typeof t!=='string')||o.requestedUrl!==plan.urls[i])fail('PROJECT_SOURCE_WEB_OBSERVATION_INVALID');
    const transport=validateWebTransportRecord({schemaVersion:'web-fetch-observation@1',requestedUrl:o.requestedUrl,finalUrl:o.finalUrl,retrievedAt:o.fetchedAt,originalSha256:sha256(o.body),originalBytes:o.body.length,originalMediaType:o.originalMediaType,extraction:o.extraction,textSha256:sha256(o.pages.join('')),redirects:o.redirects,robots:o.robots,requestCount:o.requestCount},plan);
    const transportSha256=await put(dirs.objects,encode(transport),'json',signal);
    const web=normalizeWebProvenance({schemaVersion:'web-source@1',acquisitionId:plan.acquisitionId,projectId:plan.projectId,baseManifestSha256:plan.baseManifestSha256,admissionSha256,transportSha256,requestedUrl:transport.requestedUrl,finalUrl:transport.finalUrl,retrievedAt:transport.retrievedAt,originalSha256:transport.originalSha256,originalBytes:transport.originalBytes,originalMediaType:transport.originalMediaType,extraction:transport.extraction,pageMap:o.pages.map((text,index)=>({page:index+1,sha256:sha256(text),bytes:Buffer.byteLength(text)}))});
    const snapshot={...webDocumentIdentity(web),name:`Web source ${i+1}: ${new URL(web.requestedUrl).hostname}`.slice(0,200),pages:o.pages};
    await put(dirs.objects,o.body,'bin',signal);
    const receiptSha256=await put(dirs.objects,encode(web),'json',signal),snapshotSha256=await put(dirs.objects,encode(snapshot),'json',signal);
    entries.push({receiptSha256,snapshotSha256});documents.push({...snapshot,web,originalBase64:o.body.toString('base64')});
  }
  const catalog=catalogFor(documents),manifest=validateManifest({schemaVersion:'project-sources@2',files:base?.manifest.files??[],webEntries:entries,acquisition:{projectId:plan.projectId,id:plan.acquisitionId,admissionSha256,baseManifestSha256:plan.baseManifestSha256},catalogBinding:documentCatalogBinding(catalog),pdfBinding:base?.manifest.pdfBinding??null});
  // Full read/validation before the manifest is made visible. Partial objects
  // remain unreferenced evidence on failure, never a usable source selection.
  await loadWebEntries(dirs,manifest,[],signal);
  const manifestSha256=await put(dirs.manifests,encode(manifest),'json',signal);
  return loadProjectSources({projectDir,manifestSha256,signal});
}
