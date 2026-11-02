import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const source=resolve(new URL('../src',import.meta.url).pathname);
const {run}=await import(pathToFileURL(join(source,'runtime.mjs')));
const {openSession}=await import(pathToFileURL(join(source,'session.mjs')));
test('claim reads authoritative model reservation instead of stale inspected ready state',async()=>{
 const base=resolve(import.meta.dirname,'../test-output');await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,'claim-race-'));
 const tick=Date.now(),store=await openSession({directory,clock:()=>tick});const rd=join(directory,'run');await mkdir(rd);
 const question='Synthetic source-independent claim race.',bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'scripted',version:'1'},plugins:[],adapters:[]},limits={maxRounds:4,maxTools:2,timeoutMs:5000};
 const snapshot={schemaVersion:'runtime-checkpoint@1',phase:'ready',messages:[{role:'user',content:question}],usedIds:[],rounds:0,toolsDispatched:0,proposal:null,cursor:0,result:null,host:null,working:null,answer:'',status:'failed',code:null,unknownEffects:[],partialEffects:[],hookErrors:[]};
 store.create({runId:'race-run',directory:rd,definition:{question,grantId:'race-grant',bindings,limits,rootLimits:{model:4,tool:2},deadlineAt:tick+5000,config:{requireReport:false,taskId:null}},snapshot});
 let calls=0,advanced=false;
 const facade={...store,claim(...args){
   if(!advanced){advanced=true;const other=store.claim(args[0],'intervening-owner');try{other.reserve('model',{...snapshot,phase:'model-reserved',rounds:1});}finally{other.release();}}
   return store.claim(...args);
 }};
 try{
  const result=await run({question,gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Must not execute stale state.'};}},requireReport:false,limits,durable:{store:facade,runId:'race-run',grantId:'race-grant',bindings}});
  assert.equal(advanced,true);assert.equal(calls,0);assert.equal(result.code,'MODEL_OUTCOME_UNKNOWN');assert.equal(result.status,'failed');assert.deepEqual(result.rootUsage,{model:1,tool:0});assert.equal(store.inspect('race-run').snapshot.rounds,1);
 }finally{store.close();}
});
