import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createToolHost} from '../src/tools.mjs';
import {createChatGateway} from '../src/gateway.mjs';
import {run} from '../src/runtime.mjs';
import {openArtifactStore} from '../src/artifacts.mjs';
import {openSession} from '../src/session.mjs';
import {sha256} from '../src/source.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/result-delivery-'));}
const table=(baseline=100)=>{const text=JSON.stringify({schemaVersion:'comparison-table@1',synthetic:true,rows:[{id:'base',value:baseline,unit:'amount',currency:'USD',dataAsOf:'2026-10-01'},{id:'tail',value:250,unit:'amount',currency:'USD',dataAsOf:'2026-10-01'}]});return{sourceId:'synthetic-etf@1:p1',documentId:'synthetic-etf',name:'Synthetic ETF snapshot',version:'1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'};};
const extension=baseline=>({name:'synthetic_table',description:'Owned synthetic comparison',parameters:{type:'object',properties:{},additionalProperties:false},sourceResult:true,validate:args=>assert.deepEqual(args,{}),execute:async()=>table(baseline)});
const bound=resultRef=>({resultRef,selection:{offset:0,limit:2},baselineRow:0,currentRow:1});
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const toolValues=messages=>messages.filter(m=>m.role==='tool').map(m=>m.result.value);
test('RC actual next Gateway encoding and report CSV retain one bound numeric result',async()=>{
 const requests=[];let source,calculation,csv;const completion=(message,finish_reason)=>new Response(JSON.stringify({choices:[{index:0,message:{role:'assistant',...message},finish_reason}]}),{status:200});
 const gateway=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'synthetic-injected-transport',apiKey:'synthetic-not-a-secret',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:async(_url,options)=>{
  const request=JSON.parse(options.body);requests.push(request);const values=request.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);const invoke=(name,args)=>completion({content:null,tool_calls:[{id:'wire-'+requests.length,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
  if(requests.length===1)return invoke('synthetic_table',{});
  if(requests.length===2){source=values.at(-1);return invoke('calculate_change',bound(source.resultRef));}
  if(requests.length===3){calculation=values.at(-1);assert.equal(calculation.difference,150);assert.equal(calculation.binding.sourceRef,source.resultRef);assert.equal(calculation.binding.currency,'USD');assert.equal(calculation.binding.dataAsOf,'2026-10-01');return invoke('create_csv',{calculationRef:calculation.resultRef});}
  if(requests.length===4){csv=values.at(-1);assert.match(csv.artifactId,/^artifact:sha256:/);return invoke('save_report',{text:'Independent synthetic narrative; its financial meaning is unreviewed.',sourceIds:[source.sourceId],attachmentIds:[csv.artifactId]});}
  return completion({content:'Original report and CSV saved.'},'stop');
 }});
 const outcome=await run({question:'Consume original synthetic numbers through actual Gateway encoding.',gateway,extensions:[extension(100)],outputRoot:await directory()});assert.equal(outcome.status,'completed');assert.equal(requests.length,5);
 const manifest=JSON.parse(await readFile(join(outcome.directory,'manifest.json'),'utf8'));const{resultRef,...value}=calculation;assert.deepEqual(manifest.calculations[0].value,value);assert.equal(manifest.calculations[0].ref.resultRef,resultRef);
 const store=await openArtifactStore({directory:outcome.directory,readOnly:true});const csvBytes=(await store.read(csv.artifactId)).bytes;const lines=csvBytes.toString().trimEnd().split('\r\n');assert.equal(lines.length,2);const cells=Object.fromEntries(lines[0].split(',').map((key,i)=>[key,lines[1].split(',')[i]]));
 assert.equal(cells.resultRef,resultRef);assert.equal(cells.baseline,'100');assert.equal(cells.current,'250');assert.equal(cells.difference,'150');assert.equal(cells.ratio,'2.5');assert.equal(cells.increaseRatio,'1.5');assert.equal(cells.currency,'USD');assert.equal(cells.dataAsOf,'2026-10-01');assert.equal(cells.sourceRef,source.resultRef);assert.equal(cells.contentHash,source.sha256);assert.equal(cells.currentRow,'1');
 const report=(await store.read(outcome.receipt.artifactId)).bytes.toString();assert.ok(report.includes(resultRef));assert.ok(report.includes('currency USD'));assert.ok(report.includes('dataAsOf 2026-10-01'));assert.ok(report.includes(source.resultRef));assert.ok(report.includes('Independent synthetic narrative'));
});
test('RC unavailable numeric and optional CSV effects do not block original Publication',async()=>{
 const base=await directory();const session=await openSession({directory:join(base,'session')});let step=0;const observed=[];let source;
 const gateway={mode:'fixture',async next({messages}){const values=toolValues(messages);if(step++===0)return call('r','synthetic_table',{});if(step===2){source=values.at(-1);return call('c','calculate_change',bound(source.resultRef));}if(step===3){observed.push(values.at(-1));return call('csv','create_csv',{calculationRef:'calculation:sha256:'+'a'.repeat(64)});}observed.push(values.at(-1));return{kind:'final',text:'Independent body remains available; this comparison and CSV are unavailable.'};}};
 try{const outcome=await run({question:'Missing denominator is not a body veto.',gateway,extensions:[extension(null)],outputRoot:join(base,'runs'),requireReport:false,publication:true,durable:{store:session,grantId:'synthetic-comparison-grant',bindings:{gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'comparison-unavailable',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]}}});assert.equal(outcome.status,'completed');assert.equal(observed[0].code,'OPERAND_UNKNOWN');assert.equal(observed[1].available,false);assert.equal(observed[1].artifactId,undefined);assert.ok(outcome.publication);assert.equal(session.confirmPublication(outcome.publication).content.text,outcome.answer);assert.equal(outcome.receipt,null);}finally{session.close();}
});
test('RC unbound calculation cannot gain source qualification through CSV export',async()=>{
 const host=await createToolHost({directory:await directory()});const result=await host.execute({id:'plain',name:'calculate_change',arguments:{baseline:100,current:250,baselineUnit:'amount',currentUnit:'amount'}});const csv=await host.execute({id:'csv',name:'create_csv',arguments:{calculationRef:result.value.resultRef}});assert.equal(csv.status,'succeeded');assert.equal(csv.value.available,false);assert.equal(csv.value.code,'UNBOUND_CALCULATION');assert.equal(csv.value.artifactId,undefined);
});
test('RC recovered Host rechecks original bound and unavailable result identities',async()=>{
 for(const baseline of [100,null]){const d=await directory();const extensions=[extension(baseline)];const host=await createToolHost({directory:d,extensions});const r=await host.execute({id:'r',name:'synthetic_table',arguments:{}});const request={id:'c',name:'calculate_change',arguments:bound(r.value.resultRef)};const result=await host.execute(request);assert.equal(result.status,'succeeded');const next=await createToolHost({directory:d,extensions,restore:host.snapshot()});await next.verifyResult(request,result);const altered=structuredClone(result);if(baseline===null)altered.value.code='ZERO_DENOMINATOR';else altered.value.binding.currency='EUR';await assert.rejects(next.verifyResult(request,altered));}
});

test('RC actual next encoded request retains tail currency cutoff and unknown reasons without vetoing text',async()=>{
 for(const scenario of ['tail','currency','cutoff','unknown']){
  const original=table(scenario==='unknown'?null:100);const content=JSON.parse(original.text);
  if(scenario==='currency')content.rows[1].currency='EUR';if(scenario==='cutoff')content.rows[1].dataAsOf='2026-10-02';original.text=JSON.stringify(content);original.sha256=sha256(original.text);
  const owned={...extension(100),execute:async()=>original};let step=0,observed;
  const gateway=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'synthetic-injected-negative',apiKey:'synthetic-not-a-secret',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:async(_url,options)=>{
   const request=JSON.parse(options.body);const values=request.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);step++;
   const message=step<=2?{role:'assistant',content:null,tool_calls:[{id:'negative-'+step,type:'function',function:{name:step===1?'synthetic_table':'calculate_change',arguments:JSON.stringify(step===1?{}:{...bound(values.at(-1).resultRef),...(scenario==='tail'?{selection:{offset:0,limit:1}}:{})})}}]}:{role:'assistant',content:'Independent body, numeric comparison unavailable.'};
   if(step===3)observed=values.at(-1);
   return new Response(JSON.stringify({choices:[{index:0,message,finish_reason:step<=2?'tool_calls':'stop'}]}),{status:200});
  }});
  const outcome=await run({question:'Unavailable numeric scope is local.',gateway,extensions:[owned],outputRoot:await directory(),requireReport:false});assert.equal(outcome.status,'completed');assert.equal(step,3);assert.equal(observed.available,false);assert.equal(observed.code,{tail:'OPERAND_NOT_SELECTED',currency:'CURRENCY_MISMATCH',cutoff:'CUTOFF_MISMATCH',unknown:'OPERAND_UNKNOWN'}[scenario]);assert.equal(observed.resultRef,undefined);assert.equal(observed.ratio,undefined);assert.equal(observed.contentHash,original.sha256);assert.equal(outcome.answer,'Independent body, numeric comparison unavailable.');
 }
});
test('RC cancelled optional export cannot erase a prior report and saved CSV recovery binds original input',async()=>{
 const d=await directory();const extensions=[extension(100)];const host=await createToolHost({directory:d,extensions});const r=await host.execute({id:'r',name:'synthetic_table',arguments:{}});const c=await host.execute({id:'c',name:'calculate_change',arguments:bound(r.value.resultRef)});
 const saved=await host.execute({id:'save',name:'save_report',arguments:{text:'Already delivered original body.',sourceIds:[r.value.sourceId]}});assert.equal(saved.status,'succeeded');
 const controller=new AbortController();controller.abort();const request={id:'csv',name:'create_csv',arguments:{calculationRef:c.value.resultRef}};const stopped=await host.execute(request,{signal:controller.signal});assert.equal(stopped.status,'rejected');assert.equal(stopped.dispatched,false);assert.equal(stopped.value,undefined);assert.deepEqual(host.receipt,saved.value);
 const store=await openArtifactStore({directory:d,readOnly:true});assert.equal((await store.read(saved.value.artifactId)).sha256,saved.value.sha256);
 const csv=await host.execute({...request,id:'csv-after'});assert.equal(csv.status,'succeeded');const fresh=await createToolHost({directory:d,extensions,restore:host.snapshot()});await fresh.verifyResult({...request,id:'csv-after'},csv);
 await assert.rejects(fresh.verifyResult({...request,id:'csv-after',arguments:{calculationRef:'calculation:sha256:'+'a'.repeat(64)}},csv));
 const unknown={id:'unknown',name:'create_csv',arguments:{calculationRef:'calculation:sha256:'+'b'.repeat(64)}};const absent=await host.execute(unknown);await fresh.verifyResult(unknown,absent);await assert.rejects(fresh.verifyResult(unknown,{...absent,value:{...absent.value,code:'UNBOUND_CALCULATION'}}));
});
test('RC malformed optional references stay locally unavailable and allow independent final text',async()=>{
 const invalidCsv=[null,42,{unexpected:true},'bad','result:sha256:'+'a'.repeat(64)];
 const invalidCalculation=[null,'bad','calculation:sha256:'+'a'.repeat(64)];
 const cases=[...invalidCsv.map(calculationRef=>['create_csv',{calculationRef},'INVALID_CALCULATION_REF']),...invalidCalculation.map(resultRef=>['calculate_change',bound(resultRef),'INVALID_COMPARISON_INPUT']),['calculate_change',{...bound('result:sha256:'+'a'.repeat(64)),selection:{offset:0,limit:33}},'INVALID_SELECTION']];
 for(const [name,args,expected] of cases){let step=0,observed;const gateway={mode:'fixture',async next({messages}){if(step++===0)return call('optional',name,args);observed=toolValues(messages).at(-1);return{kind:'final',text:'Independent text remains deliverable.'};}};
  const result=await run({question:'No numeric reference can veto independent text.',gateway,requireReport:false,outputRoot:await directory()});assert.equal(result.status,'completed');assert.equal(result.answer,'Independent text remains deliverable.');assert.equal(observed.available,false);assert.equal(observed.code,expected);assert.equal(observed.resultRef,undefined);assert.equal(observed.artifactId,undefined);
 }
});
test('RC recovered no-op Hook receipts bind original calls and effective IDs before value reuse',async()=>{
 const {createHookChain}=await import('../src/hooks.mjs');const d=await directory();const extensions=[extension(100)];const hooks=createHookChain();const host=await createToolHost({directory:d,extensions,hooks});const source=await host.execute({id:'source',name:'synthetic_table',arguments:{}});const request={id:'calculate',name:'calculate_change',arguments:bound(source.value.resultRef)};const result=await host.execute(request);const csvCall={id:'csv',name:'create_csv',arguments:{calculationRef:result.value.resultRef}};const csv=await host.execute(csvCall);const otherCall={id:'other',name:'calculate_change',arguments:{...request.arguments,baselineRow:1,currentRow:0}};const other=await host.execute(otherCall);assert.equal(other.status,'succeeded');const fresh=await createToolHost({directory:d,extensions,hooks,restore:host.snapshot()});
 await fresh.verifyResult(request,result);await fresh.verifyResult(csvCall,csv);
 await assert.rejects(fresh.verifyResult({...request,arguments:{...request.arguments,selection:{offset:0,limit:1}}},result));
 await assert.rejects(fresh.verifyResult({...request,arguments:{...request.arguments,resultRef:'result:sha256:'+'a'.repeat(64)}},result));
 await assert.rejects(fresh.verifyResult({...csvCall,arguments:{calculationRef:'calculation:sha256:'+'a'.repeat(64)}},csv));
 await assert.rejects(fresh.verifyResult(request,{...result,effective:{...result.effective,id:'another-call'}}));
 await assert.rejects(fresh.verifyResult(request,{...result,callId:'another-call'}));
 const {original:_original,effective:_effective,...stripped}=result;await assert.rejects(fresh.verifyResult(request,stripped));
 await assert.rejects(fresh.verifyResult(request,{...result,effective:{...result.effective,arguments:otherCall.arguments},value:other.value}));
});
test('RC equal unavailable observations cannot substitute distinct original requests without hooks',async()=>{
 const d=await directory();const host=await createToolHost({directory:d});const request={id:'missing',name:'calculate_change',arguments:bound('result:sha256:'+'a'.repeat(64))};const result=await host.execute(request);assert.equal(result.value.code,'SOURCE_UNAVAILABLE');const fresh=await createToolHost({directory:d,restore:host.snapshot()});await fresh.verifyResult(request,result);
 await assert.rejects(fresh.verifyResult({...request,arguments:bound('result:sha256:'+'b'.repeat(64))},result));
});
test('RC Hook alias mode and request digest cannot be stripped by changing the effective binding name',async()=>{
 const {createHookChain}=await import('../src/hooks.mjs');
 const opaque={name:'opaque',description:'Synthetic non-numeric observation',parameters:{type:'object'},validate:()=>{},execute:async()=>({observation:'not numeric'})};
 for(const alias of ['none','in','out']){
  const hooks=createHookChain({aliases:alias==='in'?{legacy_calculate:'calculate_change'}:alias==='out'?{calculate_change:'opaque'}:{},before:alias==='none'?[]:[({effective})=>effective.name===(alias==='in'?'legacy_calculate':'calculate_change')?{name:alias==='in'?'calculate_change':'opaque'}:undefined]});
  const d=await directory();const extensions=[opaque];const host=await createToolHost({directory:d,extensions,hooks});const request={id:'same-id',name:alias==='in'?'legacy_calculate':'calculate_change',arguments:{baseline:100,current:250,baselineUnit:'amount',currentUnit:'amount'}};const result=await host.execute(request);assert.equal(result.status,'succeeded');const fresh=await createToolHost({directory:d,extensions,hooks,restore:host.snapshot()});await fresh.verifyResult(request,result);
  assert.match(result.requestHash,/^[a-f0-9]{64}$/);
  const altered={...result,effective:{...result.effective,name:alias==='out'?'read_result':'opaque'}};
  await assert.rejects(fresh.verifyResult(request,altered));
  const {requestHash:_hash,...strippedHash}=altered;await assert.rejects(fresh.verifyResult(request,strippedHash));
  const {requestHash:_requestHash,original:_original,effective:_effective,...strippedAll}=result;await assert.rejects(fresh.verifyResult(request,strippedAll));
 }
});

test('RC Host v1 resume is explicitly refused before effects while original artifacts and v2 resume remain usable',async()=>{
 const d=await directory(),runDirectory=join(d,'original');await mkdir(runDirectory);const allowedTools=['read_page','save_report'];const host=await createToolHost({directory:runDirectory,allowedTools});
 const source=await host.execute({id:'read',name:'read_page',arguments:{documentId:'atlas-a',page:1}});const report=await host.execute({id:'save',name:'save_report',arguments:{text:'Original delivered bytes survive the Host protocol boundary.',sourceIds:[source.value.sourceId]}});assert.equal(report.status,'succeeded');
 const legacy={...host.snapshot(),schemaVersion:'tool-host@1'};const originalSnapshot=JSON.stringify(legacy);
 const files=async()=>{const result={};async function scan(path,prefix=''){for(const entry of await readdir(path,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())await scan(join(path,entry.name),name+'/');else result[name]=sha256(await readFile(join(path,entry.name)));}}await scan(runDirectory);return result;};const beforeFiles=await files();
 await assert.rejects(createToolHost({directory:runDirectory,allowedTools,restore:legacy}),{code:'UNSUPPORTED_HOST_SNAPSHOT_VERSION'});assert.equal(JSON.stringify(legacy),originalSnapshot);assert.deepEqual(await files(),beforeFiles);
 let calls=0,activations=0;const plugin={id:'protocol-probe',version:'1.0.0',schemaVersion:'trusted-plugin@1',sourceUrl:import.meta.url,contentSha256:sha256(await readFile(new URL(import.meta.url))),tools:[],activate:()=>{activations++;}};
 const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'protocol-test',version:'1'},plugins:[Object.fromEntries(['id','version','schemaVersion','contentSha256'].map(key=>[key,plugin[key]]))],adapters:[]};
 const session=await openSession({directory:join(d,'session')});const question='Keep original output.';const limits={maxRounds:3,maxTools:3,timeoutMs:15000};const definition={question,grantId:'protocol-test',bindings,limits,rootLimits:{model:3,tool:3},deadlineAt:Date.now()+15000,config:{requireReport:false,allowedTools,taskId:null}};
 const state=version=>({schemaVersion:'runtime-checkpoint@1',phase:'ready',messages:[{role:'user',content:question}],usedIds:[],rounds:0,toolsDispatched:0,proposal:null,cursor:0,result:null,host:{...host.snapshot(),schemaVersion:version},working:null,answer:'',status:'failed',code:null,unknownEffects:[],partialEffects:[],hookErrors:[]});
 const options=runId=>({question,gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Existing output remains readable.'};}},limits,plugins:[plugin],allowedTools,requireReport:false,durable:{store:session,runId,grantId:'protocol-test',bindings}});
 try{
  session.create({runId:'old-protocol',directory:runDirectory,definition,snapshot:state('tool-host@1')});const before=session.inspect('old-protocol');
  const dbFiles=await readdir(session.directory);const dbHashes=async()=>Object.fromEntries(await Promise.all(dbFiles.filter(n=>!n.endsWith('-shm')).map(async n=>[n,sha256(await readFile(join(session.directory,n)))])));const beforeDb=await dbHashes();
  await assert.rejects(run(options('old-protocol')),{code:'UNSUPPORTED_HOST_SNAPSHOT_VERSION'});assert.equal(calls,0);assert.equal(activations,0);assert.deepEqual(session.inspect('old-protocol'),before);assert.deepEqual(await dbHashes(),beforeDb);assert.deepEqual(await files(),beforeFiles);
  const artifacts=await openArtifactStore({directory:runDirectory,readOnly:true});assert.equal((await artifacts.read(report.value.artifactId)).sha256,report.value.sha256);
  session.create({runId:'new-protocol',directory:runDirectory,definition,snapshot:state('tool-host@2')});
  // Controlled read-time version change, not a claim of atomic cross-version admission.
  const beforeNew=session.inspect('new-protocol');let inspections=0,claims=0;
  const changedView={...session,inspect(id){const actual=session.inspect(id);return ++inspections===1?actual:{...actual,snapshot:{...actual.snapshot,host:legacy}};},claim(){claims++;throw new Error('Must refuse before claim');}};
  const racing=options('new-protocol');await assert.rejects(run({...racing,durable:{...racing.durable,store:changedView}}),{code:'UNSUPPORTED_HOST_SNAPSHOT_VERSION'});assert.equal(inspections,2);assert.equal(claims,0);assert.equal(calls,0);assert.equal(activations,1);assert.deepEqual(session.inspect('new-protocol'),beforeNew);assert.deepEqual(await files(),beforeFiles);
  const outcome=await run(options('new-protocol'));assert.equal(outcome.status,'completed');assert.equal(calls,1);assert.equal(activations,2);assert.equal(session.inspect('new-protocol').snapshot.host.schemaVersion,'tool-host@2');assert.equal((await artifacts.read(report.value.artifactId)).sha256,report.value.sha256);
 }finally{session.close();}
});
test('RC v2 Hook reconciliation binds the stored effective call without rerunning hooks or execution',async()=>{
 const {createHookChain}=await import('../src/hooks.mjs');let executions=0,before=0,reconciliations=0;const hooks=createHookChain({aliases:{legacy_echo:'recoverable_echo'},before:[()=>{before++;return{name:'recoverable_echo'};}]});
 const extensions=[{name:'recoverable_echo',description:'Synthetic recoverable observation',parameters:{type:'object',properties:{},additionalProperties:false},validate:args=>assert.deepEqual(args,{}),execute:async()=>{executions++;return{observation:'original'};},recoveryVersion:'synthetic@1',reconcile:async()=>{reconciliations++;return{observation:'original'};}}];
 const d=await directory(),host=await createToolHost({directory:d,extensions,hooks});const call={id:'original-call',name:'legacy_echo',arguments:{}};const actual=await host.execute(call);assert.equal(actual.status,'succeeded');const fresh=await createToolHost({directory:d,extensions,hooks,restore:host.snapshot()});const recovered=await fresh.reconcile(call,{effective:actual.effective});await fresh.verifyResult(call,recovered);assert.equal(recovered.requestHash,actual.requestHash);assert.deepEqual([executions,before,reconciliations],[1,1,1]);
 await assert.rejects(fresh.reconcile(call,{effective:{...actual.effective,id:'another-call'}}));assert.equal(reconciliations,1);
});
