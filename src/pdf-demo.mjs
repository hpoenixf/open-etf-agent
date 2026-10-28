// Scripted decisions; production local PDF parser, Host and file delivery.
export function preparePdfDemo({path,page=1}={}){
  if(!Number.isSafeInteger(page)||page<1||page>16)throw new Error('PDF_INVALID_PAGE');
  let step=0;
  return{pdfInput:path===undefined?{}:{path},allowedTools:['read_pdf_page','read_result','save_report'],gateway:{mode:'fixture',async next({messages}){
    const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);
    const call=(name,args)=>({kind:'calls',calls:[{id:'pdf-'+(++step),name,arguments:args}]});
    if(step===0)return call('read_pdf_page',{page});
    const source=values[0];
    if(step===1)return call('read_result',{resultRef:source.resultRef});
    if(step===2){
      // Source markers are data, not citations minted by this report.
      const excerpt=Array.from(source.text).slice(0,4000).join('').replace(/\[(C?[0-9]+)\]/g,'［$1］');
      return call('save_report',{text:'# Selected local PDF text\n\nScripted text-layer excerpt, not visual inspection or model-quality evidence. Only the selected physical page is cited; the complete extracted page remains available by its original ResultRef. Source bracket-number markers use fullwidth brackets here; the original Source, Result and PDF are unchanged. [1]\n\n'+excerpt,sourceIds:[source.sourceId]});
    }
    return{kind:'final',text:'The cited text-layer report and exact original PDF are saved with immutable identities; semantics unreviewed.'};
  }}};
}
