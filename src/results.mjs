import { open, constants, lstat, rename, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { safeDirectory, ensureSafeDirectory, publishImmutable } from './storage-files.mjs';
import { validateSource, sha256 } from './source.mjs';
import { validateCalculation } from './calculation.mjs';
const identityKeys=['sourceId','documentId','name','version','page','sha256','mediaType'];
const identity=source=>Object.fromEntries(identityKeys.map(key=>[key,source[key]]));
const refPattern=/^(?:result|calculation):sha256:[a-f0-9]{64}$/;
function baseDescriptor(kind,value) {
  if(kind==='source') { const fields=identity(value); return {kind,...fields,resultRef:'result:sha256:'+sha256(JSON.stringify(fields))}; }
  return {kind:'calculation',calculation:value.calculation,resultRef:'calculation:sha256:'+sha256(JSON.stringify({kind:'calculation',value}))};
}
function recordPath(ref) { return 'results/'+ref.split(':').at(-1)+'.json'; }
async function boundedBytes(path,maximum) {
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=await file.stat(); if(!stat.isFile()||stat.size>maximum) throw new Error('Corrupt or oversized content record');
    const bytes=Buffer.alloc(maximum+1); let at=0;
    while(at<bytes.length) { const {bytesRead}=await file.read(bytes,at,bytes.length-at); if(!bytesRead) break; at+=bytesRead; }
    if(at>maximum) throw new Error('Oversized content record'); return bytes.subarray(0,at);
  } finally { await file.close(); }
}
const parse=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
async function writeIndex(directory,entries) {
  await safeDirectory(directory); const target=join(directory,'content-index.json');
  try { const stat=await lstat(target); if(!stat.isFile()||stat.isSymbolicLink()) throw new Error('Unsafe content index'); } catch(error) { if(error.code!=='ENOENT') throw error; }
  const temp=join(directory,'.index-'+randomUUID()); let file;
  try { file=await open(temp,'wx',0o600); await file.writeFile(JSON.stringify({schemaVersion:'content-index@1',entries})+'\n'); await file.sync(); await file.close(); file=null; await rename(temp,target); }
  finally { await file?.close().catch(()=>{}); await unlink(temp).catch(()=>{}); }
}
export async function createResultStore({directory,allowedDocuments}={}) {
  directory=await safeDirectory(directory); const records=await ensureSafeDirectory(join(directory,'results'));
  if(allowedDocuments!==undefined&&(!Array.isArray(allowedDocuments)||!allowedDocuments.length||allowedDocuments.some(id=>typeof id!=='string'))) throw new Error('Invalid result document scope');
  const grant=allowedDocuments&&new Set(allowedDocuments); let entries;
  try { const index=parse(await boundedBytes(join(directory,'content-index.json'),131072)); if(index.schemaVersion!=='content-index@1'||!Array.isArray(index.entries)||index.entries.length>64) throw new Error('Corrupt content index'); entries=index.entries; }
  catch(error) { if(error.code!=='ENOENT') throw error; if((await readdir(records)).length) throw new Error('Missing content index for nonempty original records'); entries=[]; await writeIndex(directory,entries); }
  const bySource=new Map(),byRef=new Map();
  for(const item of entries) {
    if(!item||!['source','calculation'].includes(item.kind)||!refPattern.test(item.resultRef)||item.recordPath!==recordPath(item.resultRef)||!/^[a-f0-9]{64}$/.test(item.recordSha256)||byRef.has(item.resultRef)) throw new Error('Corrupt content index identity');
    if(item.kind==='source') {
      if(!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.page)||item.page<1||['sourceId','documentId','name','version','mediaType'].some(k=>typeof item[k]!=='string'||!item[k]||item[k].length>200||/[\u0000-\u001f]/.test(item[k]))||item.mediaType!=='text/plain; charset=utf-8'||baseDescriptor('source',item).resultRef!==item.resultRef||bySource.has(item.sourceId)) throw new Error('Corrupt source index identity');
      const keys=[...identityKeys,'kind','resultRef','recordPath','recordSha256'].sort().join(','); if(Object.keys(item).sort().join(',')!==keys) throw new Error('Corrupt index fields');
      bySource.set(item.sourceId,structuredClone(item));
    } else if(item.calculation!=='calculate_change@1'||!item.resultRef.startsWith('calculation:')||Object.keys(item).sort().join(',')!==['kind','calculation','resultRef','recordPath','recordSha256'].sort().join(',')) throw new Error('Corrupt calculation index');
    byRef.set(item.resultRef,structuredClone(item));
  }
  const scope=item=>{if(item.kind==='source'&&grant&&!grant.has(item.documentId)) throw new Error('Source document outside allowed scope');};
  async function readRecord(resultRef,kind) {
    const expected=byRef.get(resultRef); if(!expected||expected.kind!==kind||!refPattern.test(resultRef)) throw new Error('Unknown or invalid typed result ref'); scope(expected);
    await safeDirectory(records); const bytes=await boundedBytes(join(directory,recordPath(resultRef)),524288); if(sha256(bytes)!==expected.recordSha256) throw new Error('Corrupt record snapshot hash');
    const record=parse(bytes); if(record.schemaVersion!=='research-result@1'||record.kind!==kind||record.resultRef!==resultRef) throw new Error('Corrupt result record identity');
    const value=kind==='source'?validateSource(record.value):validateCalculation(record.value); if(kind==='source'&&value.derived===true) throw new Error('Derived observation is not an original source');
    const base=baseDescriptor(kind,value); if(base.resultRef!==resultRef||Object.keys(base).some(key=>base[key]!==expected[key])) throw new Error('Corrupt result snapshot identity'); return value;
  }
  let queue=Promise.resolve();
  function addRecord(kind,value,signal) {
    const operation=queue.then(async()=>{
      signal?.throwIfAborted(); const base=baseDescriptor(kind,value); scope(base); const old=kind==='source'?bySource.get(value.sourceId):byRef.get(base.resultRef);
      if(old) { if(old.resultRef!==base.resultRef) throw new Error('Source identity rebind conflict'); await readRecord(old.resultRef,kind); return structuredClone(old); }
      if(byRef.size>=64) throw new Error('Result count limit'); const bytes=Buffer.from(JSON.stringify({schemaVersion:'research-result@1',kind,resultRef:base.resultRef,value})+'\n'); if(bytes.length>524288) throw new Error('Result record size limit');
      const item={...base,recordPath:recordPath(base.resultRef),recordSha256:sha256(bytes)};
      await publishImmutable(records,base.resultRef.split(':').at(-1)+'.json',bytes,signal); signal?.throwIfAborted(); await writeIndex(directory,[...byRef.values(),item]);
      byRef.set(item.resultRef,item); if(kind==='source') bySource.set(value.sourceId,item); return structuredClone(item);
    });
    queue=operation.catch(()=>{}); return operation;
  }
  return {
    async add(input,{signal}={}) { const value=validateSource(input); if(value.derived===true) throw new Error('Derived observation is not an original source'); return addRecord('source',value,signal); },
    async addCalculation(input,{signal}={}) { return addRecord('calculation',validateCalculation(input),signal); },
    read:ref=>readRecord(ref,'source'), readCalculation:ref=>readRecord(ref,'calculation'),
    async resolve(sourceId) { const item=bySource.get(sourceId); if(!item) throw new Error('Unknown acquired source ID'); scope(item); return structuredClone(item); },
    async list() { return [...byRef.values()].filter(item=>item.kind==='source'&&(!grant||grant.has(item.documentId))).map(item=>structuredClone(item)); },
    async listCalculations() { return [...byRef.values()].filter(item=>item.kind==='calculation').map(item=>structuredClone(item)); }
  };
}
