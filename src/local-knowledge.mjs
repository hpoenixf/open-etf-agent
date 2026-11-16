import {loadProjectSources} from './project-sources.mjs';
import {createKnowledgeIndex,queryKnowledge,BM25_KNOWLEDGE_VERSION} from './knowledge.mjs';

// An explicit local search, not an Agent run or a publication receipt.
// The source owner verifies the immutable manifest and original bytes on every read.
export async function queryImportedKnowledge({projectDir,manifestSha256,query,signal}) {
 const {catalog}=await loadProjectSources({projectDir,manifestSha256,signal});
 if(!catalog)throw Object.assign(new Error('KNOWLEDGE_TEXT_REQUIRED'),{code:'KNOWLEDGE_TEXT_REQUIRED'});
 const index=createKnowledgeIndex({catalog,allowedDocuments:catalog.documents.map(d=>d.id),config:{algorithm:'bm25'},version:BM25_KNOWLEDGE_VERSION,signal});
 const result=queryKnowledge(index,{query},{signal});
 return {schemaVersion:'local-knowledge-query@1',manifestSha256,algorithm:'bm25',query,status:result.status,
  coverage:{matched:result.coverage.matched,returned:result.coverage.returned,limit:result.coverage.limit,byteLimited:result.coverage.byteLimited,encodingLimited:result.coverage.encodingLimited},sources:result.sources};
}
