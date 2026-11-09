import { validateSource } from './source.mjs';
const fail = message => { throw new Error(message); };
const citationAdvice = 'The report text contains a numbered citation without an acquired source or registered calculation. Every literal numbered marker is checked, including examples and statements that a citation was not used. Remove or correct unsupported markers in text. Keep already-valid sourceIds unchanged: documentId is not sourceId; do not remove its version/page suffix or replace it with a resultRef. This explanation does not grant another attempt or change the Host correction limit.';
export function projectControlProofs(messages){
 const projected=structuredClone(messages);
 for(const m of projected)if(m.role==='tool'&&['builtin-report-reference-validation@1','specialist-group-refusal@1'].includes(m.result?.validation?.schemaVersion)){
  const v=m.result.validation;
  // Model-facing explanation only. The persisted proof and its private basis
  // remain unchanged; only the original Host/Runtime decides correction scope.
  if(v.schemaVersion==='builtin-report-reference-validation@1'&&v.code==='REPORT_CITATION_OUT_OF_RANGE'&&v.repairable===true&&m.result.error===v.code&&m.callId===m.result.callId&&m.result.status==='rejected'&&m.result.dispatched===false)m.result.repairAdvice=citationAdvice;
  m.result.validation={schemaVersion:v.schemaVersion,code:v.code,repairable:v.repairable,requestHash:v.requestHash};
 }
 return projected;
}
export async function projectContext({ messages, maxBytes, lookupSource, additionalBudget, projectOwnedResult } = {}) {
  if (!Array.isArray(messages) || !messages.length || messages[0].role!=='user' || !Number.isSafeInteger(maxBytes) || maxBytes<1 || maxBytes>1048576 || typeof lookupSource!=='function') fail('Invalid context budget/configuration');
  if(additionalBudget!==undefined&&(!Number.isSafeInteger(additionalBudget?.maxBytes)||additionalBudget.maxBytes<1||typeof additionalBudget.measure!=='function'))fail('Invalid encoded context budget');
  const projected=projectControlProofs(messages);
  const groups=[]; const used=new Set();
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
  const fits=()=>{if(Buffer.byteLength(JSON.stringify(projected))>maxBytes)return false;if(!additionalBudget)return true;const size=additionalBudget.measure(projected);if(!Number.isSafeInteger(size)||size<0)fail('Invalid encoded context measurement');return size<=additionalBudget.maxBytes;};
  if(fits()) return projected;
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
  for(const group of projectOwnedResult?groups:groups.slice(0,-1)) {
    for(const index of group) if(projected[index].result.status==='succeeded'){
      const original=messages[index],call=messages.flatMap(m=>m.calls??[]).find(c=>c.id===original.callId);
      // A requested latest page must actually reach the model. Do not return a
      // same-selection reference that invites an endless reread cycle.
      if(group===groups.at(-1)&&call?.name==='read_result')continue;
      const owned=projectOwnedResult?await projectOwnedResult(call,original.result):null;
      projected[index].result.value=await replace(owned??projected[index].result.value);
    }
    if(fits()) return projected;
  }
  throw Object.assign(new Error('Context byte budget cannot retain mandatory original question/tool identities; narrow the requested page selection or use a larger authorized context budget'),{code:'CONTEXT_CAPACITY_EXCEEDED'});
}
