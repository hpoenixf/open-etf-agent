import {run} from '../../src/runtime.mjs';
import {openSession} from '../../src/session.mjs';
import {CLAIM_COMPARISON_METHOD} from '../../src/child.mjs';
import {childExecutionBinding,createChildExecutionBinding} from '../../src/child-execution.mjs';
const [directory,stop='',runId='',mode='correct',tick='']=process.argv.slice(2);
const store=await openSession({directory,leaseMs:5000,clock:tick?()=>Number(tick):Date.now});let token,mainCalls=0,childCalls=0;
const selected={question:'Synthetic durable Child input correction.',documents:['atlas-a'],execution:{schemaVersion:'child-execution@1',maxChildren:1,methods:[CLAIM_COMPARISON_METHOD]}};
const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'child-input-scripted',version:'1'},plugins:[],adapters:[childExecutionBinding(selected)]};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const binding=createChildExecutionBinding({store,parentRunId:runId||undefined,parentClaim:()=>token,...selected,outputRoot:directory,gatewayFactory:()=>({mode:'fixture',next({messages}){childCalls++;return messages.some(m=>m.role==='tool')?{kind:'final',text:'Original observation.'}:call('page','read_page',{documentId:'atlas-a',page:1});}})});
try{
 const result=await run({question:selected.question,extensions:[binding],allowedTools:['delegate_child','read_page','save_report'],allowedDocuments:selected.documents,requireReport:true,outputRoot:directory,limits:{maxRounds:8,maxTools:6,timeoutMs:30000},gateway:{mode:'fixture',next({messages}){
  mainCalls++;const replies=messages.filter(m=>m.role==='tool');if(replies.some(m=>m.callId==='save'))return{kind:'final',text:'Report saved.'};
  const child=replies.find(m=>m.callId==='second'&&m.result.status==='succeeded');if(child)return call('save','save_report',{text:'Original observation [1].',sourceIds:child.result.value.sources.map(s=>s.sourceId)});
  return call(replies.length?'second':'first','delegate_child',{methodId:'claim-comparison',question:'Read original source.',...(replies.length&&mode==='correct'?{documents:['atlas-a']}:{})});
 }},durable:{store,...(runId?{runId}:{}),grantId:'child-input-correction-grant',bindings,rootLimits:{model:10,tool:8},onClaim:v=>token=v,async onCheckpoint(event){
  const saved=store.inspect(event.runId);if(event.phase===stop&&(stop==='model-reserved'?saved.snapshot.corrections===1:saved.snapshot.proposal?.calls?.[0]?.id==='first')){process.send?.({kind:'stop',runId:event.runId,phase:event.phase,mainCalls,childCalls,rootUsage:saved.rootUsage});await new Promise(()=>{});}
 }}});process.send?.({kind:'outcome',result,mainCalls,childCalls,children:store.listChildren(result.runId).map(c=>({runId:c.runId,rootId:c.rootId,parentRunId:c.parentRunId,status:c.status,tools:c.snapshot.toolsDispatched}))});
}finally{store.close();}
