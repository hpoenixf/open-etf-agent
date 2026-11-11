import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,readResearchOutput} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {inspectResearchDelivery} from '../scripts/acceptance/research-delivery.mjs';
async function setup(){
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/delivery-observation-'));
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'delivery-observation'},capabilities:['report']}});
 const source=join(projectDir,'source.md');await writeFile(source,'SYNTHETIC: supports CSV.\n');
 const bundle=await importProjectSources({projectDir,files:[source]});
 await submitResearchTask({projectDir,runId:'test',question:'Read the source and save a report.',sourceManifestSha256:bundle.manifestSha256});
 return {projectDir,runId:'test',documentId:bundle.catalog.documents[0].id};
}
test('delivery observation distinguishes active, Publication-only and report without dispatch or replay',async()=>{
 const f=await setup();let calls=0;
 const before=await inspectResearchDelivery(f);assert.equal(before.runtimeCompleted,false);assert.equal(before.publicationCommitted,false);assert.equal(before.reportArtifactPresent,false);
 await workResearchTask({...f,gateway:{mode:'fixture',async next(){calls++;return {kind:'final',text:'合成中文持久答案，没有报告。',usage:null};}}});
 const first=await inspectResearchDelivery(f);assert.equal(first.runtimeCompleted,true);assert.equal(first.publicationCommitted,true);assert.equal(first.reportArtifactPresent,false);assert.equal(first.reportStatus,'not-created');assert.ok(first.publication.bytes>0);assert.equal(first.semanticStatus,'not-assessed');assert.equal(first.releaseEligibility,'not-assessed');
 assert.deepEqual(first.publication,{sha256:createHash('sha256').update('合成中文持久答案，没有报告。').digest('hex'),bytes:Buffer.byteLength('合成中文持久答案，没有报告。')});assert.deepEqual(await inspectResearchDelivery(f),first);assert.equal(calls,1);await assert.rejects(inspectResearchDelivery({...f,runId:'missing'}));
});
test('report observation retains actual artifact fingerprint separate from Publication body',async()=>{
 const f=await setup();let calls=0;
 await workResearchTask({...f,gateway:{mode:'fixture',async next({messages}){calls++;const results=messages.filter(m=>m.role==='tool').map(m=>m.result.value);const page=results.find(v=>v.sourceId);if(!page)return {kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:f.documentId,page:1}}],usage:null};if(!results.some(v=>v.path==='report.md'))return {kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'# Synthetic report\nSupports CSV.',sourceIds:[page.sourceId]}}],usage:null};return {kind:'final',text:'Report saved.',usage:null};}}});
 const out=await inspectResearchDelivery(f);assert.equal(out.runtimeCompleted,true);assert.equal(out.publicationCommitted,true);assert.equal(out.reportArtifactPresent,true);assert.equal(out.reportStatus,'present');assert.match(out.report.sha256,/^[0-9a-f]{64}$/);assert.ok(out.report.bytes>0);assert.deepEqual(await inspectResearchDelivery(f),out);assert.equal(calls,3);
 const original=await readResearchOutput(f);assert.equal(out.report.sha256,createHash('sha256').update(original.report.text).digest('hex'));assert.equal(out.report.bytes,Buffer.byteLength(original.report.text));assert.equal(out.publication.sha256,createHash('sha256').update(original.publication.content.text).digest('hex'));
 const path=join(original.directory,'artifacts','objects',out.report.sha256+'.md');const bytes=await readFile(path);
 try{await writeFile(path,'synthetic damaged bytes');const damaged=await inspectResearchDelivery(f);assert.equal(damaged.publicationCommitted,true);assert.equal(damaged.reportArtifactPresent,false);assert.equal(damaged.reportStatus,'unavailable');assert.equal(damaged.reportError,'REPORT_ARTIFACT_UNAVAILABLE');}finally{await writeFile(path,bytes);}
 assert.deepEqual(await inspectResearchDelivery(f),out);assert.equal(calls,3);
});
