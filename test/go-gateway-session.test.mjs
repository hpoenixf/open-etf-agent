import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createChatGateway} from '../src/gateway.mjs';
import {createResearchProject,submitResearchTask,workResearchTask,readResearchReport,inspectResearchChildren} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
const endpoint='https://opencode.ai/zen/go/v1/chat/completions';
const authorization={providerApproved:true,dataApproved:true,costApproved:true};
const input={messages:[{role:'user',content:'Synthetic question'}],tools:[]};
const final=()=>new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'Done'},finish_reason:'stop'}]}),{status:200});
const expected=root=>'open-etf-agent-'+createHash('sha256').update(root).digest('hex');
function gateway(fetchImpl,extra={}){return createChatGateway({endpoint,model:'synthetic',apiKey:'synthetic-test-key',authorization,fetchImpl,...extra});}
test('Go default adapter uses the same native Root session across Main, Child and reopened gateway without body changes',async()=>{
 const sent=[];const fetchImpl=async(url,options)=>{sent.push(options);return final();};
 const g=gateway(fetchImpl);await g.next({...input,reservation:{rootId:'root-a',runId:'root-a'}});await g.next({...input,reservation:{rootId:'root-a',runId:'child-a'}});await gateway(fetchImpl).next({...input,reservation:{rootId:'root-a',runId:'root-a'}});await g.next({...input,reservation:{rootId:'root-b',runId:'root-b'}});
 for(const s of sent.slice(0,3)){assert.equal(new Headers(s.headers).get('x-opencode-session'),expected('root-a'));assert.equal(new Headers(s.headers).get('user-agent'),'open-etf-agent/0.27');assert.equal(s.redirect,'error');}
 assert.equal(new Headers(sent[3].headers).get('x-opencode-session'),expected('root-b'));
 const other=[];await gateway(async(url,options)=>{other.push(options);return final();},{endpoint:'https://example.invalid/v1/chat/completions'}).next(input);assert.equal(sent[0].body,other[0].body);assert.equal(g.inputBudget.measure(input),Buffer.byteLength(sent[0].body));
});
test('direct non-durable Go gateway has one opaque session per instance; malformed native identity fails closed',async()=>{
 const ids=[];const f=async(url,o)=>{ids.push(new Headers(o.headers).get('x-opencode-session'));return final();};const g=gateway(f);await g.next(input);await g.next(input);await gateway(f).next(input);assert.match(ids[0],/^open-etf-agent-[a-f0-9]{64}$/);assert.equal(ids[0],ids[1]);assert.notEqual(ids[0],ids[2]);
 for(const reservation of [{},{rootId:''},{rootId:42},null])await assert.rejects(g.next({...input,reservation}),{code:'GO_NATIVE_ROOT_REQUIRED'});assert.equal(ids.length,3);
});
test('Go metadata is limited to the official exact endpoint; other provider headers stay unchanged',async()=>{
 for(const e of ['https://opencode.ai/zen/v1/chat/completions','https://other.invalid/zen/go/v1/chat/completions','https://opencode.ai:444/zen/go/v1/chat/completions']){let sent;await gateway(async(url,o)=>{sent=o;return final();},{endpoint:e}).next({...input,reservation:{}});assert.deepEqual(sent.headers,{'content-type':'application/json',authorization:'Bearer synthetic-test-key'});}
});
test('default Project gateway sends native Go metadata through Child, report save and terminal reopen',async t=>{
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/go-project-'));t.after(()=>rm(projectDir,{recursive:true,force:true}));
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'live',provider:'opencode-go',protocol:'chat-completions',model:'synthetic',endpoint,apiKeyEnv:'CHAT_API_KEY',stream:false},capabilities:['report','child'],childExecution:{schemaVersion:'child-execution@1',maxChildren:1,methods:[CLAIM_COMPARISON_METHOD]}}});
 const file=join(projectDir,'source.md');await writeFile(file,'Synthetic source evidence.');const bundle=await importProjectSources({projectDir,files:[file]});
 const request={projectDir,runId:'native-root',question:'Read and save a source-backed report.',sourceManifestSha256:bundle.manifestSha256,authorization,reportDelivery:'artifact-required@1'};await submitResearchTask(request);
 let calls=0;const roles=new Set();const fetchImpl=async(url,options,context)=>{
  calls++;assert.equal(String(url),endpoint);assert.equal(new Headers(options.headers).get('x-opencode-session'),expected(context.rootId));assert.equal(context.rootId,request.runId);assert.equal(new Headers(options.headers).get('user-agent'),'open-etf-agent/0.27');roles.add(context.role);
  const body=JSON.parse(options.body),results=body.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);let name,args;
  if(context.role==='child'){if(results.length)return final();name='read_page';args={documentId:bundle.catalog.documents[0].id,page:1};}
  else if(!results.length){name='delegate_child';args={methodId:CLAIM_COMPARISON_METHOD.id,question:'Read the source.',documents:[bundle.catalog.documents[0].id]};}
  else if(!results.some(r=>r.path==='report.md')){name='save_report';args={text:'Synthetic source evidence.',sourceIds:results[0].sources.map(s=>s.sourceId)};}
  else return final();
  return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'call-'+calls,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]}),{status:200});
 };
 const done=await workResearchTask({...request,apiKey:'synthetic-test-key',fetchImpl});assert.equal(done.run.status,'completed',done.run.snapshot.code);assert.deepEqual([...roles].sort(),['child','main']);assert.equal(calls,5);assert.ok((await readResearchReport(request)).report);assert.equal((await inspectResearchChildren(request)).items[0].consumption,'consumed');
 const again=await workResearchTask({...request,apiKey:'synthetic-test-key',fetchImpl:()=>assert.fail('No terminal replay')});assert.equal(again.run.status,'completed');
});

import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
test('default CLI cold continuation keeps native Root session and completes saved report without a header wrapper',async t=>{
 await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/go-cli-'));t.after(()=>rm(projectDir,{recursive:true,force:true}));
 await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'live',provider:'opencode-go',protocol:'chat-completions',model:'synthetic',endpoint,apiKeyEnv:'GO_TEST_KEY',stream:false},capabilities:['report']}});
 const file=join(projectDir,'source.md');await writeFile(file,'Synthetic fact.');const bundle=await importProjectSources({projectDir,files:[file]});
 const request={projectDir,runId:'cli-root',question:'Save a report.',sourceManifestSha256:bundle.manifestSha256,authorization,reportDelivery:'artifact-required@1'};await submitResearchTask(request);
 const stop=new AbortController();let dispatches=0;const paused=await workResearchTask({...request,apiKey:'synthetic-test-key',hostSignal:stop.signal,onCheckpoint(e){if(e.phase==='result-consumed')stop.abort();},fetchImpl:async(url,options)=>{dispatches++;assert.equal(new Headers(options.headers).get('x-opencode-session'),expected(request.runId));return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'original-read',type:'function',function:{name:'read_page',arguments:JSON.stringify({documentId:bundle.catalog.documents[0].id,page:1})}}]},finish_reason:'tool_calls'}]}),{status:200});}});
 assert.equal(paused.workerStatus,'interrupted');assert.equal(dispatches,1);
 const script=`import assert from 'node:assert/strict';import {runResearchCli} from ${JSON.stringify(pathToFileURL(resolve('src/research-cli.mjs')).href)};let calls=0;globalThis.fetch=async(url,o)=>{calls++;assert.equal(String(url),${JSON.stringify(endpoint)});assert.equal(new Headers(o.headers).get('x-opencode-session'),${JSON.stringify(expected(request.runId))});assert.equal(new Headers(o.headers).get('user-agent'),'open-etf-agent/0.27');const results=JSON.parse(o.body).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);const saved=results.some(r=>r.path==='report.md');return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:saved?'Saved.':null,...(saved?{}:{tool_calls:[{id:'save',type:'function',function:{name:'save_report',arguments:JSON.stringify({text:'Synthetic fact.',sourceIds:[results[0].sourceId]})}}]})},finish_reason:saved?'stop':'tool_calls'}]}),{status:200});};let stdout='',stderr='';const args=['run','work','--project',${JSON.stringify(projectDir)},'--run','cli-root'];const io={stdout:{write:s=>stdout+=s},stderr:{write:s=>stderr+=s}};assert.equal(await runResearchCli(args,io),0,stderr);assert.equal(calls,2);assert.equal(await runResearchCli(args,io),0,stderr);assert.equal(calls,2);console.log(JSON.stringify({pid:process.pid,calls}));`;
 const resumed=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH,LANG:'C.UTF-8',TZ:'UTC',GO_TEST_KEY:'synthetic-test-key'}});assert.equal(resumed.status,0,resumed.stderr);const result=JSON.parse(resumed.stdout);assert.notEqual(result.pid,process.pid);assert.equal(result.calls,2);assert.ok((await readResearchReport(request)).report);
});
