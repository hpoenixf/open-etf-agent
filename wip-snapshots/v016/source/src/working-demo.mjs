import {randomUUID} from 'node:crypto';
import {run} from './runtime.mjs';
import {openMemoryLibrary} from './memory.mjs';
import {createMemoryBindings} from './memory-tools.mjs';
import {createRootBudget} from './cooperation.mjs';
import {sha256} from './source.mjs';
const final=text=>({kind:'final',text});
const call=(id,name,args={})=>({kind:'calls',calls:[{id,name,arguments:args}]});
export async function runMemoryDemo({libraryDirectory,outputRoot,signal}){
  const library=await openMemoryLibrary({directory:libraryDirectory,writable:true});const receipts=[];const runs=[];const nonce=randomUUID();let entryId;
  const first='SYNTHETIC preference: cite both acquired guide versions.';const revised='SYNTHETIC preference: include exact physical page identities.';
  const intent=(operation,text,extra={})=>({explicit:true,libraryId:library.libraryId,operation,intentId:'demo-'+nonce+'-'+operation,origin:'synthetic-demo-intent',...(text===undefined?{}:{approvedTextHash:sha256(text)}),...extra});
  try{
    if((await library.list()).length)throw new Error('Synthetic Memory demo requires a library with no active entries; existing entries were not changed');
    for(const phase of ['save','revise','forget']){
      const grant=phase==='save'?intent('save',first):phase==='revise'?intent('revise',revised,{entryId,expectedRevision:1}):intent('forget',undefined,{entryId,expectedRevision:2});let step=0;const sources=[];
      const gateway={mode:'fixture',async next({messages}){
        if(step===1){const receipt=messages.at(-1).result.value;receipts.push(receipt);entryId=receipt.id;}
        if(phase!=='forget'){
          if(step===0){step++;return call(phase+'-write','memory_'+phase,phase==='save'?{text:first}:{id:entryId,expectedRevision:1,text:revised});}
          if(step===1){step++;return call(phase+'-recall','memory_read',{id:entryId});}
          if(messages.at(-1).result.value.text!==(phase==='save'?first:revised))throw new Error('Synthetic current Memory recall mismatch');return final('Synthetic '+phase+' receipt and current recall observed; no live adoption claim.');
        }
        if(step===0){step++;return call('forget-write','memory_forget',{id:entryId,expectedRevision:2});}
        if(step===1){step++;return call('after-forget-list','memory_list');}
        if(step===2){if(messages.at(-1).result.value.entries.length)throw new Error('Forgotten entry remains visible');step++;return call('source-a','read_page',{documentId:'atlas-a',page:1});}
        if(step===3||step===4){sources.push(messages.at(-1).result.value.sourceId);if(step++===3)return call('source-b','read_page',{documentId:'atlas-b',page:1});return call('save-report','save_report',{text:'# Explicit synthetic Memory demonstration\n\nSave, revise and forget produced separate receipts. Current recall excludes the forgotten entry; historical revision records are retained. These operations do not prove live model adoption.\n\nOriginal guide comparison: free-edition CSV limits are 120 and 300 rows; both require an online connection [1] [2].',sourceIds:sources});}
        return final('Synthetic Memory lifecycle and an original-source report completed.');
      }};
      const result=await run({question:'Explicit synthetic '+phase+' demonstration in the operator-selected library; entries are not original research sources.',gateway,extensions:createMemoryBindings({library,intents:[grant]}),workingInput:{memoryLibrary:library},outputRoot,signal,requireReport:phase==='forget'});runs.push(result);if(result.status!=='completed')break;
    }
    return{caseId:'explicit-memory',runs,memory:{libraryId:library.libraryId,entryId,receipts,current:await library.list()},semanticStatus:'unreviewed',intentOrigin:'synthetic-demo-intent'};
  }finally{await library.close();}
}
export function prepareCompactionDemo(){
  let step=0;const sources=new Map();let noteRef;
  const gateway={mode:'fixture',async next({messages}){
    if(step>0&&step<=6){const source=messages.at(-1).result.value;sources.set(source.documentId,{sourceId:source.sourceId,resultRef:source.resultRef});}
    if(step<6){const current=step++;return call('repeat-read-'+current,'read_page',{documentId:current%2?'atlas-b':'atlas-a',page:1});}
    if(step===6){const note=messages.find(message=>message.role==='tool'&&message.result?.value?.kind==='derived-working-note');if(!note)throw new Error('No derived note was actually adopted');noteRef=note.result.value.resultRef;step++;return call('read-derived-note','read_note',{resultRef:noteRef});}
    if(step===7){if(messages.at(-1).result.value.resultRef!==noteRef)throw new Error('Derived note readback mismatch');step++;return call('reread-original','read_result',{resultRef:sources.get('atlas-a').resultRef});}
    if(step===8){if(messages.at(-1).result.value.sourceId!==sources.get('atlas-a').sourceId)throw new Error('Original readback mismatch');step++;return call('save-comparison','save_report',{text:'# Synthetic comparison after derived compaction\n\nThe free editions permit CSV exports of 120 rows and 300 rows respectively, with an online connection required for both [1] [2]. The current/baseline denominator is the original 120-row limit; this case makes no numeric tool derivation claim.\n\nA derived working note was persisted and read back; original page bytes were independently reread. Notes are not original sources or live semantic-quality evidence.',sourceIds:[sources.get('atlas-a').sourceId,sources.get('atlas-b').sourceId]});}
    return final('Original-source report saved after derived note and original-page rereads.');
  }};
  return{gateway,rootBudget:createRootBudget({model:32,tool:16}),workingInput:{compaction:{thresholdBytes:1500,summarize:async()=> 'Derived synthetic working note: compare the acquired free-edition CSV limits using the original page refs; online conditions apply to both. Reread originals for exact claims.'}}};
}
