import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createToolHost} from '../src/tools.mjs';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {openArtifactStore,encodeCsv} from '../src/artifacts.mjs';
import {createHookChain} from '../src/hooks.mjs';
import {decideRunControl} from '../src/run-control.mjs';
import {readTimeline} from '../src/observe.mjs';
import {sha256,DOCUMENT_REVOCATION_PROFILE} from '../src/source.mjs';
import {initialize,options as protectedOptions} from './protected-runtime-fixture.mjs';
import {createResearchProject,submitResearchTask,workResearchTask,inspectResearchTask,readResearchReport} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {createChatGateway} from '../src/gateway.mjs';
const call=(id,name,args)=>({id,name,arguments:args});
const proposal=(...calls)=>({kind:'calls',calls});
const rows=[['metric','value'],['output','30'],['formula','=1+1']];
async function directory(t){await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/csv-correction-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'csv-correction',version:'1'},plugins:[],adapters:[]};

test('CSV type-only proof never parses string rows or dispatches an artifact',async t=>{
 const dir=await directory(t),host=await createToolHost({directory:dir});
 const definition=host.definitions.find(d=>d.name==='create_csv');assert.match(definition.description,/not a string containing JSON/);assert.match(definition.parameters.properties.rows.description,/Do not serialize/);
 for(const value of [JSON.stringify(rows),'SYNTHETIC_PRIVATE_VALUE',null,12,{},false]){
  let dispatched=0;const c=call('bad','create_csv',{rows:value}),out=await host.execute(c,{onDispatch(){dispatched++;}});
  assert.equal(out.status,'rejected');assert.equal(out.dispatched,false);assert.equal(dispatched,0);assert.equal(out.validation.schemaVersion,'builtin-csv-input-validation@1');assert.equal(out.error,'CSV_ROWS_ARRAY_REQUIRED');assert.equal(host.correctionEligible(c,out),true);await host.verifyResult(c,out);assert.ok(!JSON.stringify(out).includes('SYNTHETIC_PRIVATE_VALUE'));
 }
 assert.deepEqual(await readdir(join(dir,'artifacts/objects')),[]);
 const good=await host.execute(call('fixed','create_csv',{rows}));assert.equal(good.status,'succeeded');assert.equal(good.dispatched,true);const store=await openArtifactStore({directory:dir,readOnly:true});assert.equal((await store.read(good.value.artifactId)).bytes.toString(),encodeCsv(rows));assert.match(encodeCsv(rows),/'=1\+1/);
});

test('CSV correction proof is exact and cold revalidated, never an error-name capability',async t=>{
 const dir=await directory(t),host=await createToolHost({directory:dir}),c=call('bad','create_csv',{rows:JSON.stringify(rows)}),out=await host.execute(c),cold=await createToolHost({directory:dir,restore:host.snapshot(),readOnly:true});await cold.verifyResult(c,out);assert.equal(cold.correctionEligible(c,out),true);
 for(const change of [r=>r.callId='other',r=>r.validation.requestHash='0'.repeat(64),r=>r.validation.code='OTHER',r=>r.validation.repairable=false,r=>r.error='other',r=>r.durationMs=-1,r=>r.durationMs=NaN,r=>r.dispatched=true,r=>r.status='failed',r=>r.value={},r=>r.partialPaths=[],r=>r.artifactEffects=[],r=>r.hookErrors=[],r=>r.validation.extra=true]){const forged=structuredClone(out);change(forged);await assert.rejects(cold.verifyResult(c,forged),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');}
 for(const changed of [call('other','create_csv',c.arguments),call('bad','other',c.arguments),call('bad','create_csv',{rows})])await assert.rejects(cold.verifyResult(changed,out),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');
 const legacy={...out,error:'Invalid CSV rows'};delete legacy.validation;await cold.verifyResult(c,legacy);assert.equal(cold.correctionEligible(c,legacy),false);
});

test('CSV shape scope excludes union ambiguity, malformed identities, non-JSON, limits and content errors',async t=>{
 const host=await createToolHost({directory:await directory(t)});
 const args=[{}, {rows:'[]',extra:true},{rows:'[]',calculationRef:'calculation:sha256:'+'0'.repeat(64)},{rows:undefined},{rows:Infinity},{rows:()=>[]},{rows:[]},{rows:[['x'],['x','y']]},{rows:[[2]]},{rows:[['\u0000']]},{rows:[['x'.repeat(64001)]]},{rows:Array.from({length:1001},()=>['x'])},{rows:[Array(33).fill('x')]},{rows:[Array(32).fill('x'.repeat(64000))]}];
 for(const a of args){const c=call('bad','create_csv',a),out=await host.execute(c);assert.equal(out.status,'rejected');assert.equal(out.dispatched,false);assert.equal(out.validation,undefined);assert.equal(host.correctionEligible(c,out),false);}
 for(const c of [{...call('bad','create_csv',{rows:'[]'}),extra:true},call('bad\n','create_csv',{rows:'[]'})])assert.equal((await host.execute(c)).validation,undefined);
 const unavailable=await host.execute(call('ref','create_csv',{calculationRef:'not-an-original-ref'}));assert.equal(unavailable.status,'succeeded');assert.equal(unavailable.value.available,false);assert.equal(unavailable.validation,undefined);
 const denied=await createToolHost({directory:await directory(t),allowedTools:['read_page']});const c=call('bad','create_csv',{rows:'[]'});assert.equal((await denied.execute(c)).validation,undefined);await assert.rejects(denied.verifyResult(c,await host.execute(c)),e=>e.code==='RECOVERY_CHECKPOINT_MISMATCH');
});

test('hooks and same-code extension cannot mint CSV repair proof',async t=>{
 const c=call('bad','create_csv',{rows:'[]'}),hooks=createHookChain();const hooked=await createToolHost({directory:await directory(t),hooks});assert.equal((await hooked.execute(c)).validation,undefined);
 const fake={name:'fake_csv',description:'Synthetic error',parameters:{type:'object'},validate(){const e=Object.assign(new Error('CSV_ROWS_ARRAY_REQUIRED'),{validation:{schemaVersion:'builtin-csv-input-validation@1',repairable:true},validationCode:'CSV_ROWS_ARRAY_REQUIRED'});e[Symbol('builtin-csv-input-validation')]=true;throw e;},execute(){assert.fail('must not dispatch');}};
 const host=await createToolHost({directory:await directory(t),extensions:[fake]});const rejected=await host.execute(call('fake','fake_csv',{}));assert.equal(rejected.validation,undefined);assert.equal(rejected.dispatched,false);assert.equal(host.correctionEligible(call('fake','fake_csv',{}),rejected),false);
 await assert.rejects(createToolHost({directory:await directory(t),extensions:[{...fake,name:'create_csv'}]}),/collision/);
});

test('original Run control retains singleton, partial, unknown and one-correction limits for CSV proof',()=>{
 const fact={kind:'tool-result',succeeded:false,dispatched:false,correctionProved:true},context={singleCall:true,hooks:false,partial:false,unknown:false,corrections:0};
 assert.equal(decideRunControl(fact,context).reason,'LOCAL_CORRECTION');
 for(const change of [{singleCall:false},{hooks:true},{partial:true},{unknown:true}])assert.equal(decideRunControl(fact,{...context,...change}).reason,'TOOL_REJECTED');
 assert.equal(decideRunControl(fact,{...context,corrections:1}).reason,'CORRECTION_LIMIT');
});

test('OpenAI-shaped wire carries the original rejected CSV once before a new corrected call',async t=>{
 let requests=0,paired=false;const gateway=createChatGateway({endpoint:'https://example.invalid/chat/completions',model:'synthetic',apiKey:'synthetic',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:async(_url,request)=>{
  requests++;const body=JSON.parse(request.body);const schema=body.tools.find(t=>t.function.name==='create_csv').function.parameters;assert.equal(schema.properties.rows.type,'array');
  if(requests===2){assert.equal(body.messages.filter(m=>m.role==='assistant'&&m.tool_calls?.some(c=>c.id==='bad')).length,1);const replies=body.messages.filter(m=>m.role==='tool'&&m.tool_call_id==='bad');assert.equal(replies.length,1);const result=JSON.parse(replies[0].content);assert.equal(result.dispatched,false);assert.equal(result.validation.code,'CSV_ROWS_ARRAY_REQUIRED');paired=true;}
  const message=requests===3?{role:'assistant',content:'CSV saved.'}:{role:'assistant',content:null,tool_calls:[{id:requests===1?'bad':'fixed',type:'function',function:{name:'create_csv',arguments:JSON.stringify({rows:requests===1?JSON.stringify(rows):rows})}}]};return Response.json({choices:[{message,finish_reason:requests===3?'stop':'tool_calls'}]});
 }});const result=await run({question:'Synthetic paired CSV protocol.',requireReport:false,gateway,outputRoot:await directory(t),limits:{maxRounds:4,maxTools:2,timeoutMs:30000}});assert.equal(result.status,'completed');assert.equal(result.toolsDispatched,1);assert.equal(requests,3);assert.equal(paired,true);
});

for(const mode of ['repeat','mixed','round','duplicate','cancel'])test('CSV '+mode+' remains bounded by original Runtime and budget',async t=>{
 const dir=await directory(t),store=await openSession({directory:dir}),abort=new AbortController();let calls=0;
 try{const result=await run({question:'Synthetic bounded CSV correction.',requireReport:false,outputRoot:join(dir,'runs'),signal:abort.signal,limits:{maxRounds:mode==='round'?1:5,maxTools:5,timeoutMs:30000},durable:{store,grantId:'csv-bound',bindings},gateway:{mode:'fixture',next(){calls++;if(calls===2&&mode==='cancel')abort.abort();return proposal(call(mode==='duplicate'?'same':'bad-'+calls,'create_csv',{rows:JSON.stringify(rows)}),...(mode==='mixed'?[call('suffix','read_page',{documentId:'atlas-a',page:1})]:[]));}}});
  assert.equal(result.code,{repeat:'CORRECTION_LIMIT',mixed:'TOOL_REJECTED',round:'ROUND_LIMIT',duplicate:'DUPLICATE_CALL_ID',cancel:'CANCELLED'}[mode]);assert.equal(result.rootUsage.tool,0);assert.equal(calls,['mixed','round'].includes(mode)?1:2);const before=calls;const again=await run({question:'Synthetic bounded CSV correction.',requireReport:false,limits:{maxRounds:mode==='round'?1:5,maxTools:5,timeoutMs:30000},gateway:{mode:'fixture',next(){calls++;assert.fail('terminal must not dispatch');}},outputRoot:join(dir,'runs'),durable:{store,runId:result.runId,grantId:'csv-bound',bindings}});assert.equal(again.code,result.code);assert.equal(calls,before);
 }finally{store.close();}
});

test('protected CSV rows refusal remains terminal without a general correction grant',async t=>{
 const dir=await directory(t),store=await openSession({directory:dir,profile:DOCUMENT_REVOCATION_PROFILE});try{await initialize(store);let calls=0;const result=await run(protectedOptions(store,join(dir,'runs'),{mode:'fixture',next(){return ++calls===1?proposal(call('read','read_page',{documentId:'atlas-a',page:1})):proposal(call('bad','create_csv',{rows:JSON.stringify(rows)}));}}));assert.equal(result.code,'TOOL_REJECTED');assert.equal(calls,2);const message=store.inspect(result.runId).snapshot.messages.find(m=>m.callId==='bad');assert.equal(message.result.validation,undefined);assert.equal(message.result.dispatched,false);assert.deepEqual(result.rootUsage,{model:2,tool:1});}finally{store.close();}
});

test('already dispatched CSV publication failure stays failed with retained partial bytes',async t=>{
 const dir=await directory(t),host=await createToolHost({directory:dir});const hash=sha256(encodeCsv(rows)),id=sha256(JSON.stringify({sha256:hash,format:'csv',mediaType:'text/csv; charset=utf-8'}));await mkdir(join(dir,'artifacts/records',id+'.json'));let dispatch=0;const c=call('csv','create_csv',{rows}),out=await host.execute(c,{onDispatch(){dispatch++;}});assert.equal(dispatch,1);assert.equal(out.status,'failed');assert.equal(out.dispatched,true);assert.equal(out.validation,undefined);assert.ok(out.artifactEffects.some(e=>e.kind==='artifact-content'));assert.equal(host.correctionEligible(c,out),false);
});

test('public Child, calculation and corrected CSV retain same Run debit, report and independent cold bytes',async t=>{
 const dir=await directory(t),projectDir=join(dir,'project'),file=join(dir,'metrics.txt');await writeFile(file,'Q1 output: 120 units. Q2 output: 150 units. No cause measured.');
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'no-provider'},capabilities:['report','child','calculation','csv'],childExecution:{schemaVersion:'child-execution@1',maxChildren:1,methods:[CLAIM_COMPARISON_METHOD]}}});const sources=await importProjectSources({projectDir,files:[file]}),documentId=sources.catalog.documents[0].id;
 await submitResearchTask({projectDir,runId:'csv-child',question:'Check source, calculate output change, save CSV and report.',sourceManifestSha256:sources.manifestSha256});let main=0,child=0;
 const gateway={mode:'fixture',next({messages,reservation}){const replies=messages.filter(m=>m.role==='tool');if(reservation.runId!=='csv-child'){child++;return replies.length?{kind:'final',text:'120 to 150 units. No cause measured.'}:proposal(call('read','read_page',{documentId,page:1}));}main++;
  if(main===1)return proposal(call('child','delegate_child',{methodId:'claim-comparison',question:'Check original output.',documents:[documentId]}));
  if(main===2)return proposal(call('calc','calculate_change',{baseline:120,current:150,baselineUnit:'units',currentUnit:'units'}));
  if(main===3)return proposal(call('bad','create_csv',{rows:JSON.stringify(rows)}));
  if(main===4){const refused=replies.find(m=>m.callId==='bad').result;assert.equal(refused.dispatched,false);assert.equal(refused.validation.code,'CSV_ROWS_ARRAY_REQUIRED');return proposal(call('fixed','create_csv',{rows}));}
  if(main===5)return proposal(call('save','save_report',{text:'Output changed by 30 units [C1]. Original [1].',sourceIds:replies.find(m=>m.callId==='child').result.value.sources.map(s=>s.sourceId),attachmentIds:[replies.find(m=>m.callId==='fixed').result.value.artifactId]}));return{kind:'final',text:'Saved.'};}};
 const result=await workResearchTask({projectDir,runId:'csv-child',gateway});assert.equal(result.run.status,'completed');assert.deepEqual({main,child},{main:6,child:2});const state=await inspectResearchTask({projectDir,runId:'csv-child'});assert.deepEqual(state.run.rootUsage,{model:8,tool:5});assert.equal(state.run.snapshot.corrections,1);const bad=state.run.snapshot.messages.filter(m=>m.callId==='bad');assert.equal(bad.length,1);assert.equal(bad[0].result.dispatched,false);const report=await readResearchReport({projectDir,runId:'csv-child'}),artifacts=await openArtifactStore({directory:report.directory,readOnly:true});assert.equal((await artifacts.read(report.receipt.attachmentIds[0])).bytes.toString(),encodeCsv(rows));const timeline=await readTimeline(report.directory);assert.equal(timeline.entries.filter(e=>e.type==='validation_correction_offered').length,1);
 const code=`import{workResearchTask,readResearchReport,inspectResearchTask}from${JSON.stringify(new URL('../src/research-project.mjs',import.meta.url).href)};const projectDir=${JSON.stringify(projectDir)};let calls=0;const out=await workResearchTask({projectDir,runId:'csv-child',gateway:{mode:'fixture',next(){calls++;throw Error('no replay');}}});const report=await readResearchReport({projectDir,runId:'csv-child'}),state=await inspectResearchTask({projectDir,runId:'csv-child'});process.stdout.write(JSON.stringify({calls,status:out.run.status,sha256:report.report.sha256,rootUsage:state.run.rootUsage,corrections:state.run.snapshot.corrections}));`;
 const cold=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC'}});assert.equal(cold.status,0,cold.stderr);assert.deepEqual(JSON.parse(cold.stdout),{calls:0,status:'completed',sha256:report.report.sha256,rootUsage:state.run.rootUsage,corrections:1});
});
