import {openMemoryLibrary} from './memory.mjs';
import {createMemoryBindings} from './memory-tools.mjs';

const key=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const version='selected-memory@1';
export function normalizeMemoryIds(ids){
 if(!Array.isArray(ids)||ids.length<1||ids.length>16||ids.some(id=>typeof id!=='string'||!key.test(id))||new Set(ids).size!==ids.length)fail('PROJECT_MEMORY_SELECTION');
 return [...ids].sort();
}
export function validateMemorySelection(selection){
 if(!selection||selection.schemaVersion!==version||!key.test(selection.libraryId)||Object.keys(selection).sort().join(',')!=='entries,libraryId,schemaVersion')fail('PROJECT_MEMORY_SELECTION');
 const ids=normalizeMemoryIds(selection.entries?.map(entry=>entry?.id));
 for(let i=0;i<ids.length;i++){const entry=selection.entries[i];if(entry.id!==ids[i]||Object.keys(entry).sort().join(',')!=='id,revision,sha256'||!Number.isSafeInteger(entry.revision)||entry.revision<1||!digest.test(entry.sha256))fail('PROJECT_MEMORY_SELECTION');}
 return selection;
}
export async function freezeMemorySelection({directory,ids}){
 ids=normalizeMemoryIds(ids);
 const library=await openMemoryLibrary({directory});
 try{
  const active=new Map((await library.list()).map(item=>[item.id,item]));
  const entries=ids.map(id=>{const item=active.get(id);if(!item)fail('PROJECT_MEMORY_SELECTION_UNAVAILABLE');return {id,revision:item.revision,sha256:item.sha256};});
  return {schemaVersion:version,libraryId:library.libraryId,entries};
 }finally{await library.close();}
}
export async function openSelectedMemory({directory,selection}){
 validateMemorySelection(selection);
 const library=await openMemoryLibrary({directory});
 try{
  if(library.libraryId!==selection.libraryId)fail('PROJECT_MEMORY_CHANGED');
  const selected=new Map(selection.entries.map(entry=>[entry.id,entry]));
  const unavailable=id=>({kind:'memory-unavailable',libraryId:library.libraryId,id,revision:0,reason:'not-selected-or-current',recordHash:null});
  const readOptional=async id=>selected.has(id)?await library.readSelected(selected.get(id))??unavailable(id):unavailable(id);
  const activeEntries=async()=>{const rows=[];for(const entry of selected.values()){const current=await library.readSelected(entry);if(current)rows.push(current);}return rows;};
  const facade=Object.freeze({
   libraryId:library.libraryId,
   async list(){return (await activeEntries()).map(({id,libraryId,revision,sha256})=>({id,libraryId,revision,sha256,active:true}));},
   async search(query){return (await activeEntries()).filter(entry=>entry.text.toLowerCase().includes(query.toLowerCase()));},
   readOptional,
   async state(id){const entry=selected.get(id);if(!entry)return {libraryId:library.libraryId,id,active:false};const current=await library.state(id);return {...current,active:current.active&&current.revision===entry.revision&&current.sha256===entry.sha256};},
   async verifyReadObservation(value,id){
    if(value?.kind==='memory-unavailable'){const expected=unavailable(id);if(Object.keys(value).length!==Object.keys(expected).length||Object.keys(expected).some(k=>value[k]!==expected[k]))fail('PROJECT_MEMORY_READBACK');return true;}
    const entry=selected.get(id);
    if(!entry||value?.revision!==entry.revision||value?.sha256!==entry.sha256)fail('PROJECT_MEMORY_READBACK');
    return library.verifyReadObservation(value,id);
   }
  });
  async function snapshotCurrentness(){
   const current=new Map((await library.snapshotState([...selected.keys()])).map(value=>[value.id,value]));
   return ref=>{const pinned=selected.get(ref.id),item=current.get(ref.id);return ref.libraryId===library.libraryId&&item&&pinned?{...item,active:item.active&&item.revision===pinned.revision&&item.sha256===pinned.sha256}:null;};
  }
  return {library:facade,snapshotCurrentness,extensions:createMemoryBindings({library:facade}).filter(tool=>!tool.memoryEffect),close:()=>library.close()};
 }catch(error){await library.close();throw error;}
}

export function memoryEntryIdentities(messages){
 const identities=new Map();
 function visit(value){
  if(!value||typeof value!=='object')return;
  if(value.kind==='memory-entry'&&typeof value.libraryId==='string'&&key.test(value.libraryId)&&typeof value.id==='string'&&key.test(value.id)&&Number.isSafeInteger(value.revision)&&value.revision>0&&typeof value.sha256==='string'&&digest.test(value.sha256)){
   const {libraryId,id,revision,sha256}=value;
   identities.set(JSON.stringify([libraryId,id,revision,sha256]),{libraryId,id,revision,sha256});
   return;
  }
  if(Array.isArray(value)){for(const entry of value)visit(entry);}
  else for(const item of Object.values(value))visit(item);
 }
 for(const message of messages)if(message.role==='tool'&&message.result?.status==='succeeded')visit(message.result.value);
 return [...identities.values()];
}
