import test from 'node:test';import assert from 'node:assert/strict';import{mkdir,mkdtemp,rm}from'node:fs/promises';import{join,resolve}from'node:path';import{DatabaseSync}from'node:sqlite';
import{openSession}from'../src/session.mjs';import{run}from'../src/runtime.mjs';import{INTERACTION_PROFILE,INTERACTION_BINDING}from'../src/human-interaction.mjs';
for(const variant of ['receipt-text','question-hash','ordinal','paired-result'])test('cold reader refuses interaction history tampering: '+variant,async()=>{await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/interaction-integrity-'));let store=await openSession({directory:dir,profile:INTERACTION_PROFILE});try{const base={question:'Synthetic question.',ordinaryResponse:true,interaction:{schemaVersion:INTERACTION_PROFILE,maxQuestions:2},outputRoot:join(dir,'runs'),limits:{maxRounds:4,maxTools:4,timeoutMs:30000},durable:{store,grantId:'original',bindings:{gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'test',version:'1'},plugins:[],adapters:[INTERACTION_BINDING]}}};const first=await run({...base,gateway:{mode:'fixture',async next(){return{kind:'calls',calls:[{id:'question',name:'ask_response',arguments:{question:'Clarify?'}}]};}}});store.receiveResponse({runId:first.runId,questionId:first.questionId,responseId:'answer',text:'original'});await run({...base,durable:{...base.durable,runId:first.runId},gateway:{mode:'fixture',async next(){return{kind:'final',text:'completed'};}}});store.close();store=null;const db=new DatabaseSync(join(dir,'session.sqlite'));try{if(variant==='paired-result'){const row=db.prepare('SELECT snapshot FROM runs WHERE run_id=?').get(first.runId);const snapshot=JSON.parse(row.snapshot);snapshot.messages.find(m=>m.role==='tool').result.value.text='forged';db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(JSON.stringify(snapshot),first.runId);}else{const row=db.prepare('SELECT fact FROM human_interactions WHERE run_id=?').get(first.runId),fact=JSON.parse(row.fact);if(variant==='receipt-text')fact.receipt.text='forged';if(variant==='question-hash')fact.questionHash='0'.repeat(64);if(variant==='ordinal')fact.ordinal=2;db.prepare('UPDATE human_interactions SET fact=? WHERE run_id=?').run(JSON.stringify(fact),first.runId);}}finally{db.close();}await assert.rejects(openSession({directory:dir,profile:INTERACTION_PROFILE,readOnly:true}));}finally{store?.close();await rm(dir,{recursive:true,force:true});}});

// A working projection may not discard an already adopted ordinary answer.
for(const variant of ['omit-pair','duplicate-pair'])test('cold reader rejects altered working interaction projection: '+variant,async()=>{
 await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/interaction-working-'));let store=await openSession({directory:dir,profile:INTERACTION_PROFILE});
 try{
  const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'test',version:'1'},plugins:[],adapters:[INTERACTION_BINDING]};
  const base={question:'Synthetic question.',ordinaryResponse:true,interaction:{schemaVersion:INTERACTION_PROFILE,maxQuestions:2},outputRoot:join(dir,'runs'),limits:{maxRounds:4,maxTools:4,timeoutMs:30000},durable:{store,grantId:'original',bindings}};
  const first=await run({...base,gateway:{mode:'fixture',async next(){return{kind:'calls',calls:[{id:'question',name:'ask_response',arguments:{question:'Clarify?'}}]};}}});
  store.receiveResponse({runId:first.runId,questionId:first.questionId,responseId:'answer',text:'original'});
  const stop=new AbortController();let calls=0;
  const paused=await run({...base,hostSignal:stop.signal,durable:{...base.durable,runId:first.runId,onCheckpoint(event){if(event.phase==='working-input')stop.abort();}},gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'completed'};}}});
  assert.equal(paused.status,'interrupted');assert.equal(calls,0);assert.ok(store.inspect(first.runId).snapshot.working);store.close();store=null;
  const db=new DatabaseSync(join(dir,'session.sqlite'));try{
   const snapshot=JSON.parse(db.prepare('SELECT snapshot FROM runs WHERE run_id=?').get(first.runId).snapshot),messages=snapshot.working.messages;
   const pair=messages.filter(m=>m.role==='assistant'&&m.calls?.some(c=>c.name==='ask_response')||m.role==='tool'&&m.callId==='question');assert.equal(pair.length,2);
   snapshot.working.messages=variant==='omit-pair'?messages.filter(m=>!pair.includes(m)):[...messages,...pair];
   const {createHash}=await import('node:crypto');snapshot.working.hash=createHash('sha256').update(JSON.stringify(snapshot.working.messages)).digest('hex');
   db.prepare('UPDATE runs SET snapshot=? WHERE run_id=?').run(JSON.stringify(snapshot),first.runId);
  }finally{db.close();}
  await assert.rejects(openSession({directory:dir,profile:INTERACTION_PROFILE,readOnly:true}),/INVALID_HUMAN_INTERACTION/);
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
