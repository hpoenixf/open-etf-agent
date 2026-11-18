import {isDeepStrictEqual} from 'node:util';
import {sha256,normalizeDocumentCatalog,documentCatalogBinding} from './source.mjs';
import {freezeVectorEvidence} from './knowledge-vectors.mjs';
import {createKnowledgeIndex,createKnowledgeTool,queryKnowledge,KNOWLEDGE_QUERY_GUIDANCE} from './knowledge.mjs';
import {encodeTypedInputs} from './embedding-protocol.mjs';
import {validateKnowledgeQueryConfig} from './knowledge-query-session.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>sha256(canonical(v));
export const pageVectorIdentity=v=>hash({provider:v.provider,dimensions:v.dimensions,pages:v.pages});

// The local encoder is an execution resource, never a replay/verification port.
// Session's original tool-dispatch transaction reserves the query and both stages.
export function createDynamicKnowledgeTool({catalog,allowedDocuments,config,vectorEvidence,sourceManifestSha256,queryConfig,store,runId,getClaim,backendFactory}){
 catalog=normalizeDocumentCatalog(catalog);
 const frozen=freezeVectorEvidence(vectorEvidence,{catalog,allowedDocuments}).snapshot;
 if(frozen.provider.id!=='local-sentence-transformers'||frozen.provider.revision!==queryConfig?.modelManifestSha256)fail('KNOWLEDGE_QUERY_MODEL_CHANGED');
 const catalogBinding=documentCatalogBinding(catalog),profile=Object.freeze(validateKnowledgeQueryConfig({schemaVersion:'local-knowledge-query@1',model:frozen.provider.model,manifestSha256:queryConfig.modelManifestSha256,sourceManifestSha256,catalogSha256:catalogBinding.sha256,pageEvidenceSha256:pageVectorIdentity(frozen),dimensions:frozen.dimensions,maxTokens:queryConfig.maxTokens,maxQueries:queryConfig.maxQueries}));
 if(queryConfig.pageEvidenceSha256!==undefined&&queryConfig.pageEvidenceSha256!==profile.pageEvidenceSha256)fail('KNOWLEDGE_QUERY_MODEL_CHANGED');
 const binding=Object.freeze({id:'knowledge-query-effect',version:profile.schemaVersion,contentSha256:hash(profile)});
 const index=createKnowledgeIndex({catalog,allowedDocuments,config:{...config,algorithm:'hybrid'},vectorEvidence:frozen}),base=createKnowledgeTool(index);
 let backend;
 async function executionBackend(){
  if(!backend){if(typeof backendFactory!=='function')fail('KNOWLEDGE_QUERY_RUNTIME_REQUIRED');backend=await backendFactory();}
  if(backend?.identity?.model!==profile.model||backend?.identity?.manifestSha256!==profile.manifestSha256||backend?.maxTokens!==profile.maxTokens)fail('KNOWLEDGE_QUERY_MODEL_CHANGED');
  return backend;
 }
 function claimToken(){const token=getClaim?.();if(!token||token.runId!==runId||(token.rootId!==undefined&&token.rootId!==runId))fail('KNOWLEDGE_QUERY_SCOPE');return token;}
 function receipt(call){
  const f=store.knowledgeQueryEffect(runId,call.id);
  if(!f||f.status!=='completed')return null;
  if(f.profileSha256!==binding.contentSha256||!isDeepStrictEqual(f.call,call))fail('KNOWLEDGE_RESULT_MISMATCH');return f;
 }
 function result(f){
  const evidence={...frozen,queries:[{querySha256:sha256(f.call.arguments.query),vector:f.encoded.vector}]};
  const current=createKnowledgeIndex({catalog,allowedDocuments,config:index.config,vectorEvidence:evidence});
  return queryKnowledge(current,f.call.arguments,{queryAcquisition:{schemaVersion:profile.schemaVersion,requestSha256:f.requestSha256,receiptSha256:hash(f),reservedPhysicalOperations:2,dispatchedPhysicalOperations:f.dispatchedPhysicalOperations}});
 }
 const tool={...base,
  description:'Query this Run’s admitted original text with cached page vectors and one new local query embedding. Each call reserves one query slot and two local protocol operations before execution. It never fetches sources or calls a billable embedding service. Completed query receipts are read during recovery; uncertain work is never retried. Returns original whole pages with exact sourceId and ResultRef for citations. Ranking is not an answerability judgment. Coverage describes only the admitted collection, not global absence or freshness. '+KNOWLEDGE_QUERY_GUIDANCE,
  recoveryVersion:profile.schemaVersion,
  async validate(args){base.validate(args);await executionBackend();},
  async execute(args,{callId,signal}={}){
   const call={id:callId,name:'knowledge_query',arguments:structuredClone(args)},f=store.knowledgeQueryEffect(runId,callId),token=claimToken();
   if(!f||f.status!=='reserved'||f.dispatchedPhysicalOperations!==0||f.fence!==token?.fence||f.profileSha256!==binding.contentSha256||!isDeepStrictEqual(f.call,call))fail('KNOWLEDGE_QUERY_OUTCOME_UNKNOWN');
   signal?.throwIfAborted();const actual=await executionBackend();
   const guarded={identity:actual.identity,maxTokens:actual.maxTokens,
    tokenize:input=>{signal?.throwIfAborted();store.dispatchKnowledgeQuery(claimToken(),callId,'tokenize');return actual.tokenize(input);},
    encodeDocument:()=>fail('KNOWLEDGE_QUERY_DOCUMENT_ENCODING_FORBIDDEN'),
    encodeQuery:input=>{signal?.throwIfAborted();store.dispatchKnowledgeQuery(claimToken(),callId,'encode');return actual.encodeQuery(input);}
   };
   const [encoded]=await encodeTypedInputs({inputs:[{kind:'query',id:sha256(args.query),text:args.query}],dimensions:profile.dimensions,backend:guarded,signal});
   signal?.throwIfAborted();const completed=store.completeKnowledgeQuery(claimToken(),callId,encoded);return result(completed);
  },
  async reconcile(args,{callId}={}){base.validate(args);const f=receipt({id:callId,name:'knowledge_query',arguments:args});return f?result(f):null;},
  async verifyResult(value,{call}={}){
   const f=receipt(call);if(!f)fail('KNOWLEDGE_RESULT_MISMATCH');
   if(!Array.isArray(value?.sources))fail('KNOWLEDGE_RESULT_MISMATCH');
   const plain={...value,sources:value.sources.map(s=>{const {resultRef,...original}=s;return original;})};
   if(!isDeepStrictEqual(plain,result(f)))fail('KNOWLEDGE_RESULT_MISMATCH');
  }
 };
 return {profile,binding,catalogBinding,tool};
}
