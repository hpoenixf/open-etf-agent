import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceUsage,evidenceMilestone,evidenceAdvisory,omitsToolDebit} from '../src/research-control-policy.mjs';

const proposal=(...names)=>names.map((name,i)=>({id:name+i,name}));
const result=c=>({role:'tool',callId:c.id,result:{callId:c.id,dispatched:true}});
test('mixed group counts one acquisition round and ignores local/output proposals',()=>{
 const calls=proposal('public_web_read','read_pdf_cell','render_financial_chart','compute_chart_formula');
 assert.deepEqual(evidenceUsage([{role:'assistant',calls},...calls.map(result)]),{rounds:1,calls:2});
 assert.equal(omitsToolDebit(true,'render_financial_chart'),true);
 assert.equal(omitsToolDebit(true,'compute_chart_formula'),true);
 assert.equal(omitsToolDebit(true,'render_financial_chart','public_web_read'),false);
 assert.equal(omitsToolDebit(true,'unregistered_tool'),false);
});
test('highest crossed acquisition watermark is selected without implying completion',()=>{
 const calls=proposal(...Array(8).fill('public_web_read'));
 const messages=[{role:'assistant',calls},...calls.map(result)];
 assert.equal(evidenceMilestone(messages,{maxRounds:10,maxTools:10}),80);
 assert.match(evidenceAdvisory(80),/not task progress/);
 assert.equal(evidenceAdvisory(0),null);
});

import {researchIntentTool,readResearchIntent} from '../src/research-intent.mjs';
test('mid-run Deep needs a verified original and physical room, and its receipt remains stable',async()=>{
 const time=Date.now();
 const args={intent:'deep'},name='select_research_intent',call={id:'upgrade',name,arguments:args};
 const messages=[{role:'user',content:'Verify the report'},{role:'assistant',calls:[{id:'read',name:'public_web_read'}]},
  {role:'tool',callId:'read',result:{status:'succeeded',dispatched:true,callId:'read',value:{
   kind:'public-web-page@2',url:'https://example.com/report',originalSha256:'a'.repeat(64),manifestSha256:'b'.repeat(64),
   textSha256:'c'.repeat(64),page:1,pages:1,text:'Original report',
  }}},{role:'assistant',calls:[call]}];
 const run={rootUsage:{model:8},snapshot:{messages},definition:{rootLimits:{model:10,tool:20},deadlineAt:time+90000,limits:{timeoutMs:100000}}};
 const tool=researchIntentTool(()=>run.snapshot,{readRun:()=>run});
 assert.equal((await tool.execute(args,{callId:call.id})).kind,'research-intent-unapplied@1');
 run.rootUsage.model=3;
 const adopted=await tool.execute(args,{callId:call.id});
 assert.equal(adopted.kind,'auto-midrun-intent@1');
 messages.push({role:'tool',callId:call.id,result:{callId:call.id,status:'succeeded',dispatched:true,value:adopted}});
 run.rootUsage.model=8;
 await tool.verifyResult(adopted,{call});
 assert.equal(readResearchIntent(messages),'deep');
 assert.equal(await tool.reconcile(args,{callId:call.id}),null);
});
