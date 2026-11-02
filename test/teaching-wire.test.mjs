import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {createChatGateway,normalizeChatCompletion} from '../src/gateway.mjs';
import {readChatStream} from '../src/stream.mjs';
import {openArtifactStore} from '../src/artifacts.mjs';
const completion=(message,finish_reason='stop')=>({choices:[{index:0,finish_reason,message:{role:'assistant',...message}}]});
const call=(id,name,args)=>completion({content:null,tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
test('teaching wire: escaped report arguments keep original source, immutable receipt and bytes',async()=>{
 await mkdir('test-output',{recursive:true});const outputRoot=await mkdtemp(resolve('test-output/teaching-wire-')),text='"'.repeat(63000);let requests=0;
 const gateway=createChatGateway({endpoint:'https://synthetic.invalid/v1/chat/completions',model:'teaching',apiKey:'synthetic',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:async(_u,request)=>{const body=JSON.parse(request.body);requests++;const result=requests===1?call('read','read_page',{documentId:'atlas-a',page:1}):requests===2?call('save','save_report',{text,sourceIds:[JSON.parse(body.messages.at(-1).content).value.sourceId]}):completion({content:'Saved.'});return new Response(JSON.stringify(result));}});
 const result=await run({question:'Save the exact escaped synthetic lesson.',gateway,outputRoot,requireReport:true});assert.equal(result.status,'completed',result.code);assert.equal(requests,3);const bytes=await readFile(join(result.directory,'report.md'));assert.equal(bytes.subarray(0,Buffer.byteLength(text)).toString(),text);const store=await openArtifactStore({directory:result.directory,readOnly:true});assert.deepEqual((await store.read(result.receipt.artifactId)).bytes,bytes);
 assert.equal(normalizeChatCompletion(call('typed','save_report',{text})).kind,'calls');assert.throws(()=>normalizeChatCompletion(completion({content:'unfinished'},'length')));
});
test('teaching wire: many complete SSE frames accept same text while explicit small cap still rejects',async()=>{
 const frame=s=>'data: '+JSON.stringify({choices:[{index:0,delta:{content:s},finish_reason:null}]})+'\n\n';const raw=frame('学').repeat(4000)+'data: '+JSON.stringify({choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';const bytes=Buffer.from(raw);assert.ok(bytes.length>262144);
 const body=()=>new ReadableStream({start(c){c.enqueue(bytes);c.close();}});const result=await readChatStream(body());assert.equal(result.text,'学'.repeat(4000));await assert.rejects(readChatStream(body(),{maxBytes:1024}));
});
