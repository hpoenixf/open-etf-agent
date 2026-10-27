import { validateSource } from './source.mjs';
const fail = message => { throw new Error(message); };
export async function projectContext({ messages, maxBytes, lookupSource } = {}) {
  if (!Array.isArray(messages) || !messages.length || messages[0].role!=='user' || !Number.isSafeInteger(maxBytes) || maxBytes<1 || maxBytes>1048576 || typeof lookupSource!=='function') fail('Invalid context budget/configuration');
  const projected=structuredClone(messages); const groups=[]; const used=new Set();
  for (let i=0;i<projected.length;i++) {
    const message=projected[i];
    if (message.role==='tool') fail('Unpaired tool group');
    if (message.role==='assistant' && message.calls) {
      if (!Array.isArray(message.calls) || !message.calls.length) fail('Invalid call group');
      const indices=[];
      for (const call of message.calls) {
        if (!call || typeof call.id!=='string' || used.has(call.id)) fail('Duplicate call pair'); used.add(call.id);
        const index=++i; const result=projected[index];
        if (!result || result.role!=='tool' || result.callId!==call.id || result.result?.callId!==call.id || typeof result.result.status!=='string') fail('Incomplete or invalid settled call pair group');
        indices.push(index);
      }
      groups.push(indices);
    } else if (!['user','assistant','system'].includes(message.role) || typeof message.content!=='string') fail('Invalid context message');
  }
  const size=()=>Buffer.byteLength(JSON.stringify(projected)); if(size()<=maxBytes) return projected;
  async function replace(value) {
    if (!value || typeof value!=='object') return value;
    if (typeof value.sourceId==='string' && typeof value.text==='string' && typeof value.resultRef==='string' && /^result:sha256:[a-f0-9]{64}$/.test(value.resultRef)) {
      const source = validateSource(value);
      const ref=await lookupSource(value.sourceId); if(!ref) return value;
      if(ref.resultRef!==value.resultRef || ['sourceId','documentId','name','version','page','sha256','mediaType'].some(key => source[key]!==ref[key])) fail('Context source identity mismatch');
      return { ...ref,kind:'stored-source-ref', ...(value.mcp ? { acquisition: structuredClone(value.mcp) } : {}),readWith:{name:'read_result',arguments:{resultRef:ref.resultRef}} };
    }
    if(Array.isArray(value.sources)) return {...value,sources:await Promise.all(value.sources.map(replace))};
    return value;
  }
  for(const group of groups.slice(0,-1)) {
    for(const index of group) if(projected[index].result.status==='succeeded') projected[index].result.value=await replace(projected[index].result.value);
    if(size()<=maxBytes) return projected;
  }
  fail('Context byte budget cannot retain mandatory original question/latest complete group');
}
