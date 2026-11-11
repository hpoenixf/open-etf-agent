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
test('Host projection executes long Unicode local task and authored method across three granted documents',async t=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/specialist-v026-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'integration'},capabilities:['report','child'],contextBytes:131072}});
 const files=[];for(let i=0;i<3;i++){const file=join(root,'original-'+i+'.md');await writeFile(file,'Synthetic specification '+i+': CSV export needs active authorization.');files.push(file);}const sources=await importProjectSources({projectDir:root,files});const {sha256}=await import('../src/source.mjs');const text='X'.repeat(7999),method={...CLAIM_COMPARISON_METHOD,text,contentSha256:sha256(text)};
 const profiles=await openProjectSpecialists({projectDir:root,create:true}),profile=await profiles.createProfile('comparison',{name:'Compare',description:'Check exact scope',enabled:true,method});
 const request={projectDir:root,runId:'integrated',question:'Ask the comparison specialist to inspect the stated export condition, then save an original-source report.',sourceManifestSha256:sources.manifestSha256,specialistSelection:{profiles:[{profileId:profile.profileId,revision:1}],maxChildren:1}};
 await submitResearchTask(request);const saved=await readFile(join(root,'tasks/integrated.json'));const before=await inspectResearchTask(request);assert.equal(before.definition.reportGuidance,REPORT_GUIDANCE_PROFILE);assert.equal(before.definition.config.contextBytes,131072);assert.equal(before.run.definition.config.contextBytes,131072);assert.equal(before.definition.specialistSelection.profiles[0].revision,1);
 await profiles.removeProfile(profile.profileId,1);await submitResearchTask(request);assert.deepEqual(await readFile(join(root,'tasks/integrated.json')),saved);
 let children=0,main=0;const gateway={mode:'fixture',async next({messages,reservation}){
  const results=messages.filter(m=>m.role==='tool').map(m=>m.result);assert.ok(results.every(r=>r.status==='succeeded'));
  if(reservation.runId!=='integrated'){children++;const q=messages.find(m=>m.role==='user').content;assert.equal(q.split(text).length-1,1);if(results.length<3)return call('child-read-'+results.length,'read_page',{documentId:sources.catalog.documents[results.length].id,page:1});return {kind:'final',text:'CSV export is conditional on active authorization.',usage:null};}
  main++;assert.ok(messages.some(m=>m.role==='user'&&m.content.includes('Report fidelity guidance:')));
  const child=results.find(r=>r.value?.child);if(!child)return call('delegate','delegate_child',{methodId:CLAIM_COMPARISON_METHOD.id,question:'中文😀\\\"\n'.repeat(600),documents:sources.catalog.documents.map(d=>d.id)});
  if(!results.some(r=>r.value?.path==='report.md'))return call('save','save_report',{text:'# Conditional export\nCSV export requires active authorization.',sourceIds:child.value.sources.map(s=>s.sourceId)});
  return {kind:'final',text:'Saved original-source report.',usage:null};
 }};
 const completed=await workResearchTask({...request,gateway});assert.equal(completed.run.status,'completed');assert.equal(children,4);assert.equal(main,3);assert.deepEqual(await readFile(join(root,'tasks/integrated.json')),saved);
});
