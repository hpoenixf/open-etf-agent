import {SOURCE_CHECK_METHOD,sourceCheckQuestion,runSourceCheckingChild} from './child.mjs';
import {readChildSources} from './child-results.mjs';
import {validateRuntimeCheckpoint} from './runtime.mjs';
import {createToolHost} from './tools.mjs';
import {sha256} from './source.mjs';
const TASK='source-check-v1';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function scope(question,documents){
 if(typeof question!=='string'||!question.trim()||Buffer.byteLength(question)>16000||!Array.isArray(documents)||!documents.length||documents.length>2||new Set(documents).size!==documents.length||documents.some(d=>!['atlas-a','atlas-b'].includes(d)))fail('INVALID_SPECIALIST_SCOPE');
 return {question,documents:[...documents]};
}
function args(value){if(!value||Array.isArray(value)||Object.keys(value).join(',')!=='question'||typeof value.question!=='string'||!value.question.trim()||Buffer.byteLength(value.question)>2000)fail('INVALID_SPECIALIST_QUESTION');}
export function sourceCheckBinding({question,documents}){const selected=scope(question,documents);return Object.freeze({id:'serial-source-check',version:'1',contentSha256:sha256(canonical({method:SOURCE_CHECK_METHOD,...selected}))});}
function authority(parent,selected){
 validateRuntimeCheckpoint(parent.snapshot,parent.definition);
 const expected=sourceCheckBinding(selected);
 if(parent.parentRunId!==null||parent.rootId!==parent.runId||parent.definition.question!==selected.question||parent.definition.bindings.plugins.length||!parent.definition.bindings.adapters.some(a=>canonical(a)===canonical(expected)))fail('SPECIALIST_BINDING_MISMATCH');
 return expected;
}
function originalCall(parent,callId){
 const calls=parent.snapshot.messages.flatMap(m=>m.calls||[]).filter(c=>c.id===callId);
 if(calls.length!==1||calls[0].name!=='source_check')fail('SPECIALIST_CALL_IDENTITY');args(calls[0].arguments);return calls[0];
}
export async function readSpecialistHandoff({store,parentRunId,question,documents,callId}){
 const selected=scope(question,documents),parent=store.inspect(parentRunId);authority(parent,selected);
 const child=store.findChild(parentRunId,TASK);if(!child)fail('SPECIALIST_NOT_FOUND');
 const binding=sourceCheckBinding(selected);
 if(child.parentRunId!==parent.runId||child.rootId!==parent.rootId||child.definition.config.taskId!==TASK||child.definition.grantId!==parent.definition.grantId||canonical(child.definition.bindings)!==canonical(parent.definition.bindings)||child.definition.deadlineAt>parent.definition.deadlineAt||canonical(child.definition.config)!==canonical({requireReport:false,allowedTools:['read_page'],allowedDocuments:selected.documents,taskId:TASK})||canonical(child.definition.limits)!==canonical({maxRounds:4,maxTools:2,timeoutMs:30000}))fail('SPECIALIST_IDENTITY_MISMATCH');
 // The original question canonically binds the delegation call, not whichever call asks now.
 const candidates=parent.snapshot.messages.flatMap(m=>m.calls||[]).filter(c=>c.name==='source_check').filter(c=>{
  try{args(c.arguments);return child.definition.question===sourceCheckQuestion({...selected,localQuestion:c.arguments.question,callId:c.id});}catch{return false;}
 });
 if(candidates.length!==1||(callId!==undefined&&candidates[0].id!==callId))fail('SPECIALIST_CALL_IDENTITY');
 const original=candidates[0];originalCall(parent,original.id);
 if(child.status==='active'||child.snapshot.phase!=='terminal')fail('SPECIALIST_UNSETTLED');
 validateRuntimeCheckpoint(child.snapshot,child.definition);
 const out=child.snapshot.outcome;
 if(!out||out.runId!==child.runId||out.rootId!==child.rootId||out.directory!==child.directory||out.taskId!==TASK||out.status!==child.status||out.code!==child.snapshot.code||!Array.isArray(out.unknownEffects)||!Array.isArray(out.partialEffects)||!['completed','failed'].includes(out.status))fail('SPECIALIST_OUTCOME_UNAVAILABLE');
 if(out.unknownEffects.length||['MODEL_OUTCOME_UNKNOWN','TOOL_OUTCOME_UNKNOWN'].includes(out.code)||(out.status!=='completed'&&child.snapshot.working&&!['ROOT_BUDGET_EXHAUSTED'].includes(out.code)))fail('SPECIALIST_EFFECT_UNKNOWN');
 if(out.status==='completed'&&out.code!==null)fail('SPECIALIST_OUTCOME_MISMATCH');
 const host=await createToolHost({directory:child.directory,allowedTools:['read_page'],allowedDocuments:selected.documents,restore:child.snapshot.host,readOnly:true});
 const owned=await host.getResultRefs();if(canonical(owned)!==canonical(out.resultRefs))fail('SPECIALIST_SOURCE_IDENTITY');
 const originals=await readChildSources({directory:child.directory,refs:owned.map(x=>x.resultRef),allowedDocuments:selected.documents,readOnly:true});
 const sources=originals.map((s,i)=>({...s,resultRef:owned[i].resultRef}));
 return {sources,child:{schemaVersion:'specialist-handoff@1',parentRunId:parent.runId,rootId:child.rootId,runId:child.runId,taskId:TASK,callId:original.id,method:binding,status:out.status,code:out.code,derived:true,summary:out.answer,limitations:out.status==='completed'?['derived and semantically unreviewed']:['child failed; only independently validated original sources may be used'],partialEffects:structuredClone(out.partialEffects),mode:child.definition.bindings.gateway.mode,semanticStatus:'unreviewed'}};
}
export function createSpecialistChildBinding({store,parentClaim,parentRunId,outputRoot,gatewayFactory,question,documents}){
 const selected=scope(question,documents);if(typeof parentClaim!=='function'||typeof gatewayFactory!=='function')fail('INVALID_SPECIALIST_ADAPTER');
 function parent(){const token=parentClaim();const id=token?.runId??parentRunId;if(!id)fail('SPECIALIST_PARENT_REQUIRED');const saved=store.inspect(id);authority(saved,selected);return {token,saved};}
 function currentCall(value,callId){const {token,saved}=parent();const p=saved.snapshot.proposal;if(!p||p.kind!=='calls'||p.calls.length!==1||saved.snapshot.cursor!==0||p.calls[0].name!=='source_check'||(callId!==undefined&&p.calls[0].id!==callId)||canonical(p.calls[0].arguments)!==canonical(value))fail('SPECIALIST_SINGLE_CALL_REQUIRED');return {token,saved,call:p.calls[0]};}
 return {
  name:'source_check',description:'One serial source-checking Child. Derived advice with original sources; no publication authority.',parameters:{type:'object',properties:{question:{type:'string',minLength:1,maxLength:2000}},required:['question'],additionalProperties:false},sourceResults:true,recoveryVersion:'specialist-handoff@1',
  validate(value){args(value);const {saved}=currentCall(value);if(store.findChild(saved.runId,TASK))fail('SPECIALIST_ALREADY_DELEGATED');},
  async execute(value,{callId,signal}){
   args(value);const {token,saved}=currentCall(value,callId);signal?.throwIfAborted();
   if(!token||token.owner!==saved.owner||token.fence!==saved.fence)fail('STALE_SPECIALIST_PARENT');
   if(store.findChild(saved.runId,TASK))fail('SPECIALIST_ALREADY_DELEGATED');
   const gateway=gatewayFactory();if(gateway?.mode!==saved.definition.bindings.gateway.mode||typeof gateway?.next!=='function')fail('SPECIALIST_GATEWAY_BINDING');
   await runSourceCheckingChild({...selected,localQuestion:value.question,callId,gateway,outputRoot,signal,durable:{store,parentRunId:saved.runId,parentClaim:token,rootId:saved.rootId,grantId:saved.definition.grantId,bindings:saved.definition.bindings,rootLimits:saved.definition.rootLimits,deadlineAt:Math.min(saved.definition.deadlineAt,Date.now()+30000)}});
   return readSpecialistHandoff({store,parentRunId:saved.runId,...selected,callId});
  },
  async reconcile(value,{callId}){args(value);const {saved}=currentCall(value,callId);const child=store.findChild(saved.runId,TASK);if(!child||child.status==='active')return null;return readSpecialistHandoff({store,parentRunId:saved.runId,...selected,callId});},
  async verifyResult(value){const {saved}=parent();const expected=await readSpecialistHandoff({store,parentRunId:saved.runId,...selected,callId:value?.child?.callId});if(canonical(value.child)!==canonical(expected.child)||canonical(value.sources)!==canonical(expected.sources))fail('SPECIALIST_HANDOFF_CHANGED');}
 };
}
