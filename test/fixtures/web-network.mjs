import dns from 'node:dns';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
/** Test-only stdlib seam. Every request must match a fixture route; never falls back to network. */
export function mockWebNetwork(t,{routes={},addresses=[{address:'93.184.216.34',family:4}],lookupError=null}={}){
 const calls=[],lookups=[],requests=[];
 t.mock.method(dns,'lookup',(hostname,options,callback)=>{lookups.push(hostname);queueMicrotask(()=>callback(lookupError,typeof addresses==='function'?addresses(hostname):addresses));});
 t.mock.method(https,'request',(url,options,callback)=>{
  const request=new EventEmitter();request.destroyed=false;request.destroy=()=>{request.destroyed=true;request.response?.destroy();return request;};
  request.end=()=>{calls.push({url:url.href,options});queueMicrotask(()=>{
   if(request.destroyed)return;
   const fixture=routes[url.href];if(!fixture){request.emit('error',new Error('UNEXPECTED_TEST_URL'));return;}
   const f=typeof fixture==='function'?fixture({url,options,calls}):fixture;
   if(f.hang)return;if(f.error){request.emit('error',new Error('SYNTHETIC_NETWORK'));return;}
   const res=new PassThrough();request.response=res;res.statusCode=f.status??200;res.headers=f.headers??{'content-type':'text/plain; charset=utf-8'};
   callback(res);if(res.destroyed)return;
   for(const chunk of f.chunks??[Buffer.from(f.body??'')]){if(res.destroyed)break;res.write(chunk);}
   if(f.abort){res.emit('aborted');res.destroy();}else res.end();
  });};requests.push(request);return request;
 });
 return {calls,lookups,requests};
}
