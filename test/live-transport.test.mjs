import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openLiveLedger,createControlledFetch} from '../src/live-transport.mjs';
const configuration={endpoint:'https://provider.example.invalid/v1/chat/completions',model:'synthetic-model',apiKey:'synthetic-not-real-key'};
const body=()=>JSON.stringify({model:configuration.model,stream:false,n:1,messages:[{role:'user',content:'Original synthetic fixture acceptance.'}],tools:[]});
const init=()=>({method:'POST',headers:{authorization:'Bearer '+configuration.apiKey,'content-type':'application/json'},body:body()});
async function ledger(options={}){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/live-ledger-'));return{directory,ledger:await openLiveLedger({directory,...options})};}
test('5.9 actual dispatch reserves first and adds honest identity/session and output bound',async()=>{
 const state=await ledger();let seen;try{const wrapped=createControlledFetch({configuration,ledger:state.ledger,version:'v01',pin:'a'.repeat(40),sessionId:'synthetic-session',fetchImpl:async(url,options)=>{assert.equal((await state.ledger.snapshot()).attempts.length,1);seen=options;return Response.json({choices:[],usage:{prompt_tokens:100,completion_tokens:20,cost:0,opencode:{billing_source:'go',allowance:0.001,list_cost:0.001}}});}});await wrapped(configuration.endpoint,init());assert.equal(JSON.parse(seen.body).max_tokens,2048);const headers=new Headers(seen.headers);assert.match(headers.get('user-agent'),/^open-etf-agent-validation\//);assert.equal(headers.get('x-opencode-session'),'synthetic-session');assert.equal(seen.redirect,'error');const attempt=(await state.ledger.snapshot()).attempts[0];assert.equal(attempt.reserveCny,100);assert.equal(attempt.observation.costUsd,0);assert.equal(attempt.observation.billingSource,'go');assert.equal(attempt.observation.allowanceUsd,0.001);}finally{await state.ledger.close();}
});
test('5.9 changed endpoint/model and oversized input refuse before any dispatch or reservation',async()=>{
 const state=await ledger();let calls=0;try{const wrapped=createControlledFetch({configuration,ledger:state.ledger,version:'v01',pin:'a'.repeat(40),sessionId:'synthetic-session',fetchImpl:async()=>{calls++;return Response.json({});}});await assert.rejects(wrapped('https://other.example.invalid/v1/chat/completions',init()),/LIVE_SCOPE/);await assert.rejects(wrapped(configuration.endpoint,{...init(),body:JSON.stringify({...JSON.parse(body()),model:'other'})}),/LIVE_SCOPE/);await assert.rejects(wrapped(configuration.endpoint,{...init(),body:JSON.stringify({...JSON.parse(body()),messages:[{role:'user',content:'x'.repeat(40000)}]})}),/LIVE_INPUT_LIMIT/);assert.equal(calls,0);assert.equal((await state.ledger.snapshot()).attempts.length,0);}finally{await state.ledger.close();}
});
test('5.9 one version cannot exceed eight reserved requests and reopen retains unknown cost',async()=>{
 const state=await ledger();try{for(let i=0;i<8;i++)await state.ledger.reserve({version:'v01',pin:'a'.repeat(40),requestBytes:100});await assert.rejects(state.ledger.reserve({version:'v01',pin:'a'.repeat(40),requestBytes:100}),/REQUEST_LIMIT/);}finally{await state.ledger.close();}
 const reopened=await openLiveLedger({directory:state.directory});try{const snapshot=await reopened.snapshot();assert.equal(snapshot.attempts.length,8);assert.equal(snapshot.reservedCny,800);assert.ok(snapshot.attempts.every(a=>a.observation===null));}finally{await reopened.close();}
});
test('5.9 hard cumulative allowance refuses before exceeding the configured lower test cap',async()=>{
 const state=await ledger({capCny:200});try{await state.ledger.reserve({version:'v01',pin:'a'.repeat(40),requestBytes:100});await state.ledger.reserve({version:'v02',pin:'b'.repeat(40),requestBytes:100});await assert.rejects(state.ledger.reserve({version:'v03',pin:'c'.repeat(40),requestBytes:100}),/COST_LIMIT/);assert.equal((await state.ledger.snapshot()).reservedCny,200);}finally{await state.ledger.close();}
});
test('5.9 provider rejection is observed once and prevents automatic/following retry',async()=>{
 const state=await ledger();let calls=0;try{const wrapped=createControlledFetch({configuration,ledger:state.ledger,version:'v01',pin:'a'.repeat(40),sessionId:'synthetic-session',fetchImpl:async()=>{calls++;return Response.json({error:'synthetic quota refusal'},{status:429});}});const response=await wrapped(configuration.endpoint,init());assert.equal(response.status,429);await assert.rejects(wrapped(configuration.endpoint,init()),/PROVIDER_STOPPED/);assert.equal(calls,1);const snapshot=await state.ledger.snapshot();assert.equal(snapshot.attempts[0].observation.httpStatus,429);assert.equal(snapshot.reservedCny,100);}finally{await state.ledger.close();}
});

test('5.9 reopen blocks a prior unsettled reservation as unknown rather than resuming calls',async()=>{
 const state=await ledger();try{await state.ledger.reserve({version:'v01',pin:'a'.repeat(40),requestBytes:100});}finally{await state.ledger.close();}
 const reopened=await openLiveLedger({directory:state.directory});try{const snapshot=await reopened.snapshot();assert.equal(snapshot.attempts[0].outcome,'unknown-from-prior-owner');assert.equal(snapshot.blocked,true);await assert.rejects(reopened.reserve({version:'v02',pin:'b'.repeat(40),requestBytes:100}),/PROVIDER_STOPPED/);assert.equal((await reopened.snapshot()).reservedCny,100);}finally{await reopened.close();}
});
