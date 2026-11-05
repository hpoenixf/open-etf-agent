import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,readdir,rename,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createResearchProject,inspectResearchProject,updateResearchProject,submitResearchTask,inspectResearchTask,inspectResearchCapacity,workResearchTask,validateResearchConfig} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';

const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const config=()=>({schemaVersion:'research-project@1',gateway:{mode:'live',provider:'synthetic',protocol:'chat-completions',model:'one',endpoint:'https://synthetic.invalid/v1/chat/completions',apiKeyEnv:'SYNTHETIC_KEY'},capabilities:['report']});
const authorization={providerApproved:true,dataApproved:true,costApproved:true};
const reason=code=>error=>error.code===code;
async function directory(t){await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/capacity-compat-owned-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function setup(t,{legacy=false,cfg=config()}={}){
 const root=await directory(t);let project;
 // A legacy-format fixture, not a claim that this test executed the old binary.
 if(legacy){const normalized=validateResearchConfig(cfg);project={schemaVersion:'research-project-record@1',projectId:randomUUID(),config:normalized,configSha256:hash(normalized)};await writeFile(join(root,'.gitignore'),'*\n!.gitignore\n');await writeFile(join(root,'project.json'),canonical(project)+'\n');await mkdir(join(root,'tasks'));}
 else project=await createResearchProject({directory:root,config:cfg});
 const selected=join(root,'selected.md');await writeFile(selected,'Synthetic original source.');const source=await importProjectSources({projectDir:root,files:[selected]});
 const request={projectDir:root,runId:'original',question:'Read the selected original and save a report.',sourceManifestSha256:source.manifestSha256,authorization};
 await submitResearchTask(request);return {root,project,request};
}

test('new project and task freeze endpoint policy; cold CLI inspection is original and zero-dispatch',async t=>{
 const f=await setup(t),task=await inspectResearchTask(f.request),before=await readFile(join(f.root,'tasks','original.json'));
 assert.equal(f.project.schemaVersion,'research-project-record@2');assert.equal(task.definition.schemaVersion,'research-task@2');
 const original=await inspectResearchCapacity(f.request);assert.equal(original.policy,'project-endpoint-capacity@1');assert.match(original.groupId,/^endpoint-[a-f0-9]{64}$/);assert.deepEqual(original.requests,[]);
 const next={...config(),gateway:{...config().gateway,model:'two',stream:true,apiKeyEnv:'SYNTHETIC_OTHER_KEY'}};
 await updateResearchProject({projectDir:f.root,config:next,expectedConfigSha256:f.project.configSha256});await submitResearchTask({...f.request,runId:'next'});
 assert.equal((await inspectResearchCapacity({...f.request,runId:'next'})).groupId,original.groupId);assert.deepEqual(await readFile(join(f.root,'tasks','original.json')),before);
 const cli=spawnSync(process.execPath,['src/research-cli.mjs','capacity','inspect','--project',f.root,'--run','original'],{encoding:'utf8'});
 assert.equal(cli.status,0,cli.stderr);assert.deepEqual(JSON.parse(cli.stdout),original);assert.equal((await inspectResearchTask(f.request)).run.rootUsage.model,0);
});

test('capacity binding tampering fails before any provider dispatch or alternate owner creation',async t=>{
 const f=await setup(t),path=join(f.root,'tasks','original.json'),bytes=await readFile(path),original=JSON.parse(bytes);let calls=0;
 const dirs=await readdir(join(f.root,'admission'));
 for(const patch of [{admission:{policy:'project-endpoint-capacity@1',groupId:'endpoint-'+('f'.repeat(64))}},{admission:{...original.definition.admission,policy:'invented'}},{schemaVersion:'research-task@1'}]){
  const definition={...original.definition,...patch};await writeFile(path,canonical({definition,definitionSha256:hash(definition)})+'\n');
  await assert.rejects(inspectResearchCapacity(f.request),reason('PROJECT_CAPACITY_BINDING_CHANGED'));
  await assert.rejects(workResearchTask({...f.request,apiKey:'synthetic-placeholder',fetchImpl(){calls++;throw Error('must not dispatch');}}),reason('PROJECT_CAPACITY_BINDING_CHANGED'));
  assert.deepEqual(await readdir(join(f.root,'admission')),dirs);
 }
 await writeFile(path,bytes);assert.equal(calls,0);assert.deepEqual((await inspectResearchTask(f.request)).definition,original.definition);
});

test('legacy format keeps original unknown ticket and gateway-hash owner; gateway revision is refused',async t=>{
 const f=await setup(t,{legacy:true}),task=await inspectResearchTask(f.request),beforeTask=await readFile(join(f.root,'tasks','original.json'));let calls=0;
 assert.equal(task.definition.schemaVersion,'research-task@1');assert.equal(task.definition.admission,undefined);
 await workResearchTask({...f.request,apiKey:'synthetic-placeholder',fetchImpl(){calls++;throw Error('synthetic uncertain transport');}});
 const before=await inspectResearchCapacity(f.request);assert.equal(before.policy,'gateway-config@1');assert.equal(before.groupId,hash(f.project.config.gateway));assert.equal(before.requests.length,1);assert.equal(before.requests[0].state,'unknown');assert.equal(calls,1);
 const dbPath=join(f.root,'admission',before.groupId,'admission.sqlite'),dbBytes=await readFile(dbPath),dirs=await readdir(join(f.root,'admission'));
 await assert.rejects(updateResearchProject({projectDir:f.root,config:{...config(),gateway:{...config().gateway,model:'two'}},expectedConfigSha256:f.project.configSha256}),reason('PROJECT_LEGACY_CAPACITY_REVISION_UNSUPPORTED'));
 assert.equal((await inspectResearchProject({projectDir:f.root})).configSha256,f.project.configSha256);
 const next=await updateResearchProject({projectDir:f.root,config:{...config(),capabilities:['report','calculation']},expectedConfigSha256:f.project.configSha256});assert.equal(next.schemaVersion,'research-project-record@1');
 assert.deepEqual(await inspectResearchCapacity(f.request),before);assert.deepEqual(await readFile(dbPath),dbBytes);assert.deepEqual(await readFile(join(f.root,'tasks','original.json')),beforeTask);assert.deepEqual(await readdir(join(f.root,'admission')),dirs);
});

test('read-only capacity inspection neither recreates a missing owner nor repairs a corrupt group',async t=>{
 const f=await setup(t),group=await inspectResearchCapacity(f.request),owner=join(f.root,'admission',group.groupId),moved=owner+'-held';
 await rename(owner,moved);await assert.rejects(inspectResearchCapacity(f.request));assert.deepEqual(await readdir(join(f.root,'admission')),[group.groupId+'-held']);await rename(moved,owner);
 const path=join(owner,'admission.sqlite'),db=new DatabaseSync(path);db.prepare('UPDATE capacity SET route_id=? WHERE id=1').run('synthetic-wrong-owner');db.close();const bytes=await readFile(path);
 await assert.rejects(inspectResearchCapacity(f.request),reason('ADMISSION_GROUP_MISMATCH'));assert.deepEqual(await readFile(path),bytes);
});

test('new format cannot initialize over legacy residue or downgrade its current project record',async t=>{
 const root=await directory(t),residue=join(root,'legacy-admission.txt');await writeFile(residue,'Synthetic retained unknown occupancy marker.');const bytes=await readFile(residue);
 await assert.rejects(createResearchProject({directory:root,config:config()}),reason('PROJECT_DIRECTORY_NOT_EMPTY'));assert.deepEqual(await readFile(residue),bytes);assert.deepEqual(await readdir(root),['legacy-admission.txt']);
 const f=await setup(t),current={...f.project,schemaVersion:'research-project-record@1'};await writeFile(join(f.root,'config-current.json'),canonical(current)+'\n');await assert.rejects(inspectResearchCapacity(f.request),reason('PROJECT_CONFIG_CHANGED'));
});

test('fixture capacity remains separate from live endpoints in the same project',async t=>{
 const fixture={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'fixture-one'},capabilities:['report']};
 const f=await setup(t,{cfg:fixture}),first=await inspectResearchCapacity(f.request);
 const revised=await updateResearchProject({projectDir:f.root,config:{...fixture,gateway:{...fixture.gateway,model:'fixture-two',provider:'another-fixture'}},expectedConfigSha256:f.project.configSha256});await submitResearchTask({...f.request,runId:'fixture-next'});assert.equal((await inspectResearchCapacity({...f.request,runId:'fixture-next'})).groupId,first.groupId);
 await updateResearchProject({projectDir:f.root,config:config(),expectedConfigSha256:revised.configSha256});await submitResearchTask({...f.request,runId:'live-next'});assert.notEqual((await inspectResearchCapacity({...f.request,runId:'live-next'})).groupId,first.groupId);
});

test('missing database or registration cannot be replaced during work, submit or same-domain revision',async t=>{
 const f=await setup(t),group=await inspectResearchCapacity(f.request),owner=join(f.root,'admission',group.groupId),database=join(owner,'admission.sqlite'),registration=join(f.root,'admission-owners',group.groupId+'.json');let calls=0;
 const work=()=>workResearchTask({...f.request,apiKey:'synthetic-placeholder',fetchImpl(){calls++;throw Error('must not dispatch');}});
 for(const missing of [database,registration]){
  await rename(missing,missing+'.held');
  await assert.rejects(work(),reason('PROJECT_CAPACITY_OWNER_MISSING'));
  await assert.rejects(submitResearchTask({...f.request,runId:'blocked-new'}),reason('PROJECT_CAPACITY_OWNER_MISSING'));
  await assert.rejects(updateResearchProject({projectDir:f.root,config:{...config(),gateway:{...config().gateway,model:'two'}},expectedConfigSha256:f.project.configSha256}),reason('PROJECT_CAPACITY_OWNER_MISSING'));
  await assert.rejects(readFile(missing),reason('ENOENT'));await rename(missing+'.held',missing);
 }
 assert.equal(calls,0);assert.deepEqual(await inspectResearchCapacity(f.request),group);
 const bytes=await readFile(database);await writeFile(database,'');await assert.rejects(work(),reason('FOREIGN_ADMISSION_DATABASE'));assert.equal((await readFile(database)).length,0);await writeFile(database,bytes);
});

test('a previously selected endpoint cannot become a new owner if both its registration and store are missing',async t=>{
 const f=await setup(t),secondConfig={...config(),gateway:{...config().gateway,endpoint:'https://synthetic.invalid/v2/chat/completions'}};
 const second=await updateResearchProject({projectDir:f.root,config:secondConfig,expectedConfigSha256:f.project.configSha256});await submitResearchTask({...f.request,runId:'second'});const group=await inspectResearchCapacity({...f.request,runId:'second'});
 const thirdConfig={...config(),gateway:{...config().gateway,endpoint:'https://synthetic.invalid/v3/chat/completions'}};const third=await updateResearchProject({projectDir:f.root,config:thirdConfig,expectedConfigSha256:second.configSha256});
 const owner=join(f.root,'admission',group.groupId),registration=join(f.root,'admission-owners',group.groupId+'.json');await rename(owner,owner+'.held');await rename(registration,registration+'.held');
 await assert.rejects(updateResearchProject({projectDir:f.root,config:secondConfig,expectedConfigSha256:third.configSha256}),reason('PROJECT_CAPACITY_OWNER_MISSING'));
 await assert.rejects(readFile(registration),reason('ENOENT'));assert.equal((await inspectResearchProject({projectDir:f.root})).configSha256,third.configSha256);
 await rename(owner+'.held',owner);await rename(registration+'.held',registration);assert.deepEqual(await inspectResearchCapacity({...f.request,runId:'second'}),group);
});

test('bare fragment/query delimiters cannot split a new endpoint owner and legacy originals remain readable',async t=>{
 const f=await setup(t);let calls=0;await workResearchTask({...f.request,apiKey:'synthetic-placeholder',fetchImpl(){calls++;throw Error('synthetic uncertain transport');}});
 const original=await inspectResearchCapacity(f.request),dirs=await readdir(join(f.root,'admission'));
 for(const suffix of ['#','?']){
  const invalid={...config(),gateway:{...config().gateway,endpoint:config().gateway.endpoint+suffix}};
  await assert.rejects(updateResearchProject({projectDir:f.root,config:invalid,expectedConfigSha256:f.project.configSha256}),reason('PROJECT_GATEWAY_CONFIG'));
  assert.deepEqual(await inspectResearchCapacity(f.request),original);assert.deepEqual(await readdir(join(f.root,'admission')),dirs);
  const empty=await directory(t);await assert.rejects(createResearchProject({directory:empty,config:invalid}),reason('PROJECT_GATEWAY_CONFIG'));await assert.rejects(readFile(join(empty,'project.json')),reason('ENOENT'));
  const legacy=await setup(t,{legacy:true,cfg:invalid});const kept=await inspectResearchCapacity(legacy.request);assert.equal(kept.policy,'gateway-config@1');assert.equal(kept.groupId,hash(legacy.project.config.gateway));
 }
 assert.equal(calls,1);assert.equal(original.requests[0].state,'unknown');
});
