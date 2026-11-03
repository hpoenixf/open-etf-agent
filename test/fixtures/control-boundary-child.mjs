import {run} from '../../src/runtime.mjs';
import {openSession} from '../../src/session.mjs';
import {sourceCheckBinding,createSpecialistChildBinding} from '../../src/specialist-child.mjs';
const [directory,mode,stop='',runId='',logicalTick='']=process.argv.slice(2);
const store=await openSession({directory,leaseMs:150,clock:logicalTick?()=>Number(logicalTick):Date.now});
const question='Synthetic durable original source check.',documents=['atlas-a','atlas-b'];let token,calls=0,childCalls=0;
const group=mode==='group';
const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'boundary-kill',version:'1'},plugins:[],adapters:group?[sourceCheckBinding({question,documents})]:[{id:'publication',version:'publication@1'}]};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const extensions=group?[createSpecialistChildBinding({store,parentClaim:()=>token,parentRunId:runId||undefined,outputRoot:directory,question,documents,gatewayFactory:()=>({mode:'fixture',async next({messages}){childCalls++;return messages.some(m=>m.role==='tool')?{kind:'final',text:'Read original.'}:call('child-read','read_page',{documentId:'atlas-a',page:1});}})})]:[];
try{
 const result=await run({question,outputRoot:directory,extensions,requireReport:!group,publication:!group,allowedTools:group?['read_page','source_check']:['read_page','calculate_change','save_report'],allowedDocuments:documents,limits:{maxRounds:8,maxTools:8,timeoutMs:15000},gateway:{mode:'fixture',async next({messages}){
 calls++;const replies=messages.filter(m=>m.role==='tool');
 if(group){if(!replies.length)return{kind:'calls',calls:[{id:'mixed-read',name:'read_page',arguments:{documentId:'atlas-a',page:1}},{id:'mixed-child',name:'source_check',arguments:{question:'Read original.'}}]};if(!replies.some(m=>m.callId==='serial'))return call('serial','source_check',{question:'Read original.'});return{kind:'final',text:'Original serial handoff completed.'};}
 if(!replies.length)return call('read','read_page',{documentId:'atlas-a',page:1});const source=replies.find(m=>m.callId==='read').result.value.sourceId;
 if(!replies.some(m=>m.callId==='bad'))return call('bad','save_report',{text:'Not yet calculated [C1].',sourceIds:[source]});
 if(!replies.some(m=>m.callId==='calc'))return call('calc','calculate_change',{baseline:2,current:4,baselineUnit:'rows',currentUnit:'rows'});
 if(!replies.some(m=>m.callId==='save'))return call('save','save_report',{text:'Original [1], calculation [C1].',sourceIds:[source]});return{kind:'final',text:'Saved original report.'};
 }},durable:{store,...(runId?{runId}:{}),grantId:'control-boundary-kill',bindings,rootLimits:{model:10,tool:10},onClaim:t=>token=t,async onCheckpoint(event){
 if(stop&&((group&&event.groupRejected&&event.phase==='result-consumed')||(!group&&event.phase==='result-committed'&&event.callId==='bad'))){const saved=store.inspect(event.runId);process.send?.({kind:'stop',pid:process.pid,runId:event.runId,phase:event.phase,calls,childCalls,rootUsage:saved.rootUsage});await new Promise(()=>{});}
 }}});process.send?.({kind:'outcome',pid:process.pid,result,calls,childCalls});
}finally{store.close();}
