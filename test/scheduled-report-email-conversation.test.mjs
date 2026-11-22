import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startLocalGui } from '../src/gui-server.mjs';
import { readCompletedConversationEmailReport, deliverScheduledReportEmail, createScheduledReportEmailHook } from '../src/scheduled-report-email.mjs';

test('completed original freeform Publication transfers through mock email without any new research or cross-conversation read',async t=>{
 const projectDir=await mkdtemp(resolve('.email-conversation-'));
 let modelCalls=0;
 const gui=await startLocalGui({projectDir,
   liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic-only',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:2}},
   env:{ETF_GUI_PROVIDER_KEY:'synthetic-fixture-key'},
   async fetchImpl(){
     modelCalls++;
     return Response.json({choices:[{message:{role:'assistant',content:'Original synthetic answer.'},finish_reason:'stop'}]});
   },
 });
 t.after(async()=>{await gui.close();await rm(projectDir,{recursive:true,force:true});});
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const getConversation=()=>post('/api/conversations',{}).then(r=>r.json()).then(r=>r.id);
 const conversationId=await getConversation(),other=await getConversation(),messageId='m-report';
 const base='/api/conversations/'+conversationId;
 const response=await post(base+'/messages',{messageId,question:'Research a synthetic topic'});
 assert.equal(response.status,202);
 const {runId}=await response.json();
 let complete=false;
 for(let i=0;i<100;i++){
  const detail=await fetch(gui.origin+base).then(r=>r.json());
  if(detail.messages[0]?.status==='completed'){complete=true;break;}
  await new Promise(r=>setTimeout(r,15));
 }
 assert.ok(complete);
 const getReport=(id)=>readCompletedConversationEmailReport({projectDir,conversationId:id,messageId,runId});
 const sealed=await getReport(conversationId);
 assert.equal(sealed.text,'Original synthetic answer.');
 assert.equal(sealed.revisionId,'publication:'+sealed.sha256);
 await assert.rejects(getReport(other));
 let calls=0;
 const args={directory:resolve(projectDir,'report-email'),occurrenceId:'daily-2026-11-22',reportRef:sealed,
  destination:{address:'owner@example.invalid',version:'verified-1',verified:true,enabled:true},
  readCompletedReport:ref=>readCompletedConversationEmailReport({projectDir,...ref}),
  transport:async mail=>{calls++;assert.equal(mail.text,sealed.text);return {status:'accepted',receiptId:'synthetic-acceptance'};}};
 assert.equal((await deliverScheduledReportEmail(args)).status,'accepted');
 assert.equal((await deliverScheduledReportEmail(args)).status,'accepted');
 const finish={projectDir,watchId:'tracked-1',date:'2026-11-22',conversationId,messageId,runId};
 const disabled=createScheduledReportEmailHook({resolveConfirmedDestination:async()=>null,transport(){assert.fail('should not send');}});
 assert.equal((await disabled({...finish,messageId:'not-there'})).status,'not-configured');
 const enabled=createScheduledReportEmailHook({resolveConfirmedDestination:async request=>{
  assert.equal(request.watchId,'tracked-1');return args.destination;
 },transport:args.transport});
 assert.equal((await enabled(finish)).status,'accepted');
 assert.equal((await enabled(finish)).status,'accepted');
 assert.equal(modelCalls,1);
 assert.equal(calls,2);
});
