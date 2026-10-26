import {projectMemory} from './memory-projection.mjs';
import {projectContext} from './context.mjs';
import {validateSource,sha256} from './source.mjs';
const bytes=value=>Buffer.byteLength(JSON.stringify(value));
async function boundedSummary(summarize,input,parentSignal,timeoutMs){
  const controller=new AbortController();let timer;const abort=()=>controller.abort(parentSignal.reason);if(parentSignal?.aborted)abort();else parentSignal?.addEventListener('abort',abort,{once:true});
  const timeout=Object.assign(new Error('Summary timed out'),{code:'SUMMARY_TIMEOUT'});let stop;
  try{controller.signal.throwIfAborted();timer=setTimeout(()=>controller.abort(timeout),timeoutMs);const cancelled=new Promise((_,reject)=>{stop=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',stop,{once:true});});return await Promise.race([Promise.resolve().then(()=>summarize({...input,signal:controller.signal})),cancelled]);}
  finally{clearTimeout(timer);parentSignal?.removeEventListener('abort',abort);if(stop)controller.signal.removeEventListener('abort',stop);}
}
const identityKeys=['sourceId','documentId','name','version','page','sha256','mediaType'];
export async function compactWorkingView({messages,maxBytes,lookupSource,rootBudget,summarize,saveNote,signal,lookupMemoryState,summaryTimeoutMs=2000}={}){
  if(!Number.isSafeInteger(summaryTimeoutMs)||summaryTimeoutMs<1||summaryTimeoutMs>30000)throw new Error('Invalid summary timeout');
  if(typeof summarize!=='function'||typeof saveNote!=='function'||typeof rootBudget?.claim!=='function')throw new Error('Invalid compaction configuration');
  const basis=sha256(JSON.stringify(messages));
  // This baseline is exactly the v0.4 policy, not hypothetical removed bytes.
  const baseline=await projectContext({messages,maxBytes,lookupSource});
  const fallback=async(status,extra={})=>({messages:await projectContext({messages:lookupMemoryState?await projectMemory({messages,lookupState:lookupMemoryState}):messages,maxBytes,lookupSource}),observation:{status,...extra},noteRef:null});
  if(signal?.aborted)return fallback('cancelled');
  const groups=[];
  for(let i=0;i<baseline.length;i++)if(baseline[i].role==='assistant'&&Array.isArray(baseline[i].calls)){const start=i;const count=baseline[i].calls.length;groups.push({start,end:i+count,values:baseline.slice(i+1,i+count+1)});i+=count;}
  const eligible=groups.slice(0,-1).filter(group=>group.values.every(message=>message.result.status==='succeeded'));
  if(!eligible.length)return fallback('no-eligible-group');
  const sourceRefs=new Map();const memoryRefs=new Map();const callIds=[];
  async function collect(value){
    if(!value||typeof value!=='object')return;
    if(value.kind==='memory-entry')memoryRefs.set(JSON.stringify([value.libraryId,value.id,value.revision]),{libraryId:value.libraryId,id:value.id,revision:value.revision,sha256:value.sha256});
    if(value.kind==='derived-working-note'){for(const ref of value.memoryRefs||[])memoryRefs.set(JSON.stringify([ref.libraryId,ref.id,ref.revision]),structuredClone(ref));for(const ref of value.sourceRefs||[])await collect({...ref,kind:'stored-source-ref'});return;}
    if(typeof value.sourceId==='string'&&typeof value.resultRef==='string'){
      const ref=await lookupSource(value.sourceId);
      if(!ref||ref.resultRef!==value.resultRef||identityKeys.some(key=>ref[key]!==value[key]))throw new Error('Compaction source identity mismatch');
      if(value.text!==undefined)validateSource(value);
      else if(value.kind!=='stored-source-ref')throw new Error('Invalid compaction source representation');
      sourceRefs.set(ref.resultRef,structuredClone(ref));
    }
    for(const item of Object.values(value))if(item&&typeof item==='object')if(Array.isArray(item)){for(const child of item)await collect(child);}else await collect(item);
  }
  for(const group of eligible){for(const call of baseline[group.start].calls)callIds.push(call.id);for(const message of group.values)await collect(message.result.value);}
  async function memoriesCurrent(){if(!memoryRefs.size)return true;if(typeof lookupMemoryState!=='function')throw new Error('Explicit Memory state unavailable for compaction');for(const ref of memoryRefs.values()){const state=await lookupMemoryState(ref);if(!state||state.libraryId!==ref.libraryId||state.id!==ref.id||state.active!==true||state.revision!==ref.revision||(ref.sha256!==undefined&&state.sha256!==ref.sha256))return false;}return true;}
  if(!await memoriesCurrent())return fallback('memory-stale');
  if(!sourceRefs.size&&!memoryRefs.size)return fallback('no-backed-material');
  try{rootBudget.claim('model');}catch{return fallback('budget-exhausted');}
  let text;
  try{text=await boundedSummary(summarize,{groups:structuredClone(eligible.map(group=>baseline.slice(group.start,group.end+1)))},signal,summaryTimeoutMs);}catch(error){return fallback(signal?.aborted?'cancelled':error?.code==='SUMMARY_TIMEOUT'?'summary-timeout':'summary-failed');}
  if(signal?.aborted)return fallback('cancelled');if(sha256(JSON.stringify(messages))!==basis)return fallback('stale');
  if(!await memoriesCurrent())return fallback('memory-stale');
  if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>4096)return fallback('invalid-summary');
  const note={kind:'derived-working-note',text,sourceRefs:[...sourceRefs.values()],memoryRefs:[...memoryRefs.values()],callIds,basisHash:basis,origin:'derived-summary',semanticStatus:'unreviewed'};
  const projectedId='projection-'+basis.slice(0,24);const provisional='note:sha256:'+'0'.repeat(64);
  function view(resultRef){const out=[];const replaced=new Map(eligible.map(group=>[group.start,group]));let inserted=false;for(let i=0;i<baseline.length;i++){const group=replaced.get(i);if(!group){out.push(structuredClone(baseline[i]));continue;}if(!inserted){out.push({role:'assistant',projectionOnly:true,calls:[{id:projectedId,name:'read_note',arguments:{resultRef}}]},{role:'tool',projectionOnly:true,callId:projectedId,result:{callId:projectedId,status:'projected',dispatched:false,value:{...note,resultRef}}});inserted=true;}i=group.end;}return out;}
  const candidate=view(provisional);if(bytes(candidate)>=bytes(baseline)||bytes(candidate)>maxBytes)return fallback('no-net-saving');
  let receipt;try{receipt=await saveNote(structuredClone(note),{signal});}catch{return fallback(signal?.aborted?'cancelled':'persistence-failed');}
  if(signal?.aborted)return fallback('cancelled',{persistedNoteRef:receipt?.resultRef});if(sha256(JSON.stringify(messages))!==basis)return fallback('stale',{persistedNoteRef:receipt?.resultRef});
  if(!await memoriesCurrent())return fallback('memory-stale',{persistedNoteRef:receipt?.resultRef});
  if(!/^note:sha256:[a-f0-9]{64}$/.test(receipt?.resultRef))return fallback('invalid-note-receipt');
  const result=view(receipt.resultRef);return{messages:result,observation:{status:'applied',beforeBytes:bytes(baseline),afterBytes:bytes(result)},noteRef:receipt.resultRef};
}
