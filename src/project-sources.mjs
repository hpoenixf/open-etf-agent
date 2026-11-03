import {open, constants, realpath, mkdir, lstat} from 'node:fs/promises';
import {resolve, join, dirname, basename, extname} from 'node:path';
import {sha256, normalizeDocumentCatalog, documentCatalogBinding} from './source.mjs';
import {publishImmutable} from './storage-files.mjs';
import {preparePdfSnapshot, normalizePdfSnapshot, pdfSnapshotBinding} from './pdf-input.mjs';

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
  return normalizeDocumentCatalog({schemaVersion:'document-catalog@1',id,documents});
}
function validateManifest(m) {
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
  const documents=[];let pdfSnapshot=null;
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
  const catalog=catalogFor(documents);
  if(!same(manifest.catalogBinding,catalog?documentCatalogBinding(catalog):null)||!same(manifest.pdfBinding,pdfSnapshot?pdfSnapshotBinding(pdfSnapshot):null))fail('PROJECT_SOURCE_BINDING_MISMATCH');
  return {manifest,manifestSha256,catalog,pdfSnapshot};
}
