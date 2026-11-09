import {SOURCE_CHECK_METHOD,SOURCE_CHECK_LIMITS,sourceCheckQuestion,runSourceCheckingChild,normalizeChildMethod,childMethodQuestion,runMethodChild} from './child.mjs';
import {readChildSources} from './child-results.mjs';
import {validateRuntimeCheckpoint} from './runtime.mjs';
import {createToolHost} from './tools.mjs';
import {sha256,normalizeDocumentCatalog,documentCatalogBinding} from './source.mjs';
import {PUBLICATION_BINDING} from './publication.mjs';
const TASK='source-check-v1';
const groupOwners=new WeakMap();
export function specialistGroupRefusal(binding,calls,historical=false){return groupOwners.get(binding)?.(calls,historical)??null;}
const groupHistoryOwners=new WeakMap();
export function specialistHistoricalGroup(binding,callId){return groupHistoryOwners.get(binding)?.(callId)??null;}
const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
// Publication belongs to Main. Child inherits the same gateway and every other
// binding, but never this exact parent-only capability. Unknown bindings stay bound.
function childBindings(bindings){return {...bindings,adapters:bindings.adapters.filter(item=>canonical(item)!==canonical(PUBLICATION_BINDING))};}
function scope(question,documents,documentCatalog,method){
 const catalog=documentCatalog===undefined?undefined:normalizeDocumentCatalog(documentCatalog),allowed=catalog?.documents.map(d=>d.id)??['atlas-a','atlas-b'];
 if(typeof question!=='string'||!question.trim()||Buffer.byteLength(question)>16000||!Array.isArray(documents)||!documents.length||documents.length>2||new Set(documents).size!==documents.length||documents.some(d=>!allowed.includes(d)))fail('INVALID_SPECIALIST_SCOPE');
 const normalized=method===undefined?undefined:normalizeChildMethod(method);
 if(normalized&&documents.length>normalized.input.maxDocuments)fail('INVALID_CHILD_METHOD_INPUT');
 return {question,documents:[...documents],...(catalog?{documentCatalog:catalog}:{}),...(normalized?{method:normalized}:{})};
}
function args(value,method){if(!value||Array.isArray(value)||Object.keys(value).join(',')!=='question'||typeof value.question!=='string'||!value.question.trim()||Buffer.byteLength(value.question)>(method?.input.maxQuestionBytes??2000))fail('INVALID_SPECIALIST_QUESTION');}
function profile(selected){return selected.method?{task:'method-'+sha256(canonical(selected.method)).slice(0,48),limits:selected.method.limits,tools:selected.method.allowedTools,prompt:input=>childMethodQuestion({...input,method:selected.method})}:{task:TASK,limits:SOURCE_CHECK_LIMITS,tools:['read_page'],prompt:sourceCheckQuestion};}
export function sourceCheckBinding({question,documents,documentCatalog,method}){const selected=scope(question,documents,documentCatalog,method);if(selected.method)return Object.freeze({id:'serial-child-method',version:'1',contentSha256:sha256(canonical(selected))});return Object.freeze({id:'serial-source-check',version:documentCatalog?'2':'1',contentSha256:sha256(canonical({method:SOURCE_CHECK_METHOD,...selected}))});}
function authority(parent,selected){
 validateRuntimeCheckpoint(parent.snapshot,parent.definition);
 const expected=sourceCheckBinding(selected);
 if(canonical(parent.definition.config.documentCatalog??null)!==canonical(selected.documentCatalog?documentCatalogBinding(selected.documentCatalog):null))fail('SPECIALIST_BINDING_MISMATCH');
 if(parent.parentRunId!==null||parent.rootId!==parent.runId||parent.definition.question!==selected.question||parent.definition.bindings.plugins.length||!parent.definition.bindings.adapters.some(a=>canonical(a)===canonical(expected)))fail('SPECIALIST_BINDING_MISMATCH');
 return expected;
}
function originalCall(parent,callId,method){
 const calls=parent.snapshot.messages.flatMap(m=>m.calls||[]).filter(c=>c.id===callId);
 if(calls.length!==1||calls[0].name!=='source_check')fail('SPECIALIST_CALL_IDENTITY');args(calls[0].arguments,method);return calls[0];
}
export async function readSpecialistHandoff({store,parentRunId,question,documents,callId,documentCatalog,method}){
 const selected=scope(question,documents,documentCatalog,method),parent=store.inspect(parentRunId);authority(parent,selected);
 const selectedProfile=profile(selected);
 const child=store.findChild(parentRunId,selectedProfile.task);if(!child)fail('SPECIALIST_NOT_FOUND');
 const binding=sourceCheckBinding(selected);
 if(child.parentRunId!==parent.runId||child.rootId!==parent.rootId||child.definition.config.taskId!==selectedProfile.task||child.definition.grantId!==parent.definition.grantId||canonical(child.definition.bindings)!==canonical(childBindings(parent.definition.bindings))||child.definition.deadlineAt>parent.definition.deadlineAt||canonical(child.definition.config)!==canonical({requireReport:false,...(selected.documentCatalog?{documentCatalog:documentCatalogBinding(selected.documentCatalog)}:{}),allowedTools:selectedProfile.tools,allowedDocuments:selected.documents,taskId:selectedProfile.task})||canonical(child.definition.limits)!==canonical(selectedProfile.limits))fail('SPECIALIST_IDENTITY_MISMATCH');
 // The original question canonically binds the delegation call, not whichever call asks now.
 const candidates=parent.snapshot.messages.flatMap(m=>m.calls||[]).filter(c=>c.name==='source_check').filter(c=>{
  try{args(c.arguments,selected.method);return child.definition.question===selectedProfile.prompt({...selected,localQuestion:c.arguments.question,callId:c.id});}catch{return false;}
 });
 if(candidates.length!==1||(callId!==undefined&&candidates[0].id!==callId))fail('SPECIALIST_CALL_IDENTITY');
 const original=candidates[0];originalCall(parent,original.id,selected.method);
 if(child.status==='active'||child.snapshot.phase!=='terminal')fail('SPECIALIST_UNSETTLED');
 validateRuntimeCheckpoint(child.snapshot,child.definition);
 const out=child.snapshot.outcome;
 if(!out||out.runId!==child.runId||out.rootId!==child.rootId||out.directory!==child.directory||out.taskId!==selectedProfile.task||out.status!==child.status||out.code!==child.snapshot.code||!Array.isArray(out.unknownEffects)||!Array.isArray(out.partialEffects)||!['completed','failed'].includes(out.status))fail('SPECIALIST_OUTCOME_UNAVAILABLE');
 // Legacy checkpoints have no explicit Gateway outcome. Preserve their original
 // conservative read contract; do not backfill a new settlement fact from error text.
 const unknownGateway=child.snapshot.gatewayOutcome===undefined
  ? Boolean(child.snapshot.working&&!['ROOT_BUDGET_EXHAUSTED'].includes(out.code))
  : child.snapshot.gatewayOutcome!=='settled';
 if(out.unknownEffects.length||['MODEL_OUTCOME_UNKNOWN','TOOL_OUTCOME_UNKNOWN'].includes(out.code)||(out.status!=='completed'&&unknownGateway))fail('SPECIALIST_EFFECT_UNKNOWN');
 if(out.status==='completed'&&out.code!==null)fail('SPECIALIST_OUTCOME_MISMATCH');
 if(typeof out.answer!=='string')fail('SPECIALIST_OUTCOME_MISMATCH');
 const host=await createToolHost({directory:child.directory,documentCatalog:selected.documentCatalog,allowedTools:selectedProfile.tools,allowedDocuments:selected.documents,restore:child.snapshot.host,readOnly:true});
 const owned=await host.getResultRefs();if(canonical(owned)!==canonical(out.resultRefs))fail('SPECIALIST_SOURCE_IDENTITY');
 const originals=await readChildSources({directory:child.directory,refs:owned.map(x=>x.resultRef),allowedDocuments:selected.documents,readOnly:true});
 const sources=originals.map((s,i)=>({...s,resultRef:owned[i].resultRef}));
 return {sources,child:{schemaVersion:'specialist-handoff@1',parentRunId:parent.runId,rootId:child.rootId,runId:child.runId,taskId:selectedProfile.task,callId:original.id,method:binding,...(selected.method?{methodDescriptor:selected.method}:{}),status:out.status,code:out.code,derived:true,summary:out.answer,limitations:out.status==='completed'?['derived and semantically unreviewed']:['child failed; only independently validated original sources may be used'],partialEffects:structuredClone(out.partialEffects),mode:child.definition.bindings.gateway.mode,semanticStatus:'unreviewed'}};
}
export function createSpecialistChildBinding({store,parentClaim,parentRunId,outputRoot,gatewayFactory,question,documents,documentCatalog,method}){
 const selected=scope(question,documents,documentCatalog,method),selectedProfile=profile(selected);if(typeof parentClaim!=='function'||typeof gatewayFactory!=='function')fail('INVALID_SPECIALIST_ADAPTER');
 function parent(){const token=parentClaim();const id=token?.runId??parentRunId;if(!id)fail('SPECIALIST_PARENT_REQUIRED');const saved=store.inspect(id);authority(saved,selected);return {token,saved};}
 function currentCall(value,callId){const {token,saved}=parent();const p=saved.snapshot.proposal;if(!p||p.kind!=='calls'||p.calls.length!==1||saved.snapshot.cursor!==0||p.calls[0].name!=='source_check'||(callId!==undefined&&p.calls[0].id!==callId)||canonical(p.calls[0].arguments)!==canonical(value))fail('SPECIALIST_SINGLE_CALL_REQUIRED');return {token,saved,call:p.calls[0]};}
 const binding={
  name:'source_check',description:(selected.method?`One serial ${selected.method.id} Child (${selected.method.version}). Derived advice with original sources; no publication authority.`:'One serial source-checking Child. Derived advice with original sources; no publication authority.')+' Call source_check as the only tool call in this assistant response. Do not batch it with read_page or any other tool; make other calls in separate responses before or after the Child finishes.',parameters:{type:'object',properties:{question:{type:'string',minLength:1,maxLength:selected.method?.input.maxQuestionBytes??2000}},required:['question'],additionalProperties:false},sourceResults:true,recoveryVersion:'specialist-handoff@1',
  validate(value){args(value,selected.method);const {saved}=currentCall(value);if(store.findChild(saved.runId,selectedProfile.task))fail('SPECIALIST_ALREADY_DELEGATED');},
  async execute(value,{callId,signal}){
   args(value,selected.method);const {token,saved}=currentCall(value,callId);signal?.throwIfAborted();
   if(!token||token.owner!==saved.owner||token.fence!==saved.fence)fail('STALE_SPECIALIST_PARENT');
   if(store.findChild(saved.runId,selectedProfile.task))fail('SPECIALIST_ALREADY_DELEGATED');
   const gateway=gatewayFactory();if(gateway?.mode!==saved.definition.bindings.gateway.mode||typeof gateway?.next!=='function')fail('SPECIALIST_GATEWAY_BINDING');
   await (selected.method?runMethodChild:runSourceCheckingChild)({...selected,taskId:selectedProfile.task,localQuestion:value.question,callId,gateway,outputRoot,signal,durable:{store,parentRunId:saved.runId,parentClaim:token,rootId:saved.rootId,grantId:saved.definition.grantId,bindings:childBindings(saved.definition.bindings),rootLimits:saved.definition.rootLimits,deadlineAt:Math.min(saved.definition.deadlineAt,Date.now()+selectedProfile.limits.timeoutMs)}});
   return readSpecialistHandoff({store,parentRunId:saved.runId,...selected,callId});
  },
  async reconcile(value,{callId}){args(value,selected.method);const {saved}=currentCall(value,callId);const child=store.findChild(saved.runId,selectedProfile.task);if(!child||child.status==='active')return null;return readSpecialistHandoff({store,parentRunId:saved.runId,...selected,callId});},
  async verifyResult(value){const {saved}=parent();const expected=await readSpecialistHandoff({store,parentRunId:saved.runId,...selected,callId:value?.child?.callId});if(canonical(value.child)!==canonical(expected.child)||canonical(value.sources)!==canonical(expected.sources))fail('SPECIALIST_HANDOFF_CHANGED');}
 };
 groupHistoryOwners.set(binding,callId=>{const {saved}=parent();const groups=saved.snapshot.messages.filter(m=>m.role==='assistant'&&m.calls?.some(c=>c.id===callId));return groups.length===1?groups[0].calls:null;});
 groupOwners.set(binding,(calls,historical)=>{
  if(!Array.isArray(calls)||calls.length<2||calls.filter(c=>c.name===binding.name).length!==1)return null;
  const child=calls.find(c=>c.name===binding.name); // Group shape is refused without executing argument validators.
  const {token,saved}=parent();
  if(!historical){if(!token||token.owner!==saved.owner||token.fence!==saved.fence||saved.snapshot.phase!=='proposal-sealed'||saved.snapshot.cursor!==0||canonical(saved.snapshot.proposal?.calls)!==canonical(calls))fail('STALE_SPECIALIST_PARENT');if(store.findChild(saved.runId,selectedProfile.task))fail('SPECIALIST_ALREADY_DELEGATED');}
  return {schemaVersion:'specialist-group-refusal@1',runId:saved.runId,ownerBinding:sourceCheckBinding(selected),groupHash:sha256(canonical(calls)),callIds:calls.map(c=>c.id),ownerCallId:child.id};
 });
 return binding;
}
