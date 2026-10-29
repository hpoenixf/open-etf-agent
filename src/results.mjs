import { open, constants, lstat, rename, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { safeDirectory, ensureSafeDirectory, publishImmutable } from './storage-files.mjs';
import { validateSource, sha256 } from './source.mjs';
import { validateNote, noteRef } from './working-note.mjs';
import { validateCalculation } from './calculation.mjs';
const identityKeys=['sourceId','documentId','name','version','page','sha256','mediaType'];
const identity=source=>Object.fromEntries(identityKeys.map(key=>[key,source[key]]));
const refPattern=/^(?:result|calculation|note):sha256:[a-f0-9]{64}$/;
const exact=(value,keys)=>value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const validSelection=value=>exact(value,['offset','limit'])&&Number.isSafeInteger(value.offset)&&value.offset>=0&&value.offset<32&&Number.isSafeInteger(value.limit)&&value.limit>=1&&value.limit<=32;
function comparisonRows(text) {
  const value=JSON.parse(text);
  if (!exact(value,['schemaVersion','synthetic','rows']) || value.schemaVersion!=='comparison-table@1' || value.synthetic!==true || !Array.isArray(value.rows) || value.rows.length<1 || value.rows.length>32) throw new Error('Unsupported comparison table');
  const ids=new Set();
  for (const row of value.rows) {
    if (!exact(row,['id','value','unit','currency','dataAsOf']) || typeof row.id!=='string' || !/^[A-Za-z0-9_-]{1,64}$/.test(row.id) || ids.has(row.id)
      || !(row.value===null||Number.isFinite(row.value))
      || !(row.unit===null||typeof row.unit==='string'&&/^[A-Za-z][A-Za-z0-9 /%_-]{0,39}$/.test(row.unit))
      || !(row.currency===null||typeof row.currency==='string'&&/^[A-Z]{3}$/.test(row.currency))
      || !(row.dataAsOf===null||typeof row.dataAsOf==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.dataAsOf)&&Number.isFinite(Date.parse(row.dataAsOf))&&new Date(row.dataAsOf).toISOString().slice(0,10)===row.dataAsOf)) throw new Error('Invalid comparison row');
    ids.add(row.id);
  }
  return value.rows;
}
const unavailable=(code,facts={})=>({available:false,kind:'comparison-unavailable',code,...facts});

function baseDescriptor(kind,value) {
  if(kind==='source') { const fields=identity(value); return {kind,...fields,resultRef:'result:sha256:'+sha256(JSON.stringify(fields))}; }
  if(kind==='note')return {kind:'note',resultRef:noteRef(value)};
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
export async function createResultStore({directory,allowedDocuments,readOnly=false}={}) {
  if(typeof readOnly!=='boolean')throw new Error('Invalid result read mode');
  directory=await safeDirectory(directory); const records=await(readOnly?safeDirectory:ensureSafeDirectory)(join(directory,'results'));
  if(allowedDocuments!==undefined&&(!Array.isArray(allowedDocuments)||!allowedDocuments.length||allowedDocuments.some(id=>typeof id!=='string'))) throw new Error('Invalid result document scope');
  const grant=allowedDocuments&&new Set(allowedDocuments); let entries;
  try { const index=parse(await boundedBytes(join(directory,'content-index.json'),131072)); if(index.schemaVersion!=='content-index@1'||!Array.isArray(index.entries)||index.entries.length>64) throw new Error('Corrupt content index'); entries=index.entries; }
  catch(error) { if(error.code!=='ENOENT'||readOnly) throw error; if((await readdir(records)).length) throw new Error('Missing content index for nonempty original records'); entries=[]; await writeIndex(directory,entries); }
  const bySource=new Map(),byRef=new Map();
  for(const item of entries) {
    if(!item||!['source','calculation','note'].includes(item.kind)||!refPattern.test(item.resultRef)||item.recordPath!==recordPath(item.resultRef)||!/^[a-f0-9]{64}$/.test(item.recordSha256)||byRef.has(item.resultRef)) throw new Error('Corrupt content index identity');
    if(item.kind==='source') {
      if(!/^[a-f0-9]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.page)||item.page<1||['sourceId','documentId','name','version','mediaType'].some(k=>typeof item[k]!=='string'||!item[k]||item[k].length>200||/[\u0000-\u001f]/.test(item[k]))||item.mediaType!=='text/plain; charset=utf-8'||baseDescriptor('source',item).resultRef!==item.resultRef||bySource.has(item.sourceId)) throw new Error('Corrupt source index identity');
      const keys=[...identityKeys,'kind','resultRef','recordPath','recordSha256'].sort().join(','); if(Object.keys(item).sort().join(',')!==keys) throw new Error('Corrupt index fields');
      bySource.set(item.sourceId,structuredClone(item));
    } else if(item.kind==='note'){if(!item.resultRef.startsWith('note:')||Object.keys(item).sort().join(',')!==['kind','resultRef','recordPath','recordSha256'].sort().join(','))throw new Error('Corrupt note index');
    } else if(item.calculation!=='calculate_change@1'||!item.resultRef.startsWith('calculation:')||Object.keys(item).sort().join(',')!==['kind','calculation','resultRef','recordPath','recordSha256'].sort().join(',')) throw new Error('Corrupt calculation index');
    byRef.set(item.resultRef,structuredClone(item));
  }
  const scope=item=>{if(item.kind==='source'&&grant&&!grant.has(item.documentId)) throw new Error('Source document outside allowed scope');};
  async function readRecord(resultRef,kind) {
    const expected=byRef.get(resultRef); if(!expected||expected.kind!==kind||!refPattern.test(resultRef)) throw new Error('Unknown or invalid typed result ref'); scope(expected);
    await safeDirectory(records); const bytes=await boundedBytes(join(directory,recordPath(resultRef)),524288); if(sha256(bytes)!==expected.recordSha256) throw new Error('Corrupt record snapshot hash');
    const record=parse(bytes); if(record.schemaVersion!=='research-result@1'||record.kind!==kind||record.resultRef!==resultRef) throw new Error('Corrupt result record identity');
    const value=kind==='source'?validateSource(record.value):kind==='note'?validateNote(record.value):validateCalculation(record.value); if(kind==='source'&&value.derived===true) throw new Error('Derived observation is not an original source');
    if(kind==='note')for(const ref of value.sourceRefs){const owned=byRef.get(ref.resultRef);if(!owned||owned.kind!=='source'||identityKeys.some(key=>owned[key]!==ref[key]))throw new Error('Unknown note source ref');scope(owned);}
    if(kind==='calculation'&&value.binding)await verifyComparison(value);
    const base=baseDescriptor(kind,value); if(base.resultRef!==resultRef||Object.keys(base).some(key=>base[key]!==expected[key])) throw new Error('Corrupt result snapshot identity'); return value;
  }
  async function readSelection(resultRef,selection) {
    if(!validSelection(selection))return unavailable('INVALID_SELECTION');
    const owned=byRef.get(resultRef);
    if (!owned || owned.kind!=='source' || grant&&!grant.has(owned.documentId)) return unavailable('SOURCE_UNAVAILABLE');
    // Known record integrity/storage failures are not converted into ordinary
    // missing optional data; original fail-closed ownership still applies.
    const source=await readRecord(resultRef,'source');
    let rows;
    try { rows=comparisonRows(source.text); }
    catch { return unavailable('UNSUPPORTED_COMPARISON_SOURCE',{sourceRef:resultRef}); }
    if(selection.offset>=rows.length)return unavailable('SELECTION_EMPTY',{sourceRef:resultRef});
    const selected=rows.slice(selection.offset,selection.offset+selection.limit).map((row,index)=>({index:selection.offset+index,row}));
    return {available:true,resultRef,contentHash:source.sha256,rows:selected,coverage:{offset:selection.offset,requested:selection.limit,total:rows.length,returned:selected.length,rowIndices:selected.map(r=>r.index),complete:true,storedTableComplete:selection.offset===0&&selected.length===rows.length}};
  }
  async function resolveComparison(input) {
    if(!exact(input,['resultRef','selection','baselineRow','currentRow']) || typeof input.resultRef!=='string' || !/^result:sha256:[a-f0-9]{64}$/.test(input.resultRef) || ![input.baselineRow,input.currentRow].every(v=>Number.isSafeInteger(v)&&v>=0&&v<32))return unavailable('INVALID_COMPARISON_INPUT');
    const selected=await readSelection(input.resultRef,input.selection);if(!selected.available)return selected;
    const facts={sourceRef:selected.resultRef,contentHash:selected.contentHash,coverage:selected.coverage};
    const baseline=selected.rows.find(row=>row.index===input.baselineRow),current=selected.rows.find(row=>row.index===input.currentRow);
    if(!baseline||!current)return unavailable('OPERAND_NOT_SELECTED',facts);
    const a=baseline.row,b=current.row;
    if([a.unit,b.unit,a.currency,b.currency,a.dataAsOf,b.dataAsOf].some(value=>value===null))return unavailable('COMPARISON_METADATA_UNKNOWN',facts);
    if(a.unit!==b.unit)return unavailable('UNIT_MISMATCH',facts);
    if(a.currency!==b.currency)return unavailable('CURRENCY_MISMATCH',facts);
    if(a.dataAsOf!==b.dataAsOf)return unavailable('CUTOFF_MISMATCH',facts);
    if(a.value===null||b.value===null)return unavailable('OPERAND_UNKNOWN',facts);
    if(a.value===0)return unavailable('ZERO_DENOMINATOR',facts);
    if(![b.value-a.value,b.value/a.value,(b.value-a.value)/a.value].every(Number.isFinite))return unavailable('NUMERIC_OVERFLOW',facts);
    return {available:true,inputs:{baseline:a.value,current:b.value,baselineUnit:a.unit,currentUnit:b.unit},binding:{schemaVersion:'comparison-binding@1',sourceRef:selected.resultRef,contentHash:selected.contentHash,selection:structuredClone(input.selection),coverage:selected.coverage,baseline:{rowIndex:baseline.index,rowId:a.id,field:'value'},current:{rowIndex:current.index,rowId:b.id,field:'value'},unit:a.unit,currency:a.currency,dataAsOf:a.dataAsOf}};
  }
  async function verifyComparison(value) {
    const b=value.binding;
    const resolved=await resolveComparison({resultRef:b.sourceRef,selection:b.selection,baselineRow:b.baseline.rowIndex,currentRow:b.current.rowIndex});
    if(!resolved.available||!isDeepStrictEqual(resolved.inputs,value.inputs)||!isDeepStrictEqual(resolved.binding,b))throw new Error('Bound calculation differs from original selected inputs');
  }
  let queue=Promise.resolve();
  function addRecord(kind,value,signal) {
    if(readOnly)throw new Error('Read-only result store');
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
    snapshot: () => structuredClone([...byRef.values()]),
    async verifySnapshot(expected) {
      if (JSON.stringify(expected) !== JSON.stringify([...byRef.values()])) throw new Error('Host result snapshot changed');
      for (const entry of expected) await readRecord(entry.resultRef, entry.kind);
    },
    async readTyped(resultRef) { const entry=byRef.get(resultRef); if(!entry) throw new Error('Unknown result ref'); return readRecord(resultRef,entry.kind); },
    async addNote(input,{signal}={}){const value=validateNote(input);for(const ref of value.sourceRefs){const owned=byRef.get(ref.resultRef);if(!owned||owned.kind!=='source'||identityKeys.some(key=>owned[key]!==ref[key]))throw new Error('Unknown or mismatched note source ref');await readRecord(ref.resultRef,'source');}return addRecord('note',value,signal);},readNote:ref=>readRecord(ref,'note'),
    async add(input,{signal}={}) { const value=validateSource(input); if(value.derived===true) throw new Error('Derived observation is not an original source'); return addRecord('source',value,signal); },
    async addCalculation(input,{signal}={}) { const value=validateCalculation(input);if(value.binding)await verifyComparison(value);return addRecord('calculation',value,signal); },
    readSelection, resolveComparison,
    read:ref=>readRecord(ref,'source'), readCalculation:ref=>readRecord(ref,'calculation'),
    async resolve(sourceId) { const item=bySource.get(sourceId); if(!item) throw new Error('Unknown acquired source ID'); scope(item); return structuredClone(item); },
    async list() { return [...byRef.values()].filter(item=>item.kind==='source'&&(!grant||grant.has(item.documentId))).map(item=>structuredClone(item)); },
    async listCalculations() { return [...byRef.values()].filter(item=>item.kind==='calculation').map(item=>structuredClone(item)); }
  };
}
