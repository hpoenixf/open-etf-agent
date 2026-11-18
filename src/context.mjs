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
export async function projectContext({ messages, maxBytes, lookupSource, additionalBudget, projectOwnedResult, projectOwnedCall, olderReadBytes, onFit } = {}) {
  if (!Array.isArray(messages) || !messages.length || messages[0].role!=='user' || !Number.isSafeInteger(maxBytes) || maxBytes<1 || maxBytes>1048576 || typeof lookupSource!=='function') fail('Invalid context budget/configuration');
  if(additionalBudget!==undefined&&(!Number.isSafeInteger(additionalBudget?.maxBytes)||additionalBudget.maxBytes<1||typeof additionalBudget.measure!=='function'))fail('Invalid encoded context budget');
  if(olderReadBytes!==undefined&&(!Number.isSafeInteger(olderReadBytes)||olderReadBytes<1||olderReadBytes>1048576))fail('Invalid context working-set target');
  if(onFit!==undefined&&typeof onFit!=='function')fail('Invalid context observation');
  const projected=projectControlProofs(messages);
  const beforeBytes=Buffer.byteLength(JSON.stringify(projected));let softProjectedResults=0;
  const finish=()=>{const fact={schemaVersion:'context-fit@1',beforeBytes,afterBytes:Buffer.byteLength(JSON.stringify(projected)),softProjectedResults};try{const pending=onFit?.(Object.freeze(fact));if(pending&&typeof pending.then==='function')Promise.resolve(pending).catch(()=>{});}catch{}return projected;};
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
  const fits=()=>{if(Buffer.byteLength(JSON.stringify(projected))>maxBytes)return false;if(!additionalBudget)return true;const size=additionalBudget.measure(structuredClone(projected));if(!Number.isSafeInteger(size)||size<0)fail('Invalid encoded context measurement');return size<=additionalBudget.maxBytes;};

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
  // Advisory residency only: never remove a message or touch the newest two groups.
  // Failed/unbound/opaque results do not drive unrelated valid reads out.
  if(olderReadBytes!==undefined){
    const candidates=[];
    for(const group of groups.slice(0,-2))for(const index of group){
      const original=messages[index],call=messages.flatMap(m=>m.calls??[]).find(c=>c.id===original.callId);
      if(call?.name!=='read_result'||original.result.status!=='succeeded')continue;
      const owned=projectOwnedResult?await projectOwnedResult(structuredClone(call),structuredClone(original.result)):null;
      if(!owned&&call.arguments?.resultRef!==original.result.value?.resultRef)continue;
      const value=await replace(owned??structuredClone(original.result.value));
      const before=Buffer.byteLength(JSON.stringify(original.result.value)),after=Buffer.byteLength(JSON.stringify(value));
      if(after<before)candidates.push({index,value,before,after});
    }
    let retained=candidates.reduce((n,c)=>n+c.before,0);
    for(const c of candidates){
      if(retained<=olderReadBytes)break;
      const original=projected[c.index].result.value;
      const before=additionalBudget?.measure(structuredClone(projected));
      projected[c.index].result.value=c.value;
      const after=additionalBudget?.measure(structuredClone(projected));
      if(additionalBudget&&(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(after)||after<0))fail('Invalid encoded context measurement');
      if(additionalBudget&&after>before){projected[c.index].result.value=original;continue;}
      retained-=c.before-c.after;softProjectedResults++;
    }
  }
  if(fits())return finish();
  for(const group of projectOwnedResult?groups:groups.slice(0,-1)) {
    for(const index of group) if(projected[index].result.status==='succeeded'){
      const original=messages[index],call=messages.flatMap(m=>m.calls??[]).find(c=>c.id===original.callId);
      // A requested latest page must actually reach the model. Do not return a
      // same-selection reference that invites an endless reread cycle.
      if(group===groups.at(-1)&&call?.name==='read_result')continue;
      const owned=projectOwnedResult?await projectOwnedResult(structuredClone(call),structuredClone(original.result)):null;
      projected[index].result.value=await replace(owned??projected[index].result.value);
    }
    if(fits())return finish();
  }
  if(projectOwnedCall)for(const group of groups){
    for(const index of group){
      const original=messages[index],call=messages.flatMap(m=>m.calls??[]).find(c=>c.id===original.callId);
      const owned=await projectOwnedCall(structuredClone(call),structuredClone(original.result));
      if(owned){const assistant=projected.find(m=>m.calls?.some(c=>c.id===call.id));assistant.calls=assistant.calls.map(c=>c.id===call.id?owned:c);}
    }
    if(fits())return finish();
  }
  throw Object.assign(new Error('Context byte budget cannot retain mandatory original question/tool identities; narrow the requested page selection or use a larger authorized context budget'),{code:'CONTEXT_CAPACITY_EXCEEDED'});
}

// Recheck the final selected envelope before reservation, including recovered inputs.
export function assertContextCapacity({messages,tools,maxBytes,inputBudget}={}){
 if(maxBytes!==undefined&&(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576))throw new Error('Invalid context byte limit');
 if(inputBudget!==undefined&&(!Number.isSafeInteger(inputBudget?.maxBytes)||inputBudget.maxBytes<1||typeof inputBudget.measure!=='function'))throw new Error('Invalid encoded context budget');
 const raw=Buffer.byteLength(JSON.stringify(messages));
 const encoded=inputBudget?.measure({messages:structuredClone(messages),tools:structuredClone(tools)});
 if(inputBudget&&(!Number.isSafeInteger(encoded)||encoded<0))throw new Error('Invalid encoded context measurement');
 if((maxBytes!==undefined&&raw>maxBytes)||(inputBudget&&encoded>inputBudget.maxBytes))throw Object.assign(new Error('Final context exceeds the selected byte envelope before model reservation'),{code:'CONTEXT_CAPACITY_EXCEEDED'});
 return {rawBytes:raw,encodedBytes:encoded??null};
}
