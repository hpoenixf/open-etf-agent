import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startLocalGui} from '../src/gui-server.mjs';

const at=(date,time)=>Date.parse('2026-11-'+date+'T'+time+':00+08:00');
const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'mock',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:1}};
const env={ETF_GUI_PROVIDER_KEY:'fixture-only',ETF_GUI_DAILY_AUTORUN:'1'};
async function setup(t) {
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/daily-digest-'));
 const opened=[];
 t.after(async()=>{await Promise.all(opened.map(s=>s.close()));await rm(projectDir,{recursive:true,force:true});});
 return async options=>{
  const gui=await startLocalGui({projectDir,liveConfig,env,...options});
  opened.push(gui);
  const get=path=>fetch(gui.origin+path).then(r=>r.json());
  const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  return {...gui,get,post,daily:()=>get('/api/daily-watch')};
 };
}

test('independent digest is consented, one local day, non-sensitive, and never starts research or legacy per-watch email',async t=>{
 let time=at('22','07:45'),model=0,legacy=0,deliveries=[];
 const launch=await setup(t);
 const opts={dailyClock:()=>time,async fetchImpl(_url,options){
  model++;
  const content=JSON.parse(options.body).messages[0].content;
  return Response.json({choices:[{message:{role:'assistant',content:content.split('\n')[0]+' private answer'},finish_reason:'stop'}]});
 },onDailyCompleted:async()=>{legacy++;return {status:'accepted'};},
 ownerDailyDigest:{version:'owner-digest-mock',recipientPreview:'m***@test.invalid',async deliver(value){
  assert.equal(value.confirmed(),true);
  deliveries.push(value);
  return {status:'unknown'};
 }}};
 const site=await launch(opts);
 const token=(await site.daily()).digest.consentToken;
 const make=(localTime,include,enabled=true)=>site.post('/api/daily-watch',{question:'private data '+localTime,localTime,enabled,
  ...(include?{digestEnabled:true,digestConsentToken:token}:{})}).then(r=>r.json());
 const [early,pending,late,paused,excluded]=await Promise.all([make('08:00',true),make('08:10',true),make('10:00',true),make('08:15',true,false),make('08:30',false)]);
 assert.equal((await site.post('/api/daily-digest',{localTime:'09:00',enabled:true})).status,409);
 assert.equal((await site.post('/api/daily-digest',{localTime:'09:00',enabled:true,consentToken:token})).status,200);
 assert.equal((await site.daily()).emailAvailable,false);
 assert.equal((await site.post('/api/daily-watch',{question:'old',localTime:'08:15',enabled:true,emailEnabled:true})).status,400);
 await site.sweepDigest();assert.equal(deliveries.length,0);assert.equal(model,0);
 time=at('22','08:00');await site.sweepDaily();assert.equal(model,1);
 time=at('22','09:00');await Promise.all([site.sweepDigest(),site.sweepDigest()]);
 assert.equal(deliveries.length,1);
 assert.equal(model,1);assert.equal(legacy,0);
 const rows=deliveries[0].rows;
 const map=Object.fromEntries(rows.map(row=>[row.watchId,row.status]));
 assert.deepEqual(map,{[early.id]:'completed',[pending.id]:'pending',[paused.id]:'not-run',[late.id]:'not-run'});
 assert.equal(Object.hasOwn(map,excluded.id),false);
 assert.equal(rows[0].messageId,'day-2026-11-22');
 assert.doesNotMatch(JSON.stringify(rows),/private data|private answer|fixture-only|test\.invalid/);
 await site.close();
 const cold=await launch(opts);
 await cold.sweepDigest();
 assert.equal(deliveries.length,1);
 assert.deepEqual((await cold.daily()).digest.history,[{date:'2026-11-22',status:'unknown'}]);
 assert.equal((await cold.post('/api/daily-digest',{localTime:'09:00',enabled:true,consentToken:token})).status,409);
});

test('withdrawal between slot freeze and delivery disallows the original payload, not a new send',async t=>{
 let time=at('22','07:50'),calls=0,allowed;
 const launch=await setup(t);
 let site,dropped;
 site=await launch({dailyClock:()=>time,ownerDailyDigest:{version:'verified-recipient',async deliver({confirmed}){
  calls++;
  assert.equal(confirmed(),true);
  assert.equal((await site.post('/api/daily-watch/'+dropped.id,{question:'private watch',localTime:'19:00',enabled:true,digestEnabled:false})).status,200);
  allowed=confirmed();
  return {status:allowed?'accepted':'not-dispatched'};
 }}});
 const token=(await site.daily()).digest.consentToken;
 dropped=await site.post('/api/daily-watch',{question:'private watch',localTime:'19:00',enabled:true,digestEnabled:true,digestConsentToken:token}).then(r=>r.json());
 assert.equal((await site.post('/api/daily-digest',{localTime:'09:00',enabled:true,consentToken:token})).status,200);
 time=at('22','09:00');await site.sweepDigest();await site.sweepDigest();
 assert.equal(calls,1);assert.equal(allowed,false);
 assert.equal((await site.daily()).digest.history[0].status,'not-dispatched');
});

test('composed digest verifies original publication and cold-recovers provider acceptance without any second mail',async t=>{
 const {createDailyDigestHook,inspectDailyDigestEmail}=await import('../src/daily-digest-email.mjs');
 let time=at('22','07:50'),models=0,mail=[];
 const launch=await setup(t);
 const target={address:'only-owner@example.invalid',version:'synthetic-owner-revision',verified:true,enabled:true};
 const ownerOrigin='https://owner.example.invalid';
 const profile={version:target.version,recipientPreview:'o***@example.invalid',inspect:inspectDailyDigestEmail,async deliver(job){
  const hook=createDailyDigestHook({ownerOrigin,resolveConfirmedDestination:()=>job.confirmed()?target:null,async transport(body){
   mail.push(body);
   return {status:'accepted',receiptId:'mock-only-accepted'};
  }});
  const sent=await hook(job);assert.equal(sent.status,'accepted');
  // Simulate losing the GUI-side status projection after the external owner
  // durably persisted acceptance; there is no recovery send.
  throw Error('synthetic lost dashboard settle');
 }};
 const opts={dailyClock:()=>time,ownerDailyDigest:profile,async fetchImpl(){
  models++;
  return Response.json({choices:[{message:{role:'assistant',content:'sensitive full body; never in digest'},finish_reason:'stop'}]});
 }};
 const site=await launch(opts),token=(await site.daily()).digest.consentToken;
 const watch=await site.post('/api/daily-watch',{question:'private question never in digest',localTime:'08:00',enabled:true,digestEnabled:true,digestConsentToken:token});
 assert.equal(watch.status,201);
 assert.equal((await site.post('/api/daily-digest',{localTime:'09:00',enabled:true,consentToken:token})).status,200);
 time=at('22','08:00');await site.sweepDaily();
 const original=(await site.daily()).items[0].history[0];
 assert.equal(original.status,'completed');
 time=at('22','09:00');await site.sweepDigest();
 assert.deepEqual([models,mail.length],[1,1]);
 assert.equal(mail[0].to,target.address);
 assert.match(mail[0].subject,/2026-11-22/);
 assert.ok(mail[0].text.includes(ownerOrigin+'/#'+original.conversationId+'~'+original.messageId));
 assert.doesNotMatch(mail[0].text,/sensitive full body|private question|fixture-only/);
 assert.equal((await site.daily()).digest.history[0].status,'unknown');
 const guiJs=await fetch(site.origin+'/gui.mjs').then(r=>r.text());
 assert.match(guiJs,/await select\(existing\.id,!pending&&anchor\.conversationId===existing\.id\?anchor\.messageId/);
 await site.close();
 const cold=await launch(opts);await cold.sweepDigest();
 assert.equal((await cold.daily()).digest.history[0].status,'accepted');
 assert.deepEqual([models,mail.length],[1,1]);
});

test('Resend digest requires explicit exact transport and authenticated configured origin; rotation changes consent version',async()=>{
 const {prepareOwnerDailyDigest}=await import('../src/gui-daily-digest-delivery.mjs');
 assert.equal(prepareOwnerDailyDigest({}),null);
 assert.throws(()=>prepareOwnerDailyDigest({ETF_DAILY_DIGEST_ENABLED:'1'}),{code:'GUI_DAILY_DIGEST_CONFIG_INVALID'});
 const profile={ETF_DAILY_DIGEST_ENABLED:'1',ETF_DAILY_DIGEST_OWNER_ORIGIN:'https://owner.example.invalid',
  ETF_SCHEDULED_SMTP_ENABLED:'1',ETF_SCHEDULED_SMTP_PROFILE:'resend-smtp',ETF_SCHEDULED_SMTP_HOST:'smtp.resend.com',
  ETF_SCHEDULED_SMTP_TLS:'starttls',ETF_SCHEDULED_SMTP_FROM:'sender@example.invalid',ETF_SCHEDULED_SMTP_USER:'resend',
  ETF_SCHEDULED_SMTP_PASSWORD:'synthetic-no-call',ETF_SCHEDULED_SMTP_VERIFIED_TO:'only-owner@example.invalid',
  ETF_SCHEDULED_SMTP_VERIFIED_TO_VERSION:'confirmed-1'};
 const current=prepareOwnerDailyDigest(profile);
 assert.equal(current.contentMode,'links-only');
 const full=prepareOwnerDailyDigest({...profile,ETF_DAILY_DIGEST_CONTENT:'full-report'});
 assert.equal(full.contentMode,'full-report');
 assert.notEqual(full.version,current.version);
 assert.throws(()=>prepareOwnerDailyDigest({...profile,ETF_DAILY_DIGEST_CONTENT:'invalid'}),{code:'GUI_DAILY_DIGEST_CONFIG_INVALID'});
 assert.equal(current.recipientPreview,'o***@example.invalid');
 assert.notEqual(prepareOwnerDailyDigest({...profile,ETF_DAILY_DIGEST_OWNER_ORIGIN:'https://rotated.example.invalid'}).version,current.version);
 assert.notEqual(prepareOwnerDailyDigest({...profile,ETF_SCHEDULED_SMTP_VERIFIED_TO:'changed@example.invalid'}).version,current.version);
 assert.throws(()=>prepareOwnerDailyDigest({...profile,ETF_DAILY_DIGEST_OWNER_ORIGIN:'https://owner.example.invalid/report/debug'}),{code:'DIGEST_ORIGIN_INVALID'});
 assert.throws(()=>prepareOwnerDailyDigest({...profile,ETF_SCHEDULED_SMTP_HOST:'other.example.invalid'}),{code:'SCHEDULED_SMTP_CONFIG_INVALID'});
});

test('Daily Watch Skill to full digest: fresh consent, exact Markdown, safe HTML, no repeat dispatch',async t=>{
 const {createDailyDigestHook,inspectDailyDigestEmail}=await import('../src/daily-digest-email.mjs');
 let time=at('22','07:45'),modelCalls=0,mails=[];
 const launch=await setup(t);
 const ownerOrigin='https://workbench.example.invalid';
 const answer='## 纳指\n\n- **变化**：重大消息。\n- **建议**：等待公告。\n\n[来源](https://exchange.example.invalid/item?p=1&n=2)\n\n[危险链接](javascript:fixture)\n\n![远程图片](https://tracking.example.invalid/pixel)\n\n<img src="https://tracking.example.invalid/extra">\n\n## 红利低波\n\n末尾校验：这是完整正文。';
 const profile=mode=>{
  const target={address:'only-owner@example.invalid',version:mode,enabled:true,verified:true};
  return {contentMode:mode,version:mode,inspect:inspectDailyDigestEmail,deliver:job=>createDailyDigestHook({
   ownerOrigin,mode,resolveConfirmedDestination:()=>job.confirmed()?target:null,transport:async payload=>{
    mails.push(payload);return {status:'accepted',receiptId:'test-full-report-accepted'};
   },
  })(job)};
 };
 const fetchImpl=async(_url,request)=>{
  modelCalls++;
  const prompt=JSON.parse(request.body).messages[0].content;
  assert.match(prompt,/Daily Watch Skill: daily-watch-brief sha256:[a-f0-9]{64}/);
  assert.match(prompt,/10–20 candidate items/);
  assert.match(prompt,/3–5 material developments overall/);
  assert.match(prompt,/Run as of: 2026-11-22T00:00:00.000Z/);
  assert.ok(prompt.startsWith('只供测试的追踪问题\n'));
  return Response.json({choices:[{message:{role:'assistant',content:answer},finish_reason:'stop'}]});};
 const previous=await launch({dailyClock:()=>time,fetchImpl,ownerDailyDigest:profile('links-only')});
 const oldToken=(await previous.daily()).digest.consentToken;
 const originalWatch={question:'只供测试的追踪问题',localTime:'08:00',enabled:true,digestEnabled:true};
 const watched=await (await previous.post('/api/daily-watch',{...originalWatch,digestConsentToken:oldToken})).json();
 assert.equal((await previous.post('/api/daily-digest',{localTime:'09:00',enabled:true,consentToken:oldToken})).status,200);
 await previous.close();
 const briefEnv={...env,ETF_GUI_DAILY_WATCH_SKILL:'daily-watch-brief'};
 const site=await launch({env:briefEnv,dailyClock:()=>time,fetchImpl,ownerDailyDigest:profile('full-report')});
 const configured=await site.daily();
 assert.equal(configured.digest.contentMode,'full-report');
 assert.equal(configured.digest.requiresConfirmation,true);
 assert.equal(configured.items[0].digestConfirmed,false);
 assert.equal((await site.post('/api/daily-digest',{localTime:'09:00',enabled:true,consentToken:oldToken})).status,409);
 const token=configured.digest.consentToken;
 assert.equal((await site.post('/api/daily-watch/'+watched.id,{...originalWatch,digestConsentToken:token})).status,200);
 assert.equal((await site.post('/api/daily-digest',{localTime:'09:00',enabled:true,consentToken:token})).status,200);
 const pending=await site.post('/api/daily-watch',{question:'尚未执行',localTime:'10:00',enabled:true,digestEnabled:true,digestConsentToken:token});
 assert.equal(pending.status,201);
 time=at('22','08:00');await site.sweepDaily();
 const exact=(await site.daily()).items.find(item=>item.id===watched.id).history[0];
 assert.equal(exact.status,'completed');
 const stored=await site.get('/api/conversations/'+exact.conversationId+'/messages/'+exact.messageId+'/body');
 assert.equal(stored.body.text,answer);
 time=at('22','09:00');await Promise.all([site.sweepDigest(),site.sweepDigest()]);
 assert.equal(modelCalls,1);
 assert.equal(mails.length,1);
 const [message]=mails;
 assert.equal(message.to,'only-owner@example.invalid');
 assert.ok(message.text.includes(answer));
 assert.match(message.text,/10:00 · 未执行/);
 assert.match(message.html,/<h2[^>]*>纳指<\/h2>/);
 assert.match(message.html,/<li[^>]*><strong>建议<\/strong>：等待公告。<\/li>/);
 assert.match(message.html,/href="https:\/\/exchange\.example\.invalid\/item\?p=1&amp;n=2"/);
 assert.match(message.html,/末尾校验：这是完整正文/);
 assert.doesNotMatch(message.html,/<img|<script|href="javascript:|href="https:\/\/tracking\./i);
 await site.close();
 const cold=await launch({env:briefEnv,dailyClock:()=>time,fetchImpl,ownerDailyDigest:profile('full-report')});
 await cold.sweepDigest();
 assert.deepEqual([modelCalls,mails.length],[1,1]);
 assert.equal((await cold.daily()).digest.history[0].status,'accepted');
});
