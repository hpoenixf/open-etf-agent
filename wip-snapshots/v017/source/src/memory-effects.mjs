// Only bounded identity/operation facts cross the Host/Runtime observation boundary.
// No path, text, arbitrary provider object or credential can be carried here.
export function projectMemoryEffect(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.kind!=='memory-partial-effect'||!/^[-a-f0-9]{36}$/.test(value.libraryId)||!/^[-a-f0-9]{36}$/.test(value.entryId)||typeof value.intentId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value.intentId)||!Number.isSafeInteger(value.revision)||value.revision<1||value.intentConsumed!==true||typeof value.revisionPublished!=='boolean')return null;
  return{kind:'memory-partial-effect',libraryId:value.libraryId,intentId:value.intentId,entryId:value.entryId,revision:value.revision,intentConsumed:true,revisionPublished:value.revisionPublished};
}
