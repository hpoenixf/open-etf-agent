import { readFile } from 'node:fs/promises';
import { searchPages } from './retrieval.mjs';
export function prepareRetrieval({query='offline editing',allowedDocuments=['atlas-a','atlas-b']}={}) {
  if(typeof query!=='string'||!query.trim()||Buffer.byteLength(query)>512||!Array.isArray(allowedDocuments)||!allowedDocuments.length||allowedDocuments.some(id=>!['atlas-a','atlas-b'].includes(id))) throw new Error('Invalid trusted retrieval configuration');
  const grant=[...new Set(allowedDocuments)];
  const extensions=[{name:'search_pages',description:'Lexical page candidates within the explicit synthetic-document grant; hits are not acquired sources.',parameters:{type:'object',properties:{query:{type:'string',maxLength:512}},required:['query'],additionalProperties:false},validate:args=>{if(!args||Object.keys(args).join(',')!=='query'||typeof args.query!=='string') throw new Error('Invalid query fields');},async execute(args){const {documents}=JSON.parse(await readFile(new URL('../fixtures/documents.json',import.meta.url),'utf8'));return {candidates:searchPages({query:args.query,documents,allowedDocuments:grant,limit:2}),acquired:false};}}];
  let step=0,at=0,candidates=null,reread=false,saved=false;
  const gateway={mode:'fixture',async next({messages}){
    const results=messages.filter(m=>m.role==='tool').map(m=>m.result); const call=(name,args)=>({kind:'calls',calls:[{id:`retrieve-${++step}`,name,arguments:args}],usage:null});
    if(!candidates){if(!results.length)return call('search_pages',{query});candidates=results[0].value.candidates;if(!candidates.length)return {kind:'final',text:'No scoped lexical candidates; no original page was read or report saved.',usage:null};}
    if(at<candidates.length){const hit=candidates[at++];return call('read_page',{documentId:hit.documentId,page:hit.page});}
    const acquired=results.map(r=>r.value).filter(v=>v?.sourceId&&v?.resultRef);
    if(!reread){reread=true;return call('read_result',{resultRef:acquired[0].resultRef});}
    if(!saved){saved=true;const sources=[...new Map(acquired.map(v=>[v.sourceId,v])).values()];const oneSided=new Set(sources.map(s=>s.documentId)).size<2;
      return call('save_report',{text:`# Query-driven exact reread\n\nSynthetic query: ${query}\n\n${oneSided?'Only one document matched; no complete two-version comparison is claimed.':'Both allowed versions have acquired matching pages.'}\n\n`+sources.map((source,i)=>`[${i+1}] Original excerpt: ${source.text}`).join('\n\n')+'\n\nScripted fixture; semantic status unreviewed. Reread used the stored version, not a latest fetch.',sourceIds:sources.map(s=>s.sourceId)});}
    const receipt=results.find(r=>r.value?.fileId)?.value;if(!receipt)throw new Error('No actual retrieval report receipt');return {kind:'final',text:'Saved exact-source report '+receipt.fileId,usage:null};
  }};
  return {extensions,gateway,allowedDocuments:grant};
}
