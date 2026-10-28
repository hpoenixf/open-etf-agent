import {createServer} from 'node:http';
import {openArtifactStore} from './artifacts.mjs';
const artifact=/^\/artifacts\/(artifact:sha256:[a-f0-9]{64})$/;
const metadata=/^\/metadata\/(artifact:sha256:[a-f0-9]{64})$/;
const revision=/^\/revisions\/(revision:sha256:[a-f0-9]{64})$/;
const source=/^\/sources\/(revision:sha256:[a-f0-9]{64})\/(0|[1-9][0-9]?)$/;
export async function startReader({directory,port=0}){
 if(!Number.isSafeInteger(port)||port<0||port>65535)throw new Error('Invalid reader port');const store=await openArtifactStore({directory,readOnly:true});let origin;
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  const headers={'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; sandbox",'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'};
  const send=(status,bytes=Buffer.alloc(0),extra={})=>{res.writeHead(status,{...headers,'Content-Length':bytes.length,...extra});res.end(req.method==='HEAD'?undefined:bytes);};
  if(req.headers.host!==origin.slice('http://'.length)||(req.headers.origin&&req.headers.origin!==origin)){send(403);return;}if(!['GET','HEAD'].includes(req.method)){send(405,Buffer.alloc(0),{Allow:'GET, HEAD'});return;}
  try{
   if(req.url==='/'){const revisions=await store.listRevisions();const html='<!doctype html><html><head><title>Local report reader</title></head><body><h1>Immutable report artifacts</h1><p>Downloads only. Refresh does not run a model.</p><ul>'+revisions.map(r=>'<li><a href="/revisions/'+r.revisionId+'">'+r.revisionId+'</a> <a href="/artifacts/'+r.reportId+'">download report</a></li>').join('')+'</ul></body></html>';send(200,Buffer.from(html),{'Content-Type':'text/html; charset=utf-8'});return;}
   let match;if((match=artifact.exec(req.url))){const record=await store.read(match[1]);send(200,record.bytes,{'Content-Type':record.mediaType,'Content-Disposition':'attachment; filename="artifact-'+record.sha256+'.'+({markdown:'md',html:'html',csv:'csv',svg:'svg',pdf:'pdf'}[record.format])+'"','ETag':'"'+record.sha256+'"'});return;}
   if((match=metadata.exec(req.url))){const {bytes,...record}=await store.read(match[1]);send(200,Buffer.from(JSON.stringify({...record,bytes:bytes.length})+'\n'),{'Content-Type':'application/json; charset=utf-8'});return;}
   if((match=revision.exec(req.url))){send(200,Buffer.from(JSON.stringify(await store.readRevision(match[1]))+'\n'),{'Content-Type':'application/json; charset=utf-8'});return;}
   if((match=source.exec(req.url))){const r=await store.readRevision(match[1]);const s=r.sources[Number(match[2])];if(!s){send(404);return;}send(200,Buffer.from(s.text),{'Content-Type':s.mediaType,'ETag':'"'+s.sha256+'"','Content-Disposition':'attachment; filename="source.txt"'});return;}
   send(404);
  }catch{send(404);}
 });server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>{server.off('error',fail);ok();});});origin='http://127.0.0.1:'+server.address().port;let closing;
 return{origin,async close(){if(!closing){closing=new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));server.closeAllConnections();}return closing;}};
}
