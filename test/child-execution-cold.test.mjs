import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fork} from 'node:child_process';
function processStep(directory,mode,target){
 const child=fork(new URL('./child-execution-process.mjs',import.meta.url),[directory,mode,target],{silent:true,env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC'}});let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.resume();
 let settled=false;const message=new Promise((resolve,reject)=>{child.once('message',m=>{settled=true;resolve(m);});child.once('error',reject);child.once('exit',(code,signal)=>{if(!settled)reject(Error('Child helper exited before proof: '+code+'/'+signal+' '+stderr));});});
 const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal,stderr})));return{child,message,exit};
}
for(const target of ['child:result-committed','child:result-consumed','child:model-reserved','main:result-committed','main:result-consumed'])test('22.cold independent SIGKILL and original recovery at '+target,{timeout:12000},async t=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/child-cold-'));const processes=[];t.after(async()=>{for(const p of processes)if(p.child.exitCode===null&&p.child.signalCode===null){p.child.kill('SIGKILL');await p.exit;}await rm(dir,{recursive:true,force:true});});
 const first=processStep(dir,'start',target);processes.push(first);const stopped=await first.message;assert.equal(stopped.kind,'checkpoint');assert.equal(stopped.role+':'+stopped.phase,target);assert.notEqual(stopped.pid,process.pid);assert.equal(stopped.children.length,1);const before=stopped.children[0];first.child.kill('SIGKILL');assert.equal((await first.exit).signal,'SIGKILL');await new Promise(r=>setTimeout(r,200));
 const second=processStep(dir,'resume',target);processes.push(second);const resumed=await second.message,finished=await second.exit;assert.equal(finished.code,0,finished.stderr);assert.equal(resumed.kind,'result');assert.notEqual(resumed.pid,stopped.pid);assert.equal(resumed.history.items.length,1);const after=resumed.history.items[0];assert.equal(after.runId,before.runId);assert.equal(after.deadlineAt,before.definition.deadlineAt);assert.equal(after.rootId,'original');assert.equal(resumed.result.runId,'original');const calls=(await readFile(join(dir,'fixture-requests.txt'),'utf8')).trim().split('\n');
 if(target==='child:model-reserved'){assert.equal(resumed.result.status,'failed');assert.equal(after.gatewayOutcome,'unknown');assert.equal(after.consumption,'not-consumed');assert.deepEqual(calls,['main']);assert.deepEqual(resumed.result.rootUsage,{model:2,tool:1});}
 else{assert.equal(resumed.result.status,'completed');assert.equal(after.status,'completed');assert.equal(after.consumption,'consumed');assert.equal(after.toolsDispatched,1);assert.equal(after.result.sources.length,1);assert.deepEqual(calls,['main','child','child','main']);assert.deepEqual(resumed.result.rootUsage,{model:4,tool:2});}
});
