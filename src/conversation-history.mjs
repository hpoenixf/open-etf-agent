import {createResultStore} from './results.mjs';
import {loadProjectSources} from './project-sources.mjs';
import {sha256} from './source.mjs';

// Read-only historical projection. The Result owner, not model prose or an
// index hint, verifies the exact original calculation and selected operands.
export async function readConversationCalculations({projectDir,task,maxBytes=2048}) {
 const result={schemaVersion:'conversation-calculations@1',validity:'historical-only-not-current-evidence',items:[],omitted:0};
 if(!Number.isSafeInteger(maxBytes)||maxBytes<256||maxBytes>2048)throw new Error('CONVERSATION_HISTORY_LIMIT');
 if(task.run.status!=='completed'||task.run.rootStatus!=='completed'||task.definition.config.trustedPackages?.length)return {...result,unavailable:'unsupported-parent'};
 const basis=task.run.snapshot.host?.results;
 if(!Array.isArray(basis))return {...result,unavailable:'no-result-basis'};
 try{
  const sources=await loadProjectSources({projectDir,manifestSha256:task.definition.sourceManifestSha256});
  const store=await createResultStore({directory:task.run.directory,readOnly:true,derivedOwner:{runId:task.run.runId,rootId:task.run.rootId}});
  await store.verifySnapshot(basis);
  for(const item of basis.filter(x=>x.kind==='calculation')){
   const value=await store.readCalculation(item.resultRef),binding=value.binding;
   if(!binding){result.omitted++;continue;}
   const source=await store.read(binding.sourceRef),doc=sources.catalog?.documents.find(d=>d.id===source.documentId);
   // This initial projection supports imported text only. Web/PDF/Child and
   // unbound numeric results remain unavailable rather than losing provenance.
   if(!doc||doc.web||doc.version!==source.version||doc.name!==source.name||doc.pages[source.page-1]!==source.text||sha256(source.text)!==binding.contentHash){result.omitted++;continue;}
   const projected={kind:'historical-bound-calculation',synthetic:true,sourceKind:'synthetic-comparison-table',parentRunId:task.run.runId,contentHash:item.recordSha256,sourceVersions:[{sourceId:source.sourceId,documentId:source.documentId,version:source.version,page:source.page,sha256:source.sha256}],producer:'calculate_change@1',inputs:value.inputs,data:{difference:value.difference,ratio:value.ratio,increaseRatio:value.increaseRatio},unit:value.unit,currency:binding.currency,dataAsOf:binding.dataAsOf,coverage:binding.coverage,operands:{baseline:binding.baseline,current:binding.current},arithmetic:value.arithmetic};
   if(result.items.length>=2||Buffer.byteLength(JSON.stringify({...result,items:[...result.items,projected],omitted:basis.length}))>maxBytes){result.omitted++;continue;}
   result.items.push(projected);
  }
  return result;
 }catch{return {...result,items:[],unavailable:'original-result-or-source-unavailable'};}
}
