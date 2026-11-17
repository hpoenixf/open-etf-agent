import {sha256} from './source.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hash=v=>sha256(JSON.stringify(v));
/** Offline typed adapter contract. No transport, acquisition, retry or billing.
 * Tokenization must include model-specific prompts and special tokens. Encoders
 * consume these exact prepared tokens, not a second silently truncating pass.
 * Adapter receipts are assertions, not proof of an honest external provider.
 */
export async function encodeTypedInputs({inputs,dimensions,backend,signal}={}){
 signal?.throwIfAborted();
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>1040||!Number.isSafeInteger(dimensions)||dimensions<1||dimensions>1024||!backend||!Number.isSafeInteger(backend.maxTokens)||backend.maxTokens<1||backend.maxTokens>1048576||['tokenize','encodeDocument','encodeQuery'].some(k=>typeof backend[k]!=='function'))fail('EMBEDDING_PROTOCOL_INVALID');
 // map skips holes and can accept inherited indices. Validate the entire dense
 // input envelope before a tokenizer (which may itself have effects) is called.
 for(let i=0;i<inputs.length;i++)if(!Object.hasOwn(inputs,i))fail('EMBEDDING_PROTOCOL_INVALID');
 const seen=new Set();
 const frozen=inputs.map(v=>{
  if(!v||!['document','query'].includes(v.kind)||typeof v.id!=='string'||!v.id||v.id.length>256||typeof v.text!=='string'||!v.text.trim()||Buffer.byteLength(v.text)>(v.kind==='query'?512:64000)||seen.has(`${v.kind}:${v.id}`))fail('EMBEDDING_PROTOCOL_INVALID');
  seen.add(`${v.kind}:${v.id}`);return Object.freeze({kind:v.kind,id:v.id,text:v.text});
 });
 if(Buffer.byteLength(JSON.stringify(frozen))>2097152)fail('EMBEDDING_INPUT_LIMIT');
 // Capture capabilities before callbacks; reject the whole batch before encoding.
 const maxTokens=backend.maxTokens,tokenize=backend.tokenize.bind(backend),document=backend.encodeDocument.bind(backend),query=backend.encodeQuery.bind(backend),prepared=[];
 for(const input of frozen){
  signal?.throwIfAborted();
  const tokens=await tokenize(Object.freeze({...input,truncation:false,signal}));
  signal?.throwIfAborted();
  if(tokens?.truncated!==false)fail('EMBEDDING_TRUNCATION');
  if(!Array.isArray(tokens.tokenIds)||!tokens.tokenIds.length||Array.from(tokens.tokenIds).some(n=>!Number.isSafeInteger(n)||n<0))fail('EMBEDDING_PROTOCOL_INVALID');
  if(tokens.tokenIds.length>maxTokens)fail('EMBEDDING_TOKEN_LIMIT');
  const tokenIds=Object.freeze([...tokens.tokenIds]);
  prepared.push(Object.freeze({...input,tokenIds,tokenIdsSha256:hash(tokenIds),inputSha256:hash(input),truncation:false,signal}));
 }
 const result=[];
 for(const input of prepared){
  signal?.throwIfAborted();
  const encoded=await (input.kind==='document'?document:query)(input);
  signal?.throwIfAborted();
  if(encoded?.truncated!==false||encoded.tokenIdsSha256!==input.tokenIdsSha256)fail('EMBEDDING_TRUNCATION');
  const v=encoded.vector;
  if(!Array.isArray(v)||v.length!==dimensions||Array.from(v).some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e10)||!v.some(n=>n!==0))fail('EMBEDDING_RESPONSE_INVALID');
  result.push(Object.freeze({kind:input.kind,id:input.id,inputSha256:input.inputSha256,tokenIdsSha256:input.tokenIdsSha256,tokenCount:input.tokenIds.length,vector:Object.freeze([...v])}));
 }
 return Object.freeze(result);
}
