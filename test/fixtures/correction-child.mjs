import {run} from '../../src/runtime.mjs';
import {openSession} from '../../src/session.mjs';
const [directory,stop='',runId='',mode='correct',logicalTick='']=process.argv.slice(2);
const clock=logicalTick?()=>Number(logicalTick):Date.now;
const store=await openSession({directory,leaseMs:150,clock});
const question='Synthetic durable calculation correction.';
const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'scripted',version:'1'},plugins:[],adapters:[]};
let calls=0;
try{
 const result=await run({question,requireReport:false,outputRoot:directory,limits:{maxRounds:5,maxTools:3,timeoutMs:15000},gateway:{mode:'fixture',async next({messages}){
  calls++;const replies=messages.filter(m=>m.role==='tool');
  if(replies.some(m=>m.result.status==='succeeded'))return{kind:'final',text:'Synthetic calculation receipt consumed.'};
  return{kind:'calls',calls:[{id:replies.length?'second':'first',name:'calculate_change',arguments:{baseline:replies.length&&mode==='correct'?2:'2',current:4,baselineUnit:'rows',currentUnit:'rows'}}]};
 }},durable:{store,...(runId?{runId}:{}),grantId:'correction-grant',bindings,rootLimits:{model:5,tool:3},async onCheckpoint(event){
  const saved=store.inspect(event.runId);
  const shouldStop=event.phase===stop&&(stop==='model-reserved'?(saved.snapshot.corrections===1):saved.snapshot.proposal?.calls?.[0]?.id==='first');
  if(shouldStop){process.send?.({kind:'stop',runId:event.runId,phase:event.phase,calls,rootUsage:saved.rootUsage});await new Promise(()=>{});}
 }}});
 process.send?.({kind:'outcome',result,calls});
}finally{store.close();}
