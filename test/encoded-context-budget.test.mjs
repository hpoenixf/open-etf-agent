import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatGateway} from '../src/gateway.mjs';
import {projectContext} from '../src/context.mjs';
import {compactWorkingView} from '../src/compaction.mjs';
import {sha256} from '../src/source.mjs';
import {createRootBudget} from '../src/cooperation.mjs';

function sourceGroup(id,text){
 const source={sourceId:`${id}@v1:p1`,documentId:id,name:id,version:'v1',page:1,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8'},ref={...Object.fromEntries(['sourceId','documentId','name','version','page','sha256','mediaType'].map(k=>[k,source[k]])),resultRef:'result:sha256:'+sha256(id)};
 return {source,ref,messages:[{role:'assistant',calls:[{id,name:'read_page',arguments:{documentId:id,page:1}}]},{role:'tool',callId:id,result:{callId:id,status:'succeeded',dispatched:true,value:{...source,resultRef:ref.resultRef}}}]};
}
test('Gateway input measurement is exactly its real encoder and performs no fetch',async()=>{
 let calls=0,actual;const gateway=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'fixture-measure',apiKey:'synthetic-not-a-secret',authorization:{providerApproved:true,dataApproved:true,costApproved:true},fetchImpl:async(_,options)=>{calls++;actual=Buffer.byteLength(options.body);return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'done'},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});}});
 const input={messages:[{role:'user',content:'original'},...sourceGroup('a','quotes " and \\ and \u0001').messages],tools:[]};
 const measured=gateway.inputBudget.measure(input);assert.equal(calls,0);await gateway.next(input);assert.equal(calls,1);assert.equal(actual,measured);
});
test('Context projects only old originals when encoded transport budget is tighter than raw messages',async()=>{
 const old=sourceGroup('old','"'.repeat(30000)),latest=sourceGroup('latest','"'.repeat(30000));const messages=[{role:'user',content:'Keep original question'},...old.messages,...latest.messages],original=structuredClone(messages);
 const gateway=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'test',apiKey:'synthetic',authorization:{providerApproved:true,dataApproved:true,costApproved:true},maxInputBytes:160000,fetchImpl:()=>assert.fail('measurement must not dispatch')});
 const measure=messages=>gateway.inputBudget.measure({messages,tools:[]});assert.ok(Buffer.byteLength(JSON.stringify(messages))<160000);assert.ok(measure(messages)>160000);
 const lookupSource=async id=>[old,latest].find(x=>x.source.sourceId===id)?.ref;
 const result=await projectContext({messages,maxBytes:1048576,lookupSource,additionalBudget:{maxBytes:160000,measure}});
 assert.equal(result[2].result.value.kind,'stored-source-ref');assert.deepEqual(result.at(-1),latest.messages.at(-1));assert.deepEqual(result[0],original[0]);assert.ok(measure(result)<=160000);assert.deepEqual(messages,original);
 await assert.rejects(projectContext({messages,maxBytes:1048576,lookupSource,additionalBudget:{maxBytes:100,measure}}),e=>e.code==='CONTEXT_CAPACITY_EXCEEDED');
 await assert.rejects(projectContext({messages,maxBytes:1048576,lookupSource,additionalBudget:{maxBytes:160000,measure:()=>NaN}}));
});
test('An oversized summary input falls back before reservation, model call or note effect',async()=>{
 const old=sourceGroup('old','Original acquired evidence. '.repeat(100)),latest=sourceGroup('latest','Small latest evidence.'),messages=[{role:'user',content:'Original question'},...old.messages,...latest.messages];
 const rootBudget=createRootBudget({model:2,tool:2});let checked=0,reserved=0,summarized=0,saved=0;
 const result=await compactWorkingView({messages,maxBytes:16000,lookupSource:async id=>[old,latest].find(x=>x.source.sourceId===id)?.ref,rootBudget,canCompactHistory:()=>true,summaryInputFits:({groups})=>{checked++;assert.equal(groups.length,1);return false;},reserveSummary:()=>{reserved++;},summarize:()=>{summarized++;return 'derived';},saveNote:()=>{saved++;}});
 assert.equal(result.observation.status,'summary-input-capacity');assert.equal(checked,1);assert.equal(reserved,0);assert.equal(summarized,0);assert.equal(saved,0);assert.equal(rootBudget.snapshot().model,0);assert.deepEqual(result.messages,messages);
});
