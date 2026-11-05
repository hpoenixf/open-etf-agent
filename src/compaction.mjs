import {validateNote,noteRef as contentNoteRef} from './working-note.mjs';
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
export async function compactWorkingView({messages,maxBytes,lookupSource,rootBudget,summarize,saveNote,signal,lookupMemoryState,canCompactHistory,summaryTimeoutMs=2000,reserveSummary,frontier,readNote,allowSummary=true,summaryInputFits}={}){
  if(!Number.isSafeInteger(summaryTimeoutMs)||summaryTimeoutMs<1||summaryTimeoutMs>120000)throw new Error('Invalid summary timeout');
  if(typeof summarize!=='function'||typeof saveNote!=='function'||typeof rootBudget?.claim!=='function')throw new Error('Invalid compaction configuration');
  if(typeof allowSummary!=='boolean')throw new Error('Invalid summary allowance');
  const basis=sha256(JSON.stringify(messages));
  // This baseline is exactly the v0.4 policy, not hypothetical removed bytes.
  const baseline=await projectContext({messages,maxBytes,lookupSource});
  let retainedFrontier=null;
  const fallback=async(status,extra={})=>({messages:await projectContext({messages:lookupMemoryState?await projectMemory({messages,lookupState:lookupMemoryState}):messages,maxBytes,lookupSource}),observation:{status,...extra},noteRef:null,frontier:retainedFrontier?structuredClone(retainedFrontier):null});
  if(signal?.aborted)return fallback('cancelled');
  const groups=[];
  for(let i=0;i<baseline.length;i++)if(baseline[i].role==='assistant'&&Array.isArray(baseline[i].calls)){const start=i;const count=baseline[i].calls.length;groups.push({start,end:i+count,values:baseline.slice(i+1,i+count+1)});i+=count;}
  const eligible=[];
  // Unknown or effectful groups remain exact. Eligibility is trusted Host policy,
  // never inferred from a successful value or a model-provided marker.
  if(typeof canCompactHistory==='function')for(const group of groups.slice(0,-1)){
    let allowed=group.values.every(message=>message.result.status==='succeeded');
    if(allowed)for(let offset=0;offset<baseline[group.start].calls.length;offset++){
      const call=messages[group.start].calls[offset],result=messages[group.start+offset+1].result;
      if(await canCompactHistory(structuredClone(call),structuredClone(result))!==true){allowed=false;break;}
    }
    if(allowed)eligible.push(group);
  }
  if(!eligible.length)return fallback('no-eligible-group');
  const sourceRefs=new Map();const memoryRefs=new Map();const callIds=[];
  async function collect(value,sources=sourceRefs,memories=memoryRefs){
    if(!value||typeof value!=='object')return;
    if(value.kind==='memory-entry')memories.set(JSON.stringify([value.libraryId,value.id,value.revision]),{libraryId:value.libraryId,id:value.id,revision:value.revision,sha256:value.sha256});
    if(value.kind==='derived-working-note'){for(const ref of value.memoryRefs||[])memories.set(JSON.stringify([ref.libraryId,ref.id,ref.revision]),structuredClone(ref));for(const ref of value.sourceRefs||[])await collect({...ref,kind:'stored-source-ref'},sources,memories);return;}
    if(typeof value.sourceId==='string'&&typeof value.resultRef==='string'){
      const ref=await lookupSource(value.sourceId);
      if(!ref||ref.resultRef!==value.resultRef||identityKeys.some(key=>ref[key]!==value[key]))throw new Error('Compaction source identity mismatch');
      if(value.text!==undefined)validateSource(value);
      else if(value.kind!=='stored-source-ref')throw new Error('Invalid compaction source representation');
      sources.set(ref.resultRef,structuredClone(ref));
    }
    for(const item of Object.values(value))if(item&&typeof item==='object')if(Array.isArray(item)){for(const child of item)await collect(child,sources,memories);}else await collect(item,sources,memories);
  }
  try{for(const group of eligible){for(const call of baseline[group.start].calls)callIds.push(call.id);for(const message of group.values)await collect(message.result.value);}}catch(error){if(frontier)return fallback('source-stale');throw error;}
  async function memoriesCurrent(){if(!memoryRefs.size)return true;if(typeof lookupMemoryState!=='function')throw new Error('Explicit Memory state unavailable for compaction');for(const ref of memoryRefs.values()){const state=await lookupMemoryState(ref);if(!state||state.libraryId!==ref.libraryId||state.id!==ref.id||state.active!==true||state.revision!==ref.revision||(ref.sha256!==undefined&&state.sha256!==ref.sha256))return false;}return true;}
  if(!await memoriesCurrent())return fallback('memory-stale');
  if(!sourceRefs.size&&!memoryRefs.size)return fallback('no-backed-material');
  const noteFor=text=>({kind:'derived-working-note',text,sourceRefs:[...sourceRefs.values()],memoryRefs:[...memoryRefs.values()],callIds,basisHash:basis,origin:'derived-summary',semanticStatus:'unreviewed'});
  const provisional='note:sha256:'+'0'.repeat(64);
  function view(note,resultRef,selected=eligible){const projectedId='projection-'+note.basisHash.slice(0,24);const out=[];const replaced=new Map(selected.map(group=>[group.start,group]));let inserted=false;for(let i=0;i<baseline.length;i++){const group=replaced.get(i);if(!group){out.push(structuredClone(baseline[i]));continue;}if(!inserted){out.push({role:'assistant',projectionOnly:true,calls:[{id:projectedId,name:'read_note',arguments:{resultRef}}]},{role:'tool',projectionOnly:true,callId:projectedId,result:{callId:projectedId,status:'projected',dispatched:false,value:{...note,resultRef}}});inserted=true;}i=group.end;}return out;}
  // A frontier is a reference to a verified immutable note, never a second
  // history. Rebuild its projection from the original covered call groups.
  let reused;
  if(frontier!==undefined&&frontier!==null){
    if(!frontier||Object.keys(frontier).sort().join(',')!=='basisHash,messageCount,noteRef,schemaVersion'||frontier.schemaVersion!=='compaction-frontier@1'||!Number.isSafeInteger(frontier.messageCount)||frontier.messageCount<1||frontier.messageCount>messages.length||typeof readNote!=='function')throw new Error('Invalid compaction frontier');
    const note=validateNote(await readNote(frontier.noteRef));
    if(contentNoteRef(note)!==frontier.noteRef||note.basisHash!==frontier.basisHash)throw new Error('Compaction frontier note identity mismatch');
    if(sha256(JSON.stringify(messages.slice(0,frontier.messageCount)))!==frontier.basisHash)return fallback('frontier-stale');
    const ids=new Set(note.callIds),covered=eligible.filter(group=>baseline[group.start].calls.some(call=>ids.has(call.id)));
    if(covered.some(group=>group.end>=frontier.messageCount||baseline[group.start].calls.some(call=>!ids.has(call.id)))||covered.flatMap(group=>baseline[group.start].calls).length!==ids.size)return fallback('frontier-ineligible');
    const oldSources=new Map(),oldMemories=new Map();for(const group of covered)for(const message of group.values)await collect(message.result.value,oldSources,oldMemories);
    if(note.sourceRefs.length!==oldSources.size||note.sourceRefs.some(ref=>{const old=oldSources.get(ref.resultRef);return !old||identityKeys.some(key=>old[key]!==ref[key]);})||note.memoryRefs.length!==oldMemories.size||note.memoryRefs.some(ref=>{const old=oldMemories.get(JSON.stringify([ref.libraryId,ref.id,ref.revision]));return !old||old.sha256!==ref.sha256;}))throw new Error('Compaction frontier dependencies mismatch');
    for(const ref of note.memoryRefs){const current=await lookupMemoryState?.(ref);if(!current||!current.active||current.libraryId!==ref.libraryId||current.id!==ref.id||current.revision!==ref.revision||ref.sha256!==undefined&&current.sha256!==ref.sha256)return fallback('memory-stale');}
    retainedFrontier=structuredClone(frontier);
    const projection=view(note,frontier.noteRef,covered);
    if(bytes(projection)<=maxBytes)reused={messages:projection,observation:{status:'reused',beforeBytes:bytes(baseline),afterBytes:bytes(projection)},noteRef:frontier.noteRef,frontier:structuredClone(frontier)};
    const novel=[...sourceRefs.keys()].some(key=>!oldSources.has(key))||[...memoryRefs.keys()].some(key=>!oldMemories.has(key));
    if(!novel)return reused??fallback('frontier-no-new-evidence');
  }
  if(!allowSummary)return reused??fallback('summary-budget-exhausted');
  // Every valid nonblank summary encodes at least one UTF-8 byte. Use the exact
  // candidate envelope, not an estimated saving that ignores its provenance.
  // Passing this bound is not approval: the actual summary is checked below.
  const minimum=view(noteFor('x'),provisional);
  if(bytes(minimum)>=bytes(baseline)||bytes(minimum)>maxBytes)return fallback('no-net-saving');
  const summaryInput={groups:structuredClone(eligible.map(group=>baseline.slice(group.start,group.end+1)))};let reservation;
  if(summaryInputFits!==undefined){if(typeof summaryInputFits!=='function')throw new Error('Invalid summary input measurement');if(!summaryInputFits(summaryInput))return fallback('summary-input-capacity');}
  try{if(reserveSummary!==undefined){if(typeof reserveSummary!=='function')throw new Error('Invalid summary reservation');reservation=await reserveSummary(summaryInput);}else rootBudget.claim('model');}catch(error){if(error?.code!=='ROOT_BUDGET_EXHAUSTED'&&reserveSummary!==undefined)throw error;return fallback('budget-exhausted');}
  let text;
  try{text=await boundedSummary(summarize,{...summaryInput,...(reserveSummary?{reservation}:{})},signal,summaryTimeoutMs);}catch(error){return fallback(signal?.aborted?'cancelled':error?.code==='SUMMARY_TIMEOUT'?'summary-timeout':'summary-failed');}
  if(signal?.aborted)return fallback('cancelled');if(sha256(JSON.stringify(messages))!==basis)return fallback('stale');
  if(!await memoriesCurrent())return fallback('memory-stale');
  if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>4096)return fallback('invalid-summary');
  const note=noteFor(text);
  const candidate=view(note,provisional);if(bytes(candidate)>=bytes(baseline)||bytes(candidate)>maxBytes)return fallback('no-net-saving');
  let receipt;try{receipt=await saveNote(structuredClone(note),{signal});}catch{return fallback(signal?.aborted?'cancelled':'persistence-failed');}
  if(signal?.aborted)return fallback('cancelled',{persistedNoteRef:receipt?.resultRef});if(sha256(JSON.stringify(messages))!==basis)return fallback('stale',{persistedNoteRef:receipt?.resultRef});
  if(!await memoriesCurrent())return fallback('memory-stale',{persistedNoteRef:receipt?.resultRef});
  if(!/^note:sha256:[a-f0-9]{64}$/.test(receipt?.resultRef))return fallback('invalid-note-receipt');
  const result=view(note,receipt.resultRef);return{messages:result,observation:{status:'applied',beforeBytes:bytes(baseline),afterBytes:bytes(result)},noteRef:receipt.resultRef,frontier:{schemaVersion:'compaction-frontier@1',noteRef:receipt.resultRef,messageCount:messages.length,basisHash:basis}};
}
