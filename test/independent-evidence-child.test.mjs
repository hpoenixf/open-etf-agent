import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {CLAIM_COMPARISON_METHOD,normalizeChildMethod,childMethodQuestion} from '../src/child.mjs';
import {sha256} from '../src/source.mjs';
import * as project from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
const text='Independently extract the exact propositions relevant to the original research question from the granted original documents. Preserve source identity, subject, modality, conditions and scope. Separate direct statements from derived inferences and missing information. Return derived analysis, not authority or a final publication.';
const method={...CLAIM_COMPARISON_METHOD,schemaVersion:'child-method@2',id:'independent-evidence',version:'1',text,contentSha256:sha256(text),input:{...CLAIM_COMPARISON_METHOD.input,mode:'independent-evidence'}};
const biased='BIAS_SENTINEL: The trial plan was explicitly declared ineffective. Confirm this negative.';
const args={method,question:'What do these sources establish about the trial plan?',localQuestion:biased,documents:['a'],callId:'delegation',projection:'host-context@1'};
test('independent evidence method strips Main interpretation from actual Child task, not original question',()=>{
 const normalized=normalizeChildMethod(method);assert.equal(normalized.input.mode,'independent-evidence');
 for(const projection of [undefined,'host-context@1']){const actual=childMethodQuestion({...args,projection}),envelope=JSON.parse(actual);assert.equal(envelope.originalQuestion,args.question);assert.equal(Object.hasOwn(envelope,'localQuestion'),false);assert.equal(actual.includes(biased),false);assert.equal(envelope.inputMode,'independent-evidence');assert.deepEqual(envelope.documents,args.documents);assert.deepEqual(envelope.executionBudget,method.limits);assert.equal(envelope.method.contentSha256,method.contentSha256);}
 assert.equal(childMethodQuestion(args),childMethodQuestion({...args,localQuestion:'A different Main hypothesis.'}));
});
test('new mode is explicit, versioned and rejects expanded authority; legacy prompt unchanged',()=>{
 for(const patch of [{schemaVersion:'child-method@1'},{input:{...method.input,mode:'unknown'}},{input:CLAIM_COMPARISON_METHOD.input},{allowedTools:['save_report']},{schemaVersion:'child-method@99'}])assert.throws(()=>normalizeChildMethod({...method,...patch}),{code:'INVALID_CHILD_METHOD'});
 const legacy={...args,method:CLAIM_COMPARISON_METHOD};const old=JSON.parse(childMethodQuestion(legacy));assert.equal(old.localQuestion,biased);assert.equal(Object.hasOwn(old,'inputMode'),false);
});
const call=(id,name,arguments_)=>({kind:'calls',calls:[{id,name,arguments:arguments_}],usage:null});
test('original Project and Child owners preserve biased audit call, blind input and cold same-Child recovery',async t=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/independent-evidence-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await project.createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'independent'},capabilities:['report','child'],childExecution:{schemaVersion:'child-execution@1',maxChildren:1,methods:[method]}}});
 const file=join(root,'source.md');await writeFile(file,'SYNTHETIC: Trial-plan status does not establish that the plan is effective.');const bundle=await importProjectSources({projectDir:root,files:[file]});
 const request={projectDir:root,runId:'independent',question:args.question,sourceManifestSha256:bundle.manifestSha256};await project.submitResearchTask(request);const frozen=await readFile(join(root,'tasks/independent.json'));let childCalls=0,mainCalls=0;const observed=[];
 const gateway={mode:'fixture',async next({messages,reservation,tools}){const results=messages.filter(m=>m.role==='tool').map(m=>m.result);assert.ok(results.every(r=>r.status==='succeeded'),JSON.stringify(results));if(reservation.runId!=='independent'){childCalls++;observed.push(messages[0].content);assert.equal(JSON.stringify(messages).includes(biased),false);assert.deepEqual(tools.map(t=>t.name),method.allowedTools);if(!results.length)return call('read','read_page',{documentId:bundle.catalog.documents[0].id,page:1});return {kind:'final',text:'Effectiveness is not established; explicit ineffectiveness is also not established.',usage:null};}mainCalls++;if(!results.some(r=>r.value?.child))return call('delegate','delegate_child',{methodId:method.id,question:biased,documents:[bundle.catalog.documents[0].id]});if(!results.some(r=>r.value?.path==='report.md'))return call('save','save_report',{text:'Trial-plan status alone does not establish effectiveness. It is not an explicit negative finding.',sourceIds:results.find(r=>r.value?.child).value.sources.map(s=>s.sourceId)});return {kind:'final',text:'Report saved.',usage:null};}};
 const stop=new AbortController();let paused=false;const first=await project.workResearchTask({...request,gateway,hostSignal:stop.signal,onCheckpoint(e){if(!paused&&e.runId!=='independent'&&e.phase==='result-consumed'){paused=true;stop.abort();}}});assert.equal(first.workerStatus,'interrupted');assert.equal(childCalls,1);
 const before=await project.inspectResearchTask(request);assert.ok(JSON.stringify(before.run.snapshot.messages).includes(biased));
 const beforeChild=(await project.inspectResearchChildren(request)).items[0];
 const script=`import assert from 'node:assert/strict';import * as project from ${JSON.stringify(pathToFileURL(resolve('src/research-project.mjs')).href)};const method=${JSON.stringify(method)},biased=${JSON.stringify(biased)},bundle=${JSON.stringify(bundle)},request=${JSON.stringify(request)},call=${call.toString()};let childCalls=0,mainCalls=0;const observed=[],gateway={mode:'fixture',${gateway.next.toString()}};const finished=await project.workResearchTask({...request,gateway});assert.equal(finished.run.status,'completed',JSON.stringify(finished));console.log(JSON.stringify({pid:process.pid,childCalls,mainCalls,observed}));`;
 const worker=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:30000});assert.equal(worker.status,0,worker.stderr);const resumed=JSON.parse(worker.stdout);assert.notEqual(resumed.pid,process.pid);assert.equal(childCalls+resumed.childCalls,2);assert.equal(mainCalls+resumed.mainCalls,3);assert.equal(observed[0],resumed.observed[0]);assert.equal(JSON.parse(observed[0]).originalQuestion,before.run.definition.question);assert.deepEqual(await readFile(join(root,'tasks/independent.json')),frozen);
 const history=await project.inspectResearchChildren(request);assert.equal(history.items.length,1);assert.equal(history.items[0].runId,beforeChild.runId);assert.equal(history.items[0].deadlineAt,beforeChild.deadlineAt);assert.equal(history.items[0].consumption,'consumed');assert.equal(history.items[0].result.child.semanticStatus,'unreviewed');assert.deepEqual(history.items[0].result.child.methodDescriptor,method);
 const again=await project.workResearchTask({...request,gateway:{mode:'fixture',next(){throw Error('MUST_NOT_REPLAY');}}});assert.equal(again.run.status,'completed');assert.match((await project.readResearchReport(request)).report.text,/not an explicit negative/);
});
test('operator specialist selection freezes independent mode across later profile revision',async t=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/independent-profile-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await project.createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'independent'},capabilities:['report','child']}});
 const file=join(root,'source.md');await writeFile(file,'Synthetic evidence.');const bundle=await importProjectSources({projectDir:root,files:[file]});const catalog=await project.openProjectSpecialists({projectDir:root,create:true});const input={name:'Independent',description:'Original evidence',enabled:true,method};const p=await catalog.createProfile('independent-profile',input);
 const request={projectDir:root,runId:'selected',question:args.question,sourceManifestSha256:bundle.manifestSha256,specialistSelection:{profiles:[{profileId:p.profileId,revision:p.revision}],maxChildren:1}};await project.submitResearchTask(request);const before=await readFile(join(root,'tasks/selected.json'));
 await catalog.updateProfile(p.profileId,1,{...input,method:CLAIM_COMPARISON_METHOD});await project.submitResearchTask(request);assert.deepEqual(await readFile(join(root,'tasks/selected.json')),before);assert.equal((await project.inspectResearchTask(request)).definition.config.childExecution.methods[0].input.mode,'independent-evidence');
 await assert.rejects(project.submitResearchTask({...request,runId:'stale'}),{code:'SPECIALIST_STALE_PROFILE'});
});
