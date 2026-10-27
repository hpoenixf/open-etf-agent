const words = text => text.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) || [];
export function searchPages({ query, documents, allowedDocuments, limit=4 } = {}) {
  if (typeof query!=='string' || !query.trim() || Buffer.byteLength(query)>512 || !Array.isArray(documents) || documents.length>32 || !Array.isArray(allowedDocuments) || !allowedDocuments.length || allowedDocuments.some(id=>typeof id!=='string') || !Number.isSafeInteger(limit) || limit<1 || limit>8) throw new Error('Invalid scoped lexical query');
  const tokens=[...new Set(words(query).filter(word=>word.length>1))]; const candidates=[];
  for(const document of documents) {
    if(!allowedDocuments.includes(document.id)) continue;
    if(!Array.isArray(document.pages) || document.pages.length>64) throw new Error('Invalid scoped document pages');
    document.pages.forEach((text,index)=>{
      if(typeof text!=='string' || Buffer.byteLength(text)>64000) throw new Error('Invalid page size');
      const counts=new Map(); for(const word of words(text)) counts.set(word,(counts.get(word)||0)+1);
      const score=tokens.reduce((sum,word)=>sum+(counts.get(word)||0),0);
      if(score>0) candidates.push({documentId:document.id,page:index+1,score});
    });
  }
  return candidates.sort((a,b)=>b.score-a.score || a.documentId.localeCompare(b.documentId,'en-US') || a.page-b.page).slice(0,limit);
}
