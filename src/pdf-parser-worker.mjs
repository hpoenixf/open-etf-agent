// One owned byte-buffer parse. No paths, URLs, rendering or external services.
import PDFParser from 'pdf2json';
process.once('message',job=>{
  let done=false,count=0,total=0;
  const finish=value=>{if(done)return;done=true;process.send(value);};
  const parser=new PDFParser();
  parser.on('pdfParser_dataError',()=>finish({kind:'failure',code:'PDF_PARSE_FAILED'}));
  parser.on('data',page=>{
    if(!page||done)return;
    if(++count>16)finish({kind:'failure',code:'PDF_LIMIT_PAGES'});
  });
  parser.on('pdfParser_dataReady',value=>{
    if(done)return;
    try{
      if(!Array.isArray(value?.Pages)||!value.Pages.length)throw new Error('pages');
      if(value.Pages.length>16){finish({kind:'failure',code:'PDF_LIMIT_PAGES'});return;}
      const pages=value.Pages.map(page=>{
        if(!Array.isArray(page.Texts))throw new Error('text');
        // Preserve parser item order, not a visual/semantic reading-order claim.
        const text=page.Texts.map(item=>{
          if(!Array.isArray(item.R))throw new Error('runs');
          return item.R.map(run=>{if(typeof run.T!=='string')throw new Error('run');return decodeURIComponent(run.T);}).join('');
        }).join('\n').replace(/\r\n?/g,'\n').trim();
        const size=Buffer.byteLength(text);total+=size;
        if(size>64000||total>131072)throw Object.assign(new Error('limit'),{code:'PDF_LIMIT_TEXT'});
        if(text.includes('\0'))throw new Error('text');
        return text;
      });
      finish({kind:'parsed',parser:'pdf2json@4.1.0',pages});
    }catch(error){finish({kind:'failure',code:error.code==='PDF_LIMIT_TEXT'?'PDF_LIMIT_TEXT':'PDF_PARSE_FAILED'});}
  });
  process.send({kind:'ready'});
  try{if(!Buffer.isBuffer(job?.bytes))throw new Error('bytes');// Upstream parseBuffer rewraps pooled Buffers at backing offset zero.
    // Own an exact-length backing store so only the selected PDF bytes enter it.
    const exact=Buffer.alloc(job.bytes.length);job.bytes.copy(exact);parser.parseBuffer(exact,0);}
  catch{finish({kind:'failure',code:'PDF_PARSE_FAILED'});}
});
