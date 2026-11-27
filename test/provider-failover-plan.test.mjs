import test from 'node:test';
import assert from 'node:assert/strict';
import { failoverRouteDescriptor, prepareModelFailoverPlan, bindSettledProviderFailure, selectNextProviderRoute } from '../src/provider-failover-plan.mjs';

const qualificationFor=route=>({routeId:route.routeId,evidenceSha256:'a'.repeat(64),scope:'owner-root-text-and-tools@1',recipientApproved:true,costBounded:true});
const routes={deepseek:{},muse:{},mimo:{},openai:{model:'example-openai'},gemini:{model:'example-gemini'}};
const mk=()=>prepareModelFailoverPlan({routes,trainingConsent:'go-muse-contributor-public-only@1'},{qualificationFor});
const identity={rootId:'r',modelOrdinal:1,inputHash:'a'.repeat(64)};
const reservation={...identity,runId:'r',modelOrdinal:2};
const scope={manualRoot:true,outputObserved:false,publicOnly:true};
const witness=(plan,reason='model-unavailable',state='completed')=>bindSettledProviderFailure({plan,routeId:plan.candidates[0].routeId,identity,
  ticket:{...identity,runId:'r',state},transport:{...identity,routeId:plan.candidates[0].routeId,outcome:'known-rejected-before-output',reason}});
const select=(plan,failure,overrides={})=>selectNextProviderRoute({plan,failure,reservation,scope,unavailableGroups:[],authorizedRoute:()=>true,...overrides});

test('catalog capabilities are pinned, independent of credentials and not sufficient to enable fallback',()=>{
  assert.equal(prepareModelFailoverPlan(undefined),null);
  assert.equal(failoverRouteDescriptor('muse').protocol,'responses');
  assert.equal(failoverRouteDescriptor('mimo').endpoint,'https://opencode.ai/inference/go/openai/v1/chat/completions');
  assert.equal(failoverRouteDescriptor('mimo').group,failoverRouteDescriptor('deepseek').group);
  assert.throws(()=>failoverRouteDescriptor('gemini',{model:'example-gemini',endpoint:'https://evil.invalid'}),{code:'MODEL_FAILOVER_CONFIG_INVALID'});
  assert.throws(()=>prepareModelFailoverPlan({routes},{qualificationFor}),{code:'MODEL_FAILOVER_CONFIG_INVALID'});
  assert.throws(()=>prepareModelFailoverPlan({routes:{deepseek:{},mimo:{}}},{qualificationFor:r=>({...qualificationFor(r),routeId:'another'})}),{code:'MODEL_FAILOVER_CONFIG_INVALID'});
  assert.deepEqual(mk().candidates.map(r=>r.id),['deepseek','muse','mimo','openai','gemini']);
});
test('training recipient remains excluded for any private request',()=>{
  const p=mk();
  assert.equal(select(p,witness(p)).id,'muse');
  assert.equal(select(p,witness(p),{scope:{...scope,publicOnly:false}}).id,'mimo');
  assert.equal(select(p,witness(p),{authorizedRoute:r=>r.id==='gemini'}).id,'gemini');
});
test('rate limits and provider-wide unavailability never fan out over the same Go allowance',()=>{
  const p=mk();
  assert.equal(select(p,witness(p,'rate-limited')).id,'openai');
  assert.equal(select(p,witness(p,'provider-unavailable'),{unavailableGroups:['openai-direct']}).id,'gemini');
  assert.equal(select(p,witness(p,'rate-limited'),{unavailableGroups:['openai-direct','gemini-direct']}),null);
});
test('unknown/aborted outcomes, forged errors and stale permits never switch or replay',()=>{
  const p=mk(), failure=witness(p);
  assert.equal(witness(p,'model-unavailable','unknown'),null);
  assert.equal(witness(p,'timeout'),null);
  assert.equal(select(p,{}),null);
  assert.equal(select(p,failure,{reservation:{...reservation,modelOrdinal:1}}),null);
  assert.equal(select(p,failure,{reservation:{...reservation,inputHash:'b'.repeat(64)}}),null);
  assert.equal(select(p,failure,{scope:{...scope,outputObserved:true}}),null);
  assert.equal(select(p,failure,{scope:{...scope,manualRoot:false}}),null);
  assert.equal(select(p,failure).id,'muse');
  assert.equal(select(p,failure),null);
});

test('route and root mismatches cannot turn stale owner receipts into a fallback',()=>{
  const p=mk(), routeId=p.candidates[0].routeId;
  const ticket={...identity,runId:'r',state:'completed'};
  const transport={...identity,routeId,outcome:'known-rejected-before-output',reason:'model-unavailable'};
  const i={plan:p,routeId,identity,ticket,transport};
  assert.equal(bindSettledProviderFailure({...i,transport:{...transport,modelOrdinal:2}}),null);
  assert.equal(bindSettledProviderFailure({...i,transport:{...transport,routeId:p.candidates[1].routeId}}),null);
  assert.equal(bindSettledProviderFailure({...i,ticket:{...ticket,localRelease:{schemaVersion:'admission-local-release@1'}}}),null);
  const failure=bindSettledProviderFailure(i);
  assert.ok(failure);
  assert.equal(bindSettledProviderFailure(i),null);
  assert.equal(select(p,failure).id,'muse');
});
