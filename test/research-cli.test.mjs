import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runResearchCli,parseResearchArguments,researchError} from '../src/research-cli.mjs';
const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'fixture',protocol:'fixture@1',model:'fixture'},capabilities:['report','memory']};
async function fixture(t){const base=resolve('test-output');await mkdir(base,{recursive:true});const directory=await mkdtemp(join(base,'research-cli-'));t.after(()=>rm(directory,{recursive:true,force:true}));const project=join(directory,'project'),configPath=join(directory,'config.json'),question=join(directory,'question.txt'),source=join(directory,'source.md'),files=join(directory,'files.json');await writeFile(configPath,JSON.stringify(config));await writeFile(question,'Summarize the selected source.');await writeFile(source,'# Public example\nThe annual fee is 12 units.');await writeFile(files,JSON.stringify([source]));return{directory,project,configPath,question,source,files};}
async function cli(args){let out='',err='';const code=await runResearchCli(args,{stdout:{write:s=>out+=s},stderr:{write:s=>err+=s}});return{code,out,err,json:out.startsWith('{')?JSON.parse(out):null};}
async function setup(t){const f=await fixture(t);assert.equal((await cli(['project','init','--project',f.project,'--config',f.configPath])).code,0);const imported=await cli(['source','import','--project',f.project,'--files',f.files]);assert.equal(imported.code,0,imported.err);return{...f,manifest:imported.json.manifestSha256};}
test('strict CLI parsing and help reject duplicate, unknown, missing, positional, and flag values',async()=>{
 for(const args of [['project','inspect','--project','x','--project','y'],['project','inspect','--project','x','--wat','y'],['project','inspect'],['project','inspect','--project','x','extra'],['memory','save','--project','x','--intent','i','--text','x','--approve-intent','true']])assert.throws(()=>parseResearchArguments(args));
 assert.match((await cli(['--help'])).out,/Submit does not call a model/);assert.equal((await cli(['nonsense'])).code,1);
});
test('explicit source import and list bind original manifest, submit and inspect do not dispatch',async t=>{
 const f=await setup(t);const listed=await cli(['source','list','--project',f.project,'--manifest',f.manifest]);assert.equal(listed.json.manifestSha256,f.manifest);assert.equal(listed.json.manifest.files.length,1);assert.equal(listed.out.includes('annual fee'),false);
 const args=['run','submit','--project',f.project,'--run','cli-test','--question',f.question,'--manifest',f.manifest];const submitted=await cli(args);assert.equal(submitted.code,0,submitted.err);assert.equal(submitted.json.runId,'cli-test');assert.equal(submitted.json.run.status,'active');assert.equal(submitted.out.includes('Summarize'),false);
 const inspected=await cli(['run','inspect','--project',f.project,'--run','cli-test']);assert.deepEqual(inspected.json,submitted.json);
 const worked=await cli(['run','work','--project',f.project,'--run','cli-test']);assert.equal(worked.code,1);assert.match(worked.err,/CLI_LIVE_WORK_REQUIRED/);
 assert.equal((await cli(['run','report','--project',f.project,'--run','cli-test'])).code,1);
 const cancelled=await cli(['run','cancel','--project',f.project,'--run','cli-test']);assert.equal(cancelled.code,0,cancelled.err);assert.equal(cancelled.json.run.status,'cancelled');
});
test('live submit requires all explicit approvals and remains zero-dispatch',async t=>{
 const f=await fixture(t);await writeFile(f.configPath,JSON.stringify({...config,gateway:{mode:'live',provider:'example',protocol:'chat-completions',model:'example',endpoint:'https://example.invalid/v1/chat/completions',apiKeyEnv:'RESEARCH_CLI_TEST_KEY'}}));
 assert.equal((await cli(['project','init','--project',f.project,'--config',f.configPath])).code,0);const imported=await cli(['source','import','--project',f.project,'--files',f.files]);
 const args=['run','submit','--project',f.project,'--run','live-zero','--question',f.question,'--manifest',imported.json.manifestSha256];assert.match((await cli(args)).err,/PROJECT_LIVE_APPROVAL_REQUIRED/);
 const result=await cli([...args,'--approve-provider','--approve-data','--approve-cost']);assert.equal(result.code,0,result.err);assert.equal(result.json.run.status,'active');
 const work=await cli(['run','work','--project',f.project,'--run','live-zero']);assert.match(work.err,/CLI_API_KEY_ENV_REQUIRED/);
});
test('Memory mutations require explicit intent and original current revision',async t=>{
 const f=await setup(t),text=join(f.directory,'memory.txt');await writeFile(text,'Prefer short reports.');
 const args=['memory','save','--project',f.project,'--intent','save-1','--text',text];assert.equal((await cli(args)).code,1);
 const approved=await cli(['memory','approve-intent','--project',f.project,'--operation','save','--intent','deferred-1','--text',text,'--approve-intent']);assert.equal(approved.code,0,approved.err);assert.equal(approved.json.operation,'save');assert.equal((await cli(['memory','inspect','--project',f.project])).json.entries.length,0);
 const saved=await cli([...args,'--approve-intent']);assert.equal(saved.code,0,saved.err);const entry=saved.json.id;
 assert.equal((await cli(['memory','inspect','--project',f.project,'--entry',entry])).json.text,'Prefer short reports.');
 const common=['--project',f.project,'--entry',entry,'--approve-intent'];assert.equal((await cli(['memory','forget',...common,'--intent','forget-wrong','--revision','2'])).code,1);
 const forgotten=await cli(['memory','forget',...common,'--intent','forget-1','--revision','1']);assert.equal(forgotten.code,0,forgotten.err);assert.equal((await cli(['memory','inspect','--project',f.project])).json.entries.length,0);
});
test('unsafe question paths, invalid IDs and binary input fail closed without disclosure',async t=>{
 const f=await setup(t),link=join(f.directory,'link.txt');await symlink(f.question,link);
 const args=['run','submit','--project',f.project,'--run','bad','--manifest',f.manifest,'--question'];assert.equal((await cli([...args,link])).code,1);
 await writeFile(f.question,Buffer.from([0xff,0xfe]));assert.match((await cli([...args,f.question])).err,/CLI_INVALID_UTF8/);
 assert.equal((await cli(['run','inspect','--project',f.project,'--run','../escape'])).code,1);
 const result=researchError(Object.assign(new Error('Bearer private-token sk-privatevalue /private/path'),{code:'Bearer private-token'}));assert.equal(JSON.stringify(result).includes('private-token'),false);assert.equal(result.error,'RESEARCH_OPERATION_FAILED');
});
test('actual process entry exposes help and safe error exit code',()=>{
 const entry=resolve('src/research-cli.mjs');const help=spawnSync(process.execPath,[entry,'--help'],{encoding:'utf8'});assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/Local single-user/);
 const invalid=spawnSync(process.execPath,[entry,'unknown','command'],{encoding:'utf8'});assert.equal(invalid.status,1);assert.deepEqual(JSON.parse(invalid.stderr).error,'CLI_UNKNOWN_COMMAND');assert.equal(invalid.stderr.includes(' at '),false);
});
test('original fixture API prepares artifact; cold CLI report and Reader use persisted bytes without model execution',async t=>{
 const {workResearchTask}=await import('../src/research-project.mjs');const {loadProjectSources}=await import('../src/project-sources.mjs');const {spawn}=await import('node:child_process');
 const f=await setup(t),doc=(await loadProjectSources({projectDir:f.project,manifestSha256:f.manifest})).catalog.documents[0].id;
 assert.equal((await cli(['run','submit','--project',f.project,'--run','report-test','--question',f.question,'--manifest',f.manifest])).code,0);
 let calls=0;const result=await workResearchTask({projectDir:f.project,runId:'report-test',gateway:{mode:'fixture',async next({messages}){calls++;const results=messages.filter(m=>m.role==='tool').map(m=>m.result.value);const source=results.find(r=>r.sourceId);if(!source)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:doc,page:1}}],usage:null};if(!results.some(r=>r.path==='report.md'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'# Fee\nThe annual fee is 12 units.',sourceIds:[source.sourceId]}}],usage:null};return{kind:'final',text:'Saved.',usage:null};}}});
 assert.equal(result.run.status,'completed');assert.equal(calls,3);
 const entry=resolve('src/research-cli.mjs'),report=spawnSync(process.execPath,[entry,'report','inspect','--project',f.project,'--run','report-test'],{encoding:'utf8'});assert.equal(report.status,0,report.stderr);const data=JSON.parse(report.stdout);assert.match(data.report.text,/12 units/);
 const child=spawn(process.execPath,[entry,'report','serve','--project',f.project,'--run','report-test'],{stdio:['ignore','pipe','pipe']});t.after(()=>{if(child.exitCode===null)child.kill('SIGTERM');});
 const serving=await new Promise((ok,fail)=>{let output='';const timer=setTimeout(()=>fail(new Error('Reader did not announce origin')),5000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n')){clearTimeout(timer);try{ok(JSON.parse(output.split('\n')[0]));}catch(e){fail(e);}}});child.once('error',e=>{clearTimeout(timer);fail(e);});child.once('exit',code=>{clearTimeout(timer);if(!output)fail(new Error('Reader exited '+code));});});
 assert.equal(serving.directory,data.directory);const response=await fetch(serving.origin+'/artifacts/'+data.report.artifactId);assert.equal(response.status,200);assert.equal(await response.text(),data.report.text);const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');assert.equal(await exited,0);assert.equal(calls,3);
});
test('CLI exposes original pending response identity and submits explicit reply',async t=>{
 const {workResearchTask}=await import('../src/research-project.mjs');const f=await fixture(t);await writeFile(f.configPath,JSON.stringify({...config,capabilities:['report','response']}));assert.equal((await cli(['project','init','--project',f.project,'--config',f.configPath])).code,0);const imported=await cli(['source','import','--project',f.project,'--files',f.files]);assert.equal((await cli(['run','submit','--project',f.project,'--run','response-test','--question',f.question,'--manifest',imported.json.manifestSha256])).code,0);
 await workResearchTask({projectDir:f.project,runId:'response-test',gateway:{mode:'fixture',async next(){return{kind:'calls',calls:[{id:'ask-user',name:'ask_response',arguments:{question:'Which currency should the report use?'}}],usage:null};}}});
 const inspected=await cli(['run','inspect','--project',f.project,'--run','response-test']);assert.equal(inspected.json.phase,'awaiting-response');assert.match(inspected.json.response.question,/currency/);assert.ok(inspected.json.response.questionId);const original=(await (await import('../src/research-project.mjs')).inspectResearchTask({projectDir:f.project,runId:'response-test'})).run;assert.equal(inspected.json.response.deadlineAt,original.definition.deadlineAt);
 const reply=join(f.directory,'reply.txt');await writeFile(reply,'Use the original units.');const answered=await cli(['run','respond','--project',f.project,'--run','response-test','--question-id',inspected.json.response.questionId,'--response-id','reply-1','--text',reply]);assert.equal(answered.code,0,answered.err);
});
test('project update preserves identity and old task config; stale expected hash fails',async t=>{
 const {inspectResearchTask}=await import('../src/research-project.mjs');const f=await setup(t),before=(await cli(['project','inspect','--project',f.project])).json;
 assert.equal((await cli(['run','submit','--project',f.project,'--run','before-update','--question',f.question,'--manifest',f.manifest])).code,0);
 const changed={...config,capabilities:['report','memory','csv']};await writeFile(f.configPath,JSON.stringify(changed));const args=['project','update','--project',f.project,'--config',f.configPath,'--expected-config',before.configSha256];const updated=await cli(args);assert.equal(updated.code,0,updated.err);assert.equal(updated.json.projectId,before.projectId);assert.notEqual(updated.json.configSha256,before.configSha256);assert.ok(updated.json.config.capabilities.includes('csv'));
 assert.equal((await inspectResearchTask({projectDir:f.project,runId:'before-update'})).definition.config.capabilities.includes('csv'),false);assert.equal((await cli(args)).code,1);
});

test('FIFO question input fails without blocking the CLI',async t=>{
 const f=await setup(t),fifo=join(f.directory,'question.fifo');const created=spawnSync('mkfifo',[fifo],{encoding:'utf8'});assert.equal(created.status,0,created.stderr);const result=spawnSync(process.execPath,[resolve('src/research-cli.mjs'),'run','submit','--project',f.project,'--run','fifo-test','--question',fifo,'--manifest',f.manifest],{encoding:'utf8',timeout:3000});assert.equal(result.error,undefined);assert.equal(result.status,1);assert.match(result.stderr,/CLI_UNSAFE_TEXT_FILE/);
});
