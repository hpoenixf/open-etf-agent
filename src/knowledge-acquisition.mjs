import {mkdir,open,constants} from 'node:fs/promises';
import {join} from 'node:path';
import {safeDirectory,ensureSafeDirectory,publishImmutable} from './storage-files.mjs';
import {readProjectJson} from './research-project.mjs';
import {loadProjectSources} from './project-sources.mjs';
import {sha256} from './source.mjs';
import {encodeTypedInputs} from './embedding-protocol.mjs';
import {freezeVectorEvidence} from './knowledge-vectors.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const digest=value=>sha256(JSON.stringify(value));
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id);
async function syncDirectory(directory){const h=await open(directory,constants.O_RDONLY);try{await h.sync();}finally{await h.close();}}
async function publish(directory,name,value){
 await publishImmutable(directory,name,Buffer.from(JSON.stringify(value)));await syncDirectory(directory);
}
async function bounded(promise,signal){
 signal.throwIfAborted();let stopped;const cancellation=new Promise((_,reject)=>{stopped=()=>reject(signal.reason);signal.addEventListener('abort',stopped,{once:true});});
 try{return await Promise.race([promise,cancellation]);}finally{signal.removeEventListener('abort',stopped);}
}
function inputs(catalog,provider,dimensions,queries){
 if(!Array.isArray(queries)||!queries.length||queries.length>16||Array.from(queries).some(q=>typeof q!=='string'||!q.trim()||Buffer.byteLength(q)>512)||new Set(queries).size!==queries.length)fail('EMBEDDING_INPUT_INVALID');
 const pages=catalog.documents.flatMap(d=>d.pages.map((text,i)=>({sourceId:`${d.id}@${d.version}:p${i+1}`,sha256:sha256(text),text})));
 const dummy=Array.from({length:Number.isSafeInteger(dimensions)&&dimensions>0&&dimensions<=1024?dimensions:1},()=>1);
 const base={schemaVersion:'knowledge-vector-evidence@1',provider,dimensions,pages:pages.map(({sourceId,sha256})=>({sourceId,sha256,vector:dummy})),queries:queries.map(q=>({querySha256:sha256(q),vector:dummy}))};
 const normalized=freezeVectorEvidence(base,{catalog,allowedDocuments:catalog.documents.map(d=>d.id)});
 const texts=[...pages.map(p=>p.text),...queries];
 if(Buffer.byteLength(JSON.stringify(texts))>1048576)fail('EMBEDDING_INPUT_LIMIT');
 return {base:{...base,provider:normalized.snapshot.provider},texts,typedInputs:[...pages.map(p=>({kind:'document',id:p.sourceId,text:p.text})),...queries.map(text=>({kind:'query',id:sha256(text),text}))]};
}
/** Experimental acquisition port, not an enabled transport or a Runtime tool.
 * Legacy embed returns ordered vectors; backend selects typed plan v2.
 * Both are bounded by the same owner timeout. Transport/provider budgets
 * remain the caller's responsibility. This owner invokes the port at most once
 * per ID, never auto-retries, and never invokes it during inspection/recovery.
 */
export async function acquireKnowledgeVectors({projectDir,manifestSha256,acquisitionId,provider,dimensions,queries,embed,backend,approveSelectedText=false,timeoutMs=30000,signal}={}){
 const typed=backend!==undefined;
 if(typed&&(embed!==undefined||!backend||!Number.isSafeInteger(backend.maxTokens)||backend.maxTokens<1||backend.maxTokens>1048576||['tokenize','encodeDocument','encodeQuery'].some(k=>typeof backend[k]!=='function')))fail('EMBEDDING_ADMISSION_INVALID');
 if(!validId(acquisitionId)||approveSelectedText!==true||(!typed&&typeof embed!=='function')||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)fail('EMBEDDING_ADMISSION_INVALID');
 const typedBackend=typed?Object.freeze({maxTokens:backend.maxTokens,tokenize:backend.tokenize.bind(backend),encodeDocument:backend.encodeDocument.bind(backend),encodeQuery:backend.encodeQuery.bind(backend)}):null;
 signal?.throwIfAborted();
 projectDir=await safeDirectory(projectDir);
 const {catalog}=await loadProjectSources({projectDir,manifestSha256,signal});
 if(!catalog)fail('KNOWLEDGE_TEXT_REQUIRED');
 const {base,texts,typedInputs}=inputs(catalog,provider,dimensions,queries);
 // Copy identity/input before awaiting or exposing values to an adapter.
 const plan=JSON.parse(JSON.stringify({schemaVersion:typed?'knowledge-acquisition-plan@2':'knowledge-acquisition-plan@1',...(typed?{encoding:{schemaVersion:'typed-embedding@1',maxTokens:typedBackend.maxTokens,inputs:typedInputs.map(v=>({kind:v.kind,id:v.id,inputSha256:digest(v)}))}}:{}),manifestSha256,acquisitionId,provider:base.provider,dimensions,timeoutMs,inputSha256:digest(texts),vectorTemplate:base}));
 const parent=await ensureSafeDirectory(join(projectDir,'knowledge-acquisitions'));
 await syncDirectory(projectDir); // persist a newly created acquisitions directory
 const directory=join(parent,acquisitionId);
 await mkdir(directory,{mode:0o700}); // exclusive claim; EEXIST never dispatches
 await syncDirectory(parent); // persist the name before any side effect
 await publish(directory,'plan.json',plan);
 let dispatched=false,responseObserved=false;
 const controller=new AbortController();const forward=()=>controller.abort(signal.reason);
 signal?.addEventListener('abort',forward,{once:true});if(signal?.aborted)forward();
 const timer=setTimeout(()=>controller.abort(Object.assign(new Error('EMBEDDING_TIMEOUT'),{code:'EMBEDDING_TIMEOUT'})),timeoutMs);
 try{
  controller.signal.throwIfAborted();
  await publish(directory,'attempt.json',{planSha256:digest(plan),adapterInvocations:1});
  controller.signal.throwIfAborted();
  const pending=Promise.resolve().then(()=>{controller.signal.throwIfAborted();dispatched=true;return typed?encodeTypedInputs({inputs:typedInputs,dimensions,backend:typedBackend,signal:controller.signal}):embed(Object.freeze({provider:Object.freeze({...plan.provider}),dimensions,texts:Object.freeze([...texts]),signal:controller.signal}));});
  const output=await bounded(pending,controller.signal);
  const vectors=typed?output.map(r=>r.vector):output;
  responseObserved=true;controller.signal.throwIfAborted();
  if(!Array.isArray(vectors)||vectors.length!==texts.length)fail('EMBEDDING_RESPONSE_INVALID');
  const value={...plan.vectorTemplate,pages:plan.vectorTemplate.pages.map((p,i)=>({...p,vector:vectors[i]})),queries:plan.vectorTemplate.queries.map((q,i)=>({...q,vector:vectors[plan.vectorTemplate.pages.length+i]}))};
  const frozen=freezeVectorEvidence(value,{catalog,allowedDocuments:catalog.documents.map(d=>d.id)});
  const encoding=typed?{schemaVersion:'typed-embedding-receipt@1',planSha256:digest(plan),results:output}:null;
  // Cancellation bounds backend work, not filesystem durability. After this
  // final synchronous check, commit is non-cancellable: persist the validated
  // outcome even if the caller aborts while writing. No backend work remains.
  controller.signal.throwIfAborted();
  clearTimeout(timer);signal?.removeEventListener('abort',forward);
  if(typed)await publish(directory,'encoding.json',encoding);
  await publish(directory,'evidence.json',frozen.snapshot);
  await publish(directory,'terminal.json',{status:'succeeded',...(typed?{encodingSha256:digest(encoding)}:{}),planSha256:digest(plan),evidenceSha256:frozen.sha256,adapterInvocations:1,responseObserved:true,automaticReplayAllowed:false});
  return {acquisitionId,manifestSha256,vectorEvidence:frozen.snapshot,vectorEvidenceSha256:frozen.sha256};
 }catch(error){
  const terminal={status:dispatched&&!responseObserved?'unknown':'failed',planSha256:digest(plan),adapterInvocations:dispatched?1:0,responseObserved,automaticReplayAllowed:false};
  try{await publish(directory,'terminal.json',terminal);}catch{/* Claim and attempt remain; no automatic replay on uncertain persistence. */}
  throw Object.assign(new Error('EMBEDDING_ACQUISITION_INCOMPLETE'),{code:'EMBEDDING_ACQUISITION_INCOMPLETE',acquisition:terminal,cause:error});
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',forward);}
}
export async function inspectKnowledgeAcquisition({projectDir,acquisitionId}={}){
 if(!validId(acquisitionId))fail('EMBEDDING_ADMISSION_INVALID');
 projectDir=await safeDirectory(projectDir);
 const directory=await safeDirectory(join(projectDir,'knowledge-acquisitions',acquisitionId));
 let plan,terminal;
 try{plan=await readProjectJson(join(directory,'plan.json'),2097152);}catch(e){if(e.code==='ENOENT')return {status:'unknown',automaticReplayAllowed:false};throw e;}
 if(!['knowledge-acquisition-plan@1','knowledge-acquisition-plan@2'].includes(plan.schemaVersion)||plan.acquisitionId!==acquisitionId)fail('EMBEDDING_RECORD_CHANGED');
 try{terminal=await readProjectJson(join(directory,'terminal.json'),4096);}catch(e){if(e.code==='ENOENT')return {status:'unknown',automaticReplayAllowed:false};throw e;}
 if(terminal.planSha256!==digest(plan)||terminal.automaticReplayAllowed!==false||!['succeeded','failed','unknown'].includes(terminal.status))fail('EMBEDDING_RECORD_CHANGED');
 if(!Number.isSafeInteger(terminal.adapterInvocations)||![0,1].includes(terminal.adapterInvocations)||typeof terminal.responseObserved!=='boolean'||(terminal.responseObserved&&terminal.adapterInvocations!==1)||(terminal.status==='unknown'&&(terminal.adapterInvocations!==1||terminal.responseObserved))||(terminal.status==='succeeded'&&(terminal.adapterInvocations!==1||!terminal.responseObserved)))fail('EMBEDDING_RECORD_CHANGED');
 if(terminal.adapterInvocations===1){const attempt=await readProjectJson(join(directory,'attempt.json'),4096);if(attempt.planSha256!==digest(plan)||attempt.adapterInvocations!==1||Object.keys(attempt).sort().join(',')!=='adapterInvocations,planSha256')fail('EMBEDDING_RECORD_CHANGED');}
 if(terminal.status!=='succeeded')return terminal;
 const {catalog}=await loadProjectSources({projectDir,manifestSha256:plan.manifestSha256});
 if(!catalog)fail('KNOWLEDGE_TEXT_REQUIRED');
 const frozen=freezeVectorEvidence(await readProjectJson(join(directory,'evidence.json'),1048576),{catalog,allowedDocuments:catalog.documents.map(d=>d.id)});
 if(frozen.sha256!==terminal.evidenceSha256||JSON.stringify(frozen.snapshot.provider)!==JSON.stringify(plan.provider)||frozen.snapshot.dimensions!==plan.dimensions||JSON.stringify(frozen.snapshot.queries.map(q=>q.querySha256).sort())!==JSON.stringify(plan.vectorTemplate.queries.map(q=>q.querySha256).sort()))fail('EMBEDDING_RECORD_CHANGED');
 if(plan.schemaVersion==='knowledge-acquisition-plan@2'){
  const receipt=await readProjectJson(join(directory,'encoding.json'),2097152);
  const expected=[...plan.vectorTemplate.pages.map(p=>({kind:'document',id:p.sourceId})),...plan.vectorTemplate.queries.map(q=>({kind:'query',id:q.querySha256}))];
  if(!plan.encoding||plan.encoding.schemaVersion!=='typed-embedding@1'||!Number.isSafeInteger(plan.encoding.maxTokens)||plan.encoding.maxTokens<1||plan.encoding.maxTokens>1048576||!Array.isArray(plan.encoding.inputs)||plan.encoding.inputs.length!==expected.length||receipt.schemaVersion!=='typed-embedding-receipt@1'||receipt.planSha256!==digest(plan)||digest(receipt)!==terminal.encodingSha256||!Array.isArray(receipt.results)||receipt.results.length!==expected.length)fail('EMBEDDING_RECORD_CHANGED');
  for(const [i,e]of expected.entries()){
   const input=plan.encoding.inputs[i],r=receipt.results[i];
   const vector=e.kind==='document'?frozen.snapshot.pages.find(p=>p.sourceId===e.id)?.vector:frozen.snapshot.queries.find(q=>q.querySha256===e.id)?.vector;
   if(!input||!r||input.kind!==e.kind||input.id!==e.id||r.kind!==e.kind||r.id!==e.id||r.inputSha256!==input.inputSha256||!/^[a-f0-9]{64}$/.test(r.inputSha256)||!/^[a-f0-9]{64}$/.test(r.tokenIdsSha256)||!Number.isSafeInteger(r.tokenCount)||r.tokenCount<1||r.tokenCount>plan.encoding.maxTokens||JSON.stringify(r.vector)!==JSON.stringify(vector))fail('EMBEDDING_RECORD_CHANGED');
  }
 }
 return {...terminal,vectorEvidence:frozen.snapshot};
}
