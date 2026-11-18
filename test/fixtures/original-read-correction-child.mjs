import {openSession} from '../../src/session.mjs';
import {run} from '../../src/runtime.mjs';

const [directory, stop, runId, logicalTick] = process.argv.slice(2);
const tick = logicalTick ? Number(logicalTick) : Date.now();
const store = await openSession({directory, leaseMs:150, clock:()=>tick});
const bindings = {gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'read-correction',version:'1'},plugins:[],adapters:[]};
let calls = 0;
try {
  const result = await run({
    question:'Reread the original synthetic source.',
    requireReport:false, outputRoot:directory,
    hostProjection:'host-results@3', allowedDocuments:['atlas-a'], allowedTools:['read_page','read_result'],
    limits:{maxRounds:5,maxTools:3,timeoutMs:20000},
    gateway:{mode:'fixture',next({messages}) {
      calls++;
      const original=messages.find(m=>m.callId==='original')?.result.value;
      if(!original)return {kind:'calls',calls:[{id:'original',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};
      if(messages.some(m=>m.callId==='corrected'))return {kind:'final',text:'Reread the original.'};
      const rejected=messages.some(m=>m.callId==='rejected');
      return {kind:'calls',calls:[{id:rejected?'corrected':'rejected',name:'read_result',
        arguments:{resultRef:original.resultRef,...(rejected?{}:{selection:{offset:0,limit:1400}})}}]};
    }},
    durable:{store,...(runId?{runId}:{}),grantId:'original-read-recovery',bindings,rootLimits:{model:5,tool:3},onCheckpoint(event) {
      const saved=store.inspect(event.runId);
      if(event.phase!==stop||(stop==='model-reserved'
        ? saved.snapshot.corrections!==1 : saved.snapshot.proposal?.calls?.[0]?.id!=='rejected'))return;
      return new Promise((_,reject)=>{
        process.send({kind:'stop',runId:event.runId},error=>{
          if(error)return reject(error);
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,8000);
          reject(new Error('Parent did not terminate the fixture at the checkpoint'));
        });
      });
    }}
  });
  process.send({kind:'outcome',runId:result.runId,status:result.status,code:result.code,usage:result.rootUsage,calls});
} finally {
  store.close();
}
