// Server-only route policy; this module never reads credentials, sends a
// request, or mints an Admission reservation. The Host must bind the plan and
// prove each attempt with the original admission and protocol owners.
import { createHash } from 'node:crypto';
import { OPENCODE_GO_CURRENT_ENDPOINT, OPENCODE_GO_OWNER_PROVIDER } from './gateway.mjs';

const goGroup='opencode-go-shared-allowance';
const goResponses='https://opencode.ai/inference/go/openai/v1/responses';
const profiles = Object.freeze({
  deepseek: Object.freeze({provider:OPENCODE_GO_OWNER_PROVIDER, model:'deepseek-v4.1-flash', protocol:'chat-completions', endpoint:OPENCODE_GO_CURRENT_ENDPOINT, credentialRef:'ETF_GUI_PROVIDER_KEY', group:goGroup}),
  muse: Object.freeze({provider:OPENCODE_GO_OWNER_PROVIDER, model:'muse-spark-1.3-contributor', protocol:'responses', endpoint:goResponses, credentialRef:'ETF_GUI_PROVIDER_KEY', group:goGroup, trainsOnRequestData:true}),
  mimo: Object.freeze({provider:OPENCODE_GO_OWNER_PROVIDER, model:'mimo-v2.6-flash', protocol:'chat-completions', endpoint:OPENCODE_GO_CURRENT_ENDPOINT, credentialRef:'ETF_GUI_PROVIDER_KEY', group:goGroup}),
  openai: Object.freeze({provider:'openai-direct', protocol:'responses', endpoint:'https://api.openai.com/v1/responses', credentialRef:'ETF_OPENAI_API_KEY', group:'openai-direct'}),
  gemini: Object.freeze({provider:'gemini-direct', protocol:'chat-completions', endpoint:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', credentialRef:'ETF_GEMINI_API_KEY', group:'gemini-direct'})
});
const order=Object.freeze(['deepseek','muse','mimo','openai','gemini']);
const has=(o,k)=>!!o&&Object.hasOwn(o,k);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,required,optional=[])=>object(v)&&required.every(k=>has(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const modelId=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(v);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const attempts=new WeakMap();
const plans=new WeakSet();
const boundTickets=new WeakSet();

function invalid(){throw Object.assign(new Error('MODEL_FAILOVER_CONFIG_INVALID'),{code:'MODEL_FAILOVER_CONFIG_INVALID'});}

/** Route facts are independent of secrets. The same Go subscription is one
 * capacity group even when the model or wire protocol changes. OpenAI/Gemini
 * model IDs, credential references and selected recipients are not aliases. */
export function failoverRouteDescriptor(id, config={}){
  if(!has(profiles,id)||!exact(config,[],['model']))invalid();
  const template=profiles[id];
  if(template.model&&has(config,'model')||!template.model&&!modelId(config.model))invalid();
  const route=Object.freeze({id,...template,model:template.model??config.model});
  return Object.freeze({...route,routeId:'model-route-'+hash(route)});
}

/** Resolve only exact, independently qualified routes. No CLI/GUI can turn a
 * catalog entry into qualification. No automatic training-recipient opt-in. */
export function prepareModelFailoverPlan(config,{qualificationFor}={}){
  if(config===undefined||config===null)return null;
  if(!exact(config,['routes'],['trainingConsent'])||!object(config.routes)||
     Object.keys(config.routes).some(id=>!order.includes(id))||
     !has(config.routes,'deepseek')||typeof qualificationFor!=='function')invalid();
  if(has(config,'trainingConsent')&&config.trainingConsent!=='go-muse-contributor-public-only@1')invalid();
  if(has(config.routes,'muse')&&config.trainingConsent!=='go-muse-contributor-public-only@1')invalid();
  const candidates=[];
  for(const id of order){
    if(!has(config.routes,id))continue;
    const route=failoverRouteDescriptor(id,config.routes[id]);
    const proof=qualificationFor(route);
    if(!exact(proof,['routeId','evidenceSha256','scope','recipientApproved','costBounded'])||
       proof.routeId!==route.routeId||!hex(proof.evidenceSha256)||proof.scope!=='owner-root-text-and-tools@1'||
       proof.recipientApproved!==true||proof.costBounded!==true)invalid();
    candidates.push(Object.freeze({...route,qualificationSha256:proof.evidenceSha256}));
  }
  if(candidates.length<2)invalid();
  const plan=Object.freeze({schemaVersion:'owner-model-failover@1',candidates:Object.freeze(candidates),
    ...(config.trainingConsent?{trainingConsent:config.trainingConsent}:{}),planSha256:hash({candidates,trainingConsent:config.trainingConsent??null})});
  plans.add(plan);
  return plan;
}

/** The Host supplies the durable ticket readback. A provider error string is
 * not evidence: only the owner transport can confirm a complete, known
 * no-output model refusal (not a timeout or unfinished gateway response).
 * This API deliberately has no dispatch/retry operation. */
export function bindSettledProviderFailure({plan,routeId,identity,ticket,transport}={}){
  if(!plans.has(plan)||!plan.candidates.some(r=>r.routeId===routeId)||
     !exact(identity,['rootId','modelOrdinal','inputHash'])||typeof identity.rootId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(identity.rootId)||
     !Number.isSafeInteger(identity.modelOrdinal)||identity.modelOrdinal<1||!hex(identity.inputHash)||
     !object(ticket)||boundTickets.has(ticket)||ticket.state!=='completed'||ticket.rootId!==identity.rootId||ticket.runId!==identity.rootId||
     ticket.modelOrdinal!==identity.modelOrdinal||ticket.inputHash!==identity.inputHash||ticket.localRelease||
     !transport||transport.routeId!==routeId||transport.rootId!==identity.rootId||transport.modelOrdinal!==identity.modelOrdinal||
     transport.inputHash!==identity.inputHash||transport.outcome!=='known-rejected-before-output'||
     (transport.reason!=='model-unavailable'&&transport.reason!=='provider-unavailable'&&transport.reason!=='rate-limited'))return null;
  const failure=Object.freeze({});
  boundTickets.add(ticket);
  attempts.set(failure,Object.freeze({plan,routeId,identity:Object.freeze({...identity}),reason:transport.reason}));
  return failure;
}

/** Choose the next eligible route after the Host has reserved a fresh
 * budgeted logical attempt. Reject default or user-supplied provenance, and
 * preserve exclusion of summaries/children/scheduled or already-output turns. */
export function selectNextProviderRoute({plan,failure,reservation,scope,unavailableGroups,authorizedRoute}={}){
  const fact=attempts.get(failure);
  if(!fact||fact.plan!==plan||!reservation||reservation.rootId!==fact.identity.rootId||
     reservation.runId!==fact.identity.rootId||reservation.modelOrdinal!==fact.identity.modelOrdinal+1||
     reservation.inputHash!==fact.identity.inputHash||reservation.purpose!==undefined||
     !exact(scope,['manualRoot','outputObserved','publicOnly'])||scope.manualRoot!==true||scope.outputObserved!==false||
     typeof scope.publicOnly!=='boolean'||!Array.isArray(unavailableGroups)||typeof authorizedRoute!=='function')return null;
  const i=plan.candidates.findIndex(c=>c.routeId===fact.routeId);
  const prior=plan.candidates[i];
  const skip=new Set(unavailableGroups);
  if(fact.reason!=='model-unavailable')skip.add(prior.group);
  attempts.delete(failure);
  for(const route of plan.candidates.slice(i+1)){
    if(skip.has(route.group)||route.trainsOnRequestData&&(!scope.publicOnly||plan.trainingConsent!=='go-muse-contributor-public-only@1'))continue;
    if(authorizedRoute(route)===true)return route;
  }
  return null;
}
