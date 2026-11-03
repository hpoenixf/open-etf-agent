import test from 'node:test';import assert from 'node:assert/strict';import{mkdir,mkdtemp,rm}from'node:fs/promises';import{resolve,join}from'node:path';import{run}from'../src/runtime.mjs';import{openSession}from'../src/session.mjs';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'reference',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
for(const mode of ['typed-ref','numbered-citation'])test('Result owner anchored '+mode+' rejection corrects once and cold reads original fact',async()=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/reference-proof-'));let store=await openSession({directory}),calls=0,source,ref;
 const options={question:'Use original sources.',outputRoot:join(directory,'outputs'),requireReport:true,publication:true,limits:{maxRounds:6,maxTools:6,timeoutMs:30000},durable:{store,grantId:'reference-grant',bindings},gateway:{mode:'fixture',async next({messages}){
 calls++;
 if(calls===1)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:'atlas-a',page:1}}]};
 const read=messages.find(m=>m.callId==='read').result.value;source=read.sourceId;ref=read.resultRef;
 if(calls===2)return{kind:'calls',calls:[{id:'bad',name:'save_report',arguments:{text:mode==='typed-ref'?'Fact [1]':'Fact [C1]',sourceIds:[mode==='typed-ref'?ref:source]}}]};
 if(calls===3){const bad=messages.find(m=>m.callId==='bad').result;assert.equal(bad.dispatched,false);assert.equal(bad.validation.basis,undefined);return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'Original [1]',sourceIds:[source]}}]};}
 return{kind:'final',text:'Saved.'};}}};
 try{const out=await run(options);assert.equal(out.status,'completed',out.code);assert.equal(out.rootUsage.tool,2);assert.equal(calls,4);const old=store.inspect(out.runId),v=old.snapshot.messages.find(m=>m.callId==='bad').result.validation;assert.equal(v.basis.length,1);assert.equal(v.runId,out.runId);store.close();store=await openSession({directory});const again=await run({...options,durable:{...options.durable,store,runId:out.runId}});assert.equal(again.status,'completed');assert.equal(calls,4);
 }finally{store.close();await rm(directory,{recursive:true,force:true});}
});
