import {inspectKnowledgeAcquisition} from './knowledge-acquisition.mjs';
import {submitResearchTask} from './research-project.mjs';
import {sha256} from './source.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
/** Explicit pre-admission seam, never a Runtime query callback.
 * Only consumes completed immutable preparation; owns no backend, queue or budget.
 * Existing task admission remains the sole writer/fence for frozen task identity.
 */
export async function submitPreparedKnowledgeTask({acquisitionId,requiredQueries,...task}={}){
 if(!Array.isArray(requiredQueries)||!requiredQueries.length||requiredQueries.length>16||Array.from(requiredQueries).some(q=>typeof q!=='string'||!q.trim()||Buffer.byteLength(q)>512)||new Set(requiredQueries).size!==requiredQueries.length||['embed','backend','knowledgeVectorEvidence'].some(k=>Object.hasOwn(task,k)))fail('KNOWLEDGE_PREPARATION_INPUT');
 // Snapshot caller-owned values before the first asynchronous inspection.
 const queries=[...requiredQueries],definition=structuredClone(task);
 const prepared=await inspectKnowledgeAcquisition({projectDir:definition.projectDir,acquisitionId});
 if(prepared.status!=='succeeded')fail('KNOWLEDGE_PREPARATION_INCOMPLETE');
 if(prepared.manifestSha256!==definition.sourceManifestSha256)fail('KNOWLEDGE_PREPARATION_SOURCE_MISMATCH');
 const covered=new Set(prepared.vectorEvidence.queries.map(q=>q.querySha256));
 if(queries.some(q=>!covered.has(sha256(q))))fail('KNOWLEDGE_QUERY_NOT_PREPARED');
 return submitResearchTask({...definition,knowledgeVectorEvidence:prepared.vectorEvidence});
}
