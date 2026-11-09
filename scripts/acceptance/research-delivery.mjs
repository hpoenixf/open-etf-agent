// Read-only delivery observation, not a release verdict or semantic score.
// Two read-only API calls are not an atomic snapshot of an active Run.
// Committed means durable Publication, not notification delivery to a user.
// Original Project APIs own receipt validation and artifact byte readback.
import {createHash} from 'node:crypto';
import {inspectResearchTask,readResearchOutput} from '../../src/research-project.mjs';
const fingerprint=text=>({sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)});
export async function inspectResearchDelivery({projectDir,runId}) {
 const {run}=await inspectResearchTask({projectDir,runId});
 let output=null;
 try { output=await readResearchOutput({projectDir,runId}); }
 catch(error) { if(error.code!=='PROJECT_REPORT_NOT_READY')throw error; }
 const publication=output?.publication??null, report=output?.report??null;
 return {schemaVersion:'research-delivery-observation@1',runId,
  runtimeStatus:run?.status??'not-started',runtimeCode:run?.snapshot?.code??null,
  runtimeCompleted:run?.status==='completed',
  publicationCommitted:publication!==null,
  reportArtifactPresent:report!==null,
  publication:publication?fingerprint(publication.content.text):null,
  report:report?{artifactId:report.artifactId,sha256:report.sha256,bytes:report.bytes}:null,
  reportStatus:report?'present':output?.reportStatus??'not-ready',
  ...(output?.reportError?{reportError:output.reportError}:{}),
  semanticStatus:'not-assessed',releaseEligibility:'not-assessed'};
}
