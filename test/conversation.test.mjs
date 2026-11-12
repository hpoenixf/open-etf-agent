import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {createResearchProject,inspectResearchTask,readResearchReport,updateResearchProject,inspectResearchProject} from '../src/research-project.mjs';import {importProjectSources} from '../src/project-sources.mjs';
import {createConversation,submitConversationMessage,workConversationMessage,readConversationMessage,inspectConversation,cancelConversationMessage} from '../src/conversation.mjs';
const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'conversation'},capabilities:['report']};
async function setup(){await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/conversation-'));await createResearchProject({directory:projectDir,config});const file=join(projectDir,'input.md');await writeFile(file,'Synthetic Alpha fee is 0.20%. Beta fee is 0.30%.');const bundle=await importProjectSources({projectDir,files:[file]});await createConversation({projectDir,conversationId:'fees'});return {projectDir,conversationId:'fees',sourceManifestSha256:bundle.manifestSha256,documentId:bundle.catalog.documents[0].id};}
function gateway(f,observe=()=>{}){return {mode:'fixture',async next(input){observe(input);const r=input.messages.filter(x=>x.role==='tool').map(x=>x.result.value);const call=(name,args)=>({kind:'calls',calls:[{id:name,name,arguments:args}]});if(!r.length)return call('read_page',{documentId:f.documentId,page:1});if(!r.some(x=>x.path==='report.md'))return call('save_report',{text:'# Comparison\nAlpha fee 0.20%; Beta fee 0.30%.',sourceIds:[r[0].sourceId]});return {kind:'final',text:'Saved.'};}};}
test('conversation follows original report, freezes selected context and reads old outputs',async()=>{const f=await setup();let calls=0;const first=await submitConversationMessage({...f,messageId:'one',text:'Compare fees.'});assert.equal(calls,0);const g=gateway(f,()=>calls++);await workConversationMessage({...f,messageId:'one',gateway:g});const original=await readResearchReport({projectDir:f.projectDir,runId:first.runId});const next=await submitConversationMessage({...f,messageId:'two',text:'Explain the difference.',parent:{messageId:'one',start:0,end:original.report.text.length}});let saw=false;await workConversationMessage({...f,messageId:'two',gateway:gateway(f,({messages})=>{saw ||= JSON.stringify(messages).includes('previousReport');})});assert.equal(saw,true);assert.equal((await inspectConversation(f)).messages.length,2);const n=calls;await workConversationMessage({...f,messageId:'one',gateway:g});assert.equal(calls,n);assert.equal((await readResearchReport({projectDir:f.projectDir,runId:first.runId})).report.sha256,original.report.sha256);assert.ok((await readConversationMessage({...f,messageId:'two'})).output);assert.notEqual(first.runId,next.runId);});
test('message identity rejects changed input; cancelled message cannot dispatch',async()=>{const f=await setup();const input={...f,messageId:'same',text:'Compare.'};const first=await submitConversationMessage(input);assert.equal((await submitConversationMessage(input)).runId,first.runId);await assert.rejects(submitConversationMessage({...input,text:'Changed.'}),/CONVERSATION_ID_CONFLICT/);await cancelConversationMessage({...f,messageId:'same'});let calls=0;await workConversationMessage({...f,messageId:'same',gateway:gateway(f,()=>calls++)});assert.equal(calls,0);});
test('invalid parent and paths fail; no implicit latest or active parent',async()=>{const f=await setup();await assert.rejects(createConversation({...f,conversationId:'../outside'}));await submitConversationMessage({...f,messageId:'one',text:'first'});await assert.rejects(submitConversationMessage({...f,messageId:'two',text:'follow',parent:{messageId:'one',start:0,end:10}}),/CONVERSATION_PARENT_NOT_COMPLETED/);await assert.rejects(submitConversationMessage({...f,messageId:'self',text:'follow',parent:{messageId:'self',start:0,end:10}}),/CONVERSATION_INVALID_PARENT/);});
test('duplicate completed admission keeps original config after project update',async()=>{const f=await setup();const input={...f,messageId:'one',text:'first'};const first=await submitConversationMessage(input);const p=await inspectResearchProject(f);await updateResearchProject({projectDir:f.projectDir,config:{...config,gateway:{...config.gateway,model:'new-model'}},expectedConfigSha256:p.configSha256});const repeated=await submitConversationMessage(input);assert.equal(repeated.runId,first.runId);assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:first.runId})).definition.config.gateway.model,'conversation');});
test('concurrent identical messages converge on one task and original admission',async()=>{const f=await setup();const input={...f,messageId:'same',text:'Compare.'};const results=await Promise.all(Array.from({length:4},()=>submitConversationMessage(input)));assert.equal(new Set(results.map(x=>x.runId)).size,1);assert.equal((await inspectConversation(f)).messages.length,1);});
test('pending intent does not bypass live approval or use an updated config',async()=>{const f=await setup();const p=await inspectResearchProject(f);await updateResearchProject({projectDir:f.projectDir,config:{...config,gateway:{mode:'live',provider:'example',protocol:'chat-completions',model:'synthetic',endpoint:'https://example.invalid/v1/chat/completions',apiKeyEnv:'RESEARCH_API_KEY'}},expectedConfigSha256:p.configSha256});const input={...f,messageId:'pending',text:'Compare.'};await assert.rejects(submitConversationMessage(input),/PROJECT_LIVE_APPROVAL_REQUIRED/);assert.equal((await inspectConversation(f)).messages[0].status,'admission-pending');const changed=await inspectResearchProject(f);await updateResearchProject({projectDir:f.projectDir,config,expectedConfigSha256:changed.configSha256});await assert.rejects(submitConversationMessage({...input,authorization:{providerApproved:true,dataApproved:true,costApproved:true}}),/CONVERSATION_CONFIG_CHANGED_BEFORE_ADMISSION/);});
test('old task without Session finishes same admission without provider dispatch',async()=>{const {cp}=await import('node:fs/promises');const f=await setup();const input={...f,messageId:'one',text:'Compare.'};const first=await submitConversationMessage(input);const clone=f.projectDir+'-clone';await cp(f.projectDir,clone,{recursive:true,filter:path=>!path.startsWith(join(f.projectDir,'sessions'))&&!path.endsWith('.admitted.json')});const restored=await submitConversationMessage({...input,projectDir:clone});assert.equal(restored.runId,first.runId);assert.equal((await inspectResearchTask({projectDir:clone,runId:first.runId})).run.snapshot.phase,'ready');});
test('completed Review must reference exactly the parent revision',async()=>{const {prepareReportReview,submitReportReview,executeReportReview}=await import('../src/report-review.mjs');const f=await setup();const saved=await submitConversationMessage({...f,messageId:'one',text:'Compare.'});await workConversationMessage({...f,messageId:'one',gateway:gateway(f)});const report=await readResearchReport({projectDir:f.projectDir,runId:saved.runId});const request=await prepareReportReview({sourceDirectory:report.directory,revisionId:report.revision.revisionId,requestId:'r'});const directory=join(f.projectDir,'review');const {runId}=await submitReportReview({directory,request});const input={...f,messageId:'two',text:'Recheck.',parent:{messageId:'one',start:0,end:report.report.text.length},review:{directory,runId}};await assert.rejects(submitConversationMessage(input),/CONVERSATION_REVIEW_MISMATCH/);await executeReportReview({directory,runId,gateway:{mode:'fixture',next:async()=>({kind:'final',text:JSON.stringify({findings:[],unchecked:['Synthetic only.']})})}});const next=await submitConversationMessage(input);assert.match((await inspectResearchTask({projectDir:f.projectDir,runId:next.runId})).definition.question,/advisory-only/);});
test('work cannot override the checked message runId',async()=>{const f=await setup();const one=await submitConversationMessage({...f,messageId:'one',text:'First.'}),two=await submitConversationMessage({...f,messageId:'two',text:'Second.'});await workConversationMessage({...f,messageId:'one',runId:two.runId,gateway:gateway(f)});assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:one.runId})).run.status,'completed');assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:two.runId})).run.snapshot.phase,'ready');});
test('empty Session admission states are visible and recover through original owner',async()=>{const {cp}=await import('node:fs/promises'),{openSession}=await import('../src/session.mjs');const f=await setup(),input={...f,messageId:'one',text:'First.'};const first=await submitConversationMessage(input);for(const kind of ['directory','database']){const clone=f.projectDir+'-'+kind;await cp(f.projectDir,clone,{recursive:true,filter:path=>!path.startsWith(join(f.projectDir,'sessions'))&&!path.endsWith('.admitted.json')});await mkdir(join(clone,'sessions',first.runId),{recursive:true});if(kind==='database'){const session=await openSession({directory:join(clone,'sessions',first.runId)});session.close();}assert.equal((await inspectConversation({...f,projectDir:clone})).messages[0].status,'admission-pending');assert.equal((await submitConversationMessage({...input,projectDir:clone})).runId,first.runId);}});
test('cold CLI reads original completed conversation without calls',async()=>{const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');const f=await setup();await submitConversationMessage({...f,messageId:'one',text:'Compare.'});await workConversationMessage({...f,messageId:'one',gateway:gateway(f)});const cmd=promisify(execFile);const {stdout}=await cmd(process.execPath,['src/conversation-cli.mjs','read','--project',f.projectDir,'--conversation',f.conversationId,'--message','one']);assert.match(JSON.parse(stdout).output.report.text,/Alpha fee/);});
test('unknown result is retained and is never a new dispatch on repeated work',async()=>{const f=await setup();await submitConversationMessage({...f,messageId:'one',text:'Compare.'});let calls=0;const g={mode:'fixture',next:async()=>{calls++;throw Error('Synthetic unknown transport');}};await workConversationMessage({...f,messageId:'one',gateway:g});await workConversationMessage({...f,messageId:'one',gateway:g});assert.equal(calls,1);assert.notEqual((await inspectConversation(f)).messages[0].status,'completed');});
test('citation-degraded published answer remains visible without a report artifact',async()=>{const f=await setup();await submitConversationMessage({...f,messageId:'one',text:'Compare.'});let calls=0;await workConversationMessage({...f,messageId:'one',gateway:{mode:'fixture',next:async({messages})=>{calls++;if(calls===1)return {kind:'calls',calls:[{id:'r',name:'read_page',arguments:{documentId:f.documentId,page:1}}]};if(calls===2){const source=messages.find(x=>x.role==='tool').result.value;return {kind:'calls',calls:[{id:'s',name:'save_report',arguments:{text:'Visible answer with unverified [C1].',sourceIds:[source.sourceId]}}]};}return {kind:'final',text:'Finished.'};}}});const view=await readConversationMessage({...f,messageId:'one'});assert.equal(view.output.kind,'degraded-answer');assert.match(view.output.answer.text,/Visible answer/);const continued=await submitConversationMessage({...f,messageId:'degraded-follow',text:'Check this answer again.',continuationOfMessageId:'one'});const next=await inspectResearchTask({projectDir:f.projectDir,runId:continued.runId});assert.match(next.definition.question,/unverified-historical-answer/);assert.match(next.definition.question,/Visible answer/);assert.equal((await readConversationMessage({...f,messageId:'one'})).output.answer.sha256,view.output.answer.sha256);});
test('admitted receipt with lost Task and Session never recreates an execution',async()=>{const {cp,access}=await import('node:fs/promises');const f=await setup(),input={...f,messageId:'one',text:'Compare.'};const first=await submitConversationMessage(input);const clone=f.projectDir+'-missing';await cp(f.projectDir,clone,{recursive:true,filter:path=>!path.startsWith(join(f.projectDir,'sessions'))&&!path.endsWith('/tasks/'+first.runId+'.json')});await assert.rejects(submitConversationMessage({...input,projectDir:clone}),/CONVERSATION_ADMITTED_SESSION_UNAVAILABLE/);await assert.rejects(access(join(clone,'tasks',first.runId+'.json')),{code:'ENOENT'});});
test('clarification binds exact original question, same Run, idempotent reply and cold read',async()=>{
 const {respondConversationQuestion,inspectConversationQuestion}=await import('../src/conversation.mjs');
 const {listResearchInteractions}=await import('../src/research-project.mjs');
 const f=await setup();const project=await inspectResearchProject(f);
 await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:project.configSha256,config:{...config,capabilities:['report','response'],interaction:{schemaVersion:'human-interaction@1'}}});
 const admitted=await submitConversationMessage({...f,messageId:'ask',text:'Ask which fund first, then compare.'});
 let calls=0;const g={mode:'fixture',async next(input){calls++;const results=input.messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!results.some(r=>r.kind==='human-interaction@1'))return {kind:'calls',calls:[{id:'ask',name:'ask_response',arguments:{question:'Which fund?'}}]};return gateway(f).next({...input,messages:input.messages.filter(m=>m.role!=='tool'||m.result.value.kind!=='human-interaction@1')});}};
 await workConversationMessage({...f,messageId:'ask',gateway:g});
 const q=(await listResearchInteractions({projectDir:f.projectDir})).items[0];const before=calls;
 await assert.rejects(submitConversationMessage({...f,messageId:'cannot-skip-question',text:'Continue without answering.',continuationOfMessageId:'ask'}),/CONTINUATION_UNSAFE/);
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:admitted.runId})).run.status,'active');
 const input={...f,messageId:'ask',questionId:q.questionId,responseId:'reply1',text:'Alpha'};
 const first=await respondConversationQuestion(input);assert.deepEqual(await respondConversationQuestion(input),first);
 await assert.rejects(respondConversationQuestion({...input,text:'Beta'}),/CONVERSATION_ID_CONFLICT/);
 assert.equal(calls,before);assert.equal((await inspectConversationQuestion(input)).receipt.text,'Alpha');
 await workConversationMessage({...f,messageId:'ask',gateway:g});
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:admitted.runId})).run.status,'completed');
 assert.equal((await inspectConversation(f)).messages.length,1);
});
test('clarification cannot cross message identity, cancelled question, or change response target',async()=>{
 const {respondConversationQuestion,listConversationQuestions}=await import('../src/conversation.mjs');
 const f=await setup(),p=await inspectResearchProject(f);
 await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:p.configSha256,config:{...config,capabilities:['report','response'],interaction:{schemaVersion:'human-interaction@1'}}});
 const questions={};
 for(const messageId of ['one','two','three']){
  await submitConversationMessage({...f,messageId,text:'Ask.'});
  await workConversationMessage({...f,messageId,gateway:{mode:'fixture',next:async()=>({kind:'calls',calls:[{id:'ask',name:'ask_response',arguments:{question:'Which?'}}]})}});
  questions[messageId]=(await listConversationQuestions({...f,messageId})).items[0].questionId;
 }
 await assert.rejects(respondConversationQuestion({...f,messageId:'one',questionId:questions.two,responseId:'foreign',text:'A'}),/UNKNOWN_QUESTION/);
 await respondConversationQuestion({...f,messageId:'one',questionId:questions.one,responseId:'stable',text:'A'});
 await assert.rejects(respondConversationQuestion({...f,messageId:'two',questionId:questions.two,responseId:'stable',text:'A'}),/CONVERSATION_ID_CONFLICT/);
 assert.equal((await listConversationQuestions({...f,messageId:'two'})).items[0].state,'awaiting-response');
 await cancelConversationMessage({...f,messageId:'three'});
 await assert.rejects(respondConversationQuestion({...f,messageId:'three',questionId:questions.three,responseId:'cancelled',text:'A'}));
 assert.equal((await listConversationQuestions({...f,messageId:'three'})).items[0].state,'unavailable');
});
test('explicit continuation differs from history: binds original goal and authority, never revives parent',async()=>{
 const f=await setup(),first=await submitConversationMessage({...f,messageId:'one',text:'Original fee comparison goal.'});
 await assert.rejects(submitConversationMessage({...f,messageId:'early',text:'Continue.',continuationOfMessageId:'one'}),/CONTINUATION_NOT_ELIGIBLE/);
 await workConversationMessage({...f,messageId:'one',gateway:gateway(f)});
 const original=await inspectResearchTask({projectDir:f.projectDir,runId:first.runId});
 const next=await submitConversationMessage({...f,messageId:'two',text:'Continue checking the difference.',continuationOfMessageId:'one'});
 const task=await inspectResearchTask({projectDir:f.projectDir,runId:next.runId});
 assert.match(task.definition.question,/Original fee comparison goal/);assert.match(task.definition.question,/conversation-continuation@1/);
 assert.notEqual(task.definition.grantId,original.definition.grantId);assert.notEqual(next.runId,first.runId);
 assert.deepEqual((await inspectResearchTask({projectDir:f.projectDir,runId:first.runId})).run.snapshot,original.run.snapshot);
 const project=await inspectResearchProject(f);await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:project.configSha256,config:{...config,gateway:{...config.gateway,model:'changed'}}});
 await assert.rejects(submitConversationMessage({...f,messageId:'three',text:'Continue.',continuationOfMessageId:'one'}),/CONTINUATION_AUTHORITY_CHANGED/);
 assert.equal((await submitConversationMessage({...f,messageId:'two',text:'Continue checking the difference.',continuationOfMessageId:'one'})).runId,next.runId);
});
test('reply recovered after receipt-file interruption does not dispatch or lose cancelled replay',async()=>{
 const {respondConversationQuestion,listConversationQuestions}=await import('../src/conversation.mjs');
 const {cp,readFile}=await import('node:fs/promises');
 const f=await setup(),p=await inspectResearchProject(f);
 await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:p.configSha256,config:{...config,capabilities:['report','response'],interaction:{schemaVersion:'human-interaction@1'}}});
 await submitConversationMessage({...f,messageId:'one',text:'Ask first.'});
 await workConversationMessage({...f,messageId:'one',gateway:{mode:'fixture',next:async()=>({kind:'calls',calls:[{id:'ask',name:'ask_response',arguments:{question:'Which fund?'}}]})}});
 const questionId=(await listConversationQuestions({...f,messageId:'one'})).items[0].questionId;
 const input={...f,messageId:'one',questionId,responseId:'reply',text:'Alpha'};
 const original=await respondConversationQuestion(input);
 const clone=f.projectDir+'-receipt-recovery';await cp(f.projectDir,clone,{recursive:true,filter:path=>!path.endsWith('.received.json')});
 await cancelConversationMessage({...f,projectDir:clone,messageId:'one'});
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const json=join(clone,'reply.json');await writeFile(json,JSON.stringify({messageId:'one',questionId,responseId:'reply',text:'Alpha'}));
 const {stdout}=await promisify(execFile)(process.execPath,['src/conversation-cli.mjs','respond','--project',clone,'--conversation',f.conversationId,'--input',json]);
 assert.deepEqual(JSON.parse(stdout),original);
 assert.deepEqual(JSON.parse(await readFile(join(clone,'conversations',f.conversationId,'responses/reply.received.json'),'utf8')).receipt,original.receipt);
});
test('host interruption resumes original known checkpoint without a new Run or model replay',async()=>{
 const {resumeConversationMessage}=await import('../src/conversation.mjs');
 const f=await setup(),admitted=await submitConversationMessage({...f,messageId:'one',text:'Compare.'});
 const stop=new AbortController();let calls=0;const g=gateway(f,()=>calls++);
 const paused=await workConversationMessage({...f,messageId:'one',gateway:g,hostSignal:stop.signal,onCheckpoint:s=>{if(s.phase==='proposal-sealed')stop.abort();}});
 assert.equal(paused.workerStatus,'interrupted');const count=calls,usage=paused.run.rootUsage.model;
 const done=await resumeConversationMessage({...f,messageId:'one',gateway:g});
 assert.equal(done.run.status,'completed');assert.equal(done.run.runId,admitted.runId);assert.ok(done.run.rootUsage.model>=usage);assert.equal(count,1);assert.equal(calls,3);
 await assert.rejects(resumeConversationMessage({...f,messageId:'one',gateway:g}),/RESUME_NOT_SAFE/);
});
test('continuation accepts lowered limits and rejects authority expansion',async()=>{
 const f=await setup();await submitConversationMessage({...f,messageId:'one',text:'Compare.'});await workConversationMessage({...f,messageId:'one',gateway:gateway(f)});
 const p=await inspectResearchProject(f),lower={...p.config,limits:{...p.config.limits,model:p.config.limits.model-1}};
 await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:p.configSha256,config:lower});
 const next=await submitConversationMessage({...f,messageId:'two',text:'Continue.',continuationOfMessageId:'one'});
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:next.runId})).definition.config.limits.model,lower.limits.model);
 const q=await inspectResearchProject(f);await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:q.configSha256,config:{...lower,limits:{...lower.limits,model:p.config.limits.model+1}}});
 await assert.rejects(submitConversationMessage({...f,messageId:'three',text:'Continue.',continuationOfMessageId:'one'}),/AUTHORITY_CHANGED/);
});
test('two-hop continuation retains the root user goal, not only the word continue',async()=>{
 const f=await setup();await submitConversationMessage({...f,messageId:'root',text:'Compare fees and investment uncertainty.'});await workConversationMessage({...f,messageId:'root',gateway:gateway(f)});
 await submitConversationMessage({...f,messageId:'next',text:'Continue.',continuationOfMessageId:'root'});await workConversationMessage({...f,messageId:'next',gateway:gateway(f)});
 const third=await submitConversationMessage({...f,messageId:'third',text:'Continue again.',continuationOfMessageId:'next'});
 const task=await inspectResearchTask({projectDir:f.projectDir,runId:third.runId});
 assert.match(task.definition.question,/"rootGoal":\{"messageId":"root"/);
 assert.match(task.definition.question,/Compare fees and investment uncertainty/);
});
test('explicit revocation binds accepted intent and cancels original grant without a new dispatch',async()=>{
 const {revokeConversationExecution,resumeConversationMessage}=await import('../src/conversation.mjs');
 const f=await setup(),first=await submitConversationMessage({...f,messageId:'one',text:'Compare.'});
 const rev={...f,messageId:'one',revocationId:'withdraw',expectedDigest:first.digest,reason:'Operator withdrew execution permission.'};
 await assert.rejects(revokeConversationExecution({...rev,expectedDigest:'0'.repeat(64)}),/REVOCATION_IDENTITY_CHANGED/);
 const result=await revokeConversationExecution(rev);assert.equal(result.status,'cancelled');assert.equal(result.remoteEffectsRecalled,false);
 assert.deepEqual(await revokeConversationExecution(rev),result);
 await assert.rejects(revokeConversationExecution({...rev,reason:'Different intent.'}),/ID_CONFLICT/);
 let calls=0;await workConversationMessage({...f,messageId:'one',gateway:gateway(f,()=>calls++)});assert.equal(calls,0);
 await assert.rejects(resumeConversationMessage({...f,messageId:'one',gateway:gateway(f)}),/RESUME_NOT_SAFE/);
});
test('revocation never hides already published degraded answer',async()=>{
 const {revokeConversationExecution}=await import('../src/conversation.mjs');
 const f=await setup(),first=await submitConversationMessage({...f,messageId:'one',text:'Compare.'});
 await workConversationMessage({...f,messageId:'one',gateway:gateway(f)});
 const before=await readConversationMessage({...f,messageId:'one'});
 await revokeConversationExecution({...f,messageId:'one',revocationId:'late',expectedDigest:first.digest,reason:'No further execution.'});
 const after=await readConversationMessage({...f,messageId:'one'});assert.deepEqual(after.output,before.output);
});
test('interrupted safe parent hands off once to a new Run; different target or input is refused',async()=>{
 const {inspectResearchControl}=await import('../src/research-project.mjs');
 const f=await setup(),parent=await submitConversationMessage({...f,messageId:'parent',text:'Compare the original fees and risks.'});
 const stop=new AbortController();await workConversationMessage({...f,messageId:'parent',gateway:gateway(f),hostSignal:stop.signal,onCheckpoint:s=>{if(s.phase==='proposal-sealed')stop.abort();}});
 const child=await submitConversationMessage({...f,messageId:'child',text:'Continue the interrupted research.',continuationOfMessageId:'parent'});
 const receipt=await inspectResearchControl({projectDir:f.projectDir,runId:parent.runId});
 assert.equal(receipt.kind,'continuation-handoff');assert.equal(receipt.targetRunId,child.runId);
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:parent.runId})).run.status,'cancelled');
 assert.equal((await submitConversationMessage({...f,messageId:'child',text:'Continue the interrupted research.',continuationOfMessageId:'parent'})).runId,child.runId);
 await assert.rejects(submitConversationMessage({...f,messageId:'other',text:'Continue the interrupted research.',continuationOfMessageId:'parent'}),/CONTINUATION_NOT_ELIGIBLE|HANDOFF_TARGET_CONFLICT/);
 await workConversationMessage({...f,messageId:'child',gateway:gateway(f)});
 assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:child.runId})).run.status,'completed');
});
test('cold retry after parent handoff before child admission uses the same target and rejects changed intent',async()=>{
 const {cp}=await import('node:fs/promises'),{execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const f=await setup();await submitConversationMessage({...f,messageId:'parent',text:'Compare fees.'});
 const stop=new AbortController();await workConversationMessage({...f,messageId:'parent',gateway:gateway(f),hostSignal:stop.signal,onCheckpoint:s=>{if(s.phase==='proposal-sealed')stop.abort();}});
 const input={messageId:'child',text:'Continue checking original fees.',sourceManifestSha256:f.sourceManifestSha256,continuationOfMessageId:'parent'};
 const child=await submitConversationMessage({...f,...input});
 const clone=f.projectDir+'-handoff-crash';
 await cp(f.projectDir,clone,{recursive:true,filter:path=>!path.startsWith(join(f.projectDir,'sessions',child.runId))&&!path.endsWith('/tasks/'+child.runId+'.json')&&!path.endsWith('/messages/child.json')&&!path.endsWith('/child.admitted.json')});
 await assert.rejects(submitConversationMessage({...f,projectDir:clone,...input,text:'Changed after parent froze.'}),/CONTINUATION_NOT_ELIGIBLE|HANDOFF_PREPARED_CONFLICT|ID_CONFLICT/);
 const changed=await inspectResearchProject({projectDir:clone});await updateResearchProject({projectDir:clone,expectedConfigSha256:changed.configSha256,config:{...changed.config,limits:{...changed.config.limits,model:changed.config.limits.model-1}}});
 const file=join(clone,'submit.json');await writeFile(file,JSON.stringify(input));
 const {stdout}=await promisify(execFile)(process.execPath,['src/conversation-cli.mjs','submit','--project',clone,'--conversation',f.conversationId,'--input',file]);
 assert.equal(JSON.parse(stdout).runId,child.runId);assert.equal((await inspectResearchTask({projectDir:clone,runId:child.runId})).run.snapshot.phase,'ready');
});
test('competing parents for one new message cannot freeze the losing parent',async()=>{
 const f=await setup();
 const completed=await submitConversationMessage({...f,messageId:'done',text:'Compare.'});await workConversationMessage({...f,messageId:'done',gateway:gateway(f)});
 const active=await submitConversationMessage({...f,messageId:'paused',text:'Compare another.'}),stop=new AbortController();
 await workConversationMessage({...f,messageId:'paused',gateway:gateway(f),hostSignal:stop.signal,onCheckpoint:s=>{if(s.phase==='proposal-sealed')stop.abort();}});
 const requests=['done','paused'].map(continuationOfMessageId=>({...f,messageId:'shared',text:'Continue.',continuationOfMessageId}));
 const outcomes=await Promise.allSettled(requests.map(submitConversationMessage));assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
 const winning=outcomes.findIndex(x=>x.status==='fulfilled'),state=await inspectResearchTask({projectDir:f.projectDir,runId:active.runId});
 assert.equal(state.run.status,winning===0?'active':'cancelled');
});
test('unproven plugin effects cannot be repeated by completed or interrupted Continue',async()=>{
 const {createHash}=await import('node:crypto');
 const f=await setup(),project=await inspectResearchProject(f),modulePath=join(f.projectDir,'plugin.mjs');
 const code="import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';export default {id:'test-plugin',version:'1.0.0',schemaVersion:'trusted-plugin@1',sourceUrl:import.meta.url,contentSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),tools:[]};";
 await writeFile(modulePath,code);await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:project.configSha256,config:{...project.config,capabilities:['report','trusted-tools'],trustedPackages:[{modulePath,sha256:createHash('sha256').update(code).digest('hex'),trustedCodeApproved:true}]}});
 for(const messageId of ['done','paused']){
  const admitted=await submitConversationMessage({...f,messageId,text:'Compare.'});
  if(messageId==='done')await workConversationMessage({...f,messageId,gateway:gateway(f)});
  else{const stop=new AbortController();await workConversationMessage({...f,messageId,gateway:gateway(f),hostSignal:stop.signal,onCheckpoint:s=>{if(s.phase==='proposal-sealed')stop.abort();}});}
  await assert.rejects(submitConversationMessage({...f,messageId:'continue-'+messageId,text:'Continue.',continuationOfMessageId:messageId}),/EFFECT_LINEAGE_UNSUPPORTED/);
  assert.equal((await inspectResearchTask({projectDir:f.projectDir,runId:admitted.runId})).run.status,messageId==='done'?'completed':'active');
 }
 // Ordinary new intent still admits; this is not a blanket plugin ban.
 await submitConversationMessage({...f,messageId:'new-intent',text:'An explicitly new comparison.'});
});
test('cold questions CLI pages persisted clarification history without dispatch',async()=>{
 const {respondConversationQuestion,listConversationQuestions}=await import('../src/conversation.mjs');
 const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const f=await setup(),p=await inspectResearchProject(f);
 await updateResearchProject({projectDir:f.projectDir,expectedConfigSha256:p.configSha256,config:{...config,capabilities:['report','response'],interaction:{schemaVersion:'human-interaction@1'}}});
 await submitConversationMessage({...f,messageId:'ask',text:'Clarify fund and period.'});
 let calls=0;const g={mode:'fixture',async next(input){calls++;const count=input.messages.filter(m=>m.role==='tool'&&m.result.value?.kind==='human-interaction@1').length;return {kind:'calls',calls:[{id:'ask-'+count,name:'ask_response',arguments:{question:count?'Which period?':'Which fund?'}}]};}};
 await workConversationMessage({...f,messageId:'ask',gateway:g});
 const first=(await listConversationQuestions({...f,messageId:'ask'})).items[0];
 await respondConversationQuestion({...f,messageId:'ask',questionId:first.questionId,responseId:'fund',text:'Alpha'});
 await workConversationMessage({...f,messageId:'ask',gateway:g});
 const before=calls,run=promisify(execFile),base=['src/conversation-cli.mjs','questions','--project',f.projectDir,'--conversation',f.conversationId,'--message','ask'];
 const page=JSON.parse((await run(process.execPath,[...base,'--limit','1'])).stdout);
 assert.equal(page.items.length,1);assert.ok(page.nextAfter);assert.equal(page.items[0].questionId,first.questionId);
 const next=JSON.parse((await run(process.execPath,[...base,'--limit','1','--after',page.nextAfter])).stdout);
 assert.equal(next.items.length,1);assert.equal(next.items[0].question,'Which period?');assert.equal(next.nextAfter,null);
 assert.equal(calls,before);
 for(const value of ['0','51','1.5','NaN','1e0'])await assert.rejects(run(process.execPath,[...base,'--limit',value]));
 await assert.rejects(run(process.execPath,[...base,'--after','x'.repeat(401)]));
 await assert.rejects(run(process.execPath,[...base,'--limit','1','--limit','2']));
 await assert.rejects(run(process.execPath,['src/conversation-cli.mjs','list','--project',f.projectDir,'--conversation',f.conversationId,'--limit','1']));
});
