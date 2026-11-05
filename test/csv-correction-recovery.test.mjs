import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fork} from 'node:child_process';
import {openSession} from '../src/session.mjs';
function start(args){
 const child=fork(new URL('./fixtures/csv-correction-child.mjs',import.meta.url),args,{stdio:['ignore','ignore','pipe','ipc'],execArgv:['--max-old-space-size=256']});let closed=false,stderr='';const queue=[];child.stderr.on('data',b=>stderr=(stderr+b).slice(-4096));child.on('message',m=>queue.push(m));const exit=new Promise(resolve=>child.once('close',(code,signal)=>{closed=true;resolve({code,signal});}));
 return{child,exit,async wait(kind){const end=Date.now()+6000;while(Date.now()<end){const m=queue.find(x=>x.kind===kind);if(m)return m;if(closed)throw Error('Owned helper exited: '+stderr);await new Promise(r=>setTimeout(r,10));}throw Error('Owned helper deadline: '+stderr);},async close(){if(!closed)child.kill('SIGKILL');return exit;}};
}
for(const [phase,mode,code,models,tools] of [['result-committed','correct',null,3,1],['result-consumed','reject','CORRECTION_LIMIT',2,0],['model-reserved','correct','MODEL_OUTCOME_UNKNOWN',2,0]])test('CSV actual process death at '+phase+' preserves proof, root debit and unknown non-replay',{timeout:15000},async t=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/csv-cold-'));let first,second,third,store;
 try{
  first=start([dir,phase,'',mode]);const point=await first.wait('stop'),death=await first.close();assert.equal(death.signal,'SIGKILL');store=await openSession({directory:dir,readOnly:true});const before=store.inspect(point.runId),tick=before.leaseUntil+1;assert.equal(before.status,'active');assert.equal(before.snapshot.phase,phase);assert.equal(before.rootUsage.tool,0);const originalProof=phase==='result-committed'?before.snapshot.result.validation:before.snapshot.messages.find(m=>m.callId==='first').result.validation;assert.equal(originalProof.schemaVersion,'builtin-csv-input-validation@1');store.close();store=null;
  second=start([dir,'',point.runId,mode,String(tick)]);const out=await second.wait('outcome');assert.equal((await second.exit).code,0);assert.notEqual(first.child.pid,second.child.pid);assert.equal(out.result.code,code);assert.equal(out.result.status,code?'failed':'completed');assert.deepEqual(out.result.rootUsage,{model:models,tool:tools});assert.equal(out.calls,phase==='model-reserved'?0:phase==='result-consumed'?1:2);
  store=await openSession({directory:dir,readOnly:true});const saved=store.inspect(point.runId);assert.equal(saved.fence,2);assert.equal(saved.snapshot.corrections,1);assert.deepEqual(saved.definition,before.definition);assert.deepEqual(saved.snapshot.messages.find(m=>m.callId==='first').result.validation,originalProof);store.close();store=null;
  third=start([dir,'',point.runId,mode,String(tick)]);const terminal=await third.wait('outcome');assert.equal((await third.exit).code,0);assert.equal(terminal.calls,0);assert.equal(terminal.result.code,code);assert.deepEqual(terminal.result.rootUsage,out.result.rootUsage);t.diagnostic(JSON.stringify({phase,runId:point.runId,firstPid:first.child.pid,secondPid:second.child.pid,thirdPid:third.child.pid,death,clock:'controlled original leaseUntil+1; not wall-time wait',modelCalls:models,toolCalls:tools}));
 }finally{store?.close();await first?.close();await second?.close();await third?.close();await rm(dir,{recursive:true,force:true});}
});
