import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,expected)=>object(v)&&Object.keys(v).sort().join(',')===expected;
const error=code=>Object.assign(new Error(code),{code});
/** Trusted local executable only. One lazy child, sequential requests, no retries.
 * close/abort kills this child, not arbitrary descendants or remote processes.
 */
export function createLocalEmbeddingBackend({command,args=[],identity,maxTokens,timeoutMs=30000,maxInputBytes=2097152,maxOutputBytes=2097152}={}){
 if(typeof command!=='string'||!isAbsolute(command)||!Array.isArray(args)||Array.from(args).some(a=>typeof a!=='string')||!identity||typeof identity.model!=='string'||!identity.model||!/^[a-f0-9]{64}$/.test(identity.manifestSha256)||![maxTokens,timeoutMs,maxInputBytes,maxOutputBytes].every(Number.isSafeInteger)||maxTokens<1||maxTokens>1048576||timeoutMs<1||timeoutMs>120000||maxInputBytes<128||maxInputBytes>4194304||maxOutputBytes<128||maxOutputBytes>4194304)throw error('EMBEDDING_PROCESS_CONFIG');
 const fixed=Object.freeze({model:identity.model,manifestSha256:identity.manifestSha256}),argv=[...args];
 let child,closed=false,pending,ordinal=0,buffer=Buffer.alloc(0),stderrBytes=0;
 const stop=(reason=error('EMBEDDING_PROCESS_CLOSED'))=>{closed=true;child?.kill('SIGKILL');if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.signal?.removeEventListener('abort',p.abort);p.reject(reason);}};
 function start(){
  // Deliberately do not forward credential-bearing parent environment variables.
  child=spawn(command,argv,{shell:false,stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',TOKENIZERS_PARALLELISM:'false'}});
  child.on('error',()=>stop(error('EMBEDDING_PROCESS_START')));
  child.on('exit',()=>stop(error('EMBEDDING_PROCESS_EXIT')));
  child.stdin.on('error',()=>stop(error('EMBEDDING_PROCESS_WRITE')));
  child.stderr.on('data',c=>{stderrBytes+=c.length;if(stderrBytes>maxOutputBytes)stop(error('EMBEDDING_PROCESS_OUTPUT_LIMIT'));});
  child.stdout.on('data',c=>{
   if(closed)return;
   if(!pending||buffer.length+c.length>maxOutputBytes){stop(error('EMBEDDING_PROCESS_OUTPUT_LIMIT'));return;}
   buffer=Buffer.concat([buffer,c]);const newline=buffer.indexOf(10);if(newline<0)return;
   // Exactly one response frame; unsolicited/trailing bytes fail closed.
   if(newline!==buffer.length-1){stop(error('EMBEDDING_PROCESS_PROTOCOL'));return;}
   let response;try{response=JSON.parse(buffer.subarray(0,newline).toString('utf8'));}catch{stop(error('EMBEDDING_PROCESS_PROTOCOL'));return;}
   const validResult=keys(response,'id,manifestSha256,result')&&(pending.operation==='tokenize'
    ?keys(response.result,'tokenIds,truncated')&&Array.isArray(response.result.tokenIds)
    :keys(response.result,'tokenIdsSha256,truncated,vector')&&Array.isArray(response.result.vector)&&typeof response.result.tokenIdsSha256==='string');
   if(!validResult||response.result.truncated!==false||response.id!==pending.id||response.manifestSha256!==fixed.manifestSha256){stop(error('EMBEDDING_PROCESS_PROTOCOL'));return;}
   const p=pending;pending=null;buffer=Buffer.alloc(0);clearTimeout(p.timer);p.signal?.removeEventListener('abort',p.abort);p.resolve(response.result);
  });
 }
 async function request(operation,input){
  if(closed)throw error('EMBEDDING_PROCESS_CLOSED');
  const {signal,...data}=input;signal?.throwIfAborted();
  if(pending)throw error('EMBEDDING_PROCESS_BUSY');
  const id=++ordinal,wire=Buffer.from(JSON.stringify({id,operation,manifestSha256:fixed.manifestSha256,input:data})+'\n');
  if(wire.length>maxInputBytes)throw error('EMBEDDING_PROCESS_INPUT_LIMIT');
  if(!child)start();
  return new Promise((resolve,reject)=>{
   const abort=()=>stop(error('EMBEDDING_PROCESS_CANCELLED'));
   const timer=setTimeout(()=>stop(error('EMBEDDING_PROCESS_TIMEOUT')),timeoutMs);
   pending={id,operation,resolve,reject,signal,abort,timer};signal?.addEventListener('abort',abort,{once:true});
   if(signal?.aborted){abort();return;}
   child.stdin.write(wire);
  });
 }
 return Object.freeze({identity:fixed,maxTokens,tokenize:r=>request('tokenize',r),encodeDocument:r=>request('document',r),encodeQuery:r=>request('query',r),close:()=>stop()});
}
