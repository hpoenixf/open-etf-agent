import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResearchProject,submitResearchTask,inspectResearchTask,readResearchReport,cancelResearchTask,workResearchTask} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
const config=(capabilities=[],extra={})=>({schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'admission-only'},capabilities:['report',...capabilities],...extra});
const reason=code=>error=>error.code===code;
async function rootFor(t){await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/research-admission-owned-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function setup(t,cfg=config()){const root=await rootFor(t);await createResearchProject({directory:root,config:cfg});const source=join(root,'selected.md');await writeFile(source,'Synthetic selected source.');const bundle=await importProjectSources({projectDir:root,files:[source]});return {root,source,bundle,request:{projectDir:root,runId:'same-run',question:'Summarize the selected source.',sourceManifestSha256:bundle.manifestSha256}};}
async function absentTask(root,runId='same-run'){await assert.rejects(stat(join(root,'tasks',runId+'.json')),reason('ENOENT'));}
test('project admission exact resubmit retains original Run grant and rejects changed request',async t=>{
 const f=await setup(t),first=await submitResearchTask(f.request),before=await inspectResearchTask(f.request);const saved=await readFile(join(f.root,'tasks','same-run.json'));
 const second=await submitResearchTask(f.request),after=await inspectResearchTask(f.request);
 assert.equal(first.runId,second.runId);assert.equal(after.definition.grantId,before.definition.grantId);assert.deepEqual(after.run.definition,before.run.definition);assert.deepEqual(await readFile(join(f.root,'tasks','same-run.json')),saved);assert.deepEqual(after.run.rootUsage,{model:0,tool:0});
 await assert.rejects(submitResearchTask({...f.request,question:'Different task.'}),reason('PROJECT_TASK_ALREADY_DEFINED'));
 assert.deepEqual(await readFile(join(f.root,'tasks','same-run.json')),saved);
});
test('project admission unsupported response or trusted-package Child fails before project/task publication',async t=>{
 for(const [cfg,code] of [[config(['response','child']),'PROJECT_RESPONSE_CHILD_UNSUPPORTED'],[config(['trusted-tools','child'],{trustedPackages:[{modulePath:'never-read.mjs',sha256:'0'.repeat(64),trustedCodeApproved:true}]}),'PROJECT_PLUGIN_CHILD_UNSUPPORTED']]){
  const root=await rootFor(t);await assert.rejects(createResearchProject({directory:root,config:cfg}),reason(code));await absentTask(root);await assert.rejects(stat(join(root,'project.json')),reason('ENOENT'));
  await createResearchProject({directory:root,config:config()});const file=join(root,'selected.txt');await writeFile(file,'Synthetic.');const bundle=await importProjectSources({projectDir:root,files:[file]});const admitted=await submitResearchTask({projectDir:root,runId:'same-run',question:'Read.',sourceManifestSha256:bundle.manifestSha256});assert.equal(admitted.runId,'same-run');
 }
});
test('project admission actual PDF plus Child rejects before task record and Run ID remains usable',async t=>{
 const f=await setup(t,config(['pdf','child']));const fixture=JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8'));const pdf=join(f.root,'selected.pdf');await writeFile(pdf,Buffer.from(fixture.documents.text.base64,'base64'));const mixed=await importProjectSources({projectDir:f.root,files:[f.source,pdf]});
 await assert.rejects(submitResearchTask({...f.request,sourceManifestSha256:mixed.manifestSha256}),reason('PROJECT_PDF_CHILD_UNSUPPORTED'));await absentTask(f.root);
 assert.equal((await submitResearchTask(f.request)).runId,'same-run');assert.deepEqual((await inspectResearchTask(f.request)).run.rootUsage,{model:0,tool:0});
});
test('project admission Child method required tools must be a parent subset before publication',async t=>{
 const f=await setup(t,config(['child'],{childMethod:{...CLAIM_COMPARISON_METHOD,allowedTools:['read_page','read_result']},allowedTools:['save_report','source_check','read_page']}));
 await assert.rejects(submitResearchTask(f.request),reason('PROJECT_CHILD_TOOL_SCOPE'));await absentTask(f.root);
});
test('project admission pending schedule report and cancel use original pre-due schedule',async t=>{
 const f=await setup(t,config(['schedule']));const schedule={scheduleId:'pending-original',definitionRevision:1,scheduledInstant:new Date(Date.now()+3600000).toISOString(),timeZone:'UTC',maxLatenessMs:10000};
 const first=await submitResearchTask({...f.request,schedule});assert.equal(first.state,'confirmed');await assert.rejects(readResearchReport(f.request),reason('PROJECT_REPORT_NOT_READY'));
 const cancellation=await cancelResearchTask(f.request);assert.equal(cancellation.state,'cancelled');assert.equal(cancellation.runId,null);const inspection=await inspectResearchTask(f.request);assert.equal(inspection.schedule.state,'cancelled');assert.equal(inspection.run,null);
 let calls=0;const result=await workResearchTask({...f.request,gateway:{mode:'fixture',next(){calls++;throw new Error('Must never dispatch cancelled schedule');}}});assert.equal(result.state,'cancelled');assert.equal(calls,0);
});
for(const explicit of [false,true])test(`project admission ${explicit?'explicit timezone':'implicit'} TaskTime resubmit retains first anchor`,async t=>{
 const f=await setup(t,config(['task-time'],{timeZone:'UTC'}));const request={...f.request,...(explicit?{taskTime:{timeZone:'UTC'}}:{})};await submitResearchTask(request);const before=await inspectResearchTask(request);await new Promise(resolve=>setTimeout(resolve,10));await submitResearchTask(request);const after=await inspectResearchTask(request);assert.deepEqual(after.definition.taskTime,before.definition.taskTime);assert.equal(after.definition.grantId,before.definition.grantId);assert.deepEqual(after.run.rootUsage,{model:0,tool:0});
});
test('project admission expanded source-index question limit rejects before task publication',async t=>{
 const f=await setup(t);await assert.rejects(submitResearchTask({...f.request,question:'q'.repeat(16000)}),reason('PROJECT_TASK_INPUT'));await absentTask(f.root);assert.equal((await submitResearchTask(f.request)).runId,'same-run');
});
