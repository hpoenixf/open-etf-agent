import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readResearchIntent,researchIntentTool} from '../src/research-intent.mjs';
const user={role:'user',content:'Not a control signal'};
const call={id:'intent',name:'select_research_intent',arguments:{intent:'deep'}};
const response=(calls)=>({role:'assistant',calls});
const receipt=(status='succeeded',value={kind:'auto-intent@1',intent:'deep'})=>({role:'tool',callId:'intent',result:{callId:'intent',status,value}});

test('only one first-call Host receipt promotes; multiple, late, mismatched and non-settled do not',async()=>{
 const messages=[user,response([call]),receipt()];
 assert.equal(readResearchIntent(messages),'deep');
 for(const m of [[user,{role:'assistant',content:'deep'}], [user,response([call,{...call,id:'other'}]),receipt()],
  [user,response([{...call,id:'other',name:'public_web_read'}]),response([call]),receipt()],
  [user,response([call]),receipt('unknown')], [user,response([call]),receipt('succeeded',{kind:'auto-intent@1',intent:'research'})],
  [...messages,receipt()]])assert.equal(readResearchIntent(m),'direct');
 let snapshot={messages};
 const tool=researchIntentTool(()=>snapshot);
 assert.deepEqual(await tool.reconcile({intent:'deep'},{callId:'intent'}),receipt().result.value);
 await tool.verifyResult(receipt().result.value,{call});
 await assert.rejects(tool.verifyResult({kind:'auto-intent@1',intent:'research'},{call}),{code:'RESEARCH_INTENT_RECEIPT_CHANGED'});
 snapshot={messages:[user,response([{...call,id:'other',name:'public_web_read'}]),response([call])]};
 assert.deepEqual(await tool.execute({intent:'deep'},{callId:'intent'}),{kind:'research-intent-unapplied@1'});
 assert.deepEqual(await tool.execute({intent:'bogus'},{callId:'intent'}),{kind:'research-intent-unapplied@1'});
});
