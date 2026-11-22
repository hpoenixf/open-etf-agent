import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importProjectSources } from '../src/project-sources.mjs';
import { submitConversationMessage } from '../src/conversation.mjs';
import { startLocalGui } from '../src/gui-server.mjs';
import { buildOwnerFollowupQuestion } from '../src/conversation-owner-context.mjs';

test('wire context stays bounded, UTF-8 intact, chronological, with current request exact',()=>{
  const turns=Array.from({length:4},(_,i)=>({question:'问题'+i, answer:'🚀'.repeat(1000)}));
  const q='中'.repeat(4000);
  const packet=buildOwnerFollowupQuestion(q,turns);
  assert.ok(Buffer.byteLength(packet)<=16000);
  const frame=JSON.parse(packet.slice(packet.indexOf('\n')+1));
  assert.equal(frame.request,q);
  assert.ok(frame.previousTurns.length>=1);
  assert.equal(frame.previousTurns.at(-1).question,'问题3');
  assert.ok(frame.previousTurns.every(t=>t.answerTruncated && !t.answer.includes('\uFFFD')));
  assert.equal(buildOwnerFollowupQuestion('\\'.repeat(12000),turns),'\\'.repeat(12000));
  assert.equal(buildOwnerFollowupQuestion('hello',[]),'hello');
});

test('GUI followups use only original same-conversation completed user/answer facts; replay and reads do not dispatch',async t=>{
  await mkdir('test-output',{recursive:true});
  const projectDir=await mkdtemp(resolve('test-output/owner-followup-'));
  const requests=[];
  const options={
    projectDir,env:{ETF_GUI_PROVIDER_KEY:'synthetic-only-credential'},
    liveConfig:{gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic-only',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:2}},
    fetchImpl:async(_,init)=>{
      requests.push(JSON.parse(init.body));
      return Response.json({choices:[{message:{role:'assistant',content:'Synthetic answer '+requests.length},finish_reason:'stop'}]});
    },
  };
  let gui=await startLocalGui(options);
  t.after(async()=>{await gui.close();await rm(projectDir,{recursive:true,force:true});});
  const get=path=>fetch(gui.origin+path).then(r=>r.json());
  const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const newConversation=()=>post('/api/conversations',{}).then(r=>r.json()).then(x=>'/api/conversations/'+x.id);
  async function send(path,messageId,question){
    const payload={messageId,question};
    const res=await post(path+'/messages',payload);
    assert.equal(res.status,202);
    const {runId}=await res.json();
    for(let i=0;i<100;i++){
      const turn=(await get(path)).messages.find(m=>m.id===messageId);
      if(turn?.status==='completed'){
        assert.equal(turn.question,question);
        return {runId,payload};
      }
      await new Promise(r=>setTimeout(r,15));
    }
    assert.fail('Mock run did not complete');
  }
  const a=await newConversation(), b=await newConversation();
  const first=await send(a,'initial-id','Use synthetic silver');
  await send(b,'another-id','OTHER CONVERSATION PRIVATE SENTINEL');
  await gui.close();
  gui=await startLocalGui(options);
  const next=await send(a,'followup-id','What did you say just now?');
  assert.notEqual(first.runId,next.runId);
  assert.equal(requests.length,3);
  const wire=JSON.stringify(requests[2]);
  assert.match(wire,/Use synthetic silver/);
  assert.match(wire,/Synthetic answer 1/);
  assert.match(wire,/untrusted historical context/);
  assert.doesNotMatch(wire,/OTHER CONVERSATION|Synthetic answer 2|synthetic-only-credential/);
  await send(a,'third-id','Expand the same subject');
  const replay=await post(a+'/messages',next.payload);
  assert.equal(replay.status,202);
  assert.equal((await replay.json()).runId,next.runId);
  await get(a);
  assert.equal(requests.length,4);
  assert.equal(JSON.stringify(requests[3]).split('Use synthetic silver').length-1,1);
  const {manifestSha256}=await importProjectSources({projectDir,
    files:[fileURLToPath(new URL('../src/gui/etf-fees.md',import.meta.url))]});
  await submitConversationMessage({projectDir,conversationId:a.split('/').at(-1),messageId:'attached-id',
    text:'ATTACHED TURN SENTINEL',sourceManifestSha256:manifestSha256,
    authorization:{providerApproved:true,dataApproved:true,costApproved:true}});
  await send(a,'after-attachment','New question after attached turn');
  assert.doesNotMatch(JSON.stringify(requests.at(-1)),/ATTACHED TURN SENTINEL|Use synthetic silver|Synthetic answer 4/);
  assert.equal(requests.length,5);

  await gui.close();
  gui=await startLocalGui({...options,liveConfig:{...options.liveConfig,connectivity:{web:true}}});
  await send(a,'after-profile-change','New question after connectivity change');
  assert.doesNotMatch(JSON.stringify(requests.at(-1)),/New question after attached turn|Synthetic answer 5/);
  assert.equal(requests.length,6);
});
