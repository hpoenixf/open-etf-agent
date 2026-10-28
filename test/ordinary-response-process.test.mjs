import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,mkdtemp,readFile } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { fork,spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { openSession } from '../src/session.mjs';
const base=resolve('test-output');
async function directory(){await mkdir(base,{recursive:true});return mkdtemp(join(base,'ordinary-process-'));}
const fixture=resolve('test/fixtures/ordinary-response-process.mjs');
async function killAt(directory,runId,phase){
 return new Promise((resolve,reject)=>{const child=fork(fixture,[directory,runId||'',phase],{silent:true});let saved;let error='';child.stderr.on('data',chunk=>error+=chunk);const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('fixture timeout '+error));},5000);child.on('message',event=>{if(event.phase===phase){saved=event;child.kill('SIGKILL');}});child.on('exit',(_,signal)=>{clearTimeout(timer);if(signal==='SIGKILL'&&saved)resolve(saved);else reject(Error('unexpected exit '+error));});});
}
function resume(directory,runId,tz='UTC'){const result=spawnSync(process.execPath,[fixture,directory,runId||'',''],{encoding:'utf8',timeout:5000,env:{...process.env,TZ:tz}});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);}
for(const phase of ['proposal-sealed','awaiting-response','result-committed','model-reserved'])test('OR-04/11/15/17 actual process loss at '+phase,async()=>{
 const dir=await directory();let event,out;
 if(['proposal-sealed','awaiting-response'].includes(phase)){event=await killAt(dir,null,phase);const pre=await openSession({directory:dir});try{const state=pre.inspect(event.runId);assert.equal(state.rootUsage.tool,phase==='proposal-sealed'?0:1);assert.equal(pre.responseStatus(event.runId)===null,phase==='proposal-sealed');}finally{pre.close();}await delay(1100);const first=resume(dir,event.runId);assert.equal(first.outcome.status,'awaiting-response');out=first.outcome;}
 else out=resume(dir).outcome;
 let store=await openSession({directory:dir});const before=store.inspect(out.runId);assert.deepEqual(before.rootUsage,{model:1,tool:1});store.receiveResponse({runId:out.runId,questionId:out.questionId,responseId:'process-reply',text:'跨日 synthetic reply'});store.close();
 if(['result-committed','model-reserved'].includes(phase)){event=await killAt(dir,out.runId,phase);await delay(1100);}
 const next=resume(dir,out.runId,'Pacific/Auckland');
 store=await openSession({directory:dir});try{const saved=store.inspect(out.runId),fact=store.response(out.runId,out.questionId);assert.deepEqual(saved.definition,before.definition);assert.equal(fact.receipt.text,'跨日 synthetic reply');assert.ok(fact.adoption);assert.equal(saved.rootUsage.tool,1);assert.equal(saved.snapshot.messages.filter(m=>m.role==='tool'&&m.callId==='ask-1').length,1);if(phase==='model-reserved'){assert.equal(next.outcome.code,'MODEL_OUTCOME_UNKNOWN');assert.equal(next.models,0);}else{assert.equal(next.outcome.status,'completed');assert.equal(next.outcome.answer,'Original reply: 跨日 synthetic reply');}assert.equal(saved.rootUsage.model,2);}finally{store.close();}
});
test('OR-01/19 actual CLI processes yield, receive, resume and read original report bytes; safe views omit body',async()=>{
 const dir=await directory();const command=(...args)=>{const r=spawnSync(process.execPath,['src/session-cli.mjs',...args,'--session',dir],{encoding:'utf8',timeout:5000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 const out=command('start','--case','durable-response');assert.equal(out.status,'awaiting-response');const args=['--run',out.runId];const fact=command('question',...args,'--question',out.questionId);assert.equal(fact.questionId,out.questionId);
 const text='SYNTHETIC PRIVATE REPLY λ 证明原字节';const receipt=command('respond',...args,'--question',out.questionId,'--response','cli-1','--text',text);assert.equal(receipt.status,'received-not-adopted');assert.ok(!JSON.stringify(receipt).includes(text));const inspect=command('inspect',...args);assert.ok(!JSON.stringify(inspect).includes(text));
 const done=command('resume',...args);assert.equal(done.status,'completed');const report=await readFile(join(done.directory,'report.md'),'utf8');assert.ok(report.includes(text));const log=await readFile(join(done.directory,'run.jsonl'),'utf8');assert.ok(!log.includes(text));assert.ok(!log.includes(fact.call.arguments.question));
 const read=command('question',...args,'--question',out.questionId);assert.equal(read.receipt.text,text);assert.ok(read.adoption);const again=command('resume',...args);assert.equal(again.receipt.sha256,done.receipt.sha256);
});
test('OR-12 two real resume processes cannot share adoption or dispatch',async()=>{
 const dir=await directory(),out=resume(dir).outcome;const store=await openSession({directory:dir});store.receiveResponse({runId:out.runId,questionId:out.questionId,responseId:'competing','text':'one reply'});store.close();
 const child=fork(fixture,[dir,out.runId,'result-committed'],{silent:true});let errors='';child.stderr.on('data',v=>errors+=v);const stopped=new Promise(resolve=>child.once('exit',resolve));const timer=setTimeout(()=>child.kill('SIGKILL'),5000);
 try{await new Promise((resolve,reject)=>{child.on('message',event=>{if(event.phase==='result-committed')resolve();});child.once('exit',()=>reject(Error('early exit '+errors)));});const loser=spawnSync(process.execPath,[fixture,dir,out.runId,''],{encoding:'utf8',timeout:3000});assert.notEqual(loser.status,0);assert.match(loser.stderr,/LEASE_BUSY/);const read=await openSession({directory:dir});try{assert.equal(read.inspect(out.runId).rootUsage.model,1);assert.equal(read.responseStatus(out.runId).status,'adopted');}finally{read.close();}}finally{clearTimeout(timer);child.kill('SIGKILL');await stopped;}
 await delay(1100);const done=resume(dir,out.runId);assert.equal(done.outcome.status,'completed');assert.deepEqual(done.outcome.rootUsage,{model:2,tool:1});
});
