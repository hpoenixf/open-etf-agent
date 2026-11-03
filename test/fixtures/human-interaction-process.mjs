import {join} from 'node:path';
import {openSession} from '../../src/session.mjs';
import {run} from '../../src/runtime.mjs';
import {INTERACTION_PROFILE,INTERACTION_BINDING} from '../../src/human-interaction.mjs';
const [directory,runId,stopPhase]=process.argv.slice(2);let models=0;
const store=await openSession({directory,profile:INTERACTION_PROFILE});
try{const outcome=await run({question:'Synthetic two-step clarification.',outputRoot:join(directory,'runs'),ordinaryResponse:true,interaction:{schemaVersion:INTERACTION_PROFILE,maxQuestions:2},limits:{maxRounds:6,maxTools:6,timeoutMs:30000},gateway:{mode:'fixture',async next({messages}){models++;const replies=messages.filter(m=>m.role==='tool'&&m.result.value?.kind===INTERACTION_PROFILE);return replies.length<2?{kind:'calls',calls:[{id:'ask-'+(replies.length+1),name:'ask_response',arguments:{question:'Clarification '+(replies.length+1)+'?'}}]}:{kind:'final',text:replies.map(m=>m.result.value.text).join(' / ')};}},durable:{store,...(runId?{runId}:{}),grantId:'synthetic',bindings:{gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'questions',version:'1'},plugins:[],adapters:[INTERACTION_BINDING]},async onCheckpoint(event){if(event.phase===stopPhase){process.send?.(event);await new Promise(()=>{});}}}});process.stdout.write(JSON.stringify({outcome,models})+'\n');}finally{store.close();}
