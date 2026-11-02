import {createServer} from 'node:http';
import {openArtifactStore} from './artifacts.mjs';
import {DOCUMENT_REVOCATION_PROFILE} from './source.mjs';
const artifact=/^\/artifacts\/(artifact:sha256:[a-f0-9]{64})$/;
const metadata=/^\/metadata\/(artifact:sha256:[a-f0-9]{64})$/;
const revision=/^\/revisions\/(revision:sha256:[a-f0-9]{64})$/;
const source=/^\/sources\/(revision:sha256:[a-f0-9]{64})\/(0|[1-9][0-9]?)$/;
export async function startReader({directory,port=0,protectedContext}){
 if(!Number.isSafeInteger(port)||port<0||port>65535)throw new Error('Invalid reader port');let protection;
 if(protectedContext!==undefined){if(!protectedContext||Object.keys(protectedContext).sort().join(',')!=='runId,store'||protectedContext.store?.schemaVersion!==4||typeof protectedContext.store.readProtectedOutput!=='function'||typeof protectedContext.store.listProtectedOutputs!=='function')throw new Error('Protected Reader context required');const state=protectedContext.store.inspect(protectedContext.runId);if(state.directory!==directory||state.rootId!==state.runId||state.parentRunId!==null)throw new Error('Protected Reader root mismatch');protection={profile:DOCUMENT_REVOCATION_PROFILE,...state.definition.config.documentProtection,rootId:state.rootId,runId:state.runId};}
 const store=await openArtifactStore({directory,readOnly:true,protection});let origin;
 async function current(request){const output=protectedContext.store.protectedOutput(protectedContext.runId);if(!output)throw new Error('Protected output unavailable');const proof=await store.protectedOutputProof(output.reportReceipt);await store.verifyProtection();return protectedContext.store.readProtectedOutput(protectedContext.runId,request,proof);}
 const server=createServer({maxHeaderSize:8192},async(req,res)=>{
  const headers={'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; sandbox",'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'};
  const send=(status,bytes=Buffer.alloc(0),extra={})=>{res.writeHead(status,{...headers,'Content-Length':bytes.length,...extra});res.end(req.method==='HEAD'?undefined:bytes);};
  if(req.headers.host!==origin.slice('http://'.length)||(req.headers.origin&&req.headers.origin!==origin)){send(403);return;}if(!['GET','HEAD'].includes(req.method)){send(405,Buffer.alloc(0),{Allow:'GET, HEAD'});return;}
  try{
   if(protection)await store.verifyProtection();
   if(req.url==='/'){const revisions=protection?protectedContext.store.listProtectedOutputs(protectedContext.runId):await store.listRevisions();const html='<!doctype html><html><head><title>Local report reader</title></head><body><h1>Immutable report artifacts</h1><p>Downloads only. Refresh does not run a model.</p><ul>'+revisions.map(r=>'<li><a href="/revisions/'+r.revisionId+'">'+r.revisionId+'</a> <a href="/artifacts/'+r.reportId+'">download report</a></li>').join('')+'</ul></body></html>';send(200,Buffer.from(html),{'Content-Type':'text/html; charset=utf-8'});return;}
   let match;if((match=artifact.exec(req.url))){const meta=protection?await current({kind:'metadata',artifactId:match[1]}):null;const record=protection?{...meta,bytes:await current({kind:meta.format==='csv'?'attachment':'report',artifactId:match[1]})}:await store.read(match[1]);send(200,record.bytes,{'Content-Type':record.mediaType,'Content-Disposition':'attachment; filename="artifact-'+record.sha256+'.'+({markdown:'md',html:'html',csv:'csv',svg:'svg',pdf:'pdf'}[record.format])+'"','ETag':'"'+record.sha256+'"'});return;}
   if((match=metadata.exec(req.url))){const value=protection?await current({kind:'metadata',artifactId:match[1]}):await store.read(match[1]);const {bytes,...record}=value;send(200,Buffer.from(JSON.stringify({...record,bytes:protection?bytes:bytes.length})+'\n'),{'Content-Type':'application/json; charset=utf-8'});return;}
   if((match=revision.exec(req.url))){send(200,Buffer.from(JSON.stringify(protection?await current({kind:'revision',revisionId:match[1]}):await store.readRevision(match[1]))+'\n'),{'Content-Type':'application/json; charset=utf-8'});return;}
   if((match=source.exec(req.url))){const r=protection?null:await store.readRevision(match[1]);const s=protection?await current({kind:'source',revisionId:match[1],index:Number(match[2])}):r.sources[Number(match[2])];if(!s){send(404);return;}send(200,Buffer.from(s.text),{'Content-Type':s.mediaType,'ETag':'"'+s.sha256+'"','Content-Disposition':'attachment; filename="source.txt"'});return;}
   send(404);
  }catch{send(404);}
 });server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=1000;
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>{server.off('error',fail);ok();});});origin='http://127.0.0.1:'+server.address().port;let closing;
 return{origin,async close(){if(!closing){closing=new Promise((ok,fail)=>server.close(error=>error?fail(error):ok()));server.closeAllConnections();}return closing;}};
}
