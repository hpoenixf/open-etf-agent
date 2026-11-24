import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLocalGui} from '../src/gui-server.mjs';

test('Daily Watch keeps settled web results when the last read is rejected before dispatch, then publishes exact durable body',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/daily-web-refusal-'));
 const instances=[];
 t.after(async()=>{for(const instance of instances)await instance.close();await rm(projectDir,{recursive:true,force:true});});
 let now=Date.parse('2026-11-24T14:55:00+08:00'),modelCalls=0,searchCalls=0;
 const pageCalls=[],saved=new Map(),question='Report on two fixtures';
 const urls=['https://example.com/first','https://example.com/second'];
 const invalid='https://invalid example.com/third';
 const modelResponse=(message,reason)=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason:reason}]});
 const call=(id,name,args)=>({type:'function',id,function:{name,arguments:JSON.stringify(args)}});
 const original='Both public sources were read. A third source was unavailable.';
 const app={
  projectDir,dailyClock:()=>now,
  liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic-model',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},connectivity:{web:true,search:'exa-public-preview'},limits:{model:3}},
  env:{ETF_GUI_PROVIDER_KEY:'fixture-placeholder',ETF_GUI_DAILY_AUTORUN:'1'},
  ownerWebTransport:{
   async searchFetch(_url,options){searchCalls++;const {id}=JSON.parse(options.body);return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:urls.join('\n')}]}});},
   async acquire({urls:[url],acquisitionId}){pageCalls.push(url);const i=urls.indexOf(url);assert.notEqual(i,-1);const manifestSha256=(i?'b':'a').repeat(64);
    const safeSource={manifestSha256,catalog:{documents:[{pages:['Evidence '+i],web:{requestedUrl:url,finalUrl:url,retrievedAt:'2026-11-24T00:00:00.000Z',originalSha256:(i?'d':'c').repeat(64)}}]}};
    saved.set(acquisitionId,{url,safeSource});return safeSource;},
   async inspect({acquisitionId}){const row=saved.get(acquisitionId);assert.ok(row);return {status:'succeeded',manifestSha256:row.safeSource.manifestSha256,plan:{urls:[row.url]}};},
   async load({manifestSha256}){return [...saved.values()].find(row=>row.safeSource.manifestSha256===manifestSha256)?.safeSource;},
  },
  async fetchImpl(_url,options){
   modelCalls++;
   const results=JSON.parse(options.body).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));
   if(modelCalls===1)return modelResponse({tool_calls:[call('locate','public_web_search',{query:'fixture sources'})]},'tool_calls');
   if(modelCalls===2){assert.equal(results.length,1);return modelResponse({tool_calls:[
    call('first','public_web_read',{url:urls[0]}),call('second','public_web_read',{url:urls[1]}),call('invalid','public_web_read',{url:invalid}),
   ]},'tool_calls');}
   assert.equal(modelCalls,3);
   assert.deepEqual(results.slice(1,3).map(r=>[r.status,r.value.text]),[['succeeded','Evidence 0'],['succeeded','Evidence 1']]);
   assert.equal(results[3].status,'rejected');assert.equal(results[3].error,'WEB_URL_INVALID');
   return modelResponse({content:original},'stop');
  },
 };
 async function launch(){const g=await startLocalGui(app);instances.push(g);return g;}
 const gui=await launch();
 const posted=await fetch(gui.origin+'/api/daily-watch',{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify({question,localTime:'15:00',enabled:true})});
 assert.equal(posted.status,201);
 now=Date.parse('2026-11-24T15:00:00+08:00');await gui.sweepDaily();
 const daily=await fetch(gui.origin+'/api/daily-watch').then(r=>r.json());
 const [row]=daily.items[0].history;
 assert.equal(row.status,'completed');
 assert.deepEqual(pageCalls,urls);
 assert.deepEqual([modelCalls,searchCalls],[3,1]);
 await gui.close();
 const cold=await launch();await cold.sweepDaily();
 const body=await fetch(cold.origin+'/api/conversations/'+row.conversationId+'/messages/'+row.messageId+'/body');
 assert.equal(body.status,200);assert.equal((await body.json()).body.text,original);
 assert.deepEqual([modelCalls,searchCalls],[3,1]);assert.deepEqual(pageCalls,urls);
});

test('Run Control does not soften dispatched, partial, unknown or hook-mediated outcomes',async()=>{
 const {decideRunControl}=await import('../src/run-control.mjs');
 const rejected={kind:'tool-result',succeeded:false,dispatched:false,ownerWebUrlRefusalProved:true};
 assert.deepEqual(decideRunControl(rejected),{action:'continue',reason:'LOCAL_WEB_URL_REFUSAL'});
 for(const context of [{unknown:true},{partial:true},{hooks:true}]){
  assert.deepEqual(decideRunControl(rejected,context),{action:'stop',reason:'TOOL_REJECTED'});
 }
 assert.deepEqual(decideRunControl({...rejected,dispatched:true}),{action:'stop',reason:'TOOL_FAILED'});
 assert.deepEqual(decideRunControl({...rejected,ownerWebUrlRefusalProved:false,error:'WEB_URL_INVALID'}),{action:'stop',reason:'TOOL_REJECTED'});
});

test('the original selected web validator, not a matching error string, proves pre-dispatch nonexecution',async t=>{
 const {createToolHost}=await import('../src/tools.mjs');
 const {openOwnerWeb}=await import('../src/gui-owner-web.mjs');
 await mkdir('test-output',{recursive:true});
 const directory=await mkdtemp(resolve('test-output/web-refusal-proof-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const runIdentity={runId:'proof-run',grantId:'proof-grant'};
 const url='https://invalid example.com/page';
 const call={id:'web-page',name:'public_web_read',arguments:{url}};
 const owner=openOwnerWeb({profile:{web:true},projectDir:directory,runId:runIdentity.runId});
 const host=await createToolHost({directory,extensions:owner,runIdentity});
 const result=await host.execute(call,{onDispatch(){assert.fail('invalid URL must not reserve a tool call');}});
 assert.equal(result.dispatched,false);
 assert.equal(result.error,'WEB_URL_INVALID');
 assert.equal(host.ownerWebUrlRefusalProved(call,result),true);
 assert.equal(host.ownerWebUrlRefusalProved({...call,arguments:{url:'https://example.com/page'}},result),false);
 assert.equal(host.ownerWebUrlRefusalProved({...call,id:'other-call'},result),false);
 for(const changed of [{dispatched:true},{partialPaths:[]},{effective:call},{validation:{code:'WEB_URL_INVALID'}}])
  assert.equal(host.ownerWebUrlRefusalProved(call,{...result,...changed}),false);
 const fake={...owner[0],validate(){throw Object.assign(new Error('WEB_URL_INVALID'),{code:'WEB_URL_INVALID'});}};
 const wrong=await createToolHost({directory,runIdentity,extensions:[fake]});
 assert.equal(wrong.ownerWebUrlRefusalProved(call,await wrong.execute(call)),false);
});
