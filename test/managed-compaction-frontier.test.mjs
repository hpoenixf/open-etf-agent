import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,rm} from 'node:fs/promises';import {join,resolve} from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {openSession} from '../src/session.mjs';import {createSharedAdmission} from '../src/admission.mjs';import {run,submitRun} from '../src/runtime.mjs';import {readTimeline} from '../src/observe.mjs';
const encodedMeasure=({messages,tools})=>Buffer.byteLength(JSON.stringify({messages,tools,header:'x'.repeat(10000)}));
const bindings={gateway:{mode:'live',provider:'offline-fixture',protocol:'chat-completions',model:'synthetic',version:'1'},plugins:[],adapters:[]};
async function fixture(mode='normal',{pressureMode,encoded,threshold=1000,model=10,maxSummaryRounds=1,encodedMax=64000}={}){
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/managed-frontier-'));let store=await openSession({directory:join(root,'session'),leaseMs:30000});const admission=await createSharedAdmission({directory:join(root,'capacity'),routeId:'frontier-fixture',pollMs:1,queueTimeoutMs:5000});let main=0,summary=0;const seen=[],views=[],wireSizes=[];const cancel=new AbortController();let entered,releaseLate;const summaryEntered=new Promise(r=>{entered=r;}),lateRelease=new Promise(r=>{releaseLate=r;});
 const raw={mode:'live',...(encoded?{inputBudget:{maxBytes:encodedMax,measure:encoded}}:{}),async next(input){seen.push({...input.reservation});if(input.reservation.purpose==='compaction'){summary++;assert.deepEqual(input.tools,[]);if(mode==='no-gain')return{kind:'final',text:'X'.repeat(4096)};if(mode==='unknown')throw Error('synthetic unknown');if(mode==='late'){entered();await new Promise(r=>{if(input.signal.aborted)r();else input.signal.addEventListener('abort',r,{once:true});});await lateRelease;}if(mode==='cancel'){cancel.abort();await lateRelease;}return{kind:'final',text:'Derived bounded evidence summary. Original records remain authoritative.'};}main++;views.push(input.messages);wireSizes.push(encoded?.(input));if(mode==='reread'&&main===3){const note=input.messages.find(m=>m.result?.value?.kind==='derived-working-note').result.value;return{kind:'calls',calls:[{id:'original-reread',name:'read_result',arguments:{resultRef:note.sourceRefs[0].resultRef}}]};}if(mode==='reread'&&main===4)return{kind:'final',text:'Exact original checked.'};if(mode==='no-gain'&&main>=2&&main<=4)return{kind:'calls',calls:[{id:'calc-'+main,name:'calculate_change',arguments:{baseline:1,current:2,baselineUnit:'units',currentUnit:'units'}}]};if(main<=(model===3?2:4))return{kind:'calls',calls:[{id:'read-'+main,name:'read_page',arguments:{documentId:'evidence',page:main<=2?1:2}}]};return{kind:'final',text:'Original evidence read; synthetic task completed.'};}};
 const options=()=>({question:'Read original synthetic evidence and then conclude.',gateway:admission.wrap(raw,{session:store,runId:'frontier-root'}),outputRoot:join(root,'runs'),documentCatalog:{schemaVersion:'document-catalog@1',id:'frontier-docs',documents:[{id:'evidence',name:'Synthetic frontier evidence',version:'v1',pages:['First original source. '.repeat(180),'Second original source. '.repeat(180)]}]},contextBytes:32000,workingInput:{compaction:{mode:'gateway',thresholdBytes:threshold,summaryTimeoutMs:mode==='late'?10:5000,maxSummaryRounds,...(pressureMode?{pressureMode}:{})}},limits:{maxRounds:8,maxTools:8,timeoutMs:30000},signal:cancel.signal,durable:{store,runId:'frontier-root',grantId:'synthetic',bindings,rootLimits:{model,tool:8}}});
 return{root,options,admission,seen,views,wireSizes,summaryEntered,releaseLate,counts:()=>({main,summary}),get store(){return store;},async reopen(){store.close();store=await openSession({directory:join(root,'session'),leaseMs:30000});},async close(){admission.close();store.close();await rm(root,{recursive:true,force:true});}};
}
for(const resume of [false,true])test(`bounded managed summary retains adopted frontier; cold resume=${resume}`,async()=>{const f=await fixture();try{await submitRun(f.options());let outcome;if(resume){const stop=new AbortController(),o=f.options();outcome=await run({...o,hostSignal:stop.signal,durable:{...o.durable,onCheckpoint({phase}){if(phase==='proposal-sealed'&&f.counts().main===3)stop.abort();}}});assert.equal(outcome.status,'interrupted',outcome.code);assert.equal(f.counts().summary,1);const state=f.store.inspect('frontier-root').snapshot;assert.equal(state.compactionState.summaryAttempts,1);assert.ok(state.compactionState.frontier);await f.reopen();}outcome=await run(f.options());assert.equal(outcome.status,'completed',outcome.code);assert.deepEqual(f.counts(),{main:5,summary:1});assert.equal(f.seen.length,6);assert.equal(f.store.inspect('frontier-root').rootUsage.model,6);assert.ok(f.admission.snapshot().requests.every(t=>t.state==='completed'));assert.ok(f.views.slice(2).every(messages=>messages.some(m=>m.result?.value?.kind==='derived-working-note')));const before=f.seen.length;await run(f.options());assert.equal(f.seen.length,before);}finally{await f.close();}});
for(const mode of ['unknown','late','cancel'])for(const encoded of [undefined,encodedMeasure])test(`summary ${mode} cannot adopt frontier or replay; encoded=${Boolean(encoded)}`,async(t)=>{const f=await fixture(mode,encoded?{pressureMode:'encoded-request@1',encoded}:{});try{await submitRun(f.options());if(mode==='late')t.mock.timers.enable({apis:['setTimeout']});const running=run(f.options());if(mode==='late'){await f.summaryEntered;t.mock.timers.tick(10);}const outcome=await running;assert.notEqual(outcome.status,'completed');f.releaseLate();await nextTurn();assert.deepEqual(f.counts(),{main:2,summary:1});const state=f.store.inspect('frontier-root');assert.equal(state.snapshot.compactionState.summaryAttempts,1);assert.equal(state.snapshot.compactionState.frontier,null);assert.equal(state.rootUsage.model,3);const before=f.seen.length;await f.reopen();await run(f.options());assert.equal(f.seen.length,before);assert.equal(f.store.inspect('frontier-root').snapshot.compactionState.frontier,null);assert.equal(f.admission.snapshot().requests.at(-1).state,'unknown');}finally{f.releaseLate();if(mode==='late')t.mock.timers.reset();await f.close();}});
for(const kind of ['attempts','frontier'])test(`tampered compaction ${kind} rejects before new request`,async()=>{const f=await fixture();try{await submitRun(f.options());const stop=new AbortController(),o=f.options();await run({...o,hostSignal:stop.signal,durable:{...o.durable,onCheckpoint({phase}){if(phase==='proposal-sealed'&&f.counts().main===3)stop.abort();}}});const db=new DatabaseSync(join(f.root,'session/session.sqlite'));try{const s=JSON.parse(db.prepare('SELECT snapshot FROM runs WHERE run_id=?').get('frontier-root').snapshot);if(kind==='attempts')s.compactionState.summaryAttempts=2;else s.compactionState.frontier.messageCount=s.messages.length+99;db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(JSON.stringify(s),'frontier-root');}finally{db.close();}const before=f.seen.length;await assert.rejects(run(f.options()),error=>error.code==='INVALID_COMPACTION_STATE');assert.equal(f.seen.length,before);}finally{await f.close();}});


for(const [label,encoded,threshold,model,expects] of [
 ['known encoded overhead',encodedMeasure,10000,10,1],
 ['below encoded threshold',encodedMeasure,55000,10,0],
 ['unknown measurement',undefined,1000,10,0],
 ['last shared reservation',encodedMeasure,10000,3,0]
])test(`encoded compaction pressure: ${label}`,async()=>{const f=await fixture('normal',{pressureMode:'encoded-request@1',encoded,threshold,model});try{await submitRun(f.options());const view=f.store.inspect('frontier-root');assert.equal(view.definition.config.workingInput.compaction.version,'gateway-history-compaction@3');const outcome=await run(f.options());assert.equal(outcome.status,'completed',outcome.code);assert.deepEqual(f.counts(),{main:model===3?3:5,summary:expects});}finally{await f.close();}});

test('encoded no-gain receipt survives reopening the worker without another summary dispatch',async()=>{const f=await fixture('no-gain',{pressureMode:'encoded-request@1',encoded:encodedMeasure,maxSummaryRounds:4});try{
 await submitRun(f.options());const stop=new AbortController(),o=f.options();
 const interrupted=await run({...o,hostSignal:stop.signal,durable:{...o.durable,onCheckpoint({phase}){if(phase==='proposal-sealed'&&f.counts().main===3)stop.abort();}}});
 assert.equal(interrupted.status,'interrupted',interrupted.code);
 const persisted=f.store.inspect('frontier-root').snapshot.compactionState;
 assert.match(persisted.noGainHash,/^[a-f0-9]{64}$/);assert.equal(persisted.summaryAttempts,1);assert.equal(persisted.frontier,null);
 await f.reopen();const outcome=await run(f.options());assert.equal(outcome.status,'completed',outcome.code);assert.deepEqual(f.counts(),{main:5,summary:1});
 const timeline=await readTimeline(outcome.directory);
 assert.ok(timeline.entries.some(e=>e.type==='compaction_pressure'&&e.status==='pressured'&&e.requestBytes>10000));
 assert.ok(timeline.entries.some(e=>e.type==='working_note'&&e.status==='unchanged-no-net-saving'));
 assert.ok(timeline.entries.some(e=>e.type==='summary_proposal'&&e.kind==='final'));
}finally{await f.close();}});

test('same input under different size tool schemas yields different pressure; a saving can still exceed the soft target',async()=>{
 const measure=pad=>({messages,tools})=>Buffer.byteLength(JSON.stringify({messages,tools:tools.map((tool,i)=>i?tool:{...tool,description:'x'.repeat(pad)})}));
 const small=await fixture('normal',{pressureMode:'encoded-request@1',encoded:measure(0),threshold:40000,maxSummaryRounds:1,encodedMax:1048576});
 const large=await fixture('normal',{pressureMode:'encoded-request@1',encoded:measure(42000),threshold:40000,maxSummaryRounds:1,encodedMax:1048576});
 try{
  const outcomes=[];
  for(const f of [small,large]){await submitRun(f.options());outcomes.push(await run(f.options()));}
  assert.ok(outcomes.every(o=>o.status==='completed'));
  assert.deepEqual(small.views[0],large.views[0]);
  assert.deepEqual(small.counts(),{main:5,summary:0});assert.deepEqual(large.counts(),{main:5,summary:1});
  const [before,after]=await Promise.all(outcomes.map(o=>readTimeline(o.directory)));
  const pressure=timeline=>timeline.entries.filter(e=>e.type==='compaction_pressure');
  assert.ok(pressure(before).every(e=>e.status==='under-threshold'));
  assert.ok(pressure(after).every(e=>e.status==='pressured'));
  assert.ok(after.entries.some(e=>e.type==='working_note'&&e.status==='applied'));
  assert.ok(large.views[2].some(m=>m.result?.value?.kind==='derived-working-note'));
  assert.ok(large.wireSizes[2] < pressure(after)[2].requestBytes);assert.ok(large.wireSizes[2]>40000);
 }finally{await small.close();await large.close();}
});

test('reopened encoded frontier retains exact source identity for native A14 reread',async()=>{const f=await fixture('reread',{pressureMode:'encoded-request@1',encoded:encodedMeasure,maxSummaryRounds:1});try{
 await submitRun(f.options());const stop=new AbortController(),o=f.options();
 const interrupted=await run({...o,hostSignal:stop.signal,durable:{...o.durable,onCheckpoint({phase}){if(phase==='proposal-sealed'&&f.counts().main===3)stop.abort();}}});
 assert.equal(interrupted.status,'interrupted',interrupted.code);await f.reopen();
 const outcome=await run(f.options());assert.equal(outcome.status,'completed',outcome.code);assert.deepEqual(f.counts(),{main:4,summary:1});
 const note=f.views[2].find(m=>m.result?.value?.kind==='derived-working-note').result.value;
 const original=f.views[3].find(m=>m.callId==='original-reread').result.value;
 assert.equal(original.text,'First original source. '.repeat(180));
 for(const key of ['sourceId','documentId','version','page','sha256','resultRef'])assert.equal(original[key],note.sourceRefs[0][key]);
}finally{await f.close();}});
