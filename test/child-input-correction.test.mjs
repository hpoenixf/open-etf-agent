import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {createToolHost} from '../src/tools.mjs';
import {createHookChain} from '../src/hooks.mjs';
import {decideRunControl} from '../src/run-control.mjs';
import {readTimeline} from '../src/observe.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {childExecutionBinding,createChildExecutionBinding,childExecutionInputRefusal} from '../src/child-execution.mjs';
import {DOCUMENT_REVOCATION_PROFILE} from '../src/source.mjs';
import {initialize,options as protectedOptions} from './protected-runtime-fixture.mjs';
import {createResearchProject,submitResearchTask,workResearchTask,inspectResearchTask,readResearchReport} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
const schema='child-execution-input-validation@1';
const call=(id,name,args)=>({id,name,arguments:args}),proposal=(...calls)=>({kind:'calls',calls});
const selected={question:'Check original selected observations.',documents:['atlas-a'],execution:{schemaVersion:'child-execution@1',maxChildren:2,methods:[CLAIM_COMPARISON_METHOD]}};
const valid={methodId:'claim-comparison',question:'Check original output.',documents:['atlas-a']};
const missing={methodId:valid.methodId,question:valid.question};
const final={kind:'final',text:'Original evidence retained.'};
async function directory(t){await mkdir('test-output',{recursive:true});const d=await mkdtemp(resolve('test-output/child-input-'));t.after(()=>rm(d,{recursive:true,force:true}));return d;}
async function fixture(t,{main,requireReport=true,tools=['delegate_child','read_page','save_report'],documents=selected.documents,rootLimits={model:12,tool:10},hooks,mutate,onBinding,fake=false}={}){
 const dir=await directory(t);let store=await openSession({directory:dir,leaseMs:150}),token,runId,mainCalls=0,childCalls=0;
 t.after(()=>store.close());
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'child-input',version:'1'},plugins:[],adapters:[childExecutionBinding(selected)]};
 const childGateway=()=>({mode:'fixture',next({messages}){childCalls++;return messages.some(m=>m.role==='tool')?final:proposal(call('page','read_page',{documentId:'atlas-a',page:1}));}});
 function owner(selection=selected){return createChildExecutionBinding({store,parentRunId:runId,parentClaim:()=>token,...selection,outputRoot:join(dir,'runs'),gatewayFactory:childGateway});}
 const defaultMain=({messages})=>{const replies=messages.filter(m=>m.role==='tool');if(!replies.length)return proposal(call('bad','delegate_child',missing));if(replies.length===1)return proposal(call('fixed','delegate_child',valid));if(replies.length===2)return proposal(call('save','save_report',{text:'Original source [1].',sourceIds:replies.find(m=>m.callId==='fixed').result.value.sources.map(s=>s.sourceId)}));return final;};
 async function execute(extra={}){let binding=owner();if(fake)binding={name:'delegate_child',description:binding.description,parameters:binding.parameters,validate(){throw Object.assign(Error('CHILD_ARGUMENT_REQUIRED'),{validation:{schemaVersion:schema,repairable:true},validationCode:'CHILD_ARGUMENT_REQUIRED'});},execute(){assert.fail('fake must not dispatch');}};mutate?.(binding);onBinding?.(binding);
  return run({question:selected.question,extensions:[binding],allowedTools:tools,allowedDocuments:documents,requireReport,hooks,outputRoot:join(dir,'runs'),limits:{maxRounds:8,maxTools:8,timeoutMs:30000},gateway:{mode:'fixture',next(input){mainCalls++;return(main??defaultMain)(input,mainCalls);}},...extra,durable:{store,...(runId?{runId}:{}),grantId:'child-input-grant',bindings,rootLimits,onClaim:v=>{token=v;runId=v.runId;},...extra.durable}});
 }
 return{dir,execute,owner,get store(){return store;},get runId(){return runId;},counts:()=>({mainCalls,childCalls}),saved:()=>store.inspect(runId),async reopen(){store.close();token=undefined;store=await openSession({directory:dir,leaseMs:150});},async coldHost(overrides={}){const s=store.inspect(runId);return createToolHost({directory:s.directory,restore:s.snapshot.host,readOnly:true,extensions:[owner()],allowedTools:tools,allowedDocuments:documents,runIdentity:{runId,grantId:s.definition.grantId},...overrides});}};
}
function badPair(f){const s=f.saved().snapshot;return s.result?.callId==='bad'?s.result:s.messages.find(m=>m.callId==='bad').result;}

test('original Session missing documents is paired once, zero-debit refused, then a new call runs one actual Child and saves Report',async t=>{
 const f=await fixture(t),out=await f.execute({durable:{onCheckpoint:e=>{if(e.phase==='result-committed'&&f.saved().snapshot.proposal?.calls?.[0]?.id==='bad'){assert.deepEqual(f.saved().rootUsage,{model:1,tool:0});assert.equal(f.store.listChildren(f.runId).length,0);}}}});
 assert.equal(out.status,'completed',out.code);assert.deepEqual(out.rootUsage,{model:6,tool:3});assert.deepEqual(f.counts(),{mainCalls:4,childCalls:2});const bad=badPair(f);assert.equal(bad.status,'rejected');assert.equal(bad.dispatched,false);assert.equal(bad.validation.schemaVersion,schema);assert.equal(bad.validation.field,'documents');assert.equal(bad.error,'CHILD_ARGUMENT_REQUIRED');assert.equal(f.saved().snapshot.corrections,1);assert.equal(f.saved().snapshot.messages.filter(m=>m.callId==='bad').length,1);assert.equal(f.store.listChildren(f.runId).length,1);assert.ok(out.receipt);
 const timeline=await readTimeline(out.directory);assert.equal(timeline.entries.filter(e=>e.type==='validation_correction_offered').length,1);await f.reopen();const cold=await f.coldHost();await cold.verifyResult(call('bad','delegate_child',missing),bad);assert.equal(cold.correctionEligible(call('bad','delegate_child',missing),bad),true);const again=await f.execute();assert.equal(again.runId,out.runId);assert.equal(again.status,'completed');assert.deepEqual(f.counts(),{mainCalls:4,childCalls:2});assert.deepEqual(again.rootUsage,out.rootUsage);
});

for(const args of [missing,{methodId:valid.methodId,documents:valid.documents},{question:valid.question,documents:valid.documents},{...valid,documents:'atlas-a'},{...valid,question:4},{...valid,documents:[4]}])test('original Child pure shape is feedback without filling or parsing '+JSON.stringify(args),async t=>{
 const f=await fixture(t,{requireReport:false,main:(_input,n)=>n===1?proposal(call('bad','delegate_child',args)):final});const out=await f.execute();assert.equal(out.status,'completed',out.code);assert.equal(badPair(f).validation.schemaVersion,schema);assert.deepEqual(f.saved().snapshot.messages.find(m=>m.role==='assistant').calls[0].arguments,args);assert.deepEqual(out.rootUsage,{model:2,tool:0});assert.equal(f.store.listChildren(f.runId).length,0);
});

test('second original shape refusal uses the existing CORRECTION_LIMIT and cannot reserve a Child',async t=>{
 const f=await fixture(t,{requireReport:false,main:(_input,n)=>proposal(call(n===1?'bad':'second','delegate_child',missing))});const out=await f.execute();assert.equal(out.code,'CORRECTION_LIMIT');assert.deepEqual(out.rootUsage,{model:2,tool:0});assert.equal(f.saved().snapshot.corrections,1);assert.equal(f.saved().snapshot.messages.filter(m=>m.result?.validation?.schemaVersion===schema).length,2);assert.equal(f.store.listChildren(f.runId).length,0);await f.reopen();assert.equal((await f.execute()).code,'CORRECTION_LIMIT');assert.deepEqual(f.counts(),{mainCalls:2,childCalls:0});
});

for(const [label,args] of [['unknown method',{methodId:'foreign',question:'Check.'}],['foreign document',{...valid,question:4,documents:['foreign']}],['foreign string',{...valid,documents:'foreign'}],['expanded field',{...missing,allowedTools:['save_report']}],['too many documents',{...valid,documents:['atlas-a','atlas-a','atlas-a']}],['duplicate documents',{...valid,documents:['atlas-a','atlas-a']}],['question limit',{...missing,question:'x'.repeat(2001)}],['wrong spelling',{...missing,documentIds:['atlas-a']}]])test('Child '+label+' stays hard and cannot borrow shape authority',async t=>{
 const f=await fixture(t,{requireReport:false,main:()=>proposal(call('bad','delegate_child',args))});const out=await f.execute();assert.equal(out.code,'TOOL_REJECTED');assert.equal(badPair(f).validation,undefined);assert.deepEqual(out.rootUsage,{model:1,tool:0});assert.equal(f.store.listChildren(f.runId).length,0);
});

for(const [label,options] of [['hooks',{hooks:createHookChain()}],['same-name plugin',{fake:true}],['changed validator',{mutate:b=>{b.validate=()=>{throw Object.assign(Error('INVALID_CHILD_EXECUTION_ARGUMENTS'),{code:'INVALID_CHILD_EXECUTION_ARGUMENTS'});};}}],['changed handler',{mutate:b=>{b.execute=()=>assert.fail('must not dispatch');}}],['changed definition',{mutate:b=>{b.parameters={type:'object'};}}],['missing parent reader',{tools:['delegate_child','save_report']}],['narrowed document scope',{documents:['atlas-b']}]])test('Child input rejects '+label+' authority',async t=>{
 const f=await fixture(t,{...options,requireReport:false,main:()=>proposal(call('bad','delegate_child',missing))});const out=await f.execute();assert.equal(out.code,'TOOL_REJECTED');assert.equal(badPair(f).validation,undefined);assert.deepEqual(out.rootUsage,{model:1,tool:0});assert.equal(f.store.listChildren(f.runId).length,0);
});

test('Child proof exact cold verification rejects receipt, call, hash, owner and scope forgery',async t=>{
 const f=await fixture(t,{requireReport:false,main:(_input,n)=>n===1?proposal(call('bad','delegate_child',missing)):final});await f.execute();await f.reopen();const host=await f.coldHost(),original=call('bad','delegate_child',missing),result=badPair(f);await host.verifyResult(original,result);
 for(const change of [r=>r.callId='other',r=>r.validation.requestHash='0'.repeat(64),r=>r.validation.runId='other',r=>r.validation.rootId='other',r=>r.validation.grantId='other',r=>r.validation.ownerBinding.contentSha256='0'.repeat(64),r=>r.validation.scopeHash='0'.repeat(64),r=>r.validation.hostDefinitionsHash='0'.repeat(64),r=>r.validation.field='question',r=>r.validation.extra=true,r=>r.error='other',r=>r.durationMs+=1,r=>r.dispatched=true,r=>r.status='failed',r=>r.partialPaths=[],r=>r.artifactEffects=[],r=>r.value={}]){const forged=structuredClone(result);change(forged);await assert.rejects(host.verifyResult(original,forged),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');}
 for(const altered of [{...original,id:'other'},{...original,name:'other'},{...original,arguments:{...missing,question:'Changed'}}])await assert.rejects(host.verifyResult(altered,result),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');
 const different=await f.coldHost({allowedDocuments:['atlas-b'],restore:undefined});await assert.rejects(different.verifyResult(original,result),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');
 const wrongOwner=f.owner({...selected,documents:['atlas-a','atlas-b']});assert.equal(childExecutionInputRefusal(wrongOwner,original,{historical:true,result,allowedTools:['delegate_child','read_page','save_report'],allowedDocuments:selected.documents}),null);
 const fake={...f.owner(),inputRefusal(){assert.fail('untrusted callback');}};assert.equal(childExecutionInputRefusal(fake,original,{historical:true,result}),null);
 const legacy={...result};delete legacy.validation;await host.verifyResult(original,legacy);assert.equal(host.correctionEligible(original,legacy),false);
});

test('legacy no-proof terminal refusal is not retrofitted or reopened by the original factory',async t=>{
 const f=await fixture(t,{fake:true,requireReport:false,main:()=>proposal(call('bad','delegate_child',missing))});const out=await f.execute();assert.equal(out.code,'TOOL_REJECTED');const result=badPair(f),original=call('bad','delegate_child',missing);assert.equal(childExecutionInputRefusal(f.owner(),original,{historical:true,result,allowedTools:['delegate_child','read_page','save_report'],allowedDocuments:selected.documents}),null);await f.reopen();const again=await f.execute();assert.equal(again.code,'TOOL_REJECTED');assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0});
});

test('mixed group retains original atomic group refusal, never a Child shape proof or partial dispatch',async t=>{
 const f=await fixture(t,{requireReport:false,main:(_input,n)=>n===1?proposal(call('bad','delegate_child',missing),call('peer','read_page',{documentId:'atlas-a',page:1})):final});const out=await f.execute();assert.equal(out.status,'completed');const results=f.saved().snapshot.messages.filter(m=>m.role==='tool').map(m=>m.result);assert.equal(results.length,2);assert.ok(results.every(r=>r.validation.schemaVersion==='specialist-group-refusal@1'&&!r.dispatched));assert.deepEqual(out.rootUsage,{model:2,tool:0});assert.equal(f.store.listChildren(f.runId).length,0);
});

test('existing singleton, partial and unknown guards remain authoritative',()=>{
 const fact={kind:'tool-result',succeeded:false,dispatched:false,correctionProved:true},context={singleCall:true,hooks:false,partial:false,unknown:false,corrections:0};
 for(const patch of [{singleCall:false},{hooks:true},{partial:true},{unknown:true}])assert.equal(decideRunControl(fact,{...context,...patch}).reason,'TOOL_REJECTED');assert.equal(decideRunControl({...fact,dispatched:true,correctionProved:false},context).reason,'TOOL_FAILED');
});

for(const phase of ['result-committed','result-consumed'])test('same Run original Child rejection cold recovery at '+phase+' consumes the pair once',async t=>{
 const f=await fixture(t),stop=new AbortController();const first=await f.execute({hostSignal:stop.signal,durable:{onCheckpoint:e=>{if(e.phase===phase&&f.saved().snapshot.proposal?.calls?.[0]?.id==='bad')stop.abort();}}});assert.equal(first.status,'interrupted');const proof=badPair(f);assert.deepEqual(first.rootUsage,{model:1,tool:0});await f.reopen();const done=await f.execute();assert.equal(done.status,'completed',done.code);assert.equal(done.runId,first.runId);assert.deepEqual(done.rootUsage,{model:6,tool:3});assert.deepEqual(badPair(f),proof);assert.deepEqual(f.counts(),{mainCalls:4,childCalls:2});
});

test('original root model budget cannot be enlarged by Child input correction',async t=>{
 const f=await fixture(t,{rootLimits:{model:1,tool:10}});const out=await f.execute();assert.equal(out.code,'ROOT_BUDGET_EXHAUSTED');assert.deepEqual(out.rootUsage,{model:1,tool:0});assert.equal(f.saved().snapshot.corrections,1);assert.equal(f.store.listChildren(f.runId).length,0);await f.reopen();assert.equal((await f.execute()).code,'ROOT_BUDGET_EXHAUSTED');assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0});
});

for(const kind of ['user','session'])test('strong '+kind+' cancellation stops before correction reservation',async t=>{
 const f=await fixture(t),stop=new AbortController();const out=await f.execute({signal:stop.signal,durable:{onCheckpoint:e=>{if(e.phase==='result-consumed'&&f.saved().snapshot.proposal?.calls?.[0]?.id==='bad'){if(kind==='user')stop.abort();else f.store.cancel(f.runId);}}}});assert.equal(out.status,'cancelled');assert.deepEqual(out.rootUsage,{model:1,tool:0});assert.equal(f.store.listChildren(f.runId).length,0);await f.reopen();assert.equal((await f.execute()).status,'cancelled');assert.deepEqual(f.counts(),{mainCalls:1,childCalls:0});
});

test('protected Runtime cannot admit a Child extension or grant its input proof',async t=>{
 const dir=await directory(t),store=await openSession({directory:dir,profile:DOCUMENT_REVOCATION_PROFILE});try{await initialize(store);let calls=0;const binding=createChildExecutionBinding({store,parentClaim:()=>undefined,...selected,gatewayFactory(){assert.fail('no protected Child');}});await assert.rejects(run({...protectedOptions(store,join(dir,'runs'),{mode:'fixture',next(){calls++;return proposal(call('bad','delegate_child',missing));}}),extensions:[binding]}));assert.equal(calls,0);}finally{store.close();}
});

test('public project missing documents recovers through model-owned new call and real Child Report with independent cold read',async t=>{
 const dir=await directory(t),projectDir=join(dir,'project'),file=join(dir,'observations.txt');await writeFile(file,'Output increased from 120 to 150 units. The cause was not measured.');
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'no-provider'},capabilities:['report','child'],childExecution:selected.execution}});const sources=await importProjectSources({projectDir,files:[file]}),documentId=sources.catalog.documents[0].id;await submitResearchTask({projectDir,runId:'child-input-public',question:'Read original output and save a cited report.',sourceManifestSha256:sources.manifestSha256});let main=0,child=0;
 const gateway={mode:'fixture',next({messages,reservation}){const replies=messages.filter(m=>m.role==='tool');if(reservation.runId!=='child-input-public'){child++;return replies.length?final:proposal(call('page','read_page',{documentId,page:1}));}main++;if(main===1)return proposal(call('bad','delegate_child',missing));if(main===2){const bad=replies.find(m=>m.callId==='bad').result;assert.equal(bad.validation.field,'documents');assert.equal(bad.dispatched,false);return proposal(call('fixed','delegate_child',{...valid,documents:[documentId]}));}if(main===3)return proposal(call('save','save_report',{text:'Output increased from 120 to 150 units; cause not measured [1].',sourceIds:replies.find(m=>m.callId==='fixed').result.value.sources.map(s=>s.sourceId)}));return final;}};
 const out=await workResearchTask({projectDir,runId:'child-input-public',gateway});assert.equal(out.run.status,'completed',out.run.code);const state=await inspectResearchTask({projectDir,runId:'child-input-public'}),report=await readResearchReport({projectDir,runId:'child-input-public'});assert.deepEqual(state.run.rootUsage,{model:6,tool:3});assert.equal(state.run.snapshot.corrections,1);assert.deepEqual({main,child},{main:4,child:2});assert.ok(report.receipt);
 const code=`import{workResearchTask,inspectResearchTask,readResearchReport}from${JSON.stringify(new URL('../src/research-project.mjs',import.meta.url).href)};let calls=0;const projectDir=${JSON.stringify(projectDir)},runId='child-input-public';const out=await workResearchTask({projectDir,runId,gateway:{mode:'fixture',next(){calls++;throw Error('no replay');}}}),state=await inspectResearchTask({projectDir,runId}),report=await readResearchReport({projectDir,runId});process.stdout.write(JSON.stringify({calls,status:out.run.status,rootUsage:state.run.rootUsage,corrections:state.run.snapshot.corrections,sha256:report.report.sha256}));`;
 const cold=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC'}});assert.equal(cold.status,0,cold.stderr);assert.deepEqual(JSON.parse(cold.stdout),{calls:0,status:'completed',rootUsage:{model:6,tool:3},corrections:1,sha256:report.report.sha256});
});


test('private Child validator error is bound to the exact original call, not reused for another ID with identical arguments',async t=>{
 let binding,firstError,checked=false;
 const f=await fixture(t,{requireReport:false,onBinding:b=>binding=b,main:(_input,n)=>proposal(call(n===1?'bad':'second','delegate_child',missing))});
 const out=await f.execute({durable:{onCheckpoint:e=>{
  if(e.phase!=='proposal-sealed')return;
  const saved=f.saved(),original=saved.snapshot.proposal?.calls?.[0];if(!original)return;
  const context={allowedTools:saved.definition.config.allowedTools,allowedDocuments:saved.definition.config.allowedDocuments};
  if(original.id==='bad'){
   try{binding.validate(original.arguments);}catch(error){firstError=error;}
   assert.ok(firstError);assert.equal(childExecutionInputRefusal(binding,original,{...context,error:firstError}).requestHash.length,64);
   for(const forged of [{...original,arguments:{...missing,documents:undefined}},{...original,extra:undefined},{...original,id:'bad\n'}])assert.equal(childExecutionInputRefusal(binding,forged,{...context,error:firstError}),null);
   assert.equal(childExecutionInputRefusal(binding,original,{...context,error:Object.assign(Error('INVALID_CHILD_EXECUTION_ARGUMENTS'),{code:'INVALID_CHILD_EXECUTION_ARGUMENTS'})}),null);
  }else if(original.id==='second'){
   assert.equal(childExecutionInputRefusal(binding,original,{...context,error:firstError}),null);
   let currentError;try{binding.validate(original.arguments);}catch(error){currentError=error;}
   assert.equal(childExecutionInputRefusal(binding,original,{...context,error:currentError}).schemaVersion,schema);checked=true;
  }
 }}});assert.equal(checked,true);assert.equal(out.code,'CORRECTION_LIMIT');assert.deepEqual(out.rootUsage,{model:2,tool:0});
});

test('fresh original writer cancellation denies even a genuine uncommitted shape error',async t=>{
 let binding,checked=false;const f=await fixture(t,{requireReport:false,onBinding:b=>binding=b});
 const out=await f.execute({durable:{onCheckpoint:e=>{
  if(e.phase!=='proposal-sealed')return;const saved=f.saved(),original=saved.snapshot.proposal?.calls?.[0];if(original?.id!=='bad')return;
  let error;try{binding.validate(original.arguments);}catch(caught){error=caught;}
  const context={error,allowedTools:saved.definition.config.allowedTools,allowedDocuments:saved.definition.config.allowedDocuments};
  assert.equal(childExecutionInputRefusal(binding,original,context).schemaVersion,schema);f.store.cancel(f.runId);assert.equal(childExecutionInputRefusal(binding,original,context),null);checked=true;
 }}});assert.equal(checked,true);assert.equal(out.status,'cancelled');assert.deepEqual(out.rootUsage,{model:1,tool:0});assert.equal(f.saved().snapshot.messages.some(m=>m.result?.validation?.schemaVersion===schema),false);assert.equal(f.store.listChildren(f.runId).length,0);
});
