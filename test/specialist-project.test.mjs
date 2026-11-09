import {randomUUID} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as project from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}],usage:null});
test('selected Project task freezes one method body; ACK and cold Child consume without catalog',async t=>{
 const root=await mkdtemp(join(process.env.V027_TEST_ROOT??tmpdir(),'specialist-project-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await project.createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'profiles'},capabilities:['report','child']}});
 const source=join(root,'source.md');await writeFile(source,'SYNTHETIC service supports CSV.');const bundle=await importProjectSources({projectDir:root,files:[source]});
 const store=await project.openProjectSpecialists({projectDir:root,create:true});const p=await store.createProfile(randomUUID(),{name:'Compare',description:'Synthetic comparison',enabled:true,method:CLAIM_COMPARISON_METHOD});
 const args={projectDir:root,runId:'selected',question:'Ask the specialist to check source formats and save a report.',sourceManifestSha256:bundle.manifestSha256,specialistSelection:{profiles:[{profileId:p.profileId,revision:1}],maxChildren:1}};
 await project.submitResearchTask(args);const path=join(root,'tasks/selected.json'),before=await readFile(path);const {definition}=JSON.parse(before);assert.equal(definition.specialistSelection.profiles[0].profileId,p.profileId);assert.equal(definition.config.childExecution.methods[0].id,CLAIM_COMPARISON_METHOD.id);assert.equal(JSON.stringify(definition.specialistSelection).includes(CLAIM_COMPARISON_METHOD.text),false);
 await store.removeProfile(p.profileId,1);await rename(join(root,'specialists'),join(root,'catalog-removed'));await project.submitResearchTask(args);assert.deepEqual(await readFile(path),before);
 await assert.rejects(project.submitResearchTask({...args,runId:'new'}),e=>e.code==='ENOENT');await assert.rejects(project.submitResearchTask({...args,specialistSelection:{...args.specialistSelection,maxChildren:2}}),e=>e.code==='PROJECT_TASK_ALREADY_DEFINED');
 let childCalls=0;const gateway={mode:'fixture',async next({messages,reservation}){const results=messages.filter(m=>m.role==='tool').map(m=>m.result);assert.ok(results.every(r=>r.status==='succeeded'),JSON.stringify(results));if(reservation.runId!=='selected'){childCalls++;if(!results.length)return call('read','read_page',{documentId:bundle.catalog.documents[0].id,page:1});return{kind:'final',text:'Original confirms CSV.',usage:null};}if(!results.some(r=>r.value?.child))return call('delegate','delegate_child',{methodId:CLAIM_COMPARISON_METHOD.id,question:'Check supported formats.',documents:[bundle.catalog.documents[0].id]});if(!results.some(r=>r.value?.path==='report.md'))return call('save','save_report',{text:'# Synthetic formats\nCSV supported.',sourceIds:results.find(r=>r.value?.child).value.sources.map(s=>s.sourceId)});return{kind:'final',text:'Saved.',usage:null};}};
 const result=await project.workResearchTask({projectDir:root,runId:'selected',gateway});assert.equal(result.run.status,'completed',JSON.stringify(result));assert.ok(childCalls>=2);assert.match((await project.readResearchReport({projectDir:root,runId:'selected'})).report.text,/CSV/);
});

test('operator CLI lifecycle and preset selection uses explicit revisions',async t=>{
 const {runResearchCli}=await import('../src/research-cli.mjs');
 const root=await mkdtemp(join(process.env.V027_TEST_ROOT??tmpdir(),'specialist-cli-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await project.createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'profiles'},capabilities:['report','child']}});
 async function cli(args){let stdout='',stderr='';const code=await runResearchCli([...args,'--project',root],{stdout:{write:v=>stdout+=v},stderr:{write:v=>stderr+=v}});assert.equal(code,0,stderr);return JSON.parse(stdout);}
 await cli(['specialist','init']);const file=join(root,'profile-input.json');await writeFile(file,JSON.stringify({name:'Check',description:'Original sources',enabled:true,method:CLAIM_COMPARISON_METHOD}));const p=await cli(['specialist','create','--id','cli-profile','--profile',file]);assert.equal((await cli(['specialist','read','--id',p.profileId])).revision,1);
 const presetFile=join(root,'preset-input.json');await writeFile(presetFile,JSON.stringify({name:'One',profiles:[{profileId:p.profileId,revision:1}]}));const preset=await cli(['preset','create','--id','cli-preset','--preset',presetFile]);
 const selection=join(root,'selection.json'),question=join(root,'question.txt'),source=join(root,'source.md');await writeFile(selection,JSON.stringify({presetId:preset.presetId,revision:1,maxChildren:1}));await writeFile(question,'Check the source.');await writeFile(source,'Synthetic CSV.');const bundle=await importProjectSources({projectDir:root,files:[source]});
 const result=await cli(['run','submit','--run','cli-task','--question',question,'--manifest',bundle.manifestSha256,'--specialists',selection]);assert.equal(result.specialistSelection.preset.presetId,preset.presetId);
 await cli(['preset','remove','--id',preset.presetId,'--revision','1']);await cli(['specialist','remove','--id',p.profileId,'--revision','1']);assert.equal((await cli(['specialist','list'])).profiles.length,0);
 await cli(['run','submit','--run','cli-task','--question',question,'--manifest',bundle.manifestSha256,'--specialists',selection]);
});
