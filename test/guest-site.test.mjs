import assert from 'node:assert/strict';
import {scryptSync} from 'node:crypto';
import {request} from 'node:http';
import {mkdir, mkdtemp, readdir, rm, statfs} from 'node:fs/promises';
import {join} from 'node:path';
import test from 'node:test';
import {startGuestSite} from '../src/guest-site.mjs';
import {startAccountSite} from '../src/account-site.mjs';

const guestOrigin='https://guest.example.test',ownerOrigin='https://owner.example.test';
const phrase='synthetic fixture guest access';
const salt=Buffer.alloc(16,1);
const phraseVerifier='scrypt-v1:'+salt.toString('hex')+':'+scryptSync(phrase,salt,32).toString('hex');
const providerKey='guest-synthetic-provider-key-no-network';
const ownerCookie='__Secure-open-etf-account.session_token=synthetic-owner-cookie';
const provider={provider:'synthetic',endpoint:'https://models.example.invalid/v1/chat/completions',model:'fixture-model'};
const guestHeader='x-etf-guest-session';

function call(site,path,{origin=site.origin,host=new URL(site.origin).host,method='GET',headers={},json}={}) {
  const body=json===undefined?undefined:JSON.stringify(json);
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:site.port,path,method,headers:{host,...(origin?{origin}:{}),
      ...(body===undefined?{}:{'content-type':'application/json','content-length':Buffer.byteLength(body)}),...headers}},res=>{
      const parts=[];res.on('data',data=>parts.push(data));res.on('end',()=>{
        const text=Buffer.concat(parts).toString();
        resolve({status:res.statusCode, headers:res.headers,body:res.headers['content-type']?.includes('application/json')?JSON.parse(text):text});
      });
    });
    req.on('error',reject);req.end(body);
  });
}
const post=(site,path,json,token,options={})=>call(site,path,{method:'POST',json,...options,
  headers:{...(token?{[guestHeader]:token}:{}),...options.headers}});
const signIn=site=>post(site,'/api/guest/sign-in',{phrase});
const answer=(site,token,question,history=[])=>post(site,'/api/guest/answer',{question,history},token);
const completion=text=>Response.json({choices:[{message:{role:'assistant',content:text},finish_reason:'stop'}]});

async function ram(t) {
  const path=process.env.ETF_GUEST_TEST_TMPFS??'/dev/shm';
  try {
    const filesystem=await statfs(path);
    if (![0x01021994,0x858458f6].includes(filesystem.type>>>0)) throw new Error('not volatile');
    const directory=await mkdtemp(join(path,'open-etf-guest-test-'));
    return directory;
  } catch {
    if(process.platform==='linux'&&process.env.CI) throw new Error('Guest isolation tests require a writable tmpfs on Linux CI');
    t.skip('Private tmpfs unavailable'); return null;
  }
}

test('guest refuses a durable workspace and the owner provider route before opening a listener',async()=>{
  const baseline={origin:guestOrigin,runtimeRoot:process.cwd(),phraseVerifier,provider,providerKey};
  await assert.rejects(startGuestSite(baseline),{code:'GUEST_VOLATILE_ROOT_REQUIRED'});
  await assert.rejects(startGuestSite({...baseline,provider:{...provider,endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions'}}),{code:'GUEST_OWNER_PROVIDER_DISABLED'});
  await assert.rejects(startGuestSite({...baseline,providerKey:undefined}),{code:'GUEST_PROVIDER_CONFIG'});
});

test('two independent guests cannot read one another or the functioning owner, even if they know actual IDs',async t=>{
  const runtimeRoot=await ram(t);
  if(!runtimeRoot)return;
  const requests=[];
  const site=await startGuestSite({origin:guestOrigin,runtimeRoot,phraseVerifier,provider,providerKey,
    fetchImpl:async(url,options)=>{
      assert.equal(url.href,provider.endpoint);
      assert.equal(options.headers.authorization,'Bearer '+providerKey);
      const input=JSON.parse(options.body);
      requests.push(input);
      assert.deepEqual(input.tools,[]);
      return completion('Response '+input.messages.at(-1).content);
    }});
  t.after(async()=>{await site.close();await rm(runtimeRoot,{recursive:true,force:true});});
  await mkdir(join(process.cwd(),'test-output'),{recursive:true});
  const ownerRoot=await mkdtemp(join(process.cwd(),'test-output/guest-owner-fixture-'));
  const owner=await startAccountSite({origin:ownerOrigin,projectRoot:ownerRoot,auth:{
    getSession:async headers=>headers.get('cookie')===ownerCookie?{user:{id:'verified-owner-fixture'}}:null,
    handler:async()=>{throw new Error('Fixture auth handler never invoked');},
  }});
  t.after(async()=>{await owner.close();await rm(ownerRoot,{recursive:true,force:true});});

  const ownerHeaders={cookie:ownerCookie};
  const create=await post(owner,'/api/conversations',{},null,{headers:ownerHeaders});
  assert.equal(create.status,201);
  const ownerId=create.body.id;
  const ws=await call(owner,'/api/workspace',{headers:ownerHeaders});
  assert.equal(ws.status,200);
  const ownerSourceId=ws.body.sources[0].id;
  const ownerTurn=await post(owner,'/api/conversations/'+ownerId+'/messages',
    {messageId:'owner-sensitive-fixture',question:'Private fixture positions and amounts',sourceId:ownerSourceId},null,{headers:ownerHeaders});
  assert.equal(ownerTurn.status,202);
  const ownerDetail=await call(owner,'/api/conversations/'+ownerId,{headers:ownerHeaders});
  assert.equal(ownerDetail.status,200);
  assert.equal(ownerDetail.body.messages[0].question,'Private fixture positions and amounts');

  const [loginA,loginB]=await Promise.all([signIn(site),signIn(site)]);
  assert.equal(loginA.status,200);assert.equal(loginB.status,200);
  assert.equal(loginA.headers['cache-control'],'no-store');
  assert.equal(loginA.headers['set-cookie'],undefined);
  const a=loginA.body.token,b=loginB.body.token;
  assert.match(a,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a,b);
  assert.equal((await answer(site,'a'.repeat(43),'Invalid')).status,401);
  for(const token of [a,b]) {
    const headers={[guestHeader]:token};
    for(const path of ['/api/workspace','/api/conversations/'+ownerId,
      '/api/conversations/'+ownerId+'/messages/owner-sensitive-fixture/progress',
      '/api/conversations/'+ownerId+'/messages/owner-sensitive-fixture/report.md','/api/memory','/api/holdings',
      '/api/daily-watch','/api/account/status','/api/auth/sign-in/email']) {
      assert.equal((await call(site,path,{headers})).status,404,path);
      assert.equal((await post(site,path,{},token)).status,404,path);
    }
    assert.equal((await post(site,'/api/guest/answer',{question:'Read holdings',history:[],conversationId:ownerId},token)).status,400);
    assert.equal((await post(site,'/api/guest/answer',{question:'Read holdings',history:[],runId:ownerTurn.body.runId},token)).status,400);
    assert.equal((await post(site,'/api/guest/answer',{question:'Read holdings',history:[],scope:'owner'},token)).status,400);
  }
  assert.equal((await post(site,'/api/guest/answer',{question:'Override owner',history:[]},a,{headers:{'x-user-id':'verified-owner-fixture'}})).status,400);
  assert.equal((await post(site,'/api/guest/answer',{question:'Use owner cookie',history:[]},a,{headers:ownerHeaders})).status,400);
  assert.equal((await post(site,'/api/guest/answer',{question:'Cross-origin',history:[]},a,{origin:ownerOrigin})).status,403);
  assert.equal((await post(site,'/api/guest/answer',{question:'Cross-site',history:[]},a,{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await call(owner,'/api/conversations/'+ownerId,{headers:{[guestHeader]:a}})).status,401);

  const first=await answer(site,a,'Guest A sample');
  assert.deepEqual(first.body,{answer:'Response Guest A sample'});
  const next=await answer(site,a,'Follow-up A',[{question:'Guest A sample',answer:first.body.answer}]);
  assert.deepEqual(next.body,{answer:'Response Follow-up A'});
  const other=await answer(site,b,'Guest B sample');
  assert.deepEqual(other.body,{answer:'Response Guest B sample'});
  assert.ok(JSON.stringify(requests[1].messages).includes('Guest A sample'));
  assert.ok(!JSON.stringify(requests[2].messages).includes('Guest A sample'));
  assert.ok(!JSON.stringify(requests).includes(ownerDetail.body.messages[0].question));
  assert.equal(requests.length,3);
  assert.deepEqual(await readdir(join(runtimeRoot,(await readdir(runtimeRoot))[0])),[]);
});

test('guest revokes expired and signed-out tokens, and throttles phrase verification',async t=>{
  const runtimeRoot=await ram(t);if(!runtimeRoot)return;
  let time=3000;
  const site=await startGuestSite({origin:guestOrigin,runtimeRoot,phraseVerifier,provider,providerKey,
    now:()=>time,idleMs:5000,maximumMs:10000,loginAttemptsPerMinute:3,fetchImpl:async()=>completion('safe')});
  t.after(async()=>{await site.close();await rm(runtimeRoot,{recursive:true,force:true});});
  const a=(await signIn(site)).body.token;
  const b=(await signIn(site)).body.token;
  assert.equal((await post(site,'/api/guest/sign-in',{phrase:'incorrect fixture'})).status,401);
  assert.equal((await signIn(site)).status,429);
  assert.equal((await post(site,'/api/guest/sign-out',{},a)).status,200);
  assert.equal((await post(site,'/api/guest/status',{},a)).status,401);
  time+=4000;
  assert.equal((await post(site,'/api/guest/status',{},b)).status,200);
  time+=4000;
  assert.equal((await post(site,'/api/guest/status',{},b)).status,200);
  time+=2000;
  assert.equal((await post(site,'/api/guest/status',{},b)).status,401);
  assert.equal((await answer(site,b,'not dispatched')).status,401);
});

test('guest rejects unauthorized tool proposals, suppresses credential echo, and deletes runtime artifacts before replying',async t=>{
  const runtimeRoot=await ram(t);if(!runtimeRoot)return;
  let calls=0,last;
  const site=await startGuestSite({origin:guestOrigin,runtimeRoot,phraseVerifier,provider,providerKey,fetchImpl:async(_url,options)=>{
    calls+=1;last=JSON.parse(options.body);
    if(calls===2)return completion(providerKey);
    return Response.json({choices:[{message:{role:'assistant',tool_calls:[{id:'fixture-tool',
      type:'function',function:{name:'recall_memory',arguments:'{}'}}]},finish_reason:'tool_calls'}]});
  }});
  t.after(async()=>{await site.close();await rm(runtimeRoot,{recursive:true,force:true});});
  const token=(await signIn(site)).body.token;
  for(const q of ['unsafe tool proposal','credential echo']) {
    const res=await answer(site,token,q);
    assert.equal(res.status,502);assert.deepEqual(res.body,{error:'GUEST_ANSWER_UNAVAILABLE'});
    assert.deepEqual(last.tools,[]);
    assert.deepEqual(await readdir(join(runtimeRoot,(await readdir(runtimeRoot))[0])),[]);
  }
  assert.equal(calls,2);
});

test('guest browser assets have a separate tab-local store and no owner UI or data bootstrap',async t=>{
  const runtimeRoot=await ram(t);if(!runtimeRoot)return;
  const site=await startGuestSite({origin:guestOrigin,runtimeRoot,phraseVerifier,provider,providerKey,fetchImpl:async()=>completion('safe')});
  t.after(async()=>{await site.close();await rm(runtimeRoot,{recursive:true,force:true});});
  const html=await call(site,'/',{origin:null,headers:{'sec-fetch-site':'cross-site','sec-fetch-mode':'navigate'}});
  assert.equal(html.status,200);
  assert.match(html.body,/游客入口/);
  assert.match(html.headers['content-security-policy'],/connect-src 'self'/);
  const asset=await call(site,'/guest.mjs');
  assert.equal(asset.status,200);
  assert.match(asset.body,/sessionStorage\.setItem/);
  assert.match(asset.body,/sessionStorage\.removeItem/);
  assert.match(asset.body,/credentials:'omit'/);
  assert.doesNotMatch(asset.body,/localStorage|indexedDB/);
  for(const path of ['/guest.css','/markdown.mjs','/vendor/marked-16.4.2.mjs'])assert.equal((await call(site,path)).status,200);
  assert.equal((await call(site,'/gui.mjs')).status,404);
  assert.equal((await call(site,'/api/workspace')).status,404);
});

test('revocation aborts in-flight generation and stale tokens do not start work',async t=>{
  const runtimeRoot=await ram(t);if(!runtimeRoot)return;
  let markStarted, calls=0;
  const started=new Promise(resolve=>{markStarted=resolve;});
  const site=await startGuestSite({origin:guestOrigin,runtimeRoot,phraseVerifier,provider,providerKey,fetchImpl:async(_url,{signal})=>{
    calls+=1;markStarted();
    await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    throw new Error('unreachable');
  }});
  t.after(async()=>{await site.close();await rm(runtimeRoot,{recursive:true,force:true});});
  const a=(await signIn(site)).body.token;
  const flight=answer(site,a,'In flight private browser text');
  await started;
  assert.equal((await post(site,'/api/guest/sign-out',{},a)).status,200);
  assert.equal((await flight).status,401);
  assert.equal((await answer(site,a,'Stale')).status,401);
  assert.equal(calls,1);
  assert.deepEqual(await readdir(join(runtimeRoot,(await readdir(runtimeRoot))[0])),[]);
});
