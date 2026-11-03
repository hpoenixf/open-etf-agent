import {readTimeline} from '../src/observe.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';import {openSession} from '../src/session.mjs';import {createToolHost} from '../src/tools.mjs';
import {decideRunControl,validateControlObservations,controlErrorCode} from '../src/run-control.mjs';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'control',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
async function fixture(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/run-control-'));}
test('one decision owner preserves primary cancellation/unknown and rejects success when required readback fails',()=>{
 assert.equal(controlErrorCode({code:'provider-rate-limit'}),'provider-rate-limit');assert.equal(controlErrorCode({code:42}),'EXECUTION_FAILED');
 for(const status of ['failed','cancelled'])assert.equal(decideRunControl({kind:'secondary-failure',code:'RESULT_READBACK_FAILED',required:true},{status}).reason,'PRIMARY_CAUSE_PRESERVED');
 assert.equal(decideRunControl({kind:'secondary-failure',code:'RESULT_READBACK_FAILED',required:true},{status:'completed'}).action,'stop');
 assert.equal(decideRunControl({kind:'sealed-final',reportPresent:true},{unknown:true}).reason,'OUTCOME_UNKNOWN');
 assert.equal(decideRunControl({kind:'sealed-final',reportPresent:false},{requireReport:true}).reason,'REPORT_REQUIRED');
 assert.equal(decideRunControl({kind:'tool-result',succeeded:false,dispatched:true,correctionProved:false},{}).reason,'TOOL_FAILED');
 assert.throws(()=>validateControlObservations({controlObservations:[{owner:'plugin',code:'OK',runId:'a',status:'unconfirmed'}]}),/INVALID_CONTROL/);
});
for(const repeat of [false,true])test('original report input refusal is paired and bounded; '+(repeat?'second refusal stops':'correction saves once and cold terminal does not replay'),async()=>{
 const directory=await fixture(),store=await openSession({directory});let calls=0,source;
 const options={question:'Original source report.',outputRoot:join(directory,'outputs'),requireReport:true,publication:true,limits:{maxRounds:6,maxTools:5,timeoutMs:30000},durable:{store,grantId:'control-grant',bindings},gateway:{mode:'fixture',async next({messages}){
  calls++;if(calls===1)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};
  source=messages.find(m=>m.callId==='read')?.result.value.sourceId;
  if(calls===2||repeat&&calls===3)return{kind:'calls',calls:[{id:'bad-'+calls,name:'save_report',arguments:{text:'',sourceIds:[source]}}]};
  if(calls===3)return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'Original observation [1]',sourceIds:[source]}}]};
  return{kind:'final',text:'Saved.'};
 }}};
 try{const outcome=await run(options);assert.equal(outcome.code,repeat?'CORRECTION_LIMIT':null);assert.equal(outcome.status,repeat?'failed':'completed');assert.equal(outcome.rootUsage.tool,repeat?1:2);assert.equal(outcome.rootUsage.model,repeat?3:4);const timeline=await readTimeline(outcome.directory);assert.equal(timeline.entries.filter(e=>e.type==='validation_correction_offered').length,1);const saved=store.inspect(outcome.runId);assert.equal(saved.snapshot.corrections,1);assert.equal(saved.snapshot.messages.filter(m=>m.result?.validation?.schemaVersion==='builtin-report-input-validation@1').length,repeat?2:1);
 const before=calls;const again=await run({...options,durable:{...options.durable,runId:outcome.runId}});assert.equal(again.status,outcome.status);assert.equal(calls,before);
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});
test('Host alone proves pure refusal; altered identity, foreign tool, permission and plugin error cannot mint retry',async()=>{
 const directory=await fixture();try{const host=await createToolHost({directory});const call={id:'bad',name:'save_report',arguments:{text:'',sourceIds:['original']}};const result=await host.execute(call);assert.equal(host.correctionEligible(call,result),true);assert.equal(host.snapshot().saveAttempted,false);
 for(const mutate of [r=>r.validation.requestHash='0'.repeat(64),r=>r.validation.code='REPORT_SOURCE_IDS_INVALID',r=>r.callId='other',r=>r.dispatched=true,r=>r.partialPaths=['report.md']]){const forged=structuredClone(result);mutate(forged);await assert.rejects(host.verifyResult(call,forged),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');}
 const unstable=await host.execute({id:'unstable',name:'save_report',arguments:{text:'x',sourceIds:undefined}});assert.equal(unstable.validation,undefined);assert.equal(host.correctionEligible({id:'unstable',name:'save_report',arguments:{text:'x',sourceIds:undefined}},unstable),false);
 const restricted=await createToolHost({directory,allowedTools:['read_page']});const denied=await restricted.execute(call);assert.equal(restricted.correctionEligible(call,denied),false);
 const plugin=await createToolHost({directory,extensions:[{name:'fake',description:'Synthetic refusal',parameters:{type:'object'},validate(){throw Object.assign(new Error('REPORT_TEXT_INVALID'),{code:'REPORT_TEXT_INVALID'});},execute(){throw new Error('must not execute');}}]});const rejected=await plugin.execute({id:'fake',name:'fake',arguments:{}});assert.equal(plugin.correctionEligible({id:'fake',name:'fake',arguments:{}},rejected),false);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('original acquired source identity wins over reference-shaped spelling',async()=>{
 const directory=await fixture();try{
  const {sha256}=await import('../src/source.mjs');const text='Original acquired fact: 8 units.';const source={sourceId:'result:sha256:'+'a'.repeat(64),documentId:'custom',name:'actual.txt',version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
  const host=await createToolHost({directory,extensions:[{name:'read_custom',description:'Original source',parameters:{type:'object'},sourceResult:true,validate(args){assert.deepEqual(args,{});},execute(){return source;}}]});
  const acquired=await host.execute({id:'acquire',name:'read_custom',arguments:{}});assert.equal(acquired.status,'succeeded');
  const saved=await host.execute({id:'save',name:'save_report',arguments:{text:'Original fact [1].',sourceIds:[source.sourceId]}});assert.equal(saved.status,'succeeded');assert.ok(host.receipt);
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('user cancellation during asynchronous release stays visible to final owner',async()=>{
 const directory=await fixture(),store=await openSession({directory});const abort=new AbortController();const {createHookChain}=await import('../src/hooks.mjs');
 try{const result=await run({question:'A final answer.',outputRoot:join(directory,'outputs'),signal:abort.signal,gateway:{mode:'fixture',async next(){return{kind:'final',text:'Known answer.'};}},hooks:createHookChain({release:[async()=>{await Promise.resolve();abort.abort();}]}),durable:{store,grantId:'release-cancel',bindings:{...bindings,adapters:[]}},limits:{maxRounds:2,maxTools:2,timeoutMs:30000}});assert.equal(result.status,'cancelled');assert.equal(result.code,'CANCELLED');assert.equal(store.inspect(result.runId).status,'cancelled');const timeline=await readTimeline(result.directory);const proposed=timeline.entries.find(e=>e.type==='run_finished');assert.equal(proposed.status,'completed');assert.equal(proposed.settlementPhase,'pre-settlement');assert.equal(proposed.terminalAuthority,'Session.finish');
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

for(const thrown of [null,undefined,{code:'CANCELLED'},{get code(){throw new Error('untrusted accessor');}}])test('untrusted Gateway throw retains unknown and cannot claim user cancellation: '+String(thrown),async()=>{
 const directory=await fixture(),store=await openSession({directory});let calls=0;
 const options={question:'Unknown dispatch.',outputRoot:join(directory,'outputs'),gateway:{mode:'fixture',async next(){calls++;throw thrown;}},durable:{store,grantId:'unknown-grant',bindings:{...bindings,adapters:[]}},limits:{maxRounds:3,maxTools:3,timeoutMs:30000}};
 try{const result=await run(options);assert.equal(result.status,'failed');assert.equal(result.code,'EXECUTION_FAILED');assert.equal(result.gatewayOutcome,'unknown');assert.equal(result.rootUsage.model,1);const saved=store.inspect(result.runId);assert.equal(saved.status,'failed');assert.equal(saved.snapshot.gatewayOutcome,'unknown');const repeated=await run({...options,durable:{...options.durable,runId:result.runId}});assert.equal(repeated.gatewayOutcome,'unknown');assert.equal(calls,1);assert.equal(store.inspect(result.runId).rootUsage.model,1);
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});
test('ordinary release observer throw cannot veto Run completion',async()=>{
 const directory=await fixture(),store=await openSession({directory});const {createHookChain}=await import('../src/hooks.mjs');const original=createHookChain();
 try{const result=await run({question:'Final answer.',outputRoot:join(directory,'outputs'),gateway:{mode:'fixture',async next(){return{kind:'final',text:'Known answer.'};}},hooks:{...original,async observe(phase,...args){if(phase==='release')throw null;return original.observe(phase,...args);}},durable:{store,grantId:'release-observer',bindings:{...bindings,adapters:[]}},limits:{maxRounds:2,maxTools:2,timeoutMs:30000}});assert.equal(result.status,'completed');assert.equal(store.inspect(result.runId).status,'completed');assert.equal(result.controlObservations[0].owner,'hook-release');assert.equal(result.controlObservations[0].code,'HOOK_RELEASE_FAILED');
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('reference-shaped original source crosses Runtime, report, durable terminal and cold read',async()=>{
 const directory=await fixture(),store=await openSession({directory});const {sha256}=await import('../src/source.mjs');let calls=0;const text='Original 8 units.';const source={sourceId:'result:sha256:'+'b'.repeat(64),documentId:'own',name:'own.txt',version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};
 const options={question:'Use original source.',outputRoot:join(directory,'outputs'),requireReport:true,publication:true,extensions:[{name:'read_custom',description:'Original source',parameters:{type:'object'},sourceResult:true,validate(args){assert.deepEqual(args,{});},execute(){return source;}}],gateway:{mode:'fixture',async next(){calls++;return calls===1?{kind:'calls',calls:[{id:'read',name:'read_custom',arguments:{}}]}:calls===2?{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'Original [1].',sourceIds:[source.sourceId]}}]}:{kind:'final',text:'Saved.'};}},durable:{store,grantId:'ref-source',bindings},limits:{maxRounds:4,maxTools:3,timeoutMs:30000}};
 try{const result=await run(options);assert.equal(result.status,'completed');assert.equal(result.rootUsage.tool,2);const again=await run({...options,durable:{...options.durable,runId:result.runId}});assert.equal(again.receipt.sha256,result.receipt.sha256);assert.equal(calls,3);}finally{store.close();await rm(directory,{recursive:true,force:true});}
});
test('non-JSON pure report refusal does not mint correction and remains a cold terminal fact',async()=>{
 const directory=await fixture(),store=await openSession({directory});let calls=0;
 const options={question:'Malformed arguments.',outputRoot:join(directory,'outputs'),gateway:{mode:'fixture',async next(){calls++;return{kind:'calls',calls:[{id:'bad',name:'save_report',arguments:{text:'x',sourceIds:undefined}}]};}},durable:{store,grantId:'json-refusal',bindings:{...bindings,adapters:[]}},limits:{maxRounds:3,maxTools:3,timeoutMs:30000}};
 try{const result=await run(options);assert.equal(result.code,'INVALID_JSON');assert.equal(store.inspect(result.runId).status,'failed');assert.equal(result.rootUsage.tool,0);const again=await run({...options,durable:{...options.durable,runId:result.runId}});assert.equal(again.code,result.code);assert.equal(calls,1);}finally{store.close();await rm(directory,{recursive:true,force:true});}
});
for(const phase of ['result-committed','result-consumed'])test('report correction at '+phase+' restores exact original proof with a fresh Session connection',async()=>{
 const directory=await fixture();let store=await openSession({directory});const stop=new AbortController();let calls=0;
 const gateway={mode:'fixture',async next({messages}){calls++;const read=messages.find(m=>m.callId==='read');if(!read)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};if(!messages.some(m=>m.callId==='bad'))return{kind:'calls',calls:[{id:'bad',name:'save_report',arguments:{text:'',sourceIds:[read.result.value.sourceId]}}]};if(!messages.some(m=>m.callId==='save'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'Original [1].',sourceIds:[read.result.value.sourceId]}}]};return{kind:'final',text:'Saved.'};}};
 const options={question:'Cold correction.',outputRoot:join(directory,'outputs'),requireReport:true,publication:true,gateway,limits:{maxRounds:6,maxTools:4,timeoutMs:30000},durable:{store,grantId:'cold-correction',bindings,async onCheckpoint(e){if(e.phase===phase){const s=store.inspect(e.runId).snapshot;if(s.proposal?.calls?.[0]?.id==='bad')stop.abort();}}},hostSignal:stop.signal};
 try{const first=await run(options);assert.equal(first.status,'interrupted');assert.equal(first.interruption.effectsStopped,true);assert.equal(calls,2);store.close();store=await openSession({directory});const resumed=await run({...options,hostSignal:undefined,durable:{store,grantId:'cold-correction',bindings,runId:first.runId}});assert.equal(resumed.status,'completed');assert.equal(resumed.runId,first.runId);assert.equal(calls,4);assert.equal(resumed.rootUsage.model,4);assert.equal(resumed.rootUsage.tool,2);assert.equal(store.inspect(first.runId).snapshot.corrections,1);}finally{store.close();await rm(directory,{recursive:true,force:true});}
});
