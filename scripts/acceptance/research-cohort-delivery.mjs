// Read-only fixed-denominator delivery check. This is neither model execution
// nor a semantic, real-provider, projection, or overall release qualification.
import {createHash} from 'node:crypto';
import {inspectResearchTask} from '../../src/research-project.mjs';
import {inspectResearchDelivery} from './research-delivery.mjs';
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function inspectResearchCohortDelivery({projectDir,manifest}){
 if(!manifest||manifest.schemaVersion!=='research-cohort-delivery@1'||!Array.isArray(manifest.cases)||!manifest.cases.length||manifest.cases.length>1000||!Number.isInteger(manifest.minimumCompleted)||manifest.minimumCompleted<1||manifest.minimumCompleted>manifest.cases.length)fail('COHORT_MANIFEST_INVALID');
 const ids=new Set(),runs=new Set();
 for(const c of manifest.cases){
  if(!c||typeof c.caseId!=='string'||!c.caseId||typeof c.runId!=='string'||!c.runId||typeof c.requireReport!=='boolean'||typeof c.definitionSha256!=='string'||! /^[a-f0-9]{64}$/.test(c.definitionSha256)||ids.has(c.caseId)||runs.has(c.runId))fail('COHORT_MANIFEST_INVALID');
  ids.add(c.caseId);runs.add(c.runId);
 }
 // Copy before awaiting so callers cannot replace cases during observation.
 const frozen=structuredClone(manifest),rows=[];
 for(const c of frozen.cases){
  const args={projectDir,runId:c.runId},before=await inspectResearchTask(args);
  if(hash(before.definition)!==c.definitionSha256)fail('COHORT_TASK_IDENTITY_CHANGED');
  const delivery=await inspectResearchDelivery(args),after=await inspectResearchTask(args);
  if(hash(after.definition)!==c.definitionSha256||canonical(before.run)!==canonical(after.run))fail('COHORT_OBSERVATION_CHANGED');
  rows.push({caseId:c.caseId,...delivery,requiredReportSatisfied:!c.requireReport||delivery.reportArtifactPresent});
 }
 const completed=rows.filter(r=>r.runtimeCompleted).length;
 const missingReports=rows.filter(r=>!r.requiredReportSatisfied).map(r=>r.caseId);
 const unsettled=rows.filter(r=>!['completed','failed','cancelled'].includes(r.runtimeStatus)).map(r=>r.caseId);
 return {schemaVersion:'research-cohort-delivery-result@1',manifestSha256:hash(frozen),denominator:rows.length,completed,minimumCompleted:frozen.minimumCompleted,runtimeThresholdMet:completed>=frozen.minimumCompleted,missingReports,unsettled,deliveryQualified:completed>=frozen.minimumCompleted&&missingReports.length===0&&unsettled.length===0,cases:rows,semanticStatus:'not-assessed',realProviderStatus:'not-assessed',projectionStatus:'not-assessed',releaseEligibility:'not-assessed'};
}
