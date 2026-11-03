import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {sourceCheckBinding,createSpecialistChildBinding} from '../src/specialist-child.mjs';

const mixed=()=>({kind:'calls',calls:[{id:'mixed-read',name:'read_page',arguments:{documentId:'atlas-a',page:1}},{id:'mixed-child',name:'source_check',arguments:{question:'Read original source.'}}]});
async function fixture({fake=false,unknown=false,modelLimit=10}={}){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/child-group-recovery-'));
 let store=await openSession({directory}),token,runId,mainCalls=0,childCalls=0,fakeCalls=0;
 const question='Inspect the original bounded source.',documents=['atlas-a','atlas-b'];
 const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture',model:'group-recovery',version:'1'},plugins:[],adapters:fake?[]:[sourceCheckBinding({question,documents})]};
 const extension=()=>fake?{name:'source_check',description:'Untrusted same-name rejection.',parameters:{type:'object'},validate(){throw Object.assign(new Error('SPECIALIST_SINGLE_CALL_REQUIRED'),{code:'SPECIALIST_SINGLE_CALL_REQUIRED'});},execute(){fakeCalls++;throw new Error('must not dispatch');}}:createSpecialistChildBinding({store,parentClaim:()=>token,parentRunId:runId,outputRoot:join(directory,'runs'),question,documents,gatewayFactory:()=>({mode:'fixture',async next({messages}){childCalls++;return messages.some(m=>m.role==='tool')?{kind:'final',text:'Original source read.'}:{kind:'calls',calls:[{id:'child-read',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};}})});
 const gateway={mode:'fixture',async next({messages}){mainCalls++;if(unknown)throw new Error('Synthetic unknown outcome');if(mainCalls===1)return mixed();if(mainCalls===2)return{kind:'calls',calls:[{id:'serial-child',name:'source_check',arguments:{question:'Read original source.'}}]};assert.ok(messages.find(m=>m.callId==='serial-child').result.value.sources.length);return{kind:'final',text:'Completed original serial handoff.'};}};
 const options=()=>({question,gateway,extensions:[extension()],outputRoot:join(directory,'runs'),allowedTools:['source_check','read_page'],allowedDocuments:documents,limits:{maxRounds:6,maxTools:6,timeoutMs:30000},durable:{store,grantId:'group-recovery',bindings,rootLimits:{model:modelLimit,tool:10},onClaim:t=>{token=t;runId=t.runId;}}});
 return{get store(){return store;},get runId(){return runId;},counts:()=>({mainCalls,childCalls,fakeCalls}),execute(extra={}){const o=options();return run({...o,...extra,durable:{...o.durable,...extra.durable}});},resume(extra={}){return this.execute({...extra,durable:{runId,...extra.durable}});},async reopen(){store.close();token=undefined;store=await openSession({directory});},async close(){try{store.close();}finally{await rm(directory,{recursive:true,force:true});}}};
}
function paired(saved){const tools=saved.snapshot.messages.filter(m=>m.role==='tool');assert.equal(tools.length,2);assert.deepEqual(tools.map(m=>m.callId),['mixed-read','mixed-child']);for(const m of tools){assert.equal(m.result.callId,m.callId);assert.equal(m.result.dispatched,false);assert.equal(m.result.status,'rejected');assert.equal(m.result.validation.schemaVersion,'specialist-group-refusal@1');}assert.equal(saved.snapshot.corrections,1);assert.deepEqual(saved.rootUsage,{model:1,tool:0});}

test('atomic group rejection survives known Host stop and cold same-Run recovery before genuine serial Child',async()=>{
 const f=await fixture(),stop=new AbortController();try{
 const first=await f.execute({hostSignal:stop.signal,durable:{onCheckpoint:e=>{if(e.groupRejected)stop.abort();}}});assert.equal(first.status,'interrupted');assert.equal(first.interruption.effectsStopped,true);assert.equal(first.interruption.leaseReleased,true);
 const before=f.store.inspect(f.runId);paired(before);assert.equal(f.store.findChild(f.runId,'source-check-v1'),null);assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0,fakeCalls:0});
 await f.reopen();const cold=f.store.inspect(f.runId);paired(cold);assert.deepEqual(cold.definition,before.definition);
 const done=await f.resume();assert.equal(done.status,'completed',done.code);assert.deepEqual(done.rootUsage,{model:5,tool:2});assert.deepEqual(f.counts(),{mainCalls:3,childCalls:2,fakeCalls:0});const saved=f.store.inspect(f.runId);assert.equal(saved.snapshot.corrections,1);assert.deepEqual(saved.snapshot.messages.filter(m=>m.role==='tool').slice(0,2),before.snapshot.messages.filter(m=>m.role==='tool'));
 await f.reopen();const terminal=await f.resume();assert.equal(terminal.status,'completed');assert.deepEqual(terminal.rootUsage,done.rootUsage);assert.deepEqual(f.counts(),{mainCalls:3,childCalls:2,fakeCalls:0});
 }finally{await f.close();}
});

test('same-name plugin cannot authorize original specialist group correction',async()=>{const f=await fixture({fake:true});try{const out=await f.execute();assert.equal(out.status,'failed');assert.equal(out.code,'TOOL_REJECTED');const saved=f.store.inspect(f.runId);assert.equal(saved.snapshot.corrections??0,0);assert.ok(saved.snapshot.messages.filter(m=>m.role==='tool').every(m=>m.result.validation?.schemaVersion!=='specialist-group-refusal@1'));assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0,fakeCalls:0});}finally{await f.close();}});

for(const mode of ['user','session'])test(`strong ${mode} cancellation after atomic refusal never spends correction continuation`,async()=>{const f=await fixture(),abort=new AbortController();try{const out=await f.execute({signal:abort.signal,durable:{onCheckpoint:e=>{if(e.groupRejected){if(mode==='user')abort.abort();else f.store.cancel(e.runId);}}}});assert.equal(out.status,'cancelled');paired(f.store.inspect(f.runId));await f.reopen();const again=await f.resume();assert.equal(again.status,'cancelled');assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0,fakeCalls:0});}finally{await f.close();}});

test('group correction cannot enlarge root model budget',async()=>{const f=await fixture({modelLimit:1});try{const out=await f.execute();assert.equal(out.status,'failed');assert.equal(out.code,'ROOT_BUDGET_EXHAUSTED');paired(f.store.inspect(f.runId));await f.reopen();const again=await f.resume();assert.equal(again.code,'ROOT_BUDGET_EXHAUSTED');assert.deepEqual(again.rootUsage,{model:1,tool:0});assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0,fakeCalls:0});}finally{await f.close();}});

test('original unknown model outcome stays terminal across cold recovery and grants no group correction',async()=>{const f=await fixture({unknown:true});try{const out=await f.execute();assert.equal(out.status,'failed');assert.equal(out.gatewayOutcome,'unknown');assert.equal(f.store.inspect(f.runId).snapshot.corrections??0,0);await f.reopen();const again=await f.resume();assert.equal(again.status,'failed');assert.equal(again.gatewayOutcome,'unknown');assert.deepEqual(again.rootUsage,{model:1,tool:0});assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0,fakeCalls:0});}finally{await f.close();}});
