import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,access,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createResearchProject,openProjectSpecialists,submitResearchTask,inspectResearchTask,workResearchTask,readResearchReport} from '../src/research-project.mjs';
import {acquireProjectWebSources,inspectWebAcquisition} from '../src/web-acquisition.mjs';
import {loadProjectSources} from '../src/project-sources.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {prepareReportReview,submitReportReview,executeReportReview,readReportReview} from '../src/report-review.mjs';
import {openArtifactStore} from '../src/artifacts.mjs';
import {readFixturePage} from '../src/source.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';

const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}],usage:null});
async function root(t,prefix){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/'+prefix));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}

test('original v026 acquisition -> selected v027 profile -> actual Child -> original report -> advisory Review, offline transport only',async t=>{
 const directory=await root(t,'review-owner-'),projectDir=join(directory,'project'),reviewDir=join(directory,'review');
 const url='https://example.com/review-source';
 const network=mockWebNetwork(t,{routes:{'https://example.com/robots.txt':{body:'User-agent: *\nAllow: /\n'},[url]:{status:200,headers:{'content-type':'text/html; charset=utf-8'},body:'<h1>Original terms</h1><p>CSV export costs 12 units.</p><p>Active authorization is required.</p><script>Never execute this.</script>'}}});
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'review-integration'},capabilities:['report','child'],contextBytes:131072}});
 const acquisition=await acquireProjectWebSources({projectDir,acquisitionId:'review-input',urls:[url],approvePublicFetch:true});
 assert.equal(acquisition.acquisition.status,'succeeded');assert.equal(acquisition.acquisition.requestCount,2);assert.equal(network.calls.length,2);
 const doc=acquisition.catalog.documents[0];assert.doesNotMatch(doc.pages.join(''),/Never execute/);
 const profiles=await openProjectSpecialists({projectDir,create:true});
 const profile=await profiles.createProfile('comparison',{name:'Terms comparison',description:'Check scope from original acquired text',enabled:true,method:CLAIM_COMPARISON_METHOD});
 const request={projectDir,runId:'web-profile-report',question:'Use the selected comparison specialist to inspect export cost and conditions, then save an original-source report.',sourceManifestSha256:acquisition.manifestSha256,specialistSelection:{profiles:[{profileId:profile.profileId,revision:1}],maxChildren:1}};
 await submitResearchTask(request);
 const taskPath=join(projectDir,'tasks','web-profile-report.json'),frozenTask=await readFile(taskPath);
 assert.equal((await inspectResearchTask(request)).definition.specialistSelection.profiles[0].revision,1);
 // The queued task owns the selected immutable profile revision, not current UI state.
 await profiles.removeProfile(profile.profileId,1);
 let mainCalls=0,childCalls=0;
 const gateway={mode:'fixture',async next({messages,reservation}){
  const results=messages.filter(m=>m.role==='tool').map(m=>m.result);assert.ok(results.every(r=>r.status==='succeeded'));
  if(reservation.runId!==request.runId){childCalls++;if(!results.length)return call('child-original','read_page',{documentId:doc.id,page:1});return {kind:'final',text:'Derived observation: export costs 12 units and requires active authorization.',usage:null};}
  mainCalls++;const handoff=results.find(r=>r.value?.child);
  if(!handoff)return call('selected-profile','delegate_child',{methodId:CLAIM_COMPARISON_METHOD.id,question:'Check cost and authorization from the original terms.',documents:[doc.id]});
  assert.equal(handoff.value.sources[0].web.requestedUrl,url);
  if(!results.some(r=>r.value?.path==='report.md'))return call('original-report','save_report',{text:'# Export terms\nCSV export costs 12 units. Active authorization is required.',sourceIds:handoff.value.sources.map(s=>s.sourceId)});
  return {kind:'final',text:'Saved original-source report.',usage:null};
 }};
 const worked=await workResearchTask({...request,gateway});assert.equal(worked.run.status,'completed');assert.equal(mainCalls,3);assert.equal(childCalls,2);
 const original=await readResearchReport(request);assert.equal(original.revision.sources[0].web.requestedUrl,url);
 const artifacts=await openArtifactStore({directory:worked.run.directory,readOnly:true});
 const beforeReport=await artifacts.read(original.revision.reportId),beforeRevisions=await artifacts.listRevisions();
 const packet=await prepareReportReview({sourceDirectory:worked.run.directory,revisionId:original.revision.revisionId,requestId:'selected-profile-review'});
 assert.deepEqual(packet.packet.revision.sources,original.revision.sources);assert.equal(packet.packet.gaps.length,2);
 const receipt=await submitReportReview({directory:reviewDir,request:packet}),quote='CSV export costs 12 units.',start=packet.packet.report.text.indexOf(quote);
 let reviewerCalls=0;
 const reviewed=await executeReportReview({directory:reviewDir,runId:receipt.runId,gateway:{mode:'fixture',next:async()=>{reviewerCalls++;return {kind:'final',text:JSON.stringify({findings:[{quote,start,end:start+quote.length,kind:'fact',materialSupport:'supported',citationCorrespondence:'unknown',reason:'Scripted original-source correspondence fixture, not a semantic model result.',evidence:[{sourceId:packet.packet.revision.sources[0].sourceId,quote}],uncertainty:'No real model reviewed this claim.'}],unchecked:['Semantic quality and exact citation interpretation remain unverified.']})};}}});
 assert.equal(reviewed.status,'completed');assert.equal(reviewed.authority,'advisory-only');assert.equal(reviewed.rootUsage.model,1);assert.equal(reviewerCalls,1);
 assert.deepEqual(await readReportReview({directory:reviewDir,runId:receipt.runId}),reviewed);
 assert.deepEqual(await readFile(taskPath),frozenTask);assert.deepEqual((await artifacts.read(original.revision.reportId)).bytes,beforeReport.bytes);assert.deepEqual(await artifacts.listRevisions(),beforeRevisions);
 assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'review-input'})).status,'succeeded');assert.deepEqual((await loadProjectSources({projectDir,manifestSha256:acquisition.manifestSha256})).catalog,acquisition.catalog);
 assert.equal(network.calls.length,2);assert.equal(mainCalls,3);assert.equal(childCalls,2);
});

test('unknown review survives process exit and independent CLI cold read/reexecute without invoking a Gateway factory',async t=>{
 const directory=await root(t,'review-unknown-process-'),sourceDir=join(directory,'source'),reviewDir=join(directory,'review');await mkdir(sourceDir);
 const artifacts=await openArtifactStore({directory:sourceDir}),source=await readFixturePage({documentId:'atlas-a',page:1});
 const report=await artifacts.put({format:'markdown',content:'# Original\nThis is a synthetic report.'});const revision=await artifacts.revise({reportId:report.artifactId,sources:[source]});
 const request=await prepareReportReview({sourceDirectory:sourceDir,revisionId:revision.revisionId,requestId:'unknown-process'});const {runId}=await submitReportReview({directory:reviewDir,request});
 const reviewModule=new URL('../src/report-review.mjs',import.meta.url).href;
 const producer=spawnSync(process.execPath,['--input-type=module','-e',`import {executeReportReview} from ${JSON.stringify(reviewModule)};let calls=0;const result=await executeReportReview({directory:${JSON.stringify(reviewDir)},runId:${JSON.stringify(runId)},gateway:{mode:'fixture',next:async()=>{calls++;throw Error('Synthetic lost settlement after dispatch');}}});process.stdout.write(JSON.stringify({calls,result}));`],{encoding:'utf8',timeout:10000});
 assert.equal(producer.status,0,producer.stderr);const original=JSON.parse(producer.stdout);assert.equal(original.calls,1);assert.equal(original.result.status,'unknown');assert.equal(original.result.rootUsage.model,1);assert.equal(original.result.settlementUnknown,true);
 const cold=spawnSync(process.execPath,['src/report-review-cli.mjs','read','--session',reviewDir,'--run',runId],{encoding:'utf8',timeout:10000});assert.equal(cold.status,0,cold.stderr);assert.deepEqual(JSON.parse(cold.stdout),original.result);
 const marker=join(directory,'factory-called'),module=join(directory,'host.mjs');
 await writeFile(module,`import {writeFile} from 'node:fs/promises';export const gatewayBinding=${JSON.stringify(original.result.gatewayBinding)};export async function createGateway(){await writeFile(${JSON.stringify(marker)},'unexpected');throw Error('Must not invoke a terminal unknown Gateway factory');}`);
 const rerun=spawnSync(process.execPath,['src/report-review-cli.mjs','run','--session',reviewDir,'--run',runId,'--gateway-module',module],{encoding:'utf8',timeout:10000});assert.equal(rerun.status,1,rerun.stderr);assert.deepEqual(JSON.parse(rerun.stdout),original.result);await assert.rejects(access(marker),{code:'ENOENT'});
 assert.deepEqual((await artifacts.read(revision.reportId)).bytes,Buffer.from('# Original\nThis is a synthetic report.'));
});
