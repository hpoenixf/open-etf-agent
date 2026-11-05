import {run} from '../../src/runtime.mjs';
import {openSession} from '../../src/session.mjs';
const [directory,stop='',runId='',mode='correct',tick='']=process.argv.slice(2);
const store=await openSession({directory,leaseMs:5000,clock:tick?()=>Number(tick):Date.now});
const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'csv-scripted',version:'1'},plugins:[],adapters:[]};
let calls=0;
try{
 const result=await run({question:'Synthetic durable CSV correction.',requireReport:false,outputRoot:directory,limits:{maxRounds:5,maxTools:3,timeoutMs:30000},gateway:{mode:'fixture',next({messages}){
  calls++;const replies=messages.filter(m=>m.role==='tool');if(replies.some(m=>m.result.status==='succeeded'))return{kind:'final',text:'CSV receipt consumed.'};
  return{kind:'calls',calls:[{id:replies.length?'second':'first',name:'create_csv',arguments:{rows:replies.length&&mode==='correct'?[['value'],['2']]:'[["value"],["2"]]'}}]};
 }},durable:{store,...(runId?{runId}:{}),grantId:'csv-correction-grant',bindings,rootLimits:{model:5,tool:3},async onCheckpoint(event){
  const saved=store.inspect(event.runId);if(event.phase===stop&&(stop==='model-reserved'?saved.snapshot.corrections===1:saved.snapshot.proposal?.calls?.[0]?.id==='first')){process.send?.({kind:'stop',runId:event.runId,phase:event.phase,calls,rootUsage:saved.rootUsage});await new Promise(()=>{});}
 }}});process.send?.({kind:'outcome',result,calls});
}finally{store.close();}
