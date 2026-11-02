import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';import {join,resolve} from 'node:path';import {fork} from 'node:child_process';
import {openSession} from '../src/session.mjs';import {createToolHost} from '../src/tools.mjs';import {sha256} from '../src/source.mjs';
async function directory(){const p=resolve(import.meta.dirname,'../test-output');await mkdir(p,{recursive:true});return mkdtemp(join(p,'durable-correction-'));}
const valid={baseline:2,current:4,baselineUnit:'rows',currentUnit:'rows'};
test('persisted validation envelope must reproduce exact pure builtin rejection without effects or scope forgery',async()=>{
 const host=await createToolHost({directory:await directory()});const call={id:'bad',name:'calculate_change',arguments:{...valid,baseline:'2'}};const result=await host.execute(call);
 assert.equal(host.correctionEligible(call,result),true);await host.verifyResult(call,structuredClone(result));
 const mutations=[r=>r.validation.code='CALC_UNIT_FORMAT',r=>r.validation.requestHash='0'.repeat(64),r=>r.callId='foreign',r=>r.value={},r=>r.partialPaths=['report.md'],r=>r.artifactEffects=[],r=>r.memoryEffect={},r=>r.original=call,r=>r.hookErrors=[],r=>r.validation.extra=true,r=>r.dispatched=true];
 for(const change of mutations){const bad=structuredClone(result);change(bad);await assert.rejects(host.verifyResult(call,bad),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');}
 for(const changed of [{...call,extra:true},{...call,id:'bad\n'},{...call,name:'save_report'}]){const bad=structuredClone(result);bad.callId=changed.id;bad.validation.requestHash=sha256(JSON.stringify(changed));await assert.rejects(host.verifyResult(changed,bad),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');}
 const denied=await createToolHost({directory:await directory(),allowedTools:['read_page']});await assert.rejects(denied.verifyResult(call,result),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');
});
function start(args){
 const child=fork(new URL('./fixtures/correction-child.mjs',import.meta.url),args,{stdio:['ignore','ignore','pipe','ipc'],execArgv:['--max-old-space-size=256']});
 let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-4096);});let closed=false;const exit=new Promise(resolve=>child.once('exit',(code,signal)=>{closed=true;resolve({code,signal});}));
 const queue=[];let notify;child.on('message',m=>{queue.push(m);notify?.();});
 return{child,exit,async wait(kind){const end=Date.now()+4000;while(Date.now()<end){const m=queue.find(x=>x.kind===kind);if(m)return m;if(closed)throw new Error('Synthetic helper exited before '+kind+': '+stderr);await new Promise(r=>{notify=r;setTimeout(r,20);});}throw new Error('Synthetic helper deadline');},async close(){if(!closed)child.kill('SIGKILL');return exit;}};
}
for(const [phase,mode,expected,models,tools] of [['result-committed','correct',null,3,1],['result-consumed','reject','CORRECTION_LIMIT',2,0],['model-reserved','correct','MODEL_OUTCOME_UNKNOWN',2,0]])test('real process death at '+phase+' retains correction accounting and never replays unknown work',{timeout:5000},async()=>{
 const d=await directory(),first=start([d,phase,'',mode]);let point;
 try{point=await first.wait('stop');}finally{const death=await first.close();assert.equal(death.signal,'SIGKILL');}
 const inspect=await openSession({directory:d});let tick;try{tick=inspect.inspect(point.runId).leaseUntil+1;}finally{inspect.close();}
 const second=start([d,'',point.runId,mode,String(tick)]);
 try{const {result,calls}=await second.wait('outcome');assert.equal((await second.exit).code,0);assert.notEqual(first.child.pid,second.child.pid);assert.equal(result.runId,point.runId);assert.equal(result.code,expected);assert.equal(result.status,expected?'failed':'completed');assert.deepEqual(result.rootUsage,{model:models,tool:tools});assert.equal(calls,phase==='model-reserved'?0:phase==='result-consumed'?1:2);
  const store=await openSession({directory:d,clock:()=>tick});try{const saved=store.inspect(point.runId);assert.equal(saved.snapshot.corrections,1);assert.equal(saved.fence,2);assert.equal(saved.snapshot.messages.filter(m=>m.result?.validation).length,mode==='reject'?2:1);}finally{store.close();}
 }finally{await second.close();}
});
