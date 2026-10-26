import {open,constants,lstat,rename,unlink,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {safeDirectory,ensureSafeDirectory,publishImmutable} from './storage-files.mjs';
import {sha256} from './source.mjs';
const fail=message=>{throw new Error(message);};
const idPattern=/^[a-f0-9-]{36}$/;
const hashPattern=/^[a-f0-9]{64}$/;
async function readJSON(path,limit=131072){
  const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const stat=await handle.stat();if(!stat.isFile()||stat.size>limit)fail('Unsafe or oversized Memory file');const bytes=Buffer.alloc(limit+1);let at=0;while(at<bytes.length){const{bytesRead}=await handle.read(bytes,at,bytes.length-at);if(!bytesRead)break;at+=bytesRead;}if(at>limit)fail('Oversized Memory file');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,at)));}finally{await handle.close();}
}
async function replaceIndex(directory,index){
  await safeDirectory(directory);const target=join(directory,'memory-index.json');
  try{const stat=await lstat(target);if(!stat.isFile()||stat.isSymbolicLink())fail('Unsafe Memory index');}catch(error){if(error.code!=='ENOENT')throw error;}
  const temp=join(directory,'.index-'+randomUUID());let file;
  try{file=await open(temp,'wx',0o600);await file.writeFile(JSON.stringify(index)+'\n');await file.sync();await file.close();file=null;await rename(temp,target);}finally{await file?.close().catch(()=>{});await unlink(temp).catch(()=>{});}
}
function validateIndex(index){
  if(index?.schemaVersion!=='explicit-memory@1'||!idPattern.test(index.libraryId)||!Array.isArray(index.entries)||index.entries.length>64)fail('Corrupt Memory index');
  const seen=new Set();for(const item of index.entries){if(!item||!idPattern.test(item.id)||seen.has(item.id)||!Number.isSafeInteger(item.revision)||item.revision<1||typeof item.active!=='boolean'||!hashPattern.test(item.recordHash)||!(item.sha256===null||hashPattern.test(item.sha256)))fail('Corrupt Memory entry identity');seen.add(item.id);}return index;
}
function candidateText(value){if(!value||Object.keys(value).join(',')!=='text'||typeof value.text!=='string'||!value.text.trim()||Buffer.byteLength(value.text)>8000)fail('Invalid Memory text');if(/\b(password|passwd|api[_ -]?key|secret[_ -]?key|access[_ -]?token)\s*[:=]/i.test(value.text)||/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value.text))fail('Sensitive Memory value refused');return value.text;}
export async function openMemoryLibrary({directory,writable=false}={}){
  if(typeof directory!=='string'||!directory)fail('Explicit Memory directory required');directory=await(writable?ensureSafeDirectory(directory):safeDirectory(directory));
  let lock;let lockIdentity;const token=randomUUID();let index;let closed=false;let closing=false;let queue=Promise.resolve();
  async function release(){if(!lock)return;await lock.close();lock=null;await safeDirectory(directory);const current=await lstat(join(directory,'.writer.lock')).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(current?.isFile()&&!current.isSymbolicLink()&&lockIdentity&&current.dev===lockIdentity.dev&&current.ino===lockIdentity.ino)await unlink(join(directory,'.writer.lock'));}
  try{
    if(writable){try{lock=await open(join(directory,'.writer.lock'),'wx',0o600);}catch(error){if(error.code==='EEXIST')fail('Memory writer lock already owned');throw error;}lockIdentity=await lock.stat();await lock.writeFile(JSON.stringify({token}));await lock.sync();}
    try{index=validateIndex(await readJSON(join(directory,'memory-index.json')));}catch(error){if(error.code!=='ENOENT'||!writable)throw error;const existing=await readdir(directory);if(existing.some(name=>name!=='.writer.lock'))fail('Missing Memory index in nonempty library');index={schemaVersion:'explicit-memory@1',libraryId:randomUUID(),entries:[]};await ensureSafeDirectory(join(directory,'entries'));await ensureSafeDirectory(join(directory,'intents'));await replaceIndex(directory,index);}
    await safeDirectory(join(directory,'entries'));await safeDirectory(join(directory,'intents'));
  }catch(error){await release();throw error;}
  const libraryId=index.libraryId;
  const ready=()=>{if(closed||closing)fail('Memory library closed');};
  async function current(){await safeDirectory(directory);const latest=validateIndex(await readJSON(join(directory,'memory-index.json')));if(latest.libraryId!==libraryId)fail('Memory library identity changed');return latest;}
  async function metadata(id){if(!idPattern.test(id))fail('Invalid Memory entry id');return(await current()).entries.find(item=>item.id===id);}
  async function read(id){ready();const item=await metadata(id);if(!item?.active)fail('Memory entry forgotten or unavailable');const path=await safeDirectory(join(directory,'entries',id));const record=await readJSON(join(path,item.revision+'.json'),16384);if(sha256(JSON.stringify(record))!==item.recordHash||record.kind!=='memory-entry'||record.libraryId!==libraryId||record.id!==id||record.revision!==item.revision||record.sha256!==item.sha256||sha256(record.text)!==item.sha256)fail('Corrupt Memory record identity');return record;}
  function mutate(operation,id,expectedRevision,value,options={}){
    ready();if(!writable)fail('Memory library is read only');const signal=options.signal;signal?.throwIfAborted();const intent=structuredClone(options.intent);const text=operation==='forget'?undefined:candidateText(value);
    const work=queue.then(async()=>{
      signal?.throwIfAborted();const latest=await current();const old=id?latest.entries.find(item=>item.id===id):null;
      if(operation!=='save'){if(!old?.active)fail('Memory entry forgotten or unavailable');if(old.revision!==expectedRevision)fail('Memory revision conflict');}
      if(!intent||intent.explicit!==true||intent.libraryId!==libraryId||intent.operation!==operation||typeof intent.intentId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(intent.intentId)||typeof intent.origin!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(intent.origin)||(text!==undefined&&intent.approvedTextHash!==sha256(text))||(operation!=='save'&&(intent.entryId!==id||intent.expectedRevision!==expectedRevision)))fail('Missing or mismatched authorized Memory intent/library/operation/content');
      if(operation==='save'&&latest.entries.length>=64)fail('Memory entry limit');
      const reserved=join(directory,'intents');await safeDirectory(reserved);const reservation=sha256(intent.intentId)+'.json';
      try{await publishImmutable(reserved,reservation,JSON.stringify({libraryId,intent})+'\n',signal);}catch(error){if(error.code==='EEXIST')fail('Memory intent already consumed');throw error;}
      const entryId=id||randomUUID();const revision=(old?.revision||0)+1;const partialPaths=['intents/'+reservation];
      try{
        const record={kind:operation==='forget'?'memory-tombstone':'memory-entry',libraryId,id:entryId,revision,...(text===undefined?{}:{text,sha256:sha256(text)}),provenance:{intentId:intent.intentId,origin:intent.origin,operation}};
        const recordHash=sha256(JSON.stringify(record));const folder=await ensureSafeDirectory(join(directory,'entries',entryId));await publishImmutable(folder,revision+'.json',JSON.stringify(record)+'\n',signal);partialPaths.push('entries/'+entryId+'/'+revision+'.json');
        const item={id:entryId,revision,active:operation!=='forget',sha256:text===undefined?null:sha256(text),recordHash};const entries=latest.entries.filter(entry=>entry.id!==entryId);entries.push(item);signal?.throwIfAborted();await replaceIndex(directory,{...latest,entries});
        return{kind:'memory-write-receipt',libraryId,id:entryId,revision,sha256:item.sha256,operation:{save:'saved',revise:'revised',forget:'forgotten'}[operation],intentId:intent.intentId,recordHash};
      }catch(error){error.partialPaths=partialPaths;error.intentConsumed=true;error.memoryEffect={kind:'memory-partial-effect',libraryId,intentId:intent.intentId,entryId,revision,intentConsumed:true,revisionPublished:partialPaths.length>1};throw error;}
    });queue=work.catch(()=>{});return work;
  }
  return Object.freeze({libraryId,
    async list(){ready();return(await current()).entries.filter(item=>item.active).map(({recordHash,...item})=>({libraryId,...item}));},
    async search(query){ready();if(typeof query!=='string'||!query.trim()||query.length>256)fail('Invalid Memory search');const active=(await current()).entries.filter(item=>item.active);const results=[];for(const item of active){const value=await read(item.id);if(value.text.toLowerCase().includes(query.toLowerCase()))results.push(value);}return results;},
    read,async state(id){ready();const item=await metadata(id);return item?{libraryId,...item}:{libraryId,id,active:false,revision:0,sha256:null};},
    save:async(value,options)=>mutate('save',null,null,value,options),revise:async(id,revision,value,options)=>mutate('revise',id,revision,value,options),forget:async(id,revision,options)=>mutate('forget',id,revision,null,options),
    async close(){if(closed)return;closing=true;await queue;await release();closed=true;}
  });
}
