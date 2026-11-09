import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createResearchProject,updateResearchProject,inspectResearchProject,validateResearchConfig,submitResearchTask,workResearchTask,inspectResearchTask,inspectResearchChildren,readResearchReport} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
import {parseResearchArguments} from '../src/research-cli.mjs';
const execution={schemaVersion:'child-execution@1',maxChildren:2,methods:[CLAIM_COMPARISON_METHOD]};
const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'no-provider'},capabilities:['report','child'],childExecution:execution};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
test('22.project explicit execution configuration preserves old project contracts and unsupported composition guards',()=>{
 const normalized=validateResearchConfig(config);assert.equal(normalized.childExecution.maxChildren,2);
 const legacy={...config};delete legacy.childExecution;assert.equal(validateResearchConfig(legacy).childExecution,undefined);
 assert.throws(()=>validateResearchConfig({...config,childMethod:CLAIM_COMPARISON_METHOD}),/PROJECT_CHILD_CONFIG_CONFLICT/);
 assert.throws(()=>validateResearchConfig({...config,capabilities:['report']}),/PROJECT_CHILD_REQUIRED/);
 for(const cap of ['response','schedule'])assert.throws(()=>validateResearchConfig({...config,capabilities:[...config.capabilities,cap]}),/UNSUPPORTED/);
 assert.deepEqual(parseResearchArguments(['child','list','--project','project','--run','task']),{command:'child list',options:{project:'project',run:'task'}});
 for(const args of [['child','list','--project','project'],['child','list','--project','project','--run','task','--execute']])assert.throws(()=>parseResearchArguments(args));
});
test('report guidance execution Child cold inspection: 22.project three-source project delegates two narrow scopes, publishes, and independently reopens original results',async t=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/research-children-'));t.after(()=>rm(dir,{recursive:true,force:true}));const projectDir=join(dir,'project');await createResearchProject({directory:projectDir,config});
 const files=[];for(const [i,text] of ['Measured output 20 units.','Measured output 30 units.','Unselected unrelated evidence.'].entries()){const path=join(dir,'source-'+i+'.md');await writeFile(path,text);files.push(path);}
 const sources=await importProjectSources({projectDir,files}),ids=sources.catalog.documents.map(d=>d.id);
 await submitResearchTask({projectDir,runId:'original',question:'Compare the first two selected observations with independent narrow checks and retain a report.',sourceManifestSha256:sources.manifestSha256});
 assert.equal((await inspectResearchTask({projectDir,runId:'original'})).definition.reportGuidance,'source-faithful-report@1');
 let mainCalls=0,childCalls=0;const observed=[];const gateway={mode:'fixture',next({messages,reservation}){
  const results=messages.filter(m=>m.role==='tool');
  if(reservation.runId!=='original'){childCalls++;const task=JSON.parse(messages[0].content.split('\n')[1]);assert.match(task.originalQuestion,/Report fidelity guidance:/);assert.equal(task.documents.length,1);assert.notEqual(task.documents[0],ids[2]);assert.ok(!JSON.stringify(results).includes('other-child-private'));if(!results.length)return call('source','read_page',{documentId:task.documents[0],page:1});return{kind:'final',text:'Derived evidence checked.'};}
  mainCalls++;const children=results.filter(m=>m.result.value?.child);if(children.length<2)return call('child-'+children.length,'delegate_child',{methodId:'claim-comparison',question:'Check this original observation.',documents:[ids[children.length]]});
  if(!results.some(m=>m.result.value?.path==='report.md')){observed.push(...children.map(m=>m.result.value));return call('save','save_report',{text:'# Original observations\n20 units versus 30 units; methods and conditions are not established.',sourceIds:children.flatMap(m=>m.result.value.sources.map(s=>s.sourceId))});}return{kind:'final',text:'Saved.'};
 }};
 const result=await workResearchTask({projectDir,runId:'original',gateway});assert.equal(result.run.status,'completed');assert.equal(childCalls,4);assert.equal(mainCalls,4);const history=await inspectResearchChildren({projectDir,runId:'original'});assert.equal(history.items.length,2);assert.ok(history.items.every(i=>i.consumption==='consumed'));assert.deepEqual(history.items.map(i=>i.documents[0]),ids.slice(0,2));const report=await readResearchReport({projectDir,runId:'original'});assert.match(report.report.text,/20 units versus 30 units/);
 const code=`import {inspectResearchChildren,workResearchTask,readResearchReport} from ${JSON.stringify(new URL('../src/research-project.mjs',import.meta.url).href)};let calls=0;const projectDir=${JSON.stringify(projectDir)};const run=await workResearchTask({projectDir,runId:'original',gateway:{mode:'fixture',next(){calls++;throw Error('Forbidden terminal dispatch');}}});const history=await inspectResearchChildren({projectDir,runId:'original'}),report=await readResearchReport({projectDir,runId:'original'});process.stdout.write(JSON.stringify({pid:process.pid,calls,status:run.run.status,history,sha256:report.report.sha256}));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC'}});assert.equal(child.status,0,child.stderr);const cold=JSON.parse(child.stdout);assert.notEqual(cold.pid,process.pid);assert.equal(cold.calls,0);assert.equal(cold.status,'completed');assert.deepEqual(cold.history,history);assert.equal(cold.sha256,report.report.sha256);
 const cli=spawnSync(process.execPath,['src/research-cli.mjs','child','list','--project',projectDir,'--run','original'],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC'}});assert.equal(cli.status,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout),history);
 const previous=await inspectResearchProject({projectDir});await updateResearchProject({projectDir,config:{...config,childExecution:{...execution,maxChildren:3}},expectedConfigSha256:previous.configSha256});assert.equal((await inspectResearchTask({projectDir,runId:'original'})).definition.config.childExecution.maxChildren,2);assert.deepEqual(await inspectResearchChildren({projectDir,runId:'original'}),history);
});
