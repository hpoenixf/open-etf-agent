import {sha256} from './source.mjs';
export function validateNote(input){
  const value=structuredClone(input);if(!value||value.kind!=='derived-working-note'||value.origin!=='derived-summary'||value.semanticStatus!=='unreviewed'||typeof value.text!=='string'||!value.text.trim()||Buffer.byteLength(value.text)>4096||!/^[a-f0-9]{64}$/.test(value.basisHash)||!Array.isArray(value.sourceRefs)||value.sourceRefs.length>64||!Array.isArray(value.memoryRefs)||value.memoryRefs.length>64||!Array.isArray(value.callIds)||!value.callIds.length||value.callIds.length>64||value.callIds.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(value.callIds).size!==value.callIds.length)throw new Error('Invalid derived working note');
  for(const ref of value.sourceRefs)if(typeof ref?.sourceId!=='string'||!/^result:sha256:[a-f0-9]{64}$/.test(ref.resultRef))throw new Error('Invalid note original source ref');
  for(const ref of value.memoryRefs)if(typeof ref?.libraryId!=='string'||typeof ref.id!=='string'||!Number.isSafeInteger(ref.revision)||ref.revision<1||ref.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(ref.sha256))throw new Error('Invalid note Memory dependency');
  if(!value.sourceRefs.length&&!value.memoryRefs.length)throw new Error('Note needs Host-associated original or Memory refs');
  const allowed=['kind','text','sourceRefs','memoryRefs','callIds','basisHash','origin','semanticStatus'];if(Object.keys(value).sort().join(',')!==allowed.sort().join(','))throw new Error('Invalid working note fields');return value;
}
export const noteRef=value=>'note:sha256:'+sha256(JSON.stringify({kind:'note',value}));
