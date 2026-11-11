import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,inspectResearchTask,readResearchReport,readResearchOutput,cancelResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {startReader} from '../src/reader.mjs';
import {runResearchCli} from '../src/research-cli.mjs';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {createToolHost} from '../src/tools.mjs';
import {preparePublication} from '../src/publication.mjs';
import {publicReportAssessment,prepareReportAssessment,verifyReportDeliveryState} from '../src/report-assessment.mjs';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
async function delivered(t,{mixed=false,onlyMarker=false,text='原始回答：回报 12% [1] [2]，没有计算 [C1] / [C2]。',pausePhase}={}){
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/answer-view-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'answer-view'},capabilities:['report']}});
 const file=join(root,'original.md');await writeFile(file,'SYNTHETIC source. No verified investment return.');const bundle=await importProjectSources({projectDir:root,files:[file]}),doc=bundle.catalog.documents[0].id;
 const options={projectDir:root,runId:'answer'};await submitResearchTask({...options,question:'Save original answer.',sourceManifestSha256:bundle.manifestSha256});let calls=0;
 const gateway={mode:'fixture',next({messages}){calls++;assert.ok(calls<=2,'no correction model or second save after citation assessment');if(calls===1)return call('read','read_page',{documentId:doc,page:1});const source=messages.find(m=>m.callId==='read').result.value;return call('save','save_report',{text,sourceIds:onlyMarker?[source.sourceId]:mixed?[source.sourceId,doc]:[doc]});}};
 const stop=new AbortController();const worked=await workResearchTask({...options,gateway,hostSignal:stop.signal,onCheckpoint(e){if(pausePhase===e.phase&&calls===2)stop.abort();}});
 if(pausePhase){assert.equal(worked.workerStatus,'interrupted');assert.equal(worked.run.status,'active');}else{assert.equal(worked.run.status,'completed',worked.run.snapshot.code);assert.equal(worked.run.snapshot.code,null);}
 assert.equal(calls,2);return{root,run:worked.run,bundle,calls:()=>calls,options,text,resume:()=>workResearchTask({...options,gateway})};
}
test('C02-shaped citation error publishes exact original answer without correction call or Report receipt',async t=>{
 const f=await delivered(t,{onlyMarker:true}),before=await inspectResearchTask(f.options),index=await readFile(join(f.run.directory,'content-index.json'));
 await assert.rejects(readResearchReport(f.options),e=>e.code==='PROJECT_REPORT_NOT_READY');
 const view=await readResearchOutput(f.options);assert.equal(view.kind,'degraded-answer');assert.equal(view.answer.text,f.text);assert.equal(view.status,'completed');assert.equal(view.receipt,null);assert.equal(view.report,null);assert.equal(view.publicationStatus,'published');assert.equal(view.answer.citations[0].status,'verified-source');assert.equal(view.answer.markers.find(m=>m.marker==='[C1]').status,'unverified');assert.match(view.answer.warning,/金融数字/);assert.equal(view.answer.semanticStatus,'unreviewed');
 assert.ok(!JSON.stringify(view.publication).includes('recordPath'));assert.ok(!JSON.stringify(view.publication).includes('grantId'));assert.equal(view.answer.basis,undefined);
 assert.deepEqual(await readResearchOutput(f.options),view);assert.deepEqual(await inspectResearchTask(f.options),before);assert.deepEqual(await readFile(join(f.run.directory,'content-index.json')),index);assert.equal(f.calls(),2);assert.deepEqual(f.run.rootUsage,{model:2,tool:1});
 let out='',err='';assert.equal(await runResearchCli(['report','inspect','--project',f.root,'--run','answer'],{stdout:{write:s=>out+=s},stderr:{write:s=>err+=s}}),0,err);assert.equal(JSON.parse(out).answer.text,f.text);
 const cold=await f.resume();assert.equal(cold.run.status,'completed');assert.equal(f.calls(),2);assert.deepEqual(cold.publication,view.publication.receipt);
});
for(const mixed of [false,true])test('unknown IDs never become sources; mixed='+mixed,async t=>{
 const f=await delivered(t,{mixed}),view=await readResearchOutput(f.options);assert.equal(view.answer.citations.at(-1).status,'unverified');assert.equal(view.answer.citations.at(-1).resultRef,undefined);if(mixed)assert.equal(view.answer.citations[0].status,'verified-source');assert.equal(view.answer.calculations.length,0);assert.equal(f.run.snapshot.messages.at(-1).result.status,'rejected');assert.equal(f.run.snapshot.host.saveAttempted,false);
});
for(const pausePhase of ['result-committed','result-consumed','publication-committed'])test('original '+pausePhase+' cold recovery commits one delivery without another model/save',async t=>{
 const f=await delivered(t,{mixed:true,pausePhase}),prior=f.run.snapshot.result??f.run.snapshot.messages.at(-1).result,proof=structuredClone(prior.deliveryAssessment);
 if(pausePhase==='publication-committed')assert.equal((await readResearchOutput(f.options)).answer.text,f.text);else await assert.rejects(readResearchOutput(f.options),e=>e.code==='PROJECT_REPORT_NOT_READY');
 const completed=await f.resume();assert.equal(completed.run.status,'completed',completed.run.snapshot.code);assert.equal(f.calls(),2);assert.deepEqual(completed.run.snapshot.messages.at(-1).result.deliveryAssessment,proof);
 const store=await openSession({directory:join(f.root,'sessions','answer'),readOnly:true});try{assert.equal(store.claim,undefined);assert.equal(store.create,undefined);assert.equal(store.cancel,undefined);assert.equal(store.publicationRevisions('answer').length,1);assert.equal(store.publication('answer').content.text,f.text);}finally{store.close();}
});
test('Host and Session reject forged assessment, pair, source basis, grant and scope',async t=>{
 const f=await delivered(t,{mixed:true,pausePhase:'result-consumed'}),s=f.run.snapshot,call=s.proposal.calls[0],result=s.messages.at(-1).result;
 const host=await createToolHost({hostProjection:f.run.definition.config.hostProjection,projectionOwner:{runId:f.run.runId,rootId:f.run.rootId},confirmDerivedConsumption:async()=>false,directory:f.run.directory,answerDelivery:true,restore:s.host,documentCatalog:f.bundle.catalog,allowedTools:f.run.definition.config.allowedTools,allowedDocuments:f.run.definition.config.allowedDocuments,runIdentity:{runId:f.run.runId,grantId:f.run.definition.grantId}});t.after(()=>host.close());await host.verifyResult(call,result);
 for(const alter of [r=>{r.deliveryAssessment.basis=[];},r=>{r.deliveryAssessment.basisHash='0'.repeat(64);},r=>{r.deliveryAssessment.requestHash='0'.repeat(64);},r=>{r.deliveryAssessment.scopeHash='0'.repeat(64);},r=>{r.deliveryAssessment.runId='other';},r=>{r.deliveryAssessment.grantId='other';},r=>{r.callId='other';},r=>{r.dispatched=true;},r=>{r.hookErrors=[];}]){const r=structuredClone(result);alter(r);await assert.rejects(host.verifyResult(call,r));}
 const store=await openSession({directory:join(f.root,'sessions','answer')}),claim=store.claim('answer','negative-proof');try{
  const assessment=publicReportAssessment(result.deliveryAssessment,f.text);const bad=structuredClone(assessment);bad.proofHash='0'.repeat(64);assert.throws(()=>claim.publish(preparePublication({runId:'answer',rootId:'answer',text:f.text,assessment:bad})));
  assert.equal(store.publication('answer'),null);assert.deepEqual(store.inspect('answer').snapshot,s);
 }finally{claim.release();store.close();}
});
test('published Reader escapes model HTML and original Result loss cannot erase committed answer',async t=>{
 const f=await delivered(t,{mixed:true,text:'<script>alert(1)</script><img src=x onerror=alert(2)> [1] [2] [C1]'});let reads=0;
 const reader=await startReader({directory:f.run.directory,readAnswer:()=>{reads++;return readResearchOutput(f.options);}});t.after(()=>reader.close());
 const response=await fetch(reader.origin),html=await response.text();assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/publication: published/);assert.match(html,/unverified/);
 const source=f.run.snapshot.host.results.find(r=>r.kind==='source');await writeFile(join(f.run.directory,source.recordPath),'corrupt');const json=await(await fetch(reader.origin+'/answer')).json();assert.equal(json.answer.text,f.text);assert.equal(json.answer.verification,'at-publication');assert.equal(reads,2);assert.equal(f.calls(),2);
});
test('bounded assessment refuses empty/oversized/malformed bodies, limits public marker audit without changing text',()=>{
 const common={basis:[],runId:'r',grantId:'g',scopeHash:'a'.repeat(64)};
 for(const text of ['', ' ', 'x'.repeat(262145), '\0', '\ud800'])assert.throws(()=>prepareReportAssessment({...common,call:{id:'c',name:'save_report',arguments:{text,sourceIds:['unknown']}}}));
 const text=Array.from({length:1000},(_,i)=>`[${i+1}]`).join(' '),proof=prepareReportAssessment({...common,call:{id:'c',name:'save_report',arguments:{text,sourceIds:['unknown']}}}),a=publicReportAssessment(proof,text);
 assert.equal(a.markers.length,512);assert.deepEqual(a.markerAudit,{total:1000,returned:512,complete:false,unverified:1000});assert.equal(preparePublication({runId:'r',rootId:'r',text,assessment:a}).content.text,text);
});
test('corrupt original bytes before candidate validation remain hard and never publish',async t=>{
 const f=await delivered(t,{mixed:true,pausePhase:'result-committed'}),source=f.run.snapshot.host.results.find(r=>r.kind==='source');await writeFile(join(f.run.directory,source.recordPath),'corrupt');const result=await f.resume();assert.equal(result.run.status,'failed');assert.equal(f.calls(),2);await assert.rejects(readResearchOutput(f.options));
});

test('Session candidate authority rejects unknown, partial, cancelled, protected and mismatched owner facts',async t=>{
 const f=await delivered(t,{mixed:true,pausePhase:'result-consumed'}),s=f.run.snapshot,r=s.messages.at(-1).result;
 const prepared=preparePublication({runId:'answer',rootId:'answer',text:f.text,assessment:publicReportAssessment(r.deliveryAssessment,f.text)});
 assert.equal(verifyReportDeliveryState(f.run,prepared),true);
 for(const alter of [r=>r.status='cancelled',r=>r.rootStatus='cancelled',r=>r.parentRunId='child-parent',r=>r.definition.config.documentProtection={},r=>r.snapshot.gatewayOutcome='unknown',r=>r.snapshot.inFlight={},r=>r.snapshot.unknownEffects=[{}],r=>r.snapshot.partialEffects=[{}],r=>r.snapshot.hookErrors=[{}],r=>r.snapshot.host.saveAttempted=true,r=>r.snapshot.host.receipt={},r=>r.snapshot.cursor=0,r=>r.snapshot.messages.at(-1).result.dispatched=true,r=>r.snapshot.messages.at(-1).result.hookErrors=[],r=>r.snapshot.messages.at(-1).callId='other']){const bad=structuredClone(f.run);alter(bad);assert.throws(()=>verifyReportDeliveryState(bad,prepared));}
 await cancelResearchTask(f.options);const after=await f.resume();assert.equal(after.run.status,'cancelled');assert.equal(after.publication,null);assert.equal(f.calls(),2);await assert.rejects(readResearchOutput(f.options));
});
test('artifact and source-scope failures cannot mint a citation delivery assessment',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/answer-negative-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const options={directory,answerDelivery:true,runIdentity:{runId:'r',grantId:'g'},canOfferReferenceCorrection:()=>true};const host=await createToolHost(options);t.after(()=>host.close());
 const source=(await host.execute({id:'read',name:'read_page',arguments:{documentId:'atlas-b',page:1}})).value;
 const badAttachment=await host.execute({id:'bad',name:'save_report',arguments:{text:'Unverified [1]',sourceIds:['wrong'],attachmentIds:['artifact:sha256:'+'a'.repeat(64)]}});assert.equal(badAttachment.status,'rejected');assert.equal(badAttachment.deliveryAssessment,undefined);
 const restricted=await createToolHost({...options,allowedDocuments:['atlas-a']});t.after(()=>restricted.close());const denied=await restricted.execute({id:'denied',name:'save_report',arguments:{text:'Unverified [1]',sourceIds:[source.sourceId]}});assert.equal(denied.status,'rejected');assert.equal(denied.deliveryAssessment,undefined);assert.match(denied.error,/scope/);
});
test('plugin error spelling does not acquire builtin delivery authority or another model round',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/answer-plugin-negative-'));t.after(()=>rm(directory,{recursive:true,force:true}));const store=await openSession({directory});t.after(()=>store.close());let calls=0;
 const bindings={gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'fake',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
 const outcome=await run({question:'Do not trust plugin error strings.',outputRoot:join(directory,'outputs'),publication:true,extensions:[{name:'fake',description:'Synthetic rejection',parameters:{type:'object'},validate(){throw new Error('REPORT_CITATIONS_DEGRADED');},execute(){assert.fail('not dispatched');}}],gateway:{mode:'fixture',next(){calls++;return call('fake','fake',{});}},durable:{store,grantId:'g',bindings}});
 assert.equal(outcome.status,'failed');assert.equal(outcome.code,'TOOL_REJECTED');assert.equal(calls,1);assert.equal(store.publication(outcome.runId),null);
});
test('diagnostic log open failure cannot prevent original sealed-final Publication',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/answer-log-'));t.after(()=>rm(directory,{recursive:true,force:true}));const store=await openSession({directory});t.after(()=>store.close());
 const bindings={gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'log',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
 const outcome=await run({question:'Publish despite optional log failure.',outputRoot:join(directory,'outputs'),publication:true,requireReport:true,gateway:{mode:'fixture',next(){return{kind:'final',text:'Original answer without a Report.'};}},durable:{store,grantId:'g',bindings,async onClaim(e){await mkdir(join(store.inspect(e.runId).directory,'run.jsonl'));}}});
 assert.equal(outcome.status,'completed',outcome.code);assert.equal(outcome.receipt,null);assert.equal(store.publication(outcome.runId).content.text,outcome.answer);assert.ok(outcome.controlObservations.some(o=>o.owner==='log'));
});
test('post-publication result readback failure cannot revoke committed text or Run completion',async t=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/answer-readback-'));t.after(()=>rm(directory,{recursive:true,force:true}));const store=await openSession({directory});t.after(()=>store.close());let calls=0;
 const bindings={gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'readback',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
 const outcome=await run({question:'Keep the delivered answer.',outputRoot:join(directory,'outputs'),publication:true,allowedTools:['read_page','save_report'],allowedDocuments:['atlas-a'],gateway:{mode:'fixture',next(){calls++;return calls===1?call('read','read_page',{documentId:'atlas-a',page:1}):{kind:'final',text:'Original published answer.'};}},durable:{store,grantId:'g',bindings,async onCheckpoint(e){if(e.phase==='publication-committed'){const r=store.inspect(e.runId);await writeFile(join(r.directory,r.snapshot.host.results[0].recordPath),'corrupt after commit');}}}});
 assert.equal(outcome.status,'completed',outcome.code);assert.ok(outcome.controlObservations.some(o=>o.owner==='result-readback'));assert.equal(store.publication(outcome.runId).content.text,outcome.answer);assert.equal(calls,2);
});
