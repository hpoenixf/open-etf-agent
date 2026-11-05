import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {projectControlProofs,projectContext} from '../src/context.mjs';
import {createToolHost} from '../src/tools.mjs';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {createChatGateway} from '../src/gateway.mjs';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'report-feedback',version:'1'},plugins:[],adapters:[]};
async function directory(t){await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/report-feedback-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
function messages(){return [{role:'user',content:'Read the original source.'},{role:'assistant',calls:[{id:'bad',name:'save_report',arguments:{text:'There were no calculations [C1]. Source [1].',sourceIds:['atlas-a@A:p1']}}]},{role:'tool',callId:'bad',result:{callId:'bad',status:'rejected',dispatched:false,error:'REPORT_CITATION_OUT_OF_RANGE',durationMs:1,validation:{schemaVersion:'builtin-report-reference-validation@1',code:'REPORT_CITATION_OUT_OF_RANGE',repairable:true,requestHash:'a'.repeat(64),runId:'private-run',grantId:'private-grant',scopeHash:'private-scope',basis:[{recordPath:'private-owner-path'}],basisHash:'private-basis'}}}];}

test('report feedback is projected with exact original pairs, without changing history or exposing private proof',async()=>{
 const original=messages(),saved=structuredClone(original),plain=projectControlProofs(original),bounded=await projectContext({messages:original,maxBytes:10000,lookupSource:async()=>assert.fail('no source replacement required')});
 assert.deepEqual(plain,bounded);assert.deepEqual(original,saved);assert.deepEqual(plain[1],original[1]);assert.deepEqual(Object.keys(plain[2].result.validation),['schemaVersion','code','repairable','requestHash']);
 assert.match(plain[2].result.repairAdvice,/Every literal numbered marker/);assert.match(plain[2].result.repairAdvice,/Keep already-valid sourceIds unchanged/);assert.match(plain[2].result.repairAdvice,/documentId is not sourceId/);assert.match(plain[2].result.repairAdvice,/does not grant another attempt/);
 assert.ok(!JSON.stringify(plain).includes('private-'));assert.equal(original[2].result.repairAdvice,undefined);
 await assert.rejects(projectContext({messages:original,maxBytes:10,lookupSource:async()=>null}),{code:'CONTEXT_CAPACITY_EXCEEDED'});
});

test('report advice never expands to a different error, schema, success or dispatched result',()=>{
 for(const mutate of [m=>m.result.validation.code='REPORT_TYPED_REFERENCE_NOT_SOURCE',m=>m.result.validation.schemaVersion='plugin-lookalike@1',m=>m.result.validation.repairable=false,m=>m.result.error='OTHER',m=>m.result.callId='foreign',m=>m.result.status='succeeded',m=>m.result.dispatched=true,m=>{delete m.result.validation;}]){const original=messages();mutate(original[2]);assert.equal(projectControlProofs(original)[2].result.repairAdvice,undefined);}
});

test('report definitions explain literal markers and sourceId without weakening source and citation validation',async t=>{
 const host=await createToolHost({directory:await directory(t)});try{
 const definition=host.definitions.find(x=>x.name==='save_report');assert.match(definition.description,/A documentId is not a sourceId/);assert.match(definition.description,/Every literal numbered citation/);assert.match(definition.parameters.properties.sourceIds.description,/version\/page suffix/);
 const source=(await host.execute(call('read','read_page',{documentId:'atlas-a',page:1}).calls[0])).value;
 const quote=await host.execute(call('quote','save_report',{text:'There were no calculations [C1]. Source [1].',sourceIds:[source.sourceId]}).calls[0]);assert.equal(quote.status,'rejected');assert.equal(quote.dispatched,false);assert.match(quote.error,/citation/);
 const wrong=await host.execute(call('wrong','save_report',{text:'Source [1].',sourceIds:[source.documentId]}).calls[0]);assert.equal(wrong.status,'rejected');assert.equal(wrong.dispatched,false);assert.equal(wrong.validation,undefined);assert.match(wrong.error,/Unknown acquired source ID/);assert.equal(host.snapshot().saveAttempted,false);
 }finally{await host.close();}
});

for(const mode of ['correct','wrong-source','repeat-citation'])test('non-Publication durable Runtime '+mode+' retains its single correction and exact original source',async t=>{
 const dir=await directory(t);let store=await openSession({directory:dir}),calls=0,source,runId;
 const options={question:'Synthetic original source report, no calculation.',outputRoot:join(dir,'outputs'),requireReport:true,publication:false,limits:{maxRounds:5,maxTools:4,timeoutMs:30000},durable:{store,grantId:'report-feedback-grant',bindings},gateway:{mode:'fixture',async next({messages}){
  calls++;if(calls===1)return call('read','read_page',{documentId:'atlas-a',page:1});
  source=messages.find(m=>m.callId==='read').result.value;
  if(calls===2)return call('bad','save_report',{text:'No calculations [C1]. Source [1].',sourceIds:[source.sourceId]});
  if(calls===3){const rejected=messages.find(m=>m.callId==='bad').result;assert.equal(rejected.dispatched,false);assert.match(rejected.repairAdvice,/Keep already-valid sourceIds unchanged/);assert.equal(rejected.validation.basis,undefined);assert.deepEqual(messages.find(m=>m.role==='assistant'&&m.calls?.[0].id==='bad').calls[0].arguments.sourceIds,[source.sourceId]);return call('fixed','save_report',{text:mode==='repeat-citation'?'Still no calculations [C1]. Source [1].':'Original source [1]. No calculation was performed.',sourceIds:[mode==='wrong-source'?source.documentId:source.sourceId]});}
  return{kind:'final',text:'Saved.'};
 }}};
 try{
  const out=await run(options);runId=out.runId;assert.equal(out.status,mode==='correct'?'completed':'failed');if(mode!=='correct')assert.equal(out.code,mode==='wrong-source'?'TOOL_REJECTED':'CORRECTION_LIMIT');
  const saved=store.inspect(runId),bad=saved.snapshot.messages.find(m=>m.callId==='bad').result;assert.equal(bad.repairAdvice,undefined);assert.ok(bad.validation.basis.length);assert.equal(saved.snapshot.corrections,1);assert.deepEqual(out.rootUsage,{model:mode==='correct'?4:3,tool:mode==='correct'?2:1});
  if(mode==='correct')assert.match(await readFile(join(saved.directory,'report.md'),'utf8'),/No calculation was performed/);else assert.equal(saved.snapshot.host.receipt,null);
  const before=calls;store.close();store=await openSession({directory:dir});const cold=await run({...options,durable:{...options.durable,store,runId}});assert.equal(cold.status,out.status);assert.equal(calls,before);assert.deepEqual(store.inspect(runId).snapshot.messages.find(m=>m.callId==='bad').result,bad);
 }finally{store.close();}
});

for(const phase of ['result-committed','result-consumed'])test('report feedback follows original '+phase+' cold recovery without rewriting the proof',async t=>{
 const dir=await directory(t);let store=await openSession({directory:dir}),calls=0,source;
 const stop=new AbortController(),options={question:'Synthetic citation feedback recovery.',outputRoot:join(dir,'outputs'),requireReport:true,publication:false,limits:{maxRounds:5,maxTools:4,timeoutMs:30000},durable:{store,grantId:'feedback-recovery-grant',bindings},gateway:{mode:'fixture',next({messages}){
  calls++;if(calls===1)return call('read','read_page',{documentId:'atlas-a',page:1});source=messages.find(m=>m.callId==='read').result.value;
  if(calls===2)return call('bad','save_report',{text:'No calculations [C1]. Source [1].',sourceIds:[source.sourceId]});
  if(calls===3){assert.match(messages.find(m=>m.callId==='bad').result.repairAdvice,/Remove or correct unsupported markers in text/);return call('fixed','save_report',{text:'Original source [1].',sourceIds:[source.sourceId]});}return{kind:'final',text:'Saved.'};
 }}};
 try{const first=await run({...options,hostSignal:stop.signal,durable:{...options.durable,onCheckpoint:e=>{if(e.phase===phase&&store.inspect(e.runId).snapshot.proposal?.calls?.[0]?.id==='bad')stop.abort();}}});assert.equal(first.status,'interrupted');assert.equal(calls,2);const before=store.inspect(first.runId),proof=(before.snapshot.result??before.snapshot.messages.find(m=>m.callId==='bad').result).validation;store.close();store=await openSession({directory:dir});const resumed=await run({...options,durable:{...options.durable,store,runId:first.runId}});assert.equal(resumed.status,'completed');assert.equal(calls,4);const after=store.inspect(first.runId);assert.deepEqual(after.snapshot.messages.find(m=>m.callId==='bad').result.validation,proof);assert.deepEqual(after.definition,before.definition);assert.equal(after.snapshot.corrections,1);assert.deepEqual(after.rootUsage,{model:4,tool:2});}finally{store.close();}
});

test('original OpenAI-shaped model wire carries explanation once and preserves the rejected sourceIds',async t=>{
 const dir=await directory(t),store=await openSession({directory:dir});let requests=0,source,paired=false;
 const gateway=createChatGateway({endpoint:'https://example.invalid/chat/completions',model:'synthetic',apiKey:'synthetic',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:async(_url,request)=>{
  requests++;const body=JSON.parse(request.body);let next;
  if(requests===1)next=call('read','read_page',{documentId:'atlas-a',page:1});
  else{source=JSON.parse(body.messages.find(m=>m.role==='tool'&&m.tool_call_id==='read').content).value;
   if(requests===2)next=call('bad','save_report',{text:'No calculations [C1]. Source [1].',sourceIds:[source.sourceId]});
   if(requests===3){const replies=body.messages.filter(m=>m.role==='tool'&&m.tool_call_id==='bad');assert.equal(replies.length,1);const rejection=JSON.parse(replies[0].content);assert.match(rejection.repairAdvice,/documentId is not sourceId/);assert.equal(rejection.validation.basis,undefined);const original=body.messages.flatMap(m=>m.tool_calls??[]).find(c=>c.id==='bad');assert.deepEqual(JSON.parse(original.function.arguments).sourceIds,[source.sourceId]);paired=true;next=call('fixed','save_report',{text:'Original [1]. No calculation was performed.',sourceIds:[source.sourceId]});}
  }
  const c=next?.calls[0],message=c?{role:'assistant',content:null,tool_calls:[{id:c.id,type:'function',function:{name:c.name,arguments:JSON.stringify(c.arguments)}}]}:{role:'assistant',content:'Saved.'};return Response.json({choices:[{message,finish_reason:c?'tool_calls':'stop'}]});
 }});
 try{const out=await run({question:'Synthetic wire correction.',outputRoot:join(dir,'outputs'),requireReport:true,publication:false,gateway,limits:{maxRounds:5,maxTools:4,timeoutMs:30000},durable:{store,grantId:'feedback-wire-grant',bindings:{...bindings,gateway:{mode:'live',provider:'synthetic',protocol:'chat-completions',model:'synthetic',version:'1'}}}});assert.equal(out.status,'completed',out.code);assert.equal(requests,4);assert.equal(paired,true);assert.deepEqual(out.rootUsage,{model:4,tool:2});}finally{store.close();}
});
