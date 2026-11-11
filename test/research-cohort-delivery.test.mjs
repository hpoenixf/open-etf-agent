import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,inspectResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {inspectResearchCohortDelivery} from '../scripts/acceptance/research-cohort-delivery.mjs';
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
async function fixture(t){
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/cohort-delivery-'));t.after(()=>rm(projectDir,{force:true,recursive:true}));
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'cohort'},capabilities:['report']}});
 const source=join(projectDir,'source.md');await writeFile(source,'Synthetic evidence.');const bundle=await importProjectSources({projectDir,files:[source]});
 const cases=[];for(const runId of ['normal','publication']){await submitResearchTask({projectDir,runId,question:'Read the source and save a report.',sourceManifestSha256:bundle.manifestSha256});cases.push({caseId:runId,runId,requireReport:true,definitionSha256:hash((await inspectResearchTask({projectDir,runId})).definition)});}
 return {projectDir,manifest:{schemaVersion:'research-cohort-delivery@1',minimumCompleted:1,cases},documentId:bundle.catalog.documents[0].id};
}
test('fixed denominator does not turn completed Publication-only case into required report coverage',async t=>{
 const f=await fixture(t);const early=await inspectResearchCohortDelivery(f);assert.equal(early.deliveryQualified,false);assert.equal(early.unsettled.length,2);
 await workResearchTask({...f,runId:'publication',gateway:{mode:'fixture',next:async()=>({kind:'final',text:'Persistent answer only.'})}});
 await workResearchTask({...f,runId:'normal',gateway:{mode:'fixture',async next({messages}){const results=messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!results.length)return {kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:f.documentId,page:1}}]};if(results.length===1)return {kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'Synthetic evidence.',sourceIds:[results[0].sourceId]}}]};return {kind:'final',text:'Saved.'};}}});
 const result=await inspectResearchCohortDelivery(f);assert.equal(result.completed,2);assert.equal(result.denominator,2);assert.equal(result.runtimeThresholdMet,true);assert.deepEqual(result.missingReports,['publication']);assert.equal(result.deliveryQualified,false);assert.deepEqual(result.unsettled,[]);assert.equal(result.releaseEligibility,'not-assessed');assert.equal(result.semanticStatus,'not-assessed');assert.deepEqual(await inspectResearchCohortDelivery(f),result);
 // A separately declared contract may permit Publication, but is a different
 // manifest, not an upgrade of the original frozen denominator or coverage.
 const alternate=structuredClone(f);alternate.manifest.cases[1].requireReport=false;const allowed=await inspectResearchCohortDelivery(alternate);assert.equal(allowed.deliveryQualified,true);assert.notEqual(allowed.manifestSha256,result.manifestSha256);
});
test('duplicate runs, replaced task identity and invalid thresholds cannot qualify',async t=>{
 const f=await fixture(t);
 for(const change of [m=>m.cases.push(m.cases[0]),m=>m.minimumCompleted=0,m=>m.minimumCompleted=3,m=>m.cases[0].requireReport=undefined]){const manifest=structuredClone(f.manifest);change(manifest);await assert.rejects(inspectResearchCohortDelivery({...f,manifest}),{code:'COHORT_MANIFEST_INVALID'});}
 const manifest=structuredClone(f.manifest);manifest.cases[0].definitionSha256='0'.repeat(64);await assert.rejects(inspectResearchCohortDelivery({...f,manifest}),{code:'COHORT_TASK_IDENTITY_CHANGED'});
});
