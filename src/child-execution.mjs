import {setTimeout as waitForLease} from 'node:timers/promises';
import {isDeepStrictEqual} from 'node:util';
import {normalizeChildMethod,childMethodQuestion,runMethodChild} from './child.mjs';
import {validateRuntimeCheckpoint} from './runtime.mjs';
import {createToolHost} from './tools.mjs';
import {readChildSources} from './child-results.mjs';
import {sha256,normalizeDocumentCatalog,documentCatalogBinding} from './source.mjs';
import {PUBLICATION_BINDING} from './publication.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>JSON.stringify(v,(_,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const taskId=callId=>'execution-'+sha256(callId).slice(0,48);
// Only this original factory can mint its group owner proof. Extensions may read, not register.
const groupOwners=new WeakMap(),groupHistoryOwners=new WeakMap(),inputOwners=new WeakMap(),asyncOwners=new WeakMap();
export async function settleAsyncChildExecutions(bindings,options){const owners=new Set(bindings.map(b=>asyncOwners.get(b)).filter(Boolean));let effectsStopped=true;for(const owner of owners){const result=await owner(options);if(result?.effectsStopped===false)effectsStopped=false;}return{effectsStopped};}
// Read-only lookup of this factory's original validator, never a registration API.
export function childExecutionInputRefusal(binding,call,context){return inputOwners.get(binding)?.(call,context)??null;}
export function childExecutionGroupRefusal(binding,calls,historical=false){return groupOwners.get(binding)?.(calls,historical)??null;}
export function childExecutionHistoricalGroup(binding,callId){return groupHistoryOwners.get(binding)?.(callId)??null;}
export function normalizeChildExecution(input){
 if(!exact(input,input?.schemaVersion==='child-execution@2'?['schemaVersion','maxChildren','maxConcurrent','methods']:['schemaVersion','maxChildren','methods'])||!['child-execution@1','child-execution@2'].includes(input.schemaVersion)||!Number.isSafeInteger(input.maxChildren)||input.maxChildren<1||input.maxChildren>8||!Array.isArray(input.methods)||!input.methods.length||input.methods.length>8)fail('INVALID_CHILD_EXECUTION');
 if(input.schemaVersion==='child-execution@2'&&(!Number.isSafeInteger(input.maxConcurrent)||input.maxConcurrent<1||input.maxConcurrent>input.maxChildren))fail('INVALID_CHILD_CONCURRENCY');
 const methods=input.methods.map(normalizeChildMethod);if(new Set(methods.map(m=>m.id)).size!==methods.length)fail('DUPLICATE_CHILD_METHOD');
 return Object.freeze({schemaVersion:input.schemaVersion,maxChildren:input.maxChildren,...(input.schemaVersion==='child-execution@2'?{maxConcurrent:input.maxConcurrent}:{}),methods:Object.freeze(methods)});
}
function scope({question,documents,documentCatalog,execution,projection}){
 if(projection!==undefined&&projection!=='host-context@1')fail('INVALID_CHILD_PROJECTION');
 const catalog=documentCatalog===undefined?undefined:normalizeDocumentCatalog(documentCatalog),allowed=catalog?.documents.map(d=>d.id)??['atlas-a','atlas-b'];
 if(typeof question!=='string'||!question.trim()||(projection===undefined&&Buffer.byteLength(question)>16000)||!Array.isArray(documents)||!documents.length||documents.length>64||new Set(documents).size!==documents.length||documents.some(d=>!allowed.includes(d)))fail('INVALID_CHILD_EXECUTION_SCOPE');
 return {question,...(projection===undefined?{}:{projection}),documents:[...documents],...(catalog?{documentCatalog:catalog}:{}),execution:normalizeChildExecution(execution)};
}
export function childExecutionBinding(input){return Object.freeze({id:input.execution?.schemaVersion==='child-execution@2'?'async-child-execution':'serial-child-execution',version:'1',contentSha256:sha256(canonical(scope(input)))});}
function select(value,selected){
 if(!exact(value,['methodId','question','documents']))fail('INVALID_CHILD_EXECUTION_ARGUMENTS');
 const method=selected.execution.methods.find(m=>m.id===value.methodId);
 if(!method||typeof value.question!=='string'||!value.question.trim()||(selected.projection===undefined&&Buffer.byteLength(value.question)>method.input.maxQuestionBytes)||!Array.isArray(value.documents)||!value.documents.length||(selected.projection===undefined&&value.documents.length>method.input.maxDocuments)||new Set(value.documents).size!==value.documents.length||value.documents.some(id=>!selected.documents.includes(id)))fail('INVALID_CHILD_EXECUTION_ARGUMENTS');
 return {method,...(selected.projection===undefined?{}:{projection:selected.projection}),question:selected.question,localQuestion:value.question,documents:[...value.documents],...(selected.documentCatalog?{documentCatalog:selected.documentCatalog}:{})};
}
// A missing/wrong-shaped field is local input feedback, not permission to guess
// a method or document. Unknown identities, expanded fields and bounds stay hard.
function inputShapeIssue(value,selected){
 const keys=['methodId','question','documents'];
 if(!object(value)||Object.keys(value).some(k=>!keys.includes(k)))return null;
 const method=selected.execution.methods.find(m=>m.id===value.methodId);
 if(typeof value.methodId==='string'&&!method)return null;
 if(selected.projection===undefined&&typeof value.question==='string'&&Buffer.byteLength(value.question)>(method?.input.maxQuestionBytes??Math.min(...selected.execution.methods.map(m=>m.input.maxQuestionBytes))))return null;
 if(typeof value.documents==='string'&&!selected.documents.includes(value.documents))return null;
 if(Array.isArray(value.documents)&&(value.documents.some(id=>typeof id==='string'&&!selected.documents.includes(id))||(selected.projection===undefined&&value.documents.length>(method?.input.maxDocuments??Math.min(...selected.execution.methods.map(m=>m.input.maxDocuments))))||new Set(value.documents).size!==value.documents.length))return null;
 for(const field of keys)if(!Object.hasOwn(value,field))return{code:'CHILD_ARGUMENT_REQUIRED',field};
 if(typeof value.methodId!=='string')return{code:'CHILD_ARGUMENT_SHAPE',field:'methodId'};
 if(typeof value.question!=='string'||!value.question.trim())return{code:'CHILD_ARGUMENT_SHAPE',field:'question'};
 if(!Array.isArray(value.documents)||!value.documents.length||value.documents.some(id=>typeof id!=='string'))return{code:'CHILD_ARGUMENT_SHAPE',field:'documents'};
 return null;
}
// All authority stays in the admitted parent. Main-only adapters are not Child capabilities.
function childBindings(bindings){return {...bindings,adapters:bindings.adapters.filter(b=>canonical(b)!==canonical(PUBLICATION_BINDING))};}
function parentAuthority(parent,selected){
 validateRuntimeCheckpoint(parent.snapshot,parent.definition);
 if(selected.projection!==undefined&&!['host-results@1','host-results@2','host-results@3'].includes(parent.definition.config.hostProjection))fail('CHILD_EXECUTION_BINDING_MISMATCH');
 if(parent.parentRunId!==null||parent.rootId!==parent.runId||parent.definition.question!==selected.question||parent.definition.bindings.plugins.length||!parent.definition.bindings.adapters.some(b=>canonical(b)===canonical(childExecutionBinding(selected)))||canonical(parent.definition.config.documentCatalog??null)!==canonical(selected.documentCatalog?documentCatalogBinding(selected.documentCatalog):null))fail('CHILD_EXECUTION_BINDING_MISMATCH');
}
function originalCall(parent,callId,selected){
 const calls=parent.snapshot.messages.flatMap(m=>m.calls??[]).filter(c=>c.id===callId);
 if(calls.length!==1||calls[0].name!==(selected.execution.schemaVersion==='child-execution@2'?'spawn_child':'delegate_child'))fail('CHILD_EXECUTION_CALL_IDENTITY');
 return {call:calls[0],chosen:select(calls[0].arguments,selected)};
}
function requestedScope(parent,chosen){
 for(const [key,values] of [['allowedTools',chosen.method.allowedTools],['allowedDocuments',chosen.documents]])if(parent.definition.config[key]&&values.some(v=>!parent.definition.config[key].includes(v)))fail('CHILD_EXECUTION_SCOPE_MISMATCH');
}
function validateChild(parent,child,call,chosen){
 requestedScope(parent,chosen);
 validateRuntimeCheckpoint(child.snapshot,child.definition);
 const expectedConfig={requireReport:false,...(chosen.projection===undefined?{}:{hostProjection:parent.definition.config.hostProjection,contextBytes:parent.definition.config.contextBytes}),...(chosen.documentCatalog?{documentCatalog:documentCatalogBinding(chosen.documentCatalog)}:{}),allowedTools:chosen.method.allowedTools,allowedDocuments:chosen.documents,taskId:taskId(call.id)};
 if(child.parentRunId!==parent.runId||child.rootId!==parent.rootId||child.definition.grantId!==parent.definition.grantId||child.definition.deadlineAt>parent.definition.deadlineAt||canonical(child.definition.rootLimits)!==canonical(parent.definition.rootLimits)||canonical(child.definition.bindings)!==canonical(childBindings(parent.definition.bindings))||canonical(child.definition.config)!==canonical(expectedConfig)||canonical(child.definition.limits)!==canonical(chosen.method.limits)||child.definition.question!==childMethodQuestion({...chosen,callId:call.id}))fail('CHILD_EXECUTION_IDENTITY_MISMATCH');
}
function executionRows(store,parent,selected){
 const rows=store.listChildren(parent.runId);
 if(rows.length>selected.execution.maxChildren)fail('CHILD_EXECUTION_LIMIT_CHANGED');
 return rows.map(child=>{
  const candidates=parent.snapshot.messages.flatMap(m=>m.calls??[]).filter(c=>c.name===(selected.execution.schemaVersion==='child-execution@2'?'spawn_child':'delegate_child')&&taskId(c.id)===child.definition.config.taskId);
  if(candidates.length!==1)fail('CHILD_EXECUTION_CALL_IDENTITY');
  const {call,chosen}=originalCall(parent,candidates[0].id,selected);validateChild(parent,child,call,chosen);return{child,call,chosen};
 });
}
function unknown(child){return child.snapshot.unknownEffects.length>0||['MODEL_OUTCOME_UNKNOWN','TOOL_OUTCOME_UNKNOWN'].includes(child.snapshot.code)||child.snapshot.gatewayOutcome==='unknown'||(child.snapshot.gatewayOutcome===undefined&&child.status!=='completed'&&Boolean(child.snapshot.working));}
async function handoff(parent,child,call,chosen,selected){
 if(child.status==='active'||child.snapshot.phase!=='terminal')fail('CHILD_EXECUTION_UNSETTLED');
 // Cancellation is a control observation, never a derived answer or source handoff.
 // Unknown dispatch remains explicit and budgeted; no cancelled execution is replayed.
 if(child.status==='cancelled')return {sources:[],child:{schemaVersion:'child-execution-handoff@1',parentRunId:parent.runId,rootId:child.rootId,runId:child.runId,taskId:taskId(call.id),callId:call.id,binding:childExecutionBinding(selected),methodDescriptor:chosen.method,documents:chosen.documents,status:'cancelled',code:'CANCELLED',derived:true,summary:'',controlOnly:true,gatewayOutcome:child.snapshot.gatewayOutcome??'legacy-unspecified',unknownEffects:structuredClone(child.snapshot.unknownEffects),limitations:['child cancelled; no answer or source is adopted','remote termination is not confirmed; unknown dispatch and budget usage remain retained'],partialEffects:structuredClone(child.snapshot.partialEffects),mode:child.definition.bindings.gateway.mode,semanticStatus:'unreviewed'}};
 if(unknown(child))fail('CHILD_EXECUTION_EFFECT_UNKNOWN');
 const out=child.snapshot.outcome;
 if(!['completed','failed'].includes(child.status)||!out||out.runId!==child.runId||out.rootId!==child.rootId||out.directory!==child.directory||out.taskId!==taskId(call.id)||out.status!==child.status||out.code!==child.snapshot.code)fail('CHILD_EXECUTION_OUTCOME_UNAVAILABLE');
 if(out.status==='completed'&&out.code!==null)fail('CHILD_EXECUTION_OUTCOME_MISMATCH');
 if(typeof out.answer!=='string')fail('CHILD_EXECUTION_OUTCOME_MISMATCH');
 const host=await createToolHost({...(child.definition.config.hostProjection?{hostProjection:child.definition.config.hostProjection,projectionOwner:{runId:child.runId,rootId:child.rootId},confirmDerivedConsumption:async()=>false}:{}),directory:child.directory,documentCatalog:chosen.documentCatalog,allowedTools:chosen.method.allowedTools,allowedDocuments:chosen.documents,restore:child.snapshot.host,readOnly:true});
 const owned=await host.getResultRefs();if(canonical(owned)!==canonical(out.resultRefs))fail('CHILD_EXECUTION_SOURCE_IDENTITY');
 const originals=await readChildSources({directory:child.directory,refs:owned.map(r=>r.resultRef),allowedDocuments:chosen.documents,readOnly:true});
 return {sources:originals.map((s,i)=>({...s,resultRef:owned[i].resultRef})),child:{schemaVersion:'child-execution-handoff@1',parentRunId:parent.runId,rootId:child.rootId,runId:child.runId,taskId:taskId(call.id),callId:call.id,binding:childExecutionBinding(selected),methodDescriptor:chosen.method,documents:chosen.documents,status:out.status,code:out.code,derived:true,summary:out.answer,limitations:out.status==='completed'?['derived and semantically unreviewed']:['child failed; only independently validated original sources may be used'],partialEffects:structuredClone(out.partialEffects),mode:child.definition.bindings.gateway.mode,semanticStatus:'unreviewed'}};
}
export async function readChildExecutionHandoff({store,parentRunId,callId,...input}){
 const selected=scope(input),parent=store.inspect(parentRunId);parentAuthority(parent,selected);
 const {call,chosen}=originalCall(parent,callId,selected),child=store.findChild(parentRunId,taskId(call.id));
 if(!child)fail('CHILD_EXECUTION_NOT_FOUND');validateChild(parent,child,call,chosen);return handoff(parent,child,call,chosen,selected);
}
// Read-only projection of original facts. No status table, budget or worker is created here.
export async function inspectChildExecutions({store,parentRunId,...input}){
 const selected=scope(input),parent=store.inspect(parentRunId);parentAuthority(parent,selected);
 const items=[];
 for(const {child,call,chosen} of executionRows(store,parent,selected)){
  const asyncMode=selected.execution.schemaVersion==='child-execution@2';
  const consumed=parent.snapshot.messages.filter(m=>m.role==='tool'&&m.result.status==='succeeded'&&(asyncMode?m.result.value?.child?.runId===child.runId:m.callId===call.id));
  const pending=parent.snapshot.result;const committed=pending?.status==='succeeded'&&(asyncMode?pending.value?.child?.runId===child.runId:pending.callId===call.id)?pending:null;
  if(!asyncMode&&consumed.length>1)fail('CHILD_EXECUTION_CONSUMPTION_IDENTITY');
  let result=null;
  if(child.status==='cancelled'||['completed','failed'].includes(child.status)&&!unknown(child))result=await handoff(parent,child,call,chosen,selected);
  if(consumed.length||committed){if(!result)fail('CHILD_EXECUTION_CONSUMPTION_IDENTITY');for(const r of [...consumed.map(m=>m.result),...(committed?[committed]:[])])if(asyncMode?canonical(store.childOperation(parent.runId,r.callId)?.value)!==canonical(r.value):canonical(r.value?.child)!==canonical(result.child)||canonical(r.value?.sources)!==canonical(result.sources))fail('CHILD_EXECUTION_CONSUMPTION_IDENTITY');}
  items.push({runId:child.runId,parentRunId:parent.runId,rootId:child.rootId,callId:call.id,taskId:child.definition.config.taskId,methodId:chosen.method.id,documents:chosen.documents,status:child.status,phase:child.snapshot.phase,code:child.snapshot.code,deadlineAt:child.definition.deadlineAt,rounds:child.snapshot.rounds,toolsDispatched:child.snapshot.toolsDispatched,gatewayOutcome:child.snapshot.gatewayOutcome??'legacy-unspecified',unknownEffects:structuredClone(child.snapshot.unknownEffects),consumption:consumed.length?'consumed':committed?'committed-not-consumed':'not-consumed',...(result?{result}:{})});
 }
 const remainingChildren=Math.max(0,selected.execution.maxChildren-items.length);
 const capacityBlock=selected.execution.schemaVersion==='child-execution@2'?(remainingChildren===0?'execution-limit':items.filter(i=>i.status==='active').length>=selected.execution.maxConcurrent?'concurrency-limit':null):items.some(i=>i.status==='active'||i.status!=='cancelled'&&(i.gatewayOutcome==='unknown'||i.unknownEffects.length))?'child-unsettled':remainingChildren===0?'execution-limit':null;
 const admissionBlocked=parent.status!=='active'||parent.rootStatus!=='active'?'parent-terminal':Date.now()>=parent.definition.deadlineAt?'deadline-expired':capacityBlock;
 return {schemaVersion:'child-execution-history@1',parentRunId:parent.runId,rootId:parent.rootId,maxChildren:selected.execution.maxChildren,remainingChildren,admissionBlocked,rootUsage:parent.rootUsage,items};
}
export function createChildExecutionBinding({store,parentClaim,parentRunId,outputRoot,gatewayFactory,onCheckpoint,...input}){
 const selected=scope(input),inputErrors=new WeakMap();if(selected.execution.schemaVersion!=='child-execution@1')fail('ASYNC_CHILD_FACTORY_REQUIRED');if(typeof parentClaim!=='function'||typeof gatewayFactory!=='function')fail('INVALID_CHILD_EXECUTION_ADAPTER');
 function parent(){const token=parentClaim(),id=token?.runId??parentRunId;if(!id)fail('CHILD_EXECUTION_PARENT_REQUIRED');const saved=store.inspect(id);parentAuthority(saved,selected);return {saved,token};}
 function current(value,callId){const {saved,token}=parent(),p=saved.snapshot.proposal;
  if(!p||p.kind!=='calls'||p.calls.length!==1||saved.snapshot.cursor!==0||p.calls[0].name!==(selected.execution.schemaVersion==='child-execution@2'?'spawn_child':'delegate_child')||callId!==undefined&&p.calls[0].id!==callId||canonical(p.calls[0].arguments)!==canonical(value))fail('SPECIALIST_SINGLE_CALL_REQUIRED');
  let chosen;try{chosen=select(value,selected);}catch(error){if(error.code==='INVALID_CHILD_EXECUTION_ARGUMENTS'&&inputShapeIssue(value,selected))inputErrors.set(error,canonical(p.calls[0]));throw error;}
  requestedScope(saved,chosen);if(chosen.projection===undefined&&Buffer.byteLength(childMethodQuestion({...chosen,callId:p.calls[0].id}))>16000)fail('CHILD_EXECUTION_INPUT_LIMIT');
  return {saved,token,call:p.calls[0],chosen};
 }
 function writable(saved,token){
  if(!token||token.owner!==saved.owner||token.fence!==saved.fence||saved.status!=='active'||saved.rootStatus!=='active')fail('STALE_CHILD_EXECUTION_PARENT');
  // Session's original writer check rejects expired leases, cancellation and a
  // replaced fence. Captured parent facts are not authority after an await.
  const fresh=store.readClaim(token);parentAuthority(fresh,selected);
  if(fresh.runId!==saved.runId||canonical(fresh.snapshot.proposal)!==canonical(saved.snapshot.proposal)||fresh.snapshot.cursor!==saved.snapshot.cursor||fresh.snapshot.phase!==saved.snapshot.phase)fail('STALE_CHILD_EXECUTION_PARENT');
  if(Date.now()>=fresh.definition.deadlineAt)fail('TIMEOUT');return fresh;
 }
 function admit(saved,call){const rows=executionRows(store,saved,selected);if(rows.some(r=>r.call.id===call.id))fail('CHILD_EXECUTION_ALREADY_ADMITTED');if(rows.some(r=>!['completed','failed','cancelled'].includes(r.child.status)||r.child.snapshot.phase!=='terminal'||r.child.status!=='cancelled'&&unknown(r.child)))fail('CHILD_EXECUTION_UNSETTLED');return rows;}
 // This is a successful local observation of the original owner's exhausted
 // slots, not a Child admission, handoff, source acquisition or retry permission.
 function capacity(saved,call,chosen){
  requestedScope(saved,chosen);const rows=admit(saved,call);if(rows.length!==selected.execution.maxChildren)return null;
  return {sources:[],childAdmission:{schemaVersion:'child-execution-admission@1',admitted:false,reason:'execution-limit',parentRunId:saved.runId,rootId:saved.rootId,callId:call.id,taskId:taskId(call.id),requestHash:sha256(canonical(call)),binding:childExecutionBinding(selected),methodId:chosen.method.id,documents:chosen.documents,maxChildren:selected.execution.maxChildren,currentChildren:rows.map(({child,call})=>({runId:child.runId,callId:call.id,taskId:child.definition.config.taskId,status:child.status,code:child.snapshot.code}))}};
 }
 async function drive({saved,token,call,chosen},signal,existing){
  saved=writable(saved,token);signal?.throwIfAborted();
  const gateway=gatewayFactory();if(gateway?.mode!==saved.definition.bindings.gateway.mode||typeof gateway?.next!=='function')fail('CHILD_EXECUTION_GATEWAY_BINDING');
  await runMethodChild({...chosen,...(chosen.projection===undefined?{}:{hostProjection:saved.definition.config.hostProjection,contextBytes:saved.definition.config.contextBytes}),taskId:taskId(call.id),callId:call.id,gateway,outputRoot,signal,durable:{store,...(existing?{runId:existing.runId}:{}),parentRunId:saved.runId,parentClaim:token,rootId:saved.rootId,grantId:saved.definition.grantId,bindings:childBindings(saved.definition.bindings),rootLimits:saved.definition.rootLimits,deadlineAt:existing?.definition.deadlineAt??Math.min(saved.definition.deadlineAt,Date.now()+chosen.method.limits.timeoutMs),onCheckpoint}});
  signal?.throwIfAborted();return readChildExecutionHandoff({store,parentRunId:saved.runId,...selected,callId:call.id});
 }
 const binding={name:'delegate_child',description:'Delegate one bounded read-only task to an admitted method and source subset. Methods: '+selected.execution.methods.map(m=>m.id+'@'+m.version+(selected.projection===undefined?' (at most '+m.input.maxDocuments+' documents, '+m.input.maxQuestionBytes+' UTF-8 question bytes, '+m.limits.maxTools+' reader calls)':' (authorized source subset; '+m.limits.maxTools+' reader calls; shared Host input capacity)')+(m.schemaVersion==='child-method@2'?' [independent evidence: Main question is audit-only; Child receives the frozen original question]':'')).join(', ')+'. Maximum '+selected.execution.maxChildren+' executions per original Run, serial only. Call as the sole tool in this response. Child has independent context and shares the original root budget; Main owns Memory and final publication. Do not strengthen the original question or invent decision states in the delegation. Treat Child summaries as semantically unreviewed: independently review the inference, not only citation accuracy, retaining each claim\'s conditions and modality before publication. Different states do not by themselves establish mutually exclusive claims.',parameters:{type:'object',properties:{methodId:{type:'string',enum:selected.execution.methods.map(m=>m.id)},question:{type:'string',minLength:1,...(selected.projection===undefined?{maxLength:2000}:{description:'Complete local task text; actual UTF-8 serialized request capacity is enforced by Host.'})},documents:{type:'array',items:{type:'string',enum:selected.documents},minItems:1,maxItems:selected.projection===undefined?2:selected.documents.length,uniqueItems:true}},required:['methodId','question','documents'],additionalProperties:false},sourceResults:true,recoveryVersion:'child-execution-handoff@1',
  validate(value){const {saved,call}=current(value);admit(saved,call);},
  async execute(value,{callId,signal}){const context=current(value,callId);context.saved=writable(context.saved,context.token);signal?.throwIfAborted();const exhausted=capacity(context.saved,context.call,context.chosen);return exhausted??drive(context,signal);},
  async reconcile(value,{callId,signal}){const context=current(value,callId);let child=store.findChild(context.saved.runId,taskId(callId));if(!child){context.saved=writable(context.saved,context.token);signal?.throwIfAborted();return capacity(context.saved,context.call,context.chosen);}validateChild(context.saved,child,context.call,context.chosen);
   // Parent and Child leases may expire at slightly different times after process
   // loss. Wait for the original lease; never steal it or allocate a replacement.
   while(child.status==='active'&&child.owner!==null&&child.leaseUntil>Date.now()){
    signal?.throwIfAborted();if(Date.now()>=context.saved.definition.deadlineAt)fail('TIMEOUT');
    await waitForLease(Math.min(50,Math.max(1,child.leaseUntil-Date.now())),undefined,{signal});
    child=store.inspect(child.runId);validateChild(context.saved,child,context.call,context.chosen);
   }
   context.saved=writable(context.saved,context.token);
   if(child.status!=='active')return readChildExecutionHandoff({store,parentRunId:context.saved.runId,...selected,callId});
   // Re-enter the original Runtime, never dispatch from this adapter. Its sealed
   // checkpoint alone decides safe continuation versus unknown non-replay.
   return drive(context,signal,child);
  },
  async verifyResult(value,context){const {saved}=parent();
   if(context!==undefined){const call=context?.call;if(!call||call.name!==binding.name)fail('CHILD_EXECUTION_HANDOFF_CHANGED');const original=originalCall(saved,call.id,selected);if(canonical(original.call)!==canonical(call))fail('CHILD_EXECUTION_HANDOFF_CHANGED');if(!value?.childAdmission&&value?.child?.callId!==call.id)fail('CHILD_EXECUTION_HANDOFF_CHANGED');}
   if(value?.childAdmission){const call=context?.call;if(!call||call.name!==binding.name)fail('CHILD_EXECUTION_ADMISSION_CHANGED');const original=originalCall(saved,call.id,selected);if(canonical(original.call)!==canonical(call))fail('CHILD_EXECUTION_ADMISSION_CHANGED');const expected=capacity(saved,original.call,original.chosen);if(!expected||canonical(value)!==canonical(expected))fail('CHILD_EXECUTION_ADMISSION_CHANGED');return;}
   const expected=await readChildExecutionHandoff({store,parentRunId:saved.runId,...selected,callId:value?.child?.callId});if(canonical(value.child)!==canonical(expected.child)||canonical(value.sources)!==canonical(expected.sources))fail('CHILD_EXECUTION_HANDOFF_CHANGED');}
 };
 const originalFunctions=[binding.validate,binding.execute,binding.reconcile,binding.verifyResult];
 const definition=()=>canonical({name:binding.name,description:binding.description,parameters:binding.parameters,sourceResults:binding.sourceResults,recoveryVersion:binding.recoveryVersion});
 const originalDefinition=definition();
 inputOwners.set(binding,(call,{error,result,allowedTools,allowedDocuments,historical=false}={})=>{
  try{
   if(!isDeepStrictEqual(originalFunctions,[binding.validate,binding.execute,binding.reconcile,binding.verifyResult])||definition()!==originalDefinition||!exact(call,['id','name','arguments'])||call.name!=='delegate_child'||typeof call.id!=='string'||!call.id||call.id.length>200||/[\u0000-\u001f]/.test(call.id)||!isDeepStrictEqual(call,JSON.parse(JSON.stringify(call))))return null;
   const issue=inputShapeIssue(call.arguments,selected);if(!issue)return null;
   const {saved,token}=parent(),groups=saved.snapshot.messages.filter(m=>m.role==='assistant'&&m.calls?.some(c=>c.id===call.id));
   if(groups.length!==1||groups[0].calls.length!==1||canonical(groups[0].calls[0])!==canonical(call)||canonical(saved.definition.config.allowedTools??null)!==canonical(allowedTools??null)||canonical(saved.definition.config.allowedDocuments??null)!==canonical(allowedDocuments??null))return null;
   // Even malformed input cannot turn a known scope refusal into a correction.
   const methods=selected.execution.methods.filter(m=>typeof call.arguments.methodId!=='string'||m.id===call.arguments.methodId);
   const docs=Array.isArray(call.arguments.documents)?call.arguments.documents.filter(id=>typeof id==='string'):typeof call.arguments.documents==='string'?[call.arguments.documents]:selected.documents;
   for(const method of methods)requestedScope(saved,{method,documents:docs});
   const proof={schemaVersion:'child-execution-input-validation@1',...issue,repairable:true,requestHash:sha256(canonical(call)),runId:saved.runId,rootId:saved.rootId,grantId:saved.definition.grantId,ownerBinding:childExecutionBinding(selected),scopeHash:sha256(canonical({allowedTools:allowedTools??null,allowedDocuments:allowedDocuments??null}))};
   if(historical){
    const pairs=saved.snapshot.messages.filter(m=>m.role==='tool'&&m.callId===call.id).map(m=>m.result);
    if(saved.snapshot.result?.callId===call.id)pairs.push(saved.snapshot.result);
    // Never retrofit a proof to an old refusal, or accept a substituted receipt.
    if(pairs.length!==1||canonical(pairs[0])!==canonical(result)||pairs[0].validation?.schemaVersion!==proof.schemaVersion)return null;
    const {hostDefinitionsHash,...storedProof}=pairs[0].validation;if(canonical(storedProof)!==canonical(proof))return null;
   }else{
    if(inputErrors.get(error)!==canonical(call))return null;
    const fresh=writable(saved,token),s=fresh.snapshot;
    if(s.phase!=='proposal-sealed'||s.cursor!==0||s.inFlight||s.partialEffects.length||s.unknownEffects.length||s.gatewayOutcome!=='settled'||canonical(s.proposal?.calls)!==canonical([call]))return null;
    admit(fresh,call);
   }
   return proof;
  }catch{return null;}
 });
 groupHistoryOwners.set(binding,callId=>{const {saved}=parent();const groups=saved.snapshot.messages.filter(m=>m.role==='assistant'&&m.calls?.some(c=>c.id===callId));return groups.length===1?groups[0].calls:null;});
 groupOwners.set(binding,(calls,historical)=>{
  if(!Array.isArray(calls)||calls.length<2||calls.filter(c=>c.name===binding.name).length!==1)return null;
  const {saved,token}=parent(),call=calls.find(c=>c.name===binding.name);
  if(!historical){writable(saved,token);if(saved.snapshot.phase!=='proposal-sealed'||saved.snapshot.cursor!==0||canonical(saved.snapshot.proposal.calls)!==canonical(calls))fail('STALE_CHILD_EXECUTION_PARENT');}
  return {schemaVersion:'specialist-group-refusal@1',runId:saved.runId,ownerBinding:childExecutionBinding(selected),groupHash:sha256(canonical(calls)),callIds:calls.map(c=>c.id),ownerCallId:call.id};
 });
 return binding;
}

// One Session remains the durable owner. This map only coordinates work in the
// current Worker; original operation receipts, not current status, verify history.
export function createAsyncChildExecutionBindings({store,parentClaim,parentRunId,outputRoot,gatewayFactory,onCheckpoint,...input}){
 const selected=scope(input);if(selected.execution.schemaVersion!=='child-execution@2'||typeof parentClaim!=='function'||typeof gatewayFactory!=='function')fail('INVALID_ASYNC_CHILD_EXECUTION');
 const jobs=new Map();let closing=false,effectsStopped=true;
 function parent(writable=false){const token=parentClaim(),id=token?.runId??parentRunId;if(!id)fail('CHILD_EXECUTION_PARENT_REQUIRED');const saved=writable?store.readClaim(token):store.inspect(id);parentAuthority(saved,selected);return{saved,token};}
 function current(name,args,callId,writable=false){const {saved,token}=parent(writable),p=saved.snapshot.proposal,call=p?.calls?.[saved.snapshot.cursor];
  if(p?.kind!=='calls'||p.calls.length!==1||saved.snapshot.cursor!==0||call?.name!==name||callId!==undefined&&call.id!==callId||canonical(call.arguments)!==canonical(args))fail('ASYNC_CHILD_SINGLE_CALL_REQUIRED');
  return{saved,token,call};
 }
 function target(saved,args){if(!exact(args,Object.hasOwn(args??{},'waitMs')?['childRunId','waitMs']:['childRunId'])||typeof args.childRunId!=='string'||args.waitMs!==undefined&&(!Number.isSafeInteger(args.waitMs)||args.waitMs<0||args.waitMs>1000))fail('INVALID_ASYNC_CHILD_ARGUMENTS');
  const rows=executionRows(store,saved,selected),row=rows.find(r=>r.child.runId===args.childRunId);if(!row)fail('CHILD_EXECUTION_NOT_FOUND');return row;
 }
 const control=(action,row)=>({schemaVersion:'async-child-control@1',action,parentRunId:row.child.parentRunId,rootId:row.child.rootId,childRunId:row.child.runId,spawnCallId:row.call.id,definitionSha256:sha256(canonical(row.child.definition))});
 async function start(saved,token,call,chosen,existing){
  const key=taskId(call.id);if(jobs.has(key))return jobs.get(key).admitted;
  if(closing)fail('ASYNC_CHILD_OWNER_CLOSED');parent(true);
  if(existing?.status!=='active'&&existing)return existing;
  if(existing?.owner&&existing.leaseUntil>Date.now())return existing;
  const gateway=gatewayFactory();if(gateway?.mode!==saved.definition.bindings.gateway.mode||typeof gateway?.next!=='function')fail('CHILD_EXECUTION_GATEWAY_BINDING');
  const controller=new AbortController();let resolveAdmission,rejectAdmission;
  const admitted=new Promise((resolve,reject)=>{resolveAdmission=resolve;rejectAdmission=reject;});
  const job={controller,admitted,runId:existing?.runId,promise:null};jobs.set(key,job);
  job.promise=runMethodChild({...chosen,...(chosen.projection===undefined?{}:{hostProjection:saved.definition.config.hostProjection,contextBytes:saved.definition.config.contextBytes}),taskId:key,callId:call.id,gateway,outputRoot,signal:controller.signal,durable:{store,...(existing?{runId:existing.runId}:{}),parentRunId:saved.runId,parentClaim:token,rootId:saved.rootId,grantId:saved.definition.grantId,bindings:childBindings(saved.definition.bindings),rootLimits:saved.definition.rootLimits,deadlineAt:existing?.definition.deadlineAt??Math.min(saved.definition.deadlineAt,Date.now()+chosen.method.limits.timeoutMs),onClaim:claim=>{job.runId=claim.runId;resolveAdmission(store.inspect(claim.runId));},onCheckpoint}}).then(out=>{if(out.interruption?.effectsStopped===false)effectsStopped=false;if(!job.runId)rejectAdmission(Object.assign(new Error('CHILD_ADMISSION_FAILED'),{code:out.code??'CHILD_ADMISSION_FAILED'}));return out;},error=>{rejectAdmission(error);return{status:'failed',code:error.code??'CHILD_EXECUTION_FAILED'};}).finally(()=>{jobs.delete(key);});
  return admitted;
 }
 async function observe(context,args,signal){let row=target(context.saved,args),end=Date.now()+(args.waitMs??0);
  if(row.child.status==='active')await start(context.saved,context.token,row.call,row.chosen,row.child);
  while(row.child.status==='active'&&Date.now()<end){signal?.throwIfAborted();parent(true);await waitForLease(Math.max(1,Math.min(25,end-Date.now())),undefined,{signal});row=target(context.saved,args);if(row.child.status==='active'&&!jobs.has(taskId(row.call.id)))await start(context.saved,context.token,row.call,row.chosen,row.child);}
  row=target(context.saved,args);const c=row.child;
  const result=c.status==='cancelled'||['completed','failed'].includes(c.status)&&!unknown(c)?await handoff(context.saved,c,row.call,row.chosen,selected):{sources:[]};
  return{...result,childControl:{...control('inspect',row),status:c.status,phase:c.snapshot.phase,code:c.snapshot.code,gatewayOutcome:c.snapshot.gatewayOutcome??'legacy-unspecified',unknownEffects:structuredClone(c.snapshot.unknownEffects),partialEffects:structuredClone(c.snapshot.partialEffects),semanticStatus:'unreviewed'}};
 }
 const definitions=[
  {name:'spawn_child',description:'Start one independently scoped read-only Child and return its stable reference. Use inspect_child to obtain original results; admission is not completion. Root budget is shared.',parameters:{type:'object',properties:{methodId:{type:'string',enum:selected.execution.methods.map(m=>m.id)},question:{type:'string'},documents:{type:'array',items:{type:'string',enum:selected.documents},minItems:1,uniqueItems:true}},required:['methodId','question','documents'],additionalProperties:false}},
  {name:'inspect_child',description:'Observe one original Child. Optional bounded wait does not grant budget or retry unknown work. Historical observations remain immutable; only completed source handoffs contain evidence.',parameters:{type:'object',properties:{childRunId:{type:'string'},waitMs:{type:'integer',minimum:0,maximum:1000}},required:['childRunId'],additionalProperties:false}},
  {name:'cancel_child',description:'Cancel one original Child, not the Root. No answer or source is adopted. Unknown remote outcomes remain charged and are not replayed.',parameters:{type:'object',properties:{childRunId:{type:'string'}},required:['childRunId'],additionalProperties:false}}
 ];
 const bindings=definitions.map(def=>{
  async function execute(args,{callId,signal}){const context=current(def.name,args,callId,true);const prior=store.childOperation(context.saved.runId,callId);if(prior)return prior.value;
   let row,value;
   if(def.name==='spawn_child'){
    const chosen=select(args,selected);requestedScope(context.saved,chosen);const rows=executionRows(store,context.saved,selected);row=rows.find(r=>r.call.id===callId);
    if(!row){if(rows.length>=selected.execution.maxChildren)fail('CHILD_EXECUTION_LIMIT');if(rows.filter(r=>r.child.status==='active').length>=selected.execution.maxConcurrent)fail('CHILD_CONCURRENCY_LIMIT');const child=await start(context.saved,context.token,context.call,chosen);row={child,call:context.call,chosen};}
    value={sources:[],childControl:{...control('spawn',row),status:'admitted'}};
   }else{
    row=target(context.saved,args);
    if(def.name==='cancel_child'){if(Object.hasOwn(args,'waitMs'))fail('INVALID_ASYNC_CHILD_ARGUMENTS');store.cancelChild(context.saved.runId,row.child.runId);jobs.get(taskId(row.call.id))?.controller.abort(Object.assign(new Error('CANCELLED'),{code:'CANCELLED'}));row=target(context.saved,args);value={sources:[],childControl:{...control('cancel',row),status:row.child.status,gatewayOutcome:row.child.snapshot.gatewayOutcome??'legacy-unspecified',unknownEffects:structuredClone(row.child.snapshot.unknownEffects),partialEffects:structuredClone(row.child.snapshot.partialEffects),remoteTerminationConfirmed:false}};
    }else value=await observe(context,args,signal);
   }
   parent(true);return store.commitChildOperation(context.token,{call:context.call,childRunId:row.child.runId,value}).value;
  }
  return {...def,sourceResults:true,recoveryVersion:'async-child-operation@1',validate(args){const {saved}=current(def.name,args);if(def.name==='spawn_child'){const chosen=select(args,selected);requestedScope(saved,chosen);}else{target(saved,args);if(def.name==='cancel_child'&&Object.hasOwn(args,'waitMs'))fail('INVALID_ASYNC_CHILD_ARGUMENTS');}},execute,reconcile:execute,
   async verifyResult(value,{call}={}){if(!call||call.name!==def.name)fail('ASYNC_CHILD_RECEIPT_MISMATCH');const {saved}=parent();const receipt=store.childOperation(saved.runId,call.id);if(!receipt||canonical(receipt.call)!==canonical(call)||canonical(receipt.value)!==canonical(value))fail('ASYNC_CHILD_RECEIPT_MISMATCH');}}
 });
 const settle=async({phase,signal,interrupted}={})=>{
  if(phase==='before-final'){
   const {saved,token}=parent();
   for(const row of executionRows(store,saved,selected))if(row.child.status==='active')await start(saved,token,row.call,row.chosen,row.child);
   while(store.listChildren(saved.runId).some(c=>c.status==='active')){signal?.throwIfAborted();parent(true);await waitForLease(25,undefined,{signal});for(const row of executionRows(store,saved,selected))if(row.child.status==='active'&&!jobs.has(taskId(row.call.id)))await start(saved,token,row.call,row.chosen,row.child);}
   return;
  }
  closing=true;
  try{
   if(parentClaim()?.runId??parentRunId){const {saved}=parent();if(!interrupted)for(const child of store.listChildren(saved.runId))if(child.status==='active')store.cancelChild(saved.runId,child.runId);}
  }finally{
  const pending=[...jobs.values()];
  for(const job of pending)job.controller.abort(Object.assign(new Error(interrupted?'HOST_STOPPED':'CANCELLED'),{code:interrupted?'HOST_STOPPED':'CANCELLED'}));
  await Promise.all(pending.map(j=>j.promise));
  }
  return{effectsStopped};
 };
 for(const b of bindings)asyncOwners.set(b,settle);return bindings;
}
