import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openSession} from '../src/session.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const checkpoint=(phase='ready',extra={})=>({schemaVersion:'runtime-checkpoint@1',phase,...extra});
const definition=()=>({question:'Synthetic task',grantId:'test-grant',bindings:{gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'test',version:'1'},plugins:[],adapters:[]},limits:{maxRounds:10,maxTools:10,timeoutMs:10000},rootLimits:{model:10,tool:10},deadlineAt:10000,config:{}});
async function setup(t,name='spawn_child'){
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/child-operation-'));
 const store=await openSession({directory,clock:()=>100,leaseMs:1000});t.after(()=>store.close());
 const parent=store.create({runId:'parent',directory,definition:definition(),snapshot:checkpoint()}),claim=store.claim(parent.runId,'owner');
 const call={id:'original-operation',name,arguments:name==='spawn_child'?{methodId:'synthetic',question:'Question',documents:['atlas-a']}:{childRunId:'child'}};
 const child=store.create({runId:'child',parentRunId:'parent',parentClaim:claim,directory,definition:{...definition(),config:{taskId:'execution-'+sha(call.id).slice(0,48)}},snapshot:checkpoint()});
 const token={runId:'parent',owner:claim.owner,fence:claim.fence},snapshot=checkpoint('tool-dispatched',{messages:[{role:'assistant',calls:[call]}],proposal:{kind:'calls',calls:[call]},cursor:0,inFlight:{callId:call.id,name:call.name}});
 claim.checkpoint(snapshot);return {store,directory,claim,call,child,token,snapshot};
}
for(const name of ['spawn_child','inspect_child','cancel_child'])test('Child operation immutable '+name+' survives mutable lifecycle and readonly reopen',async t=>{
 const h=await setup(t,name),input={call:h.call,childRunId:'child',value:{status:'active',sources:[]}};
 assert.equal(h.store.childOperation('parent',h.call.id),null);
 const fact=h.store.commitChildOperation(h.token,input);assert.deepEqual(fact.value,input.value);assert.equal(fact.requestHash.length,64);
 assert.deepEqual(h.store.commitChildOperation(h.token,input),fact);
 h.store.cancelChild('parent','child');assert.deepEqual(h.store.childOperation('parent',h.call.id),fact);
 h.claim.release();h.store.close();const read=await openSession({directory:h.directory,readOnly:true,clock:()=>100});try{assert.deepEqual(read.childOperation('parent',h.call.id),fact);assert.equal(read.commitChildOperation,undefined);}finally{read.close();}
});
test('Child receipt rejects changed call/value/target, wrong phase and stale writer',async t=>{
 const h=await setup(t),input={call:h.call,childRunId:'child',value:{status:'active'}};
 assert.throws(()=>h.store.commitChildOperation({...h.token,fence:99},input),/STALE_WRITER/);
 assert.throws(()=>h.store.commitChildOperation(h.token,{...input,call:{...h.call,id:'other'}}),/CALL_MISMATCH/);
 h.claim.checkpoint({...h.snapshot,phase:'proposal-sealed'});assert.throws(()=>h.store.commitChildOperation(h.token,input),/CALL_MISMATCH/);h.claim.checkpoint(h.snapshot);
 h.store.commitChildOperation(h.token,input);
 assert.throws(()=>h.store.commitChildOperation(h.token,{...input,value:{status:'completed'}}),/CONFLICT/);
 assert.throws(()=>h.store.commitChildOperation(h.token,{...input,childRunId:'parent'}),/SCOPE_MISMATCH/);
 h.store.cancel('parent');assert.throws(()=>h.store.commitChildOperation(h.token,input),/RUN_CANCELLED/);
});
test('Child receipt lookup on legacy database remains readonly and does not add schema',async t=>{
 const h=await setup(t);h.claim.release();h.store.close();const read=await openSession({directory:h.directory,readOnly:true,clock:()=>100});assert.equal(read.childOperation('parent','absent'),null);read.close();
 const db=new DatabaseSync(join(h.directory,'session.sqlite'),{readOnly:true});try{assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='child_operation_receipts'").get().n,0);}finally{db.close();}
});
test('tampered Child observation is rejected on writable and readonly admission',async t=>{
 const h=await setup(t);h.store.commitChildOperation(h.token,{call:h.call,childRunId:'child',value:{status:'active'}});h.claim.release();h.store.close();
 const db=new DatabaseSync(join(h.directory,'session.sqlite'));try{const row=db.prepare('SELECT fact FROM child_operation_receipts').get(),f=JSON.parse(row.fact);f.value.status='completed';db.prepare('UPDATE child_operation_receipts SET fact=?').run(JSON.stringify(f));}finally{db.close();}
 for(const readOnly of [false,true])await assert.rejects(openSession({directory:h.directory,readOnly,clock:()=>100}),/INVALID_CHILD_OPERATION_RECEIPT/);
});
