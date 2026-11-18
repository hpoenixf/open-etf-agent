import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {openSession} from '../src/session.mjs';
function launch(directory,action,id,pause,tick){const child=fork(new URL('./fixtures/knowledge-query-process.mjs',import.meta.url),[directory,action,id,pause,String(tick)],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});const messages=[];let stderr='';child.stdout.resume();child.stderr.on('data',x=>{stderr+=x;});child.on('message',x=>messages.push(x));const exited=once(child,'exit').then(([code,signal])=>({code,signal}));return{child,exited,async wait(kind){const end=Date.now()+10000;while(Date.now()<end){const found=messages.find(x=>x.kind===kind);if(found)return found;const failure=messages.find(x=>x.kind==='fixture-error');if(failure)throw Error(failure.code);if(child.exitCode!==null||child.signalCode)throw Error('Child ended: '+stderr);await delay(10);}throw Error('Fixture barrier timed out');},async stop(){if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');return exited;}};}
const stages=async d=>{try{return(await readFile(join(d,'stages.txt'),'utf8')).trim().split('\n').filter(Boolean);}catch(e){if(e.code==='ENOENT')return[];throw e;}};
for(const [pause,dispatched,completed] of [['before-backend',0,false],['tokenizer-dispatched',1,false],['encoder-dispatched',2,false],['receipt-before-host',2,true],['host-result-consumed',2,true]])test('actual SIGKILL at '+pause+' restores original accounting and never re-encodes',async t=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/query-process-'));t.after(()=>rm(dir,{recursive:true,force:true}));const id='original-query',clock=Date.now();const submit=launch(dir,'submit',id,'',clock);await submit.wait('submitted');assert.equal((await submit.exited).code,0);
 const first=launch(dir,'work',id,pause,clock);t.after(()=>first.stop());await first.wait('barrier');assert.equal((await first.stop()).signal,'SIGKILL');const beforeStages=await stages(dir);let store=await openSession({directory:dir,readOnly:true});const before=store.inspect(id),budget=store.knowledgeQueryBudget(id);store.close();assert.equal(budget.reservedQueries,1);assert.equal(budget.dispatchedPhysicalOperations,dispatched);
 // Lease ordering is controlled; Runtime's persisted wall-clock deadline is real.
 const second=launch(dir,'work',id,'',before.leaseUntil+1);t.after(()=>second.stop());const seen=await second.wait('observation');assert.equal((await second.exited).code,0);assert.notEqual(first.child.pid,second.child.pid);assert.equal(seen.observation.run.runId,id);assert.equal(seen.observation.run.definition.deadlineAt,before.definition.deadlineAt);
 assert.equal(seen.observation.run.status,completed?'completed':'failed');if(!completed)assert.equal(seen.observation.run.snapshot.code,'TOOL_OUTCOME_UNKNOWN');assert.deepEqual(await stages(dir),beforeStages);
 store=await openSession({directory:dir,readOnly:true});t.after(()=>store.close());assert.deepEqual(store.knowledgeQueryBudget(id),budget);assert.equal(store.knowledgeQueryEffect(id,'q').status,completed?'completed':'reserved');
});
