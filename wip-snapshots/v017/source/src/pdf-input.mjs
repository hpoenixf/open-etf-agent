import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {open,constants,readFile,realpath} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {sha256,validateSource} from './source.mjs';
const error=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw error(code);};
const cancelled=signal=>{if(signal?.aborted)fail('PDF_CANCELLED');};
const parser='pdf2json@4.1.0';
const failures=new Set(['PDF_LIMIT_PAGES','PDF_LIMIT_TEXT','PDF_PARSE_FAILED']);
// Process options are a host-only testing seam, never model arguments.
export async function parsePdfBytes(bytes,{signal,timeoutMs=5000,workerUrl=new URL('./pdf-parser-worker.mjs',import.meta.url),onSpawn,onReady}={}){
  cancelled(signal);
  if(!Buffer.isBuffer(bytes))fail('PDF_INVALID_FORMAT');
  if(bytes.length>1048576)fail('PDF_LIMIT_BYTES');
  if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))fail('PDF_INVALID_FORMAT');
  if(/\/Encrypt\b/.test(bytes.toString('latin1')))fail('PDF_ENCRYPTED');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)fail('PDF_INVALID_LIMIT');
  return new Promise((resolveResult,reject)=>{
    let child,timer,cleanupTimer,settled=false,exited=false,wanted,problem;
    const cleanup=()=>{clearTimeout(timer);clearTimeout(cleanupTimer);signal?.removeEventListener('abort',abort);};
    const deliver=()=>{cleanup();problem?reject(error(problem)):resolveResult(wanted);};
    const finish=(code,value)=>{
      if(settled)return;settled=true;problem=code;wanted=value;clearTimeout(timer);
      if(!child||exited){deliver();return;}
      // Successful IPC alone is not process termination. Await the owned exit.
      child.kill('SIGKILL');
      cleanupTimer=setTimeout(()=>{cleanup();reject(error('PDF_CLEANUP_FAILED'));},1000);
    };
    const abort=()=>finish('PDF_CANCELLED');
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>finish('PDF_TIMEOUT'),timeoutMs);
    try{
      cancelled(signal);
      child=fork(fileURLToPath(workerUrl),[],{execPath:process.execPath,execArgv:['--max-old-space-size=128','--disallow-code-generation-from-strings'],serialization:'advanced',stdio:['ignore','ignore','ignore','ipc'],env:{LANG:'C.UTF-8',TZ:'UTC',PDF2JSON_DISABLE_LOGS:'1'}});
      child.once('error',()=>finish('PDF_PARSE_FAILED'));
      child.once('exit',()=>{exited=true;if(settled)deliver();else finish('PDF_PARSE_FAILED');});
      child.on('message',message=>{
        if(settled)return;
        try{
          if(message?.kind==='ready'){onReady?.();return;}
          if(message?.kind==='failure'&&failures.has(message.code)){finish(message.code);return;}
          if(message?.kind!=='parsed'||message.parser!==parser||!Array.isArray(message.pages)||!message.pages.length||message.pages.length>16)throw new Error('protocol');
          let total=0;for(const text of message.pages){if(typeof text!=='string'||text.includes('\0')||Buffer.byteLength(text)>64000)throw new Error('text');total+=Buffer.byteLength(text);}
          if(total>131072)throw new Error('text');
          finish(null,{parser,pages:message.pages});
        }catch{finish('PDF_PARSE_FAILED');}
      });
      onSpawn?.(child.pid);
      cancelled(signal);
      child.send({bytes},sendError=>{if(sendError)finish('PDF_PARSE_FAILED');});
    }catch(e){finish(e.code==='PDF_CANCELLED'?'PDF_CANCELLED':'PDF_PARSE_FAILED');}
  });
}
async function selectedBytes(input,signal){
  cancelled(signal);
  if(Object.keys(input).length===0){
    const fixture=JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8')).documents.text;
    const bytes=Buffer.from(fixture.base64,'base64');if(fixture.synthetic!==true||sha256(bytes)!==fixture.sha256)fail('PDF_FIXTURE_IDENTITY');return{bytes,synthetic:true};
  }
  if(Object.keys(input).length!==1||typeof input.path!=='string'||!input.path||input.path.includes('\0'))fail('PDF_INVALID_INPUT');
  if(extname(input.path).toLowerCase()!=='.pdf')fail('PDF_INVALID_FORMAT');
  let handle;
  try{
    const path=resolve(input.path);if(await realpath(path)!==path)fail('PDF_UNSAFE_FILE');
    // A named pipe must not block before the regular-file check can run.
    handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const before=await handle.stat();
    if(!before.isFile())fail('PDF_UNSAFE_FILE');if(before.size>1048576)fail('PDF_LIMIT_BYTES');
    const buffer=Buffer.alloc(1048577);let offset=0;
    while(offset<buffer.length){cancelled(signal);const{bytesRead}=await handle.read(buffer,offset,buffer.length-offset);if(!bytesRead)break;offset+=bytesRead;}
    if(offset>1048576)fail('PDF_LIMIT_BYTES');const after=await handle.stat();
    if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||after.size!==offset)fail('PDF_CHANGED_DURING_READ');
    return{bytes:buffer.subarray(0,offset),synthetic:false};
  }catch(e){if(typeof e.code==='string'&&e.code.startsWith('PDF_'))throw e;fail(e.code==='ELOOP'?'PDF_UNSAFE_FILE':'PDF_INPUT_UNAVAILABLE');}
  finally{await handle?.close();}
}
export function openPdfInput({input,store}){
  if(!input||typeof input!=='object'||Array.isArray(input)||!store?.put)fail('PDF_INVALID_INPUT');
  const configured=structuredClone(input),lifetime=new AbortController();let pending,artifact,cleanupError;
  const load=signal=>pending??=(async()=>{
    try{const snapshot=await selectedBytes(configured,signal);const parsed=await parsePdfBytes(snapshot.bytes,{signal});return{...snapshot,...parsed};}
    catch(e){if(e.code==='PDF_CLEANUP_FAILED')cleanupError=e;throw e;}
  })();
  return{
    async readPage(page,{signal}={}){
      if(!Number.isSafeInteger(page)||page<1||page>16)fail('PDF_INVALID_PAGE');
      const combined=signal?AbortSignal.any([signal,lifetime.signal]):lifetime.signal;cancelled(combined);
      const value=await load(combined);cancelled(combined);
      if(page>value.pages.length)fail('PDF_INVALID_PAGE');const text=value.pages[page-1];if(!text.trim())fail('PDF_NO_TEXT');
      artifact??=store.put({format:'pdf',content:value.bytes},{signal:combined});const original=await artifact;
      try{
        cancelled(combined);const hash=sha256(value.bytes);
        return validateSource({sourceId:`pdf:${hash}:p${page}`,documentId:`pdf:${hash}`,name:value.synthetic?'Original synthetic local PDF':'Operator-selected local PDF',version:`${parser}:${hash}`,page,text,sha256:sha256(text),mediaType:'text/plain; charset=utf-8',pdf:{originalArtifactId:original.artifactId,originalSha256:hash,originalBytes:value.bytes.length,parser,pageCount:value.pages.length,synthetic:value.synthetic,extraction:'text-layer',visualInspection:'not-performed'}});
      }catch(e){e.artifactEffects=[{kind:'artifact',artifactId:original.artifactId}];throw e;}
    },
    async close(){lifetime.abort();await pending?.catch(()=>{});await artifact?.catch(()=>{});if(cleanupError)throw cleanupError;}
  };
}
