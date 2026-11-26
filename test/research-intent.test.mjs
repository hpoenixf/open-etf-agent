import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readResearchIntent,researchIntentTool,researchProfileFor,DEEP_EVIDENCE_REVISION,readDeepResearchProgress,deepResearchInstruction} from '../src/research-intent.mjs';
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

test('Deep sees only matched settled original source entries; old admitted profiles remain unchanged',()=>{
 const v2=researchProfileFor('deep',DEEP_EVIDENCE_REVISION);
 assert.equal(researchProfileFor('deep'),'deep-evidence@1');
 assert.equal(researchProfileFor('auto'),'auto-intent@1');
 assert.equal(researchProfileFor('standard',DEEP_EVIDENCE_REVISION),undefined);
 const hash='a'.repeat(64),url='https://example.org/evidence';
 const page={kind:'public-web-page@1',url,originalSha256:hash,manifestSha256:hash,textSha256:hash,text:'Original source excerpt',page:1,pages:1};
 const blocked={kind:'public-web-page-unavailable@1',requestOutcome:'no-unobserved-dispatch'};
 const unknown={...blocked,requestOutcome:'unknown'};
 const pair=(id,name,value)=>[response([{id,name,arguments:{}}]),{role:'tool',callId:id,result:{callId:id,status:'succeeded',dispatched:true,value}}];
 const pdf=(p)=>({documentId:'pdf:'+hash,page:p,sourceId:'pdf:'+hash+':p'+p,text:'Extracted original page',sha256:hash,pdf:{originalSha256:hash}});
 const messages=[user,...pair('web-a','public_web_read',page),...pair('web-b','public_web_read',page),
   ...pair('pdf-1','read_pdf_page',pdf(1)),...pair('pdf-2','read_pdf_page',pdf(2)),...pair('pdf-1-again','read_pdf_page',pdf(1)),
   ...pair('a-refusal','public_web_read',blocked),...pair('false-evidence','public_web_search',page),...pair('unknown-source','public_web_read',unknown),...pair('empty','public_web_read',{...page,text:' '}),
   ...pair('lookalike','public_web_read',{...page,textSha256:null}),...pair('no-local-text','read_pdf_page',{...pdf(3),text:''})];
 assert.equal(readDeepResearchProgress(researchProfileFor('deep'),{messages}),null);
 assert.equal(readDeepResearchProgress(researchProfileFor('auto',DEEP_EVIDENCE_REVISION),{messages}),null);
 assert.deepEqual(readDeepResearchProgress(v2,{messages}),{schemaVersion:DEEP_EVIDENCE_REVISION,phase:'originals-read',originalsRead:3,settledSourceChecks:6,unavailableSourceChecks:1});
 assert.match(deepResearchInstruction(readDeepResearchProgress(v2,{messages}),false),/acquired.+Other original-source checks settled/);
 assert.equal(readDeepResearchProgress(v2,{messages,phase:'terminal',status:'completed'}).phase,'delivery-unverified');
 assert.equal(readDeepResearchProgress(v2,{messages,phase:'terminal',status:'completed'},{deliveryReadback:true}).phase,'delivered');
 const mismatch=pair('bad','public_web_read',page);mismatch[1].result.callId='other';
 const native=readDeepResearchProgress(v2,{rounds:2,messages:[user,...mismatch,...pair('blocked','public_web_read',blocked)]});
 assert.equal(native.phase,'sources-checked');assert.equal(native.originalsRead,0);
 assert.match(deepResearchInstruction(native,true),/settled without readable content.+last remaining Main round/);
 assert.equal(readDeepResearchProgress(v2,{rounds:1,messages:[user,...pair('unknown','public_web_read',unknown)]}).phase,'collecting');
});

test('financial analysis system guidance changes only the new deep route',async()=>{
 const {createChatGateway}=await import('../src/gateway.mjs');
 const {ANALYSIS_RESEARCH_REVISION,RESEARCH_NEEDS_REVISION}=await import('../src/research-intent.mjs');
 async function capture(profile,messages) {
  let wire;
  const gateway=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'stub',apiKey:'synthetic',
   authorization:{providerApproved:true,dataApproved:true,costApproved:true},researchProfile:profile,
   fetchImpl:async(_url,init)=>{wire=JSON.parse(init.body);return Response.json({choices:[{message:{role:'assistant',content:'stub'},finish_reason:'stop'}]});}});
  await gateway.next({messages,tools:[]});
  return wire.messages.filter(m=>m.role==='system').map(m=>m.content);
 }
 const old=await capture(researchProfileFor('deep',RESEARCH_NEEDS_REVISION),[user]);
 assert.match(old[0],/deep-evidence@3/);
 assert.doesNotMatch(old[0],/counter-scenario/);
 const auto=researchProfileFor('auto',ANALYSIS_RESEARCH_REVISION);
 const deep=await capture(auto,[user,response([call]),receipt()]);
 assert.match(deep[0],/deep-evidence@4.*counter-scenario/);
 assert.doesNotMatch(deep[0],/Daily Watch|News window/);
 assert.deepEqual(await capture(auto,[user]),[]);
 assert.deepEqual(await capture(researchProfileFor('standard'),[user]),[]);
});
