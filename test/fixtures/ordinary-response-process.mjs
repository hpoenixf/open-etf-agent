// Synthetic Gateway only. IPC contains safe identities, never reply text.
import { join } from 'node:path';
import { run } from '../../src/runtime.mjs';
import { openSession } from '../../src/session.mjs';
const [directory,runId,stop]=process.argv.slice(2);
const store=await openSession({directory,profile:'ordinary-response@1',leaseMs:1000});
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'ordinary-process',version:'1'},plugins:[],adapters:[{id:'ordinary-response',version:'1'}]};
let models=0;
try{
 const outcome=await run({question:'Synthetic original process task.',ordinaryResponse:true,requireReport:false,outputRoot:join(directory,'runs'),limits:{maxRounds:4,maxTools:4,timeoutMs:30000},taskTime:{anchorInstant:'2026-10-28T00:30:00.000Z',timeZone:'America/Los_Angeles'},gateway:{mode:'fixture',async next({messages}){models++;const reply=messages.find(m=>m.role==='tool'&&m.callId==='ask-1');if(!reply)return{kind:'calls',calls:[{id:'ask-1',name:'ask_response',arguments:{question:'Synthetic process label?'}}]};return{kind:'final',text:'Original reply: '+reply.result.value.text};}},durable:{store,runId:runId||undefined,grantId:'synthetic-process',bindings,onCheckpoint:async event=>{process.send?.(event);if(event.phase===stop&&!(stop==='model-reserved'&&models===0))await new Promise(()=>{});}}});
 process.stdout.write(JSON.stringify({outcome,models})+'\n');
}finally{store.close();}
