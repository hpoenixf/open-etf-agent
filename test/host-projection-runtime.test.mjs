import {spawnSync} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {createResearchProject,openProjectSpecialists,submitResearchTask,inspectResearchTask,workResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}],usage:null});
test('actual Runtime latest Child reference and Unicode pages survive cold read without replay',async()=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/host-runtime-'));
 await createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'projection'},capabilities:['report','child'],contextBytes:16000}});
 const file=join(root,'synthetic.md');await writeFile(file,'Synthetic: export needs active authorization.');const sources=await importProjectSources({projectDir:root,files:[file]});
 const profiles=await openProjectSpecialists({projectDir:root,create:true}),profile=await profiles.createProfile('comparison',{name:'Compare',description:'Check exact scope',enabled:true,method:CLAIM_COMPARISON_METHOD});
 const request={projectDir:root,runId:'projection',question:'Review the synthetic export condition, then save an original-source report.',sourceManifestSha256:sources.manifestSha256,specialistSelection:{profiles:[{profileId:profile.profileId,revision:1}],maxChildren:1}};
 await submitResearchTask(request);
 const summary='中🙂é'.repeat(2500);let read='',offset=0,round=0,children=0,ref,sourceIds,resuming=false;
 const gateway={mode:'fixture',inputBudget:{maxBytes:24000,measure:input=>Buffer.byteLength(JSON.stringify(input))},async next({messages,reservation}){
  assert.ok(Buffer.byteLength(JSON.stringify({messages,tools:arguments[0].tools}))<=24000);
  const results=messages.filter(m=>m.role==='tool').map(m=>m.result);assert.ok(results.every(r=>r.status==='succeeded'),JSON.stringify(results.map(r=>r.error)));
  if(reservation.runId!=='projection'){assert.equal(resuming,false,'No Child replay on resume');children++;return results.length?{kind:'final',text:summary,usage:null}:call('original','read_page',{documentId:sources.catalog.documents[0].id,page:1});}
  round++;const last=results.at(-1)?.value;
  if(!results.length)return call('delegate','delegate_child',{methodId:CLAIM_COMPARISON_METHOD.id,question:'Check exact condition.',documents:sources.catalog.documents.map(d=>d.id)});
  if(!ref){assert.equal(last.child.kind,'stored-derived-ref');ref=last.child.resultRef;sourceIds=last.sources.map(s=>s.sourceId);}
  if(last.kind==='derived-text-page'){assert.equal(last.coverage.offset,offset);read+=last.text;offset=last.coverage.nextOffset;}
  if(offset!==null)return call('page-'+round,'read_result',{resultRef:ref,selection:{offset,limit:2500}});
  assert.equal(read,summary);
  if(!results.some(r=>r.value?.path==='report.md'))return call('save','save_report',{text:'# Export\nRequires active authorization.',sourceIds});
  return {kind:'final',text:'Saved.',usage:null};
 }};
 const stop=new AbortController();let paused=false;
 await workResearchTask({...request,gateway,hostSignal:stop.signal,onCheckpoint(info){if(info.runId==='projection'&&info.phase==='working-input'&&children===2&&round===1){paused=true;stop.abort();}}});
 assert.equal(paused,true);const suspended=await inspectResearchTask(request);assert.equal(suspended.run.status,'active');assert.equal(suspended.run.snapshot.working.messages.at(-1).result.value.child.kind,'stored-derived-ref');assert.equal(children,2);assert.equal(round,1);
 const code=`import assert from 'node:assert/strict';import {workResearchTask} from ${JSON.stringify(new URL('../src/research-project.mjs',import.meta.url).href)};import {sha256} from ${JSON.stringify(new URL('../src/source.mjs',import.meta.url).href)};
 const summary=${JSON.stringify(summary)},sources=${JSON.stringify(sources)},request=${JSON.stringify(request)};let read='',offset=0,round=1,children=2,ref,sourceIds,resuming=true;const call=${call.toString()};const gateway={mode:'fixture',inputBudget:{maxBytes:24000,measure:v=>Buffer.byteLength(JSON.stringify(v))},${gateway.next.toString()}};
 const done=await workResearchTask({...request,gateway});process.stdout.write(JSON.stringify({pid:process.pid,status:done.run.status,code:done.run.snapshot?.code,readHash:sha256(read),children,round}));`;
 const processResult=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC'}});assert.equal(processResult.status,0,processResult.stderr);const done=JSON.parse(processResult.stdout);assert.notEqual(done.pid,process.pid);assert.equal(done.status,'completed',done.code);assert.equal(done.children,2);const {sha256}=await import('../src/source.mjs');assert.equal(done.readHash,sha256(summary));
 const before=await inspectResearchTask(request);assert.deepEqual(before.run.snapshot.messages.slice(0,suspended.run.snapshot.messages.length),suspended.run.snapshot.messages);assert.equal(before.run.definition.deadlineAt,suspended.run.definition.deadlineAt);assert.equal(before.run.snapshot.unknownEffects.length,0);assert.equal(suspended.run.rootUsage.model,3);assert.equal(before.run.rootUsage.model-suspended.run.rootUsage.model,done.round-1);assert.equal(before.run.rootUsage.tool-suspended.run.rootUsage.tool,5);
 const reopened=await workResearchTask({...request,gateway:{...gateway,next(){throw Error('No terminal replay allowed');}}});assert.equal(reopened.run.status,'completed');assert.equal((await inspectResearchTask(request)).run.snapshot.outcome.answer,before.run.snapshot.outcome.answer);

});
import {run} from '../src/runtime.mjs';
test('default new policy checks encoded gateway capacity even without explicit contextBytes or reader grant',async()=>{
 await mkdir('test-output',{recursive:true});const outputRoot=await mkdtemp(resolve('test-output/encoded-host-'));let calls=0;
 const gateway={mode:'fixture',inputBudget:{maxBytes:128,measure:v=>Buffer.byteLength(JSON.stringify(v))},async next(){calls++;return{kind:'final',text:'Must not dispatch'};}};
 const result=await run({question:'中'.repeat(500),gateway,outputRoot,hostProjection:'host-results@1',allowedTools:['read_page']});assert.equal(result.code,'CONTEXT_CAPACITY_EXCEEDED');assert.equal(calls,0);
 const small=await run({question:'Small',gateway:{...gateway,inputBudget:{maxBytes:10000,measure:v=>Buffer.byteLength(JSON.stringify(v))}},outputRoot,hostProjection:'host-results@1',allowedTools:['read_page']});assert.equal(small.status,'completed');assert.equal(calls,1);
});
