import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run, submitRun } from './runtime.mjs';
import { workRun } from './worker.mjs';
import { openSession } from './session.mjs';
import { openDurableMemory } from './durable-memory.mjs';
import { createDurableChildBinding } from './durable-child.mjs';
import { createExamplePlugins } from './example-plugins.mjs';
import { sha256 } from './source.mjs';
import { PUBLICATION_BINDING } from './publication.mjs';

export const durableCases=['durable-report','durable-publication','durable-child','durable-compaction','durable-memory','trusted-plugins'];
const call=(id,name,args={})=>({kind:'calls',calls:[{id,name,arguments:args}]});
function facts(messages){
  const values=messages.filter(m=>m.role==='tool').map(m=>m.result?.value);const ids=new Set(messages.flatMap(m=>m.calls?.map(c=>c.id)||[]));const sources=new Map();let note;
  for(const value of values){if(!value)continue;for(const id of value.callIds||[])ids.add(id);for(const source of [...(value.sources||[]),...(value.sourceRefs||[]),...(value.sourceId?[value]:[])])sources.set(source.sourceId,source);if(value.kind==='derived-working-note')note=value;}
  return{ids,sources,note};
}
// This is a stateless synthetic Gateway fixture, not a second Runtime or a live-model substitute.
export function runDurableDemo(options){return durableDemo(options,'run');}
export function submitDurableDemo(options){return durableDemo(options,'submit');}
export function workDurableDemo(options){return durableDemo(options,'work');}
async function durableDemo({directory,caseId='durable-report',runId,signal,hostSignal,onCheckpoint}={},operation){
  if(!durableCases.includes(caseId))throw new Error('Unknown durable fixture case');
  if(operation!=='run'&&(caseId!=='durable-publication'||typeof runId!=='string'))throw Object.assign(new Error('WORKER_PROFILE_REQUIRED'),{code:'WORKER_PROFILE_REQUIRED'});
  const store=await openSession({directory});let token;let plugins;let workingInput;let extensions=[];
  const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:caseId,version:'1'},plugins:[],adapters:[{id:'durable-demo',version:'1',contentSha256:sha256(await readFile(new URL(import.meta.url)))}]};
  try{
    if(caseId==='durable-publication')bindings.adapters.push(PUBLICATION_BINDING);
    if(caseId==='trusted-plugins'){plugins=await createExamplePlugins();bindings.plugins=plugins.map(({id,version,schemaVersion,contentSha256})=>({id,version,schemaVersion,contentSha256}));}
    if(caseId==='durable-memory'){
      const selected=await openDurableMemory({directory:join(directory,'synthetic-memory')});const text='SYNTHETIC preference: retain original source identities.';
      const memory=await openDurableMemory({directory:join(directory,'synthetic-memory'),intents:[{explicit:true,libraryId:selected.libraryId,operation:'save',intentId:'synthetic-demo-save',origin:'synthetic-fixture',approvedTextHash:sha256(text)}]});
      extensions=memory.extensions;workingInput={memoryLibrary:memory};bindings.adapters.push({id:'memory-intents',version:'1',contentSha256:memory.intentDigest});
    }
    if(caseId==='durable-compaction')workingInput={compaction:{thresholdBytes:1500,summarize:async()=> 'Derived synthetic note: compare the original acquired guide pages; reread the immutable source refs for exact statements.'}};
    if(caseId==='durable-child'){
      bindings.adapters.push({id:'child-handoff',version:'1'});
      extensions=[createDurableChildBinding({store,parentClaim:()=>token,parentRunId:runId,outputRoot:join(directory,'runs'),question:'Read both synthetic guides and return originals.',documents:['atlas-a','atlas-b'],dimensions:['free export limit'],gatewayFactory:()=>({mode:'fixture',async next({messages}){const {ids}=facts(messages);if(!ids.has('child-a'))return call('child-a','read_page',{documentId:'atlas-a',page:1});if(!ids.has('child-b'))return call('child-b','read_page',{documentId:'atlas-b',page:1});return{kind:'final',text:'Derived fixture observation from two actual original pages; semantic quality unreviewed.'};}})})];
    }
    const gateway={mode:'fixture',async next({messages}){
      const {ids,sources,note}=facts(messages);
      if(caseId==='trusted-plugins'){
        if(!ids.has('method-a'))return call('method-a','document_method');if(!ids.has('method-b'))return call('method-b','etf_method');
        if(!ids.has('source-a'))return call('source-a','document_page',{documentId:'atlas-a',page:1});if(!ids.has('source-b'))return call('source-b','synthetic_etf_page');
      }else if(caseId==='durable-child'){if(!ids.has('child-handoff'))return call('child-handoff','durable_child');}
      else{
        if(caseId==='durable-memory'&&!ids.has('memory-save'))return call('memory-save','memory_save',{text:'SYNTHETIC preference: retain original source identities.'});
        const count=caseId==='durable-compaction'?6:2;
        for(let index=0;index<count;index++)if(!ids.has('source-'+index))return call('source-'+index,'read_page',{documentId:index%2?'atlas-b':'atlas-a',page:1});
        if(caseId==='durable-compaction'){
          if(!note)throw new Error('No adopted working note');if(!ids.has('read-note'))return call('read-note','read_note',{resultRef:note.resultRef});
          if(!ids.has('reread')){const original=[...sources.values()].find(s=>s.documentId==='atlas-a');return call('reread','read_result',{resultRef:original.resultRef});}
        }
      }
      if(!ids.has('save-report'))return call('save-report','save_report',{text:'# Synthetic '+caseId+'\n\nThis offline fixture exercises the same Runtime and the selected durable boundary. Source identities and actual saved bytes are checked; model reasoning and financial conclusions are not assessed.',sourceIds:[...sources.keys()]});
      return{kind:'final',text:'Saved the original synthetic report with immutable source and artifact identities.'};
    }};
    const execute=operation==='submit'?submitRun:operation==='work'?workRun:run;
    return await execute({publication:caseId==='durable-publication',question:'Synthetic '+caseId+': preserve this exact request, original sources, bounded resources and actual report receipts.',gateway,plugins,extensions,workingInput,outputRoot:join(directory,'runs'),signal,hostSignal,requireReport:true,limits:{maxRounds:16,maxTools:16,timeoutMs:30000},durable:{store,runId,grantId:'synthetic-demo-'+caseId,bindings,rootLimits:{model:32,tool:16},onClaim:value=>{token=value;},onCheckpoint}});
  }finally{store.close();}
}
