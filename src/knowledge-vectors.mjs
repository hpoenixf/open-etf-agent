import {sha256,normalizeDocumentCatalog} from './source.mjs';
const fail=()=>{throw Object.assign(new Error('KNOWLEDGE_VECTOR_EVIDENCE'),{code:'KNOWLEDGE_VECTOR_EVIDENCE'});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const label=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(v);
// Provider results are admitted data, not a provider authenticity attestation.
// This module has no transport or callback: recovery cannot invoke a provider.
export function freezeVectorEvidence(value,{catalog,allowedDocuments}){
 if(!exact(value,['schemaVersion','provider','dimensions','pages','queries'])||value.schemaVersion!=='knowledge-vector-evidence@1'||!exact(value.provider,['id','model','revision'])||!Object.values(value.provider).every(label)||!Number.isSafeInteger(value.dimensions)||value.dimensions<1||value.dimensions>1024||!Array.isArray(value.pages)||value.pages.length>1024||!Array.isArray(value.queries)||!value.queries.length||value.queries.length>16)fail();
 if(Buffer.byteLength(JSON.stringify(value))>1048576)fail();
 catalog=normalizeDocumentCatalog(catalog);
 const originals=catalog.documents.filter(d=>allowedDocuments.includes(d.id)).flatMap(d=>d.pages.map((text,i)=>({sourceId:`${d.id}@${d.version}:p${i+1}`,sha256:sha256(text)})));
 if(value.pages.length!==originals.length)fail();
 const vector=v=>{if(!Array.isArray(v)||v.length!==value.dimensions||Array.from(v).some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e10)||!v.some(n=>n!==0))fail();return [...v];};
 const seen=new Set();const pages=Array.from(value.pages).map(p=>{if(!exact(p,['sourceId','sha256','vector'])||seen.has(p.sourceId)||!originals.some(s=>s.sourceId===p.sourceId&&s.sha256===p.sha256))fail();seen.add(p.sourceId);return{sourceId:p.sourceId,sha256:p.sha256,vector:vector(p.vector)};}).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 const queries=Array.from(value.queries).map(q=>{if(!exact(q,['querySha256','vector'])||typeof q.querySha256!=='string'||!/^[a-f0-9]{64}$/.test(q.querySha256)||seen.has(q.querySha256))fail();seen.add(q.querySha256);return{querySha256:q.querySha256,vector:vector(q.vector)};}).sort((a,b)=>a.querySha256.localeCompare(b.querySha256));
 const snapshot={schemaVersion:value.schemaVersion,provider:{id:value.provider.id,model:value.provider.model,revision:value.provider.revision},dimensions:value.dimensions,pages,queries};
 const frozen=v=>{if(v&&typeof v==='object'){for(const item of Object.values(v))frozen(item);Object.freeze(v);}return v;};
 return Object.freeze({snapshot:frozen(snapshot),sha256:sha256(JSON.stringify(snapshot))});
}
export function vectorRanks(snapshot,pages,query,catalog,signal){
 const q=snapshot.queries.find(q=>q.querySha256===sha256(query));if(!q)return null;
 // Scale before squaring so finite subnormal input cannot underflow the norm.
 const unit=v=>{const scale=Math.max(...v.map(Math.abs)),scaled=v.map(n=>n/scale),norm=Math.sqrt(scaled.reduce((sum,n)=>sum+n*n,0));return scaled.map(n=>n/norm);};const qvector=unit(q.vector);
 const versions=new Map(catalog.documents.map(d=>[d.id,d.version])),vectors=new Map(snapshot.pages.map(p=>[p.sourceId,p.vector]));
 return pages.map(p=>{if(signal?.aborted)throw Object.assign(new Error('KNOWLEDGE_CANCELLED'),{code:'KNOWLEDGE_CANCELLED'});const v=vectors.get(`${p.documentId}@${versions.get(p.documentId)}:p${p.page}`);return{...p,score:Math.max(-1,Math.min(1,unit(v).reduce((sum,n,i)=>sum+n*qvector[i],0)))};}).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||(a.documentId<b.documentId?-1:a.documentId>b.documentId?1:a.page-b.page));
}
export function fuseRanks(lexical,vector){
 const candidates=new Map();for(const channel of [lexical,vector])for(const [i,page]of channel.entries()){const key=JSON.stringify([page.documentId,page.page]);const old=candidates.get(key);candidates.set(key,{...page,score:(old?.score??0)+1/(60+i+1)});}
 return [...candidates.values()].sort((a,b)=>b.score-a.score||(a.documentId<b.documentId?-1:a.documentId>b.documentId?1:a.page-b.page));
}
