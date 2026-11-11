import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResearchProject,openProjectSpecialists,submitResearchTask,inspectResearchTask,workResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {REPORT_GUIDANCE_PROFILE} from '../src/report-guidance.mjs';
import {parseResearchArguments} from '../src/research-cli.mjs';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}],usage:null});
test('selected specialist preserves v026 context and frozen report guidance through duplicate submit and actual Child',async t=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/specialist-v026-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'integration'},capabilities:['report','child'],contextBytes:131072}});
 const file=join(root,'original.md');await writeFile(file,'Synthetic specification: CSV export needs an active authorization.');const sources=await importProjectSources({projectDir:root,files:[file]});
 const profiles=await openProjectSpecialists({projectDir:root,create:true}),profile=await profiles.createProfile('comparison',{name:'Compare',description:'Check exact scope',enabled:true,method:CLAIM_COMPARISON_METHOD});
 const request={projectDir:root,runId:'integrated',question:'Ask the comparison specialist to inspect the stated export condition, then save an original-source report.',sourceManifestSha256:sources.manifestSha256,specialistSelection:{profiles:[{profileId:profile.profileId,revision:1}],maxChildren:1}};
 await submitResearchTask(request);const saved=await readFile(join(root,'tasks/integrated.json'));const before=await inspectResearchTask(request);assert.equal(before.definition.reportGuidance,REPORT_GUIDANCE_PROFILE);assert.equal(before.definition.config.contextBytes,131072);assert.equal(before.run.definition.config.contextBytes,131072);assert.equal(before.definition.specialistSelection.profiles[0].revision,1);
 await profiles.removeProfile(profile.profileId,1);await submitResearchTask(request);assert.deepEqual(await readFile(join(root,'tasks/integrated.json')),saved);
 let children=0,main=0;const gateway={mode:'fixture',async next({messages,reservation}){
  const results=messages.filter(m=>m.role==='tool').map(m=>m.result);assert.ok(results.every(r=>r.status==='succeeded'));
  if(reservation.runId!=='integrated'){children++;if(!results.length)return call('child-read','read_page',{documentId:sources.catalog.documents[0].id,page:1});return {kind:'final',text:'CSV export is conditional on active authorization.',usage:null};}
  main++;assert.ok(messages.some(m=>m.role==='user'&&m.content.includes('Report fidelity guidance:')));
  const child=results.find(r=>r.value?.child);if(!child)return call('delegate','delegate_child',{methodId:CLAIM_COMPARISON_METHOD.id,question:'Check the exact CSV export condition.',documents:[sources.catalog.documents[0].id]});
  if(!results.some(r=>r.value?.path==='report.md'))return call('save','save_report',{text:'# Conditional export\nCSV export requires active authorization.',sourceIds:child.value.sources.map(s=>s.sourceId)});
  return {kind:'final',text:'Saved original-source report.',usage:null};
 }};
 const completed=await workResearchTask({...request,gateway});assert.equal(completed.run.status,'completed');assert.equal(children,2);assert.equal(main,3);assert.deepEqual(await readFile(join(root,'tasks/integrated.json')),saved);
});
test('CLI retains Web acquisition alongside specialist and capacity maintenance options',()=>{
 assert.equal(parseResearchArguments(['source','acquire','--project','p','--acquisition','a','--urls','u.json','--approve-public-fetch','--network-profile','platform-doh-pinned@1']).options['approve-public-fetch'],true);
 assert.equal(parseResearchArguments(['run','submit','--project','p','--run','r','--question','q.txt','--manifest','abc','--specialists','s.json']).options.specialists,'s.json');
 assert.equal(parseResearchArguments(['capacity','maintain','--project','p','--run','r']).command,'capacity maintain');
});
