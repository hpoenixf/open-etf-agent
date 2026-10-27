import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../../src/runtime.mjs';
import { openDurableMemory } from '../../src/durable-memory.mjs';
import { createDurableChildBinding } from '../../src/durable-child.mjs';
import { sha256 } from '../../src/source.mjs';
import { openSession } from '../../src/session.mjs';
const [directory,mode,stop,rawRunId,rawClock,rawStall]=process.argv.slice(2);
const runId=rawRunId||undefined;
const leaseClock=rawClock?Number(rawClock):undefined,stallMs=rawStall?Number(rawStall):0;
if((leaseClock!==undefined&&(mode!=='compaction'||!Number.isSafeInteger(leaseClock)))||!Number.isSafeInteger(stallMs)||stallMs<0||stallMs>1000)throw new Error('Invalid recovery fixture clock');
const store=await openSession({directory,leaseMs:150,...(leaseClock===undefined?{}:{clock:()=>leaseClock})});
const trace=event=>appendFile(join(directory,'attempts.jsonl'),JSON.stringify({pid:process.pid,...event})+'\n');
const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'scripted',version:'1'},plugins:[],adapters:[]};
let token;let workingInput;let memory;
if(mode==='memory'){memory=await openDurableMemory({directory:join(directory,'memory')});const text='SYNTHETIC preference: verify immutable receipts.';memory=await openDurableMemory({directory:join(directory,'memory'),intents:[{explicit:true,libraryId:memory.libraryId,operation:'save',intentId:'synthetic-recovery-intent',origin:'synthetic-fixture',approvedTextHash:sha256(text)}]});bindings.adapters.push({id:'memory-intents',version:'1',contentSha256:memory.intentDigest});workingInput={memoryLibrary:memory};}
if(mode==='compaction')workingInput={compaction:{thresholdBytes:1500,summarize:async()=>{await trace({kind:'summary'});return'Derived synthetic note: reread original pages for exact comparisons.';}}};
const gateway={mode:'fixture',async next({messages}){
 await trace({kind:'model',inputHash:sha256(JSON.stringify(messages)),noteRef:messages.find(m=>m.result?.value?.kind==='derived-working-note')?.result.value.resultRef??null});
 if(mode==='late'){process.send?.({phase:'model-pending'});await new Promise(resolve=>setTimeout(resolve,500));return{kind:'calls',calls:[{id:'late',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};}
 if(mode==='modelunknown'){process.send?.({phase:'model-pending',runId:store.list?.()[0]?.runId});await new Promise(()=>{});}
 const results=messages.filter(m=>m.role==='tool');
 if(mode==='memory')return results.length?{kind:'final',text:'Original Memory receipt consumed.'}:{kind:'calls',calls:[{id:'memory-save',name:'memory_save',arguments:{text:'SYNTHETIC preference: verify immutable receipts.'}}]};
 if(mode==='child')return results.length?{kind:'final',text:'Original child handoff consumed.'}:{kind:'calls',calls:[{id:'child-one',name:'durable_child',arguments:{}}]};
 if(mode==='compaction'){const ids=new Set([...messages.flatMap(m=>m.calls?.map(c=>c.id)||[]),...results.flatMap(m=>m.result?.value?.callIds||[])]);const count=[...ids].filter(id=>id.startsWith('repeat-')).length;if(count<6)return{kind:'calls',calls:[{id:'repeat-'+count,name:'read_page',arguments:{documentId:count%2?'atlas-b':'atlas-a',page:1}}]};const note=results.find(m=>m.result?.value?.kind==='derived-working-note');if(!note)throw new Error('Adopted note missing');await trace({kind:'note-input',ref:note.result.value.resultRef});return{kind:'final',text:'Exact adopted note observed.'};}
 if(!results.length)return{kind:'calls',calls:[{id:'read-a',name:mode==='unknown'?'unknown_tool':mode==='rejected'?'not_granted':'read_page',arguments:mode==='unknown'?{}:{documentId:'atlas-a',page:1}}]};
 if(mode==='duplicate')return{kind:'calls',calls:[{id:'read-a',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};
 if(mode==='report'&&!results.some(m=>m.result.value?.fileId))return{kind:'calls',calls:[{id:'save-one',name:'save_report',arguments:{text:'# Synthetic durable report',sourceIds:results.filter(m=>m.result.value?.sourceId).map(m=>m.result.value.sourceId)}}]};
 return{kind:'final',text:'Synthetic continuation completed.'};
}};
let extensions=mode==='unknown'?[{name:'unknown_tool',description:'Synthetic external effect marker',parameters:{type:'object'},validate(){},async execute(){await trace({kind:'effect'});process.send?.({phase:'effect-dispatched'});await new Promise(()=>{});}}]:[];
if(memory)extensions=memory.extensions;
if(mode==='child'){bindings.adapters.push({id:'child-handoff',version:'1'});const binding=createDurableChildBinding({store,parentClaim:()=>token,parentRunId:runId,outputRoot:directory,question:'Read the first synthetic page.',documents:['atlas-a'],dimensions:['free export limit'],gatewayFactory:()=>({mode:'fixture',async next({messages}){await trace({kind:'child-model'});return messages.some(m=>m.role==='tool')?{kind:'final',text:'Derived synthetic handoff.'}:{kind:'calls',calls:[{id:'child-read',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};}})});const execute=binding.execute;binding.execute=async(...args)=>{const result=await execute(...args);process.send?.({phase:'child-handoff',runId:token.runId});if(stop==='child-handoff')await new Promise(()=>{});return result;};extensions=[binding];}
try{
 const result=await run({question:'Keep this exact synthetic request.',gateway,outputRoot:directory,requireReport:mode==='report',extensions,workingInput,limits:{maxRounds:12,maxTools:12,timeoutMs:mode==='deadline'?200:15000},durable:{store,runId,grantId:'synthetic-grant',bindings,rootLimits:{model:32,tool:16},onClaim:value=>{token=value;if(stallMs)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,stallMs);},async onCheckpoint(event){process.send?.({kind:'checkpoint',...event,pid:process.pid});if(stop===event.phase&&(mode!=='compaction'||event.noteRef)&&(mode!=='report'||event.callId==='save-one'||event.phase==='result-committed'&&event.cursor===0&&store.inspect(event.runId).snapshot.result?.value?.fileId))await new Promise(()=>{});}}});
 process.send?.({kind:'outcome',result,pid:process.pid});process.stdout.write(JSON.stringify(result)+'\n');
}finally{store.close();}
