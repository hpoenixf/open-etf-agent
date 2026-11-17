import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeTypedInputs} from '../src/embedding-protocol.mjs';
const inputs=[{kind:'document',id:'doc:p1',text:'same'},{kind:'query',id:'query:1',text:'same'}];
function backend(events=[]){return {maxTokens:3,tokenize:async r=>{events.push(['tokenize',r.kind,r.truncation]);return {tokenIds:[1,2,3],truncated:false};},encodeDocument:async r=>{events.push(['document',r.id]);return {vector:[1,0],tokenIdsSha256:r.tokenIdsSha256,truncated:false};},encodeQuery:async r=>{events.push(['query',r.id]);return {vector:[0,1],tokenIdsSha256:r.tokenIdsSha256,truncated:false};}};}
test('typed roles remain distinct and tokenize without truncation',async()=>{const events=[];const r=await encodeTypedInputs({inputs,dimensions:2,backend:backend(events)});assert.deepEqual(r.map(v=>v.vector),[[1,0],[0,1]]);assert.deepEqual(events,[['tokenize','document',false],['tokenize','query',false],['document','doc:p1'],['query','query:1']]);assert.notEqual(r[0].inputSha256,r[1].inputSha256);});
test('preflight entire batch rejects oversized input before any encode',async()=>{let calls=0;const b=backend();b.tokenize=async r=>({tokenIds:r.kind==='query'?[1,2,3,4]:[1],truncated:false});b.encodeDocument=async()=>{calls++;};await assert.rejects(encodeTypedInputs({inputs,dimensions:2,backend:b}),{code:'EMBEDDING_TOKEN_LIMIT'});assert.equal(calls,0);});
test('missing or explicit tokenizer truncation evidence is rejected',async()=>{for(const truncated of [true,undefined]){const b=backend();b.tokenize=async()=>({tokenIds:[1],truncated});await assert.rejects(encodeTypedInputs({inputs,dimensions:2,backend:b}),{code:'EMBEDDING_TRUNCATION'});}});
test('encoder must account for exact preflight tokens without truncation',async()=>{for(const change of [{truncated:true},{tokenIdsSha256:'changed'},{vector:[0,0]}]){const b=backend();b.encodeDocument=async r=>({vector:[1,0],tokenIdsSha256:r.tokenIdsSha256,truncated:false,...change});await assert.rejects(encodeTypedInputs({inputs,dimensions:2,backend:b}));}});
test('invalid roles and pre-cancelled requests never tokenize',async()=>{let calls=0;const b=backend();b.tokenize=async()=>{calls++;};await assert.rejects(encodeTypedInputs({inputs:[{...inputs[0],kind:'text'}],dimensions:2,backend:b}));await assert.rejects(encodeTypedInputs({inputs,dimensions:2,backend:b,signal:AbortSignal.abort()}));assert.equal(calls,0);});
test('leading, trailing and middle holes fail before any adapter callback',async()=>{
 const inherited=new Array(2);inherited[1]=inputs[1];Object.setPrototypeOf(inherited,Object.assign(Object.create(Array.prototype),{0:inputs[0]}));
 for(const batch of [new Array(1),[,inputs[0]],[inputs[0],,],[inputs[0],,inputs[1]],inherited]){
  const events=[];await assert.rejects(encodeTypedInputs({inputs:batch,dimensions:2,backend:backend(events)}),{code:'EMBEDDING_PROTOCOL_INVALID'});assert.deepEqual(events,[]);
 }
});
test('mixed valid and invalid entries fail before any adapter callback',async()=>{
 for(const invalid of [undefined,null,{...inputs[1],kind:'text'},{...inputs[1],text:''}])for(const batch of [[invalid,inputs[0]],[inputs[0],invalid],[inputs[0],invalid,inputs[1]]]){
  const events=[];await assert.rejects(encodeTypedInputs({inputs:batch,dimensions:2,backend:backend(events)}),{code:'EMBEDDING_PROTOCOL_INVALID'});assert.deepEqual(events,[]);
 }
});
