import test from 'node:test';
import assert from 'node:assert/strict';
import {compactWorkingView} from '../src/compaction.mjs';
import {createRootBudget} from '../src/cooperation.mjs';
import {sha256} from '../src/source.mjs';
function fixture(){const source={sourceId:'bounds@V1:p1',documentId:'bounds',name:'Synthetic bounded compaction',version:'V1',page:1,text:'Original synthetic source. '.repeat(80),mediaType:'text/plain; charset=utf-8'};source.sha256=sha256(source.text);const ref={...Object.fromEntries(['sourceId','documentId','name','version','page','sha256','mediaType'].map(k=>[k,source[k]])),resultRef:'result:sha256:'+sha256('bounds')};return{lookupSource:async()=>ref,messages:[{role:'user',content:'Keep exact evidence.'},{role:'assistant',calls:[{id:'old',name:'read_page',arguments:{documentId:'bounds',page:1}}]},{role:'tool',callId:'old',result:{callId:'old',status:'succeeded',value:{...source,resultRef:ref.resultRef}}},{role:'assistant',calls:[{id:'new',name:'read_page',arguments:{documentId:'bounds',page:2}}]},{role:'tool',callId:'new',result:{callId:'new',status:'succeeded',value:{text:'Latest group'}}}]};}
test('5.3 uncooperative summarizer is bounded on timeout and active cancellation',async()=>{
  for(const mode of ['timeout','cancel']){
    const controller=new AbortController();let saves=0;const f=fixture();const pending=compactWorkingView({canCompactHistory:()=>true,...f,maxBytes:8000,summaryTimeoutMs:20,signal:controller.signal,rootBudget:createRootBudget({model:1,tool:1}),summarize:async()=>new Promise(()=>{}),saveNote:async()=>{saves++;return{resultRef:'note:sha256:'+'a'.repeat(64)};}});
    let cancellation,watchdog;try{if(mode==='cancel')cancellation=setTimeout(()=>controller.abort(),5);const result=await Promise.race([pending,new Promise(resolve=>{watchdog=setTimeout(()=>resolve({observation:{status:'watchdog-expired'}}),200);})]);assert.equal(result.observation.status,mode==='timeout'?'summary-timeout':'cancelled');assert.equal(saves,0);assert.deepEqual(result.messages,f.messages);}finally{clearTimeout(cancellation);clearTimeout(watchdog);controller.abort();}
  }
});
