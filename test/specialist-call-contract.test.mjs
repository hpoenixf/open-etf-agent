import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {openSession} from '../src/session.mjs';
import {run} from '../src/runtime.mjs';
import {createSpecialistChildBinding,sourceCheckBinding} from '../src/specialist-child.mjs';
import {CLAIM_COMPARISON_METHOD} from '../src/child.mjs';
for(const method of [undefined,CLAIM_COMPARISON_METHOD])test('serial Child pairs a mixed refusal before dispatch and rejects repeated IDs '+(method?.id??'legacy'),async t=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/child-call-contract-'));const store=await openSession({directory:dir});t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});let token,childRequests=0;const question='Read the original selected source.',documents=['atlas-a'];
 const binding=createSpecialistChildBinding({store,parentClaim:()=>token,question,documents,method,outputRoot:join(dir,'runs'),gatewayFactory:()=>({mode:'fixture',next:()=>{childRequests++;return{kind:'final',text:'Must not run'};}})});assert.match(binding.description,/only tool call in this assistant response/);assert.match(binding.description,/Do not batch it with read_page/);
 const result=await run({question,gateway:{mode:'fixture',next:()=>({kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:'atlas-a',page:1}},{id:'child',name:'source_check',arguments:{question:'Check the source.'}}]})},extensions:[binding],allowedTools:['read_page','source_check'],allowedDocuments:documents,requireReport:false,outputRoot:join(dir,'runs'),limits:{maxRounds:3,maxTools:3,timeoutMs:5000},durable:{store,grantId:'synthetic-call-contract',bindings:{gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture',model:'contract',version:'1'},plugins:[],adapters:[sourceCheckBinding({question,documents,method})]},rootLimits:{model:6,tool:6},onClaim:value=>token=value}});
 assert.equal(result.status,'failed');assert.equal(result.code,'DUPLICATE_CALL_ID');assert.equal(result.rootUsage.tool,0);assert.equal(store.inspect(result.runId).snapshot.corrections,1);assert.equal(childRequests,0);const messages=store.inspect(result.runId).snapshot.messages;assert.equal(messages.filter(m=>m.role==='tool').length,2);assert.ok(messages.filter(m=>m.role==='tool').every(m=>m.result.status==='rejected'&&m.result.dispatched===false));assert.equal(messages.filter(m=>m.role==='tool')[0].result.error,'GROUP_NOT_DISPATCHED');const rejected=messages.filter(m=>m.role==='tool').at(-1).result;assert.equal(rejected.error,'SPECIALIST_SINGLE_CALL_REQUIRED');assert.equal(rejected.dispatched,false);
});
