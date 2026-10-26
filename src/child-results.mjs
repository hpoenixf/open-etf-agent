import { createResultStore } from './results.mjs';
// The caller supplies a directory from its own actual child run receipt, never model text.
export async function readChildSources({directory,refs,allowedDocuments}={}) {
  if(!Array.isArray(refs)||refs.length>16||new Set(refs).size!==refs.length||refs.some(ref=>typeof ref!=='string'||!/^result:sha256:[a-f0-9]{64}$/.test(ref))||!Array.isArray(allowedDocuments)||!allowedDocuments.length) throw new Error('Invalid child source refs or document scope');
  const store=await createResultStore({directory,allowedDocuments}); const sources=[];
  for(const ref of refs) sources.push(await store.read(ref)); return sources;
}
