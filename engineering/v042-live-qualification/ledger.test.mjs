import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {newLedgers,frozenPlan,PLAN_SHA} from './run.mjs';

const endpoint='https://opencode.ai/inference/go/openai/v1/chat/completions';
const runId='conversation-'+'a'.repeat(40);
const ctx=(modelOrdinal=1)=>({runId,rootId:runId,modelOrdinal,role:'main',purpose:'main',inputHash:'b'.repeat(64)});
const opts={method:'POST',redirect:'error',body:'private never exported',headers:{authorization:'Bearer synthetic-never-leak'}};
async function folder(t){
 await mkdir('test-output',{recursive:true});
 const root=await mkdtemp(resolve('test-output/witness-'));t.after(()=>rm(root,{recursive:true,force:true}));return join(root,'new-cohort');
}
test('the locked manifest has ten distinct logical cases and exact same watch question',async()=>{
 const plan=await frozenPlan();assert.match(PLAN_SHA,/^[a-f0-9]{64}$/);
 assert.equal(plan.priorExcludedPhysicalPosts,6);
 assert.equal(plan.maxPhysicalPosts,49994);
 assert.equal(plan.cases[2].sameAs,'01');
 assert.equal(plan.cases[0].day,plan.cases[1].day);
 assert.equal(plan.cases[1].operation,'new');
 assert.equal(plan.cases[3].operation,'edit');
});
test('append is fsynced before fake upstream is called; duplicates, overage and foreign URL never dispatch',async t=>{
 const directory=await folder(t);let dispatches=0;let ledger;
 ledger=await newLedgers(directory,{physicalCap:1,async fetchOriginal(){
  dispatches++;
  const fields=(await readFile(join(directory,'provider.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(fields.map(x=>x.event),['before_provider_post']);
  assert.equal(fields[0].postingOrdinal,1);
  assert.doesNotMatch(JSON.stringify(fields),/private|authorization|synthetic-never-leak/);
  return new Response('{}',{status:200});
 }});t.after(()=>ledger.close());
 ledger.setCase('01');
 await assert.rejects(ledger.fetch('https://different.example',opts,ctx()),/SCOPE_OR_NATIVE_WITNESS_INVALID/);
 await ledger.fetch(endpoint,opts,ctx());
 await assert.rejects(ledger.fetch(endpoint,opts,ctx()),/DUPLICATE_PHYSICAL_REQUEST_REFUSED/);
 await assert.rejects(ledger.fetch(endpoint,opts,ctx(2)),/AUTHORIZED_PHYSICAL_CAP_EXHAUSTED/);
 assert.equal(dispatches,1);assert.equal(ledger.count,1);
 assert.equal(ledger.requests(runId)[0].httpStatus,200);
 await assert.rejects(newLedgers(directory,{physicalCap:1}),{code:'EEXIST'});
});
test('unknown transport remains one physical witness with no body or exception leaked',async t=>{
 const dir=await folder(t);let attempts=0;
 const ledger=await newLedgers(dir,{physicalCap:2,async fetchOriginal(){attempts++;throw new TypeError('provider private raw exception');}});
 t.after(()=>ledger.close());
 ledger.setCase('03');
 await assert.rejects(ledger.fetch(endpoint,opts,ctx()),TypeError);
 await assert.rejects(ledger.fetch(endpoint,opts,ctx()),/DUPLICATE_PHYSICAL_REQUEST_REFUSED/);
 assert.equal(attempts,1);
 assert.equal(ledger.requests(runId)[0].httpStatus,undefined);
 const log=await readFile(join(dir,'provider.jsonl'),'utf8');
 assert.match(log,/remote_post_outcome_unknown/);
 assert.doesNotMatch(log,/provider private|private never exported|synthetic-never-leak/);
});
