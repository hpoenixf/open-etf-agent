import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalEmbeddingBackend} from '../src/local-embedding-process.mjs';
import {encodeTypedInputs} from '../src/embedding-protocol.mjs';
const identity={model:'synthetic',manifestSha256:'a'.repeat(64)};
const script=`let b='';process.stdin.on('data',c=>{b+=c;let n;while((n=b.indexOf('\\n'))>=0){let r=JSON.parse(b.slice(0,n));b=b.slice(n+1);process.stdout.write(JSON.stringify({id:r.id,manifestSha256:r.manifestSha256,result:r.operation==='tokenize'?{tokenIds:[1,2],truncated:false}:{vector:r.operation==='document'?[1,0]:[0,1],truncated:false,tokenIdsSha256:r.input.tokenIdsSha256}})+'\\n');}});`;
const config=extra=>({command:process.execPath,args:['-e',script],identity,maxTokens:8,timeoutMs:500,...extra});
test('local JSONL process preserves roles and identities without HTTP',async t=>{const b=createLocalEmbeddingBackend(config());t.after(()=>b.close());const r=await encodeTypedInputs({inputs:[{kind:'document',id:'d',text:'cash'},{kind:'query',id:'q',text:'cash'}],dimensions:2,backend:b});assert.deepEqual(r.map(r=>r.vector),[[1,0],[0,1]]);assert.equal(b.identity.manifestSha256,identity.manifestSha256);});
test('timeout closes backend permanently; no implicit respawn',async()=>{const b=createLocalEmbeddingBackend(config({args:['-e','process.stdin.resume()'],timeoutMs:30}));await assert.rejects(b.tokenize({text:'x'}),{code:'EMBEDDING_PROCESS_TIMEOUT'});await assert.rejects(b.tokenize({text:'x'}),{code:'EMBEDDING_PROCESS_CLOSED'});});
test('cancellation, oversized input and output are bounded',async()=>{const b=createLocalEmbeddingBackend(config({maxInputBytes:128}));await assert.rejects(b.tokenize({text:'x'.repeat(500)}),{code:'EMBEDDING_PROCESS_INPUT_LIMIT'});b.close();const c=createLocalEmbeddingBackend(config({args:['-e',`process.stdin.once('data',()=>process.stdout.write('x'.repeat(1025)))`],maxOutputBytes:1024}));await assert.rejects(c.tokenize({text:'x'}),{code:'EMBEDDING_PROCESS_OUTPUT_LIMIT'});const d=createLocalEmbeddingBackend(config());await assert.rejects(d.tokenize({text:'x',signal:AbortSignal.abort()}));d.close();});
test('identity mismatch and malformed output fail closed',async()=>{for(const code of [`console.log('bad')`,`process.stdin.once('data',()=>console.log(JSON.stringify({id:1,manifestSha256:'wrong',result:{}})))`]){const b=createLocalEmbeddingBackend(config({args:['-e',code]}));await assert.rejects(b.tokenize({text:'x'}));await assert.rejects(b.tokenize({text:'x'}),{code:'EMBEDDING_PROCESS_CLOSED'});}});
test('mid-request cancellation kills child and prevents later reuse',async()=>{const b=createLocalEmbeddingBackend(config({args:['-e','process.stdin.resume()']})),c=new AbortController();const p=b.tokenize({text:'x',signal:c.signal});c.abort();await assert.rejects(p,{code:'EMBEDDING_PROCESS_CANCELLED'});await assert.rejects(b.tokenize({text:'x'}),{code:'EMBEDDING_PROCESS_CLOSED'});});
test('sparse command arguments rejected before process spawn',()=>{assert.throws(()=>createLocalEmbeddingBackend(config({args:[,]})),{code:'EMBEDDING_PROCESS_CONFIG'});});
test('JSON null, primitives and arrays reject without crashing the host',async()=>{
 const {spawnSync}=await import('node:child_process');
 for(const value of ['null','true','1','"text"','[]']){
  const childCode=`import {createLocalEmbeddingBackend} from './src/local-embedding-process.mjs'; const b=createLocalEmbeddingBackend(${JSON.stringify(config({args:['-e',`process.stdin.once('data',()=>console.log(${JSON.stringify(value)}))`]}))});try {await b.tokenize({text:'x'});process.exitCode=9;} catch(e){if(e.code!=='EMBEDDING_PROCESS_PROTOCOL')process.exitCode=8;}finally{b.close();}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',childCode],{encoding:'utf8',timeout:3000});assert.equal(child.status,0,`${value}: ${child.stderr}`);
 }
});
test('wrong result shape and extra response fields fail closed',async()=>{
 for(const change of [{result:null},{result:[]},{result:{tokenIds:[],truncated:false,extra:1}},{extra:1}]){
  const code=`process.stdin.once('data',c=>{const r=JSON.parse(c);console.log(JSON.stringify({...{id:r.id,manifestSha256:r.manifestSha256,result:{tokenIds:[1],truncated:false}},...${JSON.stringify(change)}}));});`;
  const b=createLocalEmbeddingBackend(config({args:['-e',code]}));await assert.rejects(b.tokenize({text:'x'}),{code:'EMBEDDING_PROCESS_PROTOCOL'});b.close();
 }
});
