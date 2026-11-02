import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {createToolHost} from '../src/tools.mjs';
import {sha256} from '../src/source.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/context-capability-'));}
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});

test('working input rejects missing selected reread consumers before any model, summary or Run output',async()=>{
  for(const mode of ['context-original','summary-note','summary-original']){
    const outputRoot=await directory();let calls=0,summaries=0;
    const allowedTools=mode==='context-original'?['read_page']:mode==='summary-note'?['read_page','read_result']:['read_page','read_note'];
    const originalGrant=[...allowedTools];
    const options={question:'Preserve the selected tool grant.',gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Must not be requested.'};}},outputRoot,requireReport:false,allowedTools,...(mode==='context-original'?{contextBytes:7000}:{workingInput:{compaction:{thresholdBytes:1,summarize:async()=>{summaries++;return 'derived';}}}})};
    await assert.rejects(run(options),error=>error.code==='WORKING_INPUT_TOOL_UNAVAILABLE');
    assert.equal(calls,0);assert.equal(summaries,0);assert.deepEqual(await readdir(outputRoot),[]);
    assert.deepEqual(allowedTools,originalGrant,'admission never widens the caller grant');
  }
});

test('selected consumers support actual original and note rereads through the same Runtime Host',async()=>{
  for(const mode of ['context','summary']){
    const text='Original synthetic page content. '.repeat(105);
    const sources=[1,2].map(page=>({sourceId:`profile@1:p${page}`,documentId:'profile',name:'Synthetic selected-capability profile',version:'1',page,text:page+text,sha256:sha256(page+text),mediaType:'text/plain; charset=utf-8'}));
    const extension={name:'read_large',historyCompaction:'read-only@1',description:'Read one fixed synthetic source page.',parameters:{type:'object',properties:{page:{type:'integer',minimum:1,maximum:2}},required:['page'],additionalProperties:false},sourceResult:true,validate(args){assert.deepEqual(Object.keys(args),['page']);assert.ok([1,2].includes(args.page));},execute:async({page})=>structuredClone(sources[page-1])};
    const allowedTools=['read_large','read_result',...(mode==='summary'?['read_note']:[])];let step=0,selectedRef,originalRef;
    const gateway={mode:'fixture',async next({messages,tools}){
      assert.deepEqual(tools.map(t=>t.name).sort(),[...allowedTools].sort());
      if(step===1)originalRef=messages.at(-1).result.value.resultRef;
      if(step<2){const page=++step;return call('read-'+page,'read_large',{page});}
      if(step===2){const kind=mode==='context'?'stored-source-ref':'derived-working-note';const value=messages.filter(m=>m.role==='tool').map(m=>m.result.value).find(v=>v?.kind===kind);assert.ok(value,'the actual next Gateway input contains the enabled projection');selectedRef=value.resultRef;step++;return call('consume-ref',mode==='context'?'read_result':'read_note',{resultRef:selectedRef});}
      if(step===3){assert.equal(messages.at(-1).result.value.resultRef,selectedRef);if(mode==='context'){assert.equal(messages.at(-1).result.value.text,sources[0].text);return{kind:'final',text:'Exact original consumed.'};}else assert.equal(messages.at(-1).result.value.kind,'derived-working-note');step++;return call('consume-original','read_result',{resultRef:originalRef});}
      assert.equal(messages.at(-1).result.value.text,sources[0].text);return{kind:'final',text:'Original immutable bytes were consumed after projection.'};
    }};
    const out=await run({question:'Keep both source identities; derived notes are not original evidence.',gateway,extensions:[extension],allowedTools,outputRoot:await directory(),requireReport:false,contextBytes:mode==='context'?7000:32000,limits:{maxRounds:12,maxTools:6},workingInput:mode==='summary'?{compaction:{thresholdBytes:1000,summarize:async()=> 'Derived source observation; exact original refs remain authoritative.'}}:undefined});
    assert.equal(out.status,'completed',out.code);assert.equal(out.toolsDispatched,mode==='context'?3:4);assert.equal(out.unknownEffects.length,0);
  }
});

test('a narrow profile without reference projection or compaction remains unchanged',async()=>{
  let calls=0;const out=await run({question:'No optional working-input mechanism.',allowedTools:['read_page'],requireReport:false,outputRoot:await directory(),gateway:{mode:'fixture',async next({tools}){calls++;assert.deepEqual(tools.map(t=>t.name),['read_page']);return{kind:'final',text:'Narrow profile.'};}}});
  assert.equal(out.status,'completed');assert.equal(calls,1);
});

// Portable legacy-shape fixture from the original Session/Host contract. The
// separate upgrade proof uses the fixed old Runtime producer, not this fixture.
test('legacy terminal narrow context profile remains a binding-checked zero-model cold read',async()=>{
  const d=await directory();const question='Synthetic legacy terminal profile.';
  const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'synthetic-compat',version:'1'},plugins:[],adapters:[]};
  const limits={maxRounds:4,maxTools:4,timeoutMs:10000};const allowedTools=['read_page'];
  const config={requireReport:false,allowedTools,contextBytes:4000,taskId:null};
  const host=await createToolHost({directory:d,allowedTools});
  const snapshot={schemaVersion:'runtime-checkpoint@1',phase:'ready',messages:[{role:'user',content:question}],usedIds:[],rounds:0,toolsDispatched:0,proposal:null,cursor:0,result:null,host:host.snapshot(),working:null,answer:'',status:'failed',code:null,unknownEffects:[],partialEffects:[],hookErrors:[]};
  let store=await openSession({directory:d});let original,runId;
  try{
    const saved=store.create({directory:d,definition:{question,grantId:'legacy-profile',bindings,limits,rootLimits:{model:4,tool:4},deadlineAt:Date.now()+10000,config},snapshot});runId=saved.runId;
    const claim=store.claim(runId,'legacy-producer');claim.reserve('model',{...snapshot,phase:'model-reserved',rounds:1});
    original={runId,rootId:saved.rootId,directory:d,status:'completed',code:null,answer:'Original legacy answer.',receipt:null,toolsDispatched:0,rounds:1,logErrors:[],unknownEffects:[],partialEffects:[],hookErrors:[],rootUsage:{model:1,tool:0},taskId:null,sources:[],resultRefs:[],semanticStatus:'unreviewed'};
    claim.finish({...snapshot,phase:'terminal',status:'completed',rounds:1,answer:original.answer,outcome:original});
  }finally{store.close();}
  store=await openSession({directory:d});let calls=0;
  try{
    const options={question,outputRoot:d,gateway:{mode:'fixture',next:async()=>{calls++;throw Error('NO_MODEL_ON_READBACK');}},requireReport:false,allowedTools,contextBytes:4000,limits,durable:{store,grantId:'legacy-profile',bindings,runId}};
    assert.deepEqual(await run(options),original);assert.equal(calls,0);
    await assert.rejects(run({...options,contextBytes:5000}),error=>error.code==='RUN_BINDINGS_MISMATCH');
    assert.deepEqual(store.inspect(runId).definition.config.allowedTools,['read_page']);
    assert.deepEqual(store.inspect(runId).rootUsage,{model:1,tool:0});assert.equal(calls,0);
  }finally{store.close();}
});
