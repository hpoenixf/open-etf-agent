import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {childExecutionBinding,createAsyncChildExecutionBindings,inspectChildExecutions} from '../src/child-execution.mjs';
const question='Compare synthetic evidence.',documents=['atlas-a','atlas-b'];
const execution={schemaVersion:'child-execution@2',maxChildren:2,maxConcurrent:2,methods:[CLAIM_COMPARISON_METHOD]};
const selection={question,documents,execution};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const spawn=id=>call(id,'spawn_child',{methodId:'claim-comparison',question:'Read the original evidence.',documents:['atlas-a']});
async function harness(t,{main,child=()=>({kind:'final',text:'Derived answer.'}),onCheckpoint,hostSignal,rootLimits={model:24,tool:24}}){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/async-child-'));let store=await openSession({directory,leaseMs:1000}),token,mainCalls=0,childCalls=0;
 t.after(()=>{store.close();return rm(directory,{recursive:true,force:true});});
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'async-child',version:'1'},plugins:[],adapters:[childExecutionBinding(selection)]};
 function options(runId,controls={}){const extensions=createAsyncChildExecutionBindings({store,parentRunId:runId,parentClaim:()=>token,...selection,outputRoot:join(directory,'runs'),gatewayFactory:()=>({mode:'fixture',next:async input=>{childCalls++;return child(input);}}),onCheckpoint:controls.onCheckpoint});return{question,gateway:{mode:'fixture',next:async input=>{mainCalls++;return main(input);}},extensions,allowedTools:['spawn_child','inspect_child','cancel_child','read_page'],allowedDocuments:documents,requireReport:false,outputRoot:join(directory,'runs'),limits:{maxRounds:20,maxTools:20,timeoutMs:10000},...controls,durable:{store,...(runId?{runId}:{}),grantId:'synthetic-async-child',bindings,rootLimits,onClaim:t=>token=t,onCheckpoint:controls.onCheckpoint}};}
 const result=await run(options(undefined,{onCheckpoint,hostSignal}));return{result,directory,get store(){return store;},get mainCalls(){return mainCalls;},get childCalls(){return childCalls;},restart:async()=>{store.close();store=await openSession({directory,leaseMs:1000});token=undefined;},resume:controls=>run(options(result.runId,controls)),history:()=>inspectChildExecutions({store,parentRunId:result.runId,...selection})};
}
test('30.async spawn returns identity, inspect delivers originals, final drains, cold history uses receipts',async t=>{
 const h=await harness(t,{main:({messages})=>{const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!values.length)return spawn('spawn');if(!values.at(-1).child)return call('inspect-'+values.length,'inspect_child',{childRunId:values[0].childControl.childRunId,waitMs:1000});return{kind:'final',text:'Observed original derived answer.'};},child:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'Original evidence inspected.'}:call('page','read_page',{documentId:'atlas-a',page:1})});
 assert.equal(h.result.status,'completed',h.result.code);assert.equal(h.childCalls,2);const history=await h.history();assert.equal(history.items[0].consumption,'consumed');assert.ok(history.items[0].result.sources.length);
 const count=h.mainCalls;await h.restart();assert.equal((await h.resume()).status,'completed');assert.equal(h.mainCalls,count);assert.equal(h.childCalls,2);assert.deepEqual(await h.history(),history);
});
test('30.async historical running observation stays valid after Child completion',async t=>{
 let release;const gate=new Promise(r=>release=r);
 const h=await harness(t,{child:async()=>{await gate;return{kind:'final',text:'Later completed.'};},main:({messages})=>{const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!values.length)return spawn('spawn');if(values.length===1)return call('running','inspect_child',{childRunId:values[0].childControl.childRunId});if(values.length===2){assert.equal(values[1].childControl.status,'active');release();return call('finished','inspect_child',{childRunId:values[0].childControl.childRunId,waitMs:1000});}return{kind:'final',text:'Observed both original states.'};}});
 assert.equal(h.result.status,'completed',h.result.code);const old=h.store.childOperation(h.result.runId,'running');assert.equal(old.value.childControl.status,'active');
 await h.restart();assert.equal((await h.resume()).status,'completed');assert.deepEqual(h.store.childOperation(h.result.runId,'running'),old);assert.equal(h.childCalls,1);
});
test('30.async two Children run independently; cancel A retains unknown and permits B result',async t=>{
 let release;const gate=new Promise(r=>release=r);let n=0,started;const childStarted=new Promise(r=>started=r);
 const h=await harness(t,{child:async()=>{if(++n===1){started();await gate;}return{kind:'final',text:'Original child result.'};},main:async({messages})=>{const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!values.length)return spawn('a');if(values.length===1){await childStarted;return spawn('b');}if(values.length===2)return call('cancel-a','cancel_child',{childRunId:values[0].childControl.childRunId});if(values.length===3){assert.equal(values[2].childControl.status,'cancelled');assert.equal(values[2].childControl.remoteTerminationConfirmed,false);release();return call('inspect-b','inspect_child',{childRunId:values[1].childControl.childRunId,waitMs:1000});}return{kind:'final',text:'A cancelled, B inspected.'};}});
 assert.equal(h.result.status,'completed',h.result.code);assert.equal(h.childCalls,2);const rows=h.store.listChildren(h.result.runId);assert.equal(rows.filter(r=>r.status==='cancelled').length,1);assert.equal(rows.filter(r=>r.status==='completed').length,1);assert.equal(rows.find(r=>r.status==='cancelled').snapshot.gatewayOutcome,'unknown');
 const receipt=h.store.childOperation(h.result.runId,'cancel-a');assert.deepEqual(receipt.value.sources,[]);assert.equal(receipt.value.child,undefined);await h.restart();assert.equal((await h.resume()).status,'completed');assert.equal(h.childCalls,2);
});
test('30.async final drains admitted Child before closing Root',async t=>{
 const h=await harness(t,{child:async()=>{await new Promise(r=>setTimeout(r,50));return{kind:'final',text:'Done.'};},main:({messages})=>messages.some(m=>m.role==='tool')?{kind:'final',text:'No need to incorporate Child output.'}:spawn('a')});
 assert.equal(h.result.status,'completed',h.result.code);assert.equal(h.store.listChildren(h.result.runId)[0].status,'completed');assert.equal(h.childCalls,1);
});
test('30.async Main and Child compete for one remaining Root reservation without refund',async t=>{
 const h=await harness(t,{rootLimits:{model:2,tool:10},main:()=>spawn('a')});assert.equal(h.result.status,'failed');assert.equal(h.result.rootUsage.model,2);assert.ok(h.mainCalls+h.childCalls<=2);assert.equal(h.store.listChildren(h.result.runId).some(r=>r.status==='active'),false);
});
for(const phase of ['result-committed','result-consumed'])test('30.async spawn '+phase+' Host stop restores same identity without unknown replay',async t=>{
 const stop=new AbortController();let rootId,stopped=false,started;const childStarted=new Promise(r=>started=r);
 const h=await harness(t,{hostSignal:stop.signal,child:({signal})=>new Promise((resolve,reject)=>{started();signal.addEventListener('abort',()=>reject(signal.reason),{once:true});if(signal.aborted)reject(signal.reason);}),main:({messages})=>{const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!values.length)return spawn('a');if(values.length===1)return call('inspect','inspect_child',{childRunId:values[0].childControl.childRunId,waitMs:1000});return{kind:'final',text:'Unknown preserved, no replay.'};},onCheckpoint:async e=>{rootId??=e.runId;if(!stopped&&e.runId===rootId&&e.phase===phase){stopped=true;await childStarted;stop.abort();}}});
 assert.equal(h.result.status,'interrupted',h.result.code);const original=h.store.listChildren(h.result.runId)[0],calls=h.childCalls;await h.restart();const out=await h.resume();assert.equal(out.status,'completed',out.code);assert.equal(h.store.listChildren(h.result.runId)[0].runId,original.runId);assert.equal(h.childCalls,calls);assert.equal(h.store.childOperation(h.result.runId,'inspect').value.childControl.gatewayOutcome,'unknown');
});
test('30.async already stopped Host before owner admission preserves interruption',async t=>{
 const stop=new AbortController();stop.abort();const h=await harness(t,{hostSignal:stop.signal,main:()=>{throw Error('must not dispatch');}});
 assert.equal(h.result.status,'interrupted');assert.equal(h.mainCalls,0);assert.equal(h.childCalls,0);assert.equal(h.store.listChildren(h.result.runId).length,0);
});
test('30.async noncooperative Child preserves unstopped effect and unknown debit',async t=>{
 const stop=new AbortController();let started;const childStarted=new Promise(r=>started=r);let rootId;
 const h=await harness(t,{hostSignal:stop.signal,child:()=>{started();return new Promise(()=>{});},main:()=>spawn('a'),onCheckpoint:async e=>{rootId??=e.runId;if(e.runId===rootId&&e.phase==='result-consumed'){await childStarted;stop.abort();}}});
 assert.equal(h.result.status,'interrupted');assert.equal(h.result.interruption.effectsStopped,false);assert.equal(h.childCalls,1);assert.equal(h.store.listChildren(h.result.runId)[0].snapshot.gatewayOutcome,'unknown');assert.ok(h.result.rootUsage.model>=2);
});
