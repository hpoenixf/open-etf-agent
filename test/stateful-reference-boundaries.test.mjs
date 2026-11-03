import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {run} from '../src/runtime.mjs';
import {openSession} from '../src/session.mjs';
import {createToolHost} from '../src/tools.mjs';
import {sha256} from '../src/source.mjs';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'reference-boundaries',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
async function fixture(mode='correct'){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/reference-boundaries-'));let store=await openSession({directory}),calls=0,runId;
 const options={question:'Synthetic source and calculation report.',outputRoot:join(directory,'outputs'),requireReport:true,publication:true,limits:{maxRounds:8,maxTools:8,timeoutMs:30000},durable:{store,grantId:'boundary-reference-grant',bindings,onClaim:v=>{runId=v.runId;}},gateway:{mode:'fixture',async next({messages}){
  calls++;if(calls===1)return call('read','read_page',{documentId:'atlas-a',page:1});
  const source=messages.find(m=>m.callId==='read').result.value.sourceId;
  for(const m of messages)if(m.result?.validation){assert.equal(m.result.validation.basis,undefined,'private basis must not enter model projection');assert.equal(m.result.validation.basisHash,undefined);}
  if(calls===2)return call('bad','save_report',{text:'Initial [C1]',sourceIds:[mode==='unknown-source'?'arbitrary-not-acquired':source]});
  if(calls===3)return call('calc','calculate_change',{baseline:2,current:4,baselineUnit:'rows',currentUnit:'rows'});
  if(calls===4)return call('save','save_report',{text:mode==='second-rejection'?'Still invalid [C2]':'Original [1], calculated [C1].',sourceIds:[source]});
  return{kind:'final',text:'Saved.'};}}};
 return{directory,options,get store(){return store;},get runId(){return runId;},calls:()=>calls,async reopen(){store.close();store=await openSession({directory});},resume(extra={}){return run({...options,...extra,durable:{...options.durable,store,runId,...extra.durable}});},async close(){try{store.close();}finally{await rm(directory,{recursive:true,force:true});}}};
}
async function pause(f,phase='result-committed'){
 const stop=new AbortController();const result=await run({...f.options,hostSignal:stop.signal,durable:{...f.options.durable,onCheckpoint:e=>{if(e.phase===phase&&e.callId==='bad')stop.abort();}}});assert.equal(result.status,'interrupted');assert.equal(result.interruption.effectsStopped,true);assert.equal(result.interruption.leaseReleased,true);return f.store.inspect(result.runId);
}

test('old C1 rejection basis remains calculation-free after genuine later calculation and cold recovery',async()=>{
 const f=await fixture();try{
  const stopped=await pause(f),basis=structuredClone(stopped.snapshot.result.validation.basis);assert.equal(basis.length,1);assert.ok(basis.every(x=>x.kind!=='calculation'));assert.equal(f.calls(),2);
  await f.reopen();const outcome=await f.resume();assert.equal(outcome.status,'completed',outcome.code);assert.equal(f.calls(),5);assert.deepEqual(outcome.rootUsage,{model:5,tool:3});const state=f.store.inspect(outcome.runId),old=state.snapshot.messages.find(m=>m.callId==='bad').result.validation;
  assert.deepEqual(old.basis,basis);assert.ok(state.snapshot.host.results.some(x=>x.kind==='calculation'));assert.equal(state.snapshot.corrections,1);assert.equal(old.basisHash,sha256(JSON.stringify(basis,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)));
  await f.reopen();const cold=await f.resume();assert.equal(cold.status,'completed');assert.deepEqual(cold.receipt,outcome.receipt);assert.equal(f.calls(),5);assert.deepEqual(f.store.inspect(cold.runId).snapshot.messages.find(m=>m.callId==='bad').result.validation.basis,basis);
 }finally{await f.close();}
});

test('arbitrary unknown source identity receives no stateful-reference correction authority',async()=>{
 const f=await fixture('unknown-source');try{const outcome=await run(f.options);assert.equal(outcome.status,'failed');assert.equal(outcome.code,'TOOL_REJECTED');assert.equal(f.calls(),2);const state=f.store.inspect(outcome.runId),bad=state.snapshot.messages.find(m=>m.callId==='bad').result;assert.equal(bad.dispatched,false);assert.equal(bad.validation,undefined);assert.equal(state.snapshot.corrections??0,0);assert.equal(state.snapshot.host.receipt,null);}finally{await f.close();}
});

test('a second stateful-reference rejection cannot expand the single correction allowance',async()=>{
 const f=await fixture('second-rejection');try{const outcome=await run(f.options);assert.equal(outcome.status,'failed');assert.equal(outcome.code,'CORRECTION_LIMIT');assert.equal(f.calls(),4);const state=f.store.inspect(outcome.runId),proofs=state.snapshot.messages.filter(m=>m.result?.validation).map(m=>m.result.validation);assert.equal(proofs.length,2);assert.equal(proofs[0].basis.filter(x=>x.kind==='calculation').length,0);assert.equal(proofs[1].basis.filter(x=>x.kind==='calculation').length,1);assert.equal(state.snapshot.corrections,1);assert.equal(state.snapshot.host.receipt,null);assert.deepEqual(outcome.rootUsage,{model:4,tool:2});}finally{await f.close();}
});

test('restored Host rejects committed basis, call, run, grant and hash forgery without changing the original proof',async()=>{
 const f=await fixture();let host;try{const saved=await pause(f),snapshot=saved.snapshot,original=snapshot.result,originalCall=snapshot.proposal.calls[0];host=await createToolHost({directory:saved.directory,restore:snapshot.host,runIdentity:{runId:saved.runId,grantId:saved.definition.grantId}});await host.verifyResult(originalCall,original);
  for(const mutate of [r=>r.validation.basis=[],r=>r.validation.basis[0].recordSha256='0'.repeat(64),r=>r.validation.basisHash='0'.repeat(64),r=>r.validation.runId='foreign-run',r=>r.validation.grantId='foreign-grant',r=>r.validation.requestHash='0'.repeat(64),r=>r.callId='foreign-call']){const altered=structuredClone(original);mutate(altered);await assert.rejects(host.verifyResult(originalCall,altered),{code:'RECOVERY_CHECKPOINT_MISMATCH'});}
  await assert.rejects(host.verifyResult({...originalCall,id:'foreign-call'},original),{code:'RECOVERY_CHECKPOINT_MISMATCH'});await host.verifyResult(originalCall,original);assert.deepEqual(f.store.inspect(saved.runId).snapshot.result,original);assert.equal(f.calls(),2);
 }finally{await host?.close();await f.close();}
});

test('corrupted original Result record cannot validate a previously committed reference basis',async()=>{
 const f=await fixture();let host;try{const saved=await pause(f),descriptor=saved.snapshot.result.validation.basis[0];host=await createToolHost({directory:saved.directory,restore:saved.snapshot.host,runIdentity:{runId:saved.runId,grantId:saved.definition.grantId}});await writeFile(join(saved.directory,descriptor.recordPath),'{}\n');await assert.rejects(host.verifyResult(saved.snapshot.proposal.calls[0],saved.snapshot.result),/Corrupt record snapshot hash/);assert.equal(f.calls(),2);assert.equal(f.store.inspect(saved.runId).status,'active');}finally{await host?.close();await f.close();}
});

test('original Session anchors first reference rejection to its prior proposal Host basis and rejects forged transition',async()=>{
 const f=await fixture();let host,claim;try{const prior=await pause(f,'proposal-sealed');claim=f.store.claim(prior.runId,'boundary-transition-owner');host=await createToolHost({directory:prior.directory,restore:prior.snapshot.host,runIdentity:{runId:prior.runId,grantId:prior.definition.grantId},canOfferReferenceCorrection:()=>{const s=claim.read().snapshot;return s.phase==='proposal-sealed'&&s.cursor===0&&s.proposal?.calls?.length===1&&!s.inFlight&&!s.partialEffects.length&&!s.unknownEffects.length&&s.gatewayOutcome==='settled';}});const originalCall=prior.snapshot.proposal.calls[0],result=await host.execute(originalCall);assert.equal(result.dispatched,false);assert.equal(result.validation.schemaVersion,'builtin-report-reference-validation@1');const valid={...structuredClone(prior.snapshot),phase:'result-committed',result,host:host.snapshot(),inFlight:null};
  for(const mutate of [s=>s.result.validation.basis=[],s=>s.result.validation.runId='foreign-run',s=>s.result.validation.grantId='foreign-grant',s=>s.result.validation.requestHash='0'.repeat(64),s=>s.proposal.calls[0].id='foreign-call',s=>s.host.saveAttempted=true]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>claim.checkpoint(bad),{code:'REFERENCE_CORRECTION_TRANSITION'});assert.equal(f.store.inspect(prior.runId).snapshot.phase,'proposal-sealed');}
  claim.checkpoint(valid);assert.deepEqual(f.store.inspect(prior.runId).snapshot.result.validation.basis,prior.snapshot.host.results);assert.equal(f.calls(),2);
 }finally{try{claim?.release();await host?.close();}finally{await f.close();}}
});

test('original PDF integrity failure outranks out-of-range reference correction and cannot request another model',async()=>{
 const {preparePdfSnapshot}=await import('../src/pdf-input.mjs');const {openArtifactStore}=await import('../src/artifacts.mjs');
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/reference-pdf-integrity-'));let store,calls=0,original,corrupted=false;
 try{const snapshot=await preparePdfSnapshot();store=await openSession({directory:join(directory,'session')});
 const out=await run({question:'Synthetic original PDF report.',pdfInput:{snapshot},requireReport:true,publication:true,outputRoot:join(directory,'runs'),allowedTools:['read_pdf_page','save_report'],limits:{maxRounds:5,maxTools:4,timeoutMs:30000},gateway:{mode:'fixture',async next({messages}){
 calls++;if(calls===1)return call('pdf','read_pdf_page',{page:3});assert.equal(calls,2,'integrity rejection must not offer a correction model round');original=messages.find(m=>m.callId==='pdf').result.value;assert.ok(original.pdf.originalArtifactId);return call('save','save_report',{text:'Original physical page [1], unavailable calculation [C2].',sourceIds:[original.sourceId]});
 }},durable:{store,grantId:'pdf-reference-integrity',bindings,onCheckpoint:async e=>{if(e.phase==='proposal-sealed'&&e.callId==='save'){const artifacts=await openArtifactStore({directory:e.directory});const pdf=await artifacts.read(original.pdf.originalArtifactId);await writeFile(join(e.directory,pdf.contentPath),Buffer.from('%PDF-corrupt-owned-synthetic'));corrupted=true;}}}});
 assert.equal(corrupted,true);assert.equal(out.status,'failed');assert.equal(out.code,'TOOL_REJECTED');assert.equal(calls,2);const saved=store.inspect(out.runId),rejected=saved.snapshot.messages.find(m=>m.callId==='save').result;
 assert.equal(rejected.dispatched,false);assert.equal(rejected.validation,undefined);assert.match(rejected.error,/Artifact identity or bytes mismatch/);assert.equal(saved.snapshot.corrections??0,0);assert.equal(saved.snapshot.host.receipt,null);assert.equal(saved.snapshot.host.saveAttempted,false);assert.equal(out.receipt,null);
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});
