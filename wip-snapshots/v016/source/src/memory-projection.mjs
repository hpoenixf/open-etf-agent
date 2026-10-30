import {sha256} from './source.mjs';
export async function projectMemory({messages,lookupState}={}){
  if(!Array.isArray(messages)||typeof lookupState!=='function')throw new Error('Invalid Memory projection configuration');
  const projected=structuredClone(messages);const stateCache=new Map();
  async function active(ref){
    if(!ref||typeof ref.libraryId!=='string'||typeof ref.id!=='string'||!Number.isSafeInteger(ref.revision)||ref.revision<1)return false;
    const key=JSON.stringify([ref.libraryId,ref.id]);if(!stateCache.has(key))stateCache.set(key,await lookupState({libraryId:ref.libraryId,id:ref.id}));
    const state=stateCache.get(key);return !!state&&state.libraryId===ref.libraryId&&state.id===ref.id&&state.active===true&&state.revision===ref.revision&&(ref.sha256===undefined||state.sha256===ref.sha256);
  }
  const marker=value=>({kind:'unavailable-memory-projection',libraryId:value.libraryId,id:value.id,revision:value.revision,reason:'forgotten, superseded or unavailable; original history retained'});
  async function transform(value){
    if(!value||typeof value!=='object')return value;
    if(value.kind==='memory-entry'){
      if(typeof value.text!=='string'||sha256(value.text)!==value.sha256||!await active(value))return marker(value);
      return value;
    }
    if(value.kind==='derived-working-note'){
      if(!Array.isArray(value.memoryRefs))throw new Error('Invalid note Memory dependencies');
      for(const ref of value.memoryRefs)if(!await active(ref))return{kind:'unavailable-derived-note',resultRef:value.resultRef,sourceRefs:value.sourceRefs||[],memoryRefs:value.memoryRefs,reason:'Memory dependency forgotten or superseded'};
    }
    if(Array.isArray(value))return Promise.all(value.map(transform));
    for(const key of Object.keys(value))value[key]=await transform(value[key]);return value;
  }
  // Redact typed write arguments using the paired, actually acknowledged receipt.
  for(let i=0;i<projected.length;i++){
    const message=projected[i];if(message.role!=='assistant'||!Array.isArray(message.calls))continue;
    for(let n=0;n<message.calls.length;n++){
      const call=message.calls[n];const paired=projected[i+n+1];
      if(!paired||paired.role!=='tool'||paired.callId!==call.id||paired.result?.callId!==call.id)throw new Error('Invalid settled Memory call pair');
      const receipt=paired.result.value;
      if(paired.result.status==='succeeded'&&receipt?.kind==='memory-write-receipt'&&['saved','revised'].includes(receipt.operation)&&!await active(receipt)){
        for(const identity of [call,paired.result.original,paired.result.effective]){if(!identity)continue;if(identity.id!==call.id)throw new Error('Invalid Memory write observation identity');if(identity.arguments&&typeof identity.arguments==='object'&&Object.hasOwn(identity.arguments,'text'))identity.arguments.text='[projected redaction: forgotten or superseded Memory text]';}paired.result.memoryTextProjected=true;
      }
    }
  }
  // Assistant call arguments are handled only through acknowledged pairs above;
  // recursively filter typed tool payloads and derived projection messages.
  for(const message of projected)if(message.role==='tool')message.result=await transform(message.result);
  return projected;
}
