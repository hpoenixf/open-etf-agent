import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {request} from 'node:http';
import {cp,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {accountProjectBasename,startAccountSite} from '../src/account-site.mjs';
import {sha256} from '../src/source.mjs';

const origin='https://agent.example.test', host=new URL(origin).host;
const creds=[
  {email:'operator-one@example.test',password:'local-fixture-password-one'},
  {email:'operator-two@example.test',password:'local-fixture-password-two'},
];
const cookieName='__Secure-open-etf-account.session_token';
const attrs='; Path=/; HttpOnly; Secure; SameSite=Strict';
const tokenOf=headers=>headers.get('cookie')?.split(';')[0].split('=')[1];
function fixtureAuth(){
 const active=new Map(), seen=[];
 let failure=false;
 return {seen,setUnavailable(v){failure=v;}, async getSession(headers){
   if(failure)throw Error('test db unavailable');
   return active.get(tokenOf(headers))??null;
 },async handler(req){
   const path=new URL(req.url).pathname;
   seen.push({path,ip:req.headers.get('x-forwarded-for')});
   if(path.endsWith('/email')){
     const b=await req.json(),index=creds.findIndex(c=>c.email===b.email&&c.password===b.password);
     if(index<0)return new Response('',{status:401});
     const token=randomBytes(20).toString('hex');
     active.set(token,{user:{id:'fixture-'+index}});
     return Response.json({unwantedToken:token},{headers:{'set-cookie':cookieName+'='+token+attrs}});
   }
   active.delete(tokenOf(req.headers));
   return Response.json({}, {headers:{'set-cookie':cookieName+'=; Max-Age=0'+attrs}});
 }};
}
async function workspace(t) {
 await mkdir('test-output',{recursive:true});
 const root=await mkdtemp(resolve('test-output/accounts-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 return root;
}
function send(app,path,{method='GET',body,cookie,headers={}}={}){
 const bytes=body!==undefined?Buffer.from(JSON.stringify(body)):undefined;
 return new Promise((resolve,reject)=>{
   const req=request({hostname:'127.0.0.1',port:app.port,path,method,
     headers:{Host:host,...(method==='POST'?{Origin:origin}:{}),
       ...(bytes?{'content-type':'application/json','content-length':bytes.length}:{}),
       ...(cookie?{Cookie:cookie}:{}),...headers}},res=>{
     const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);
     res.on('end',()=>{const text=Buffer.concat(chunks).toString();let value;try{value=JSON.parse(text);}catch{}resolve({status:res.statusCode,text,value,headers:res.headers});});
   });
   req.on('error',reject);req.end(bytes);
 });
}
const mutation=(app,path,body,cookie,headers)=>send(app,path,{method:'POST',body,cookie,headers});
async function signIn(app,body){
 const r=await mutation(app,'/api/auth/sign-in/email',body,undefined,{'x-forwarded-for':'192.0.2.44'});
 assert.equal(r.status,200,r.text);
 assert.deepEqual(r.value,{status:'signed-in'});
 const header=r.headers['set-cookie'][0];
 assert.match(header,/; HttpOnly/i);assert.match(header,/; Secure/i);assert.match(header,/; SameSite=Strict/i);
 assert.doesNotMatch(header,/; Domain=/i);
 return header.split(';')[0];
}
async function createSyntheticReport(app,cookie){
 const w=await send(app,'/api/workspace',{cookie});assert.equal(w.status,200);
 const c=await mutation(app,'/api/conversations',{},cookie);assert.equal(c.status,201);
 const id=c.value.id, messageId='m-synthetic'+Date.now();
 const turn=await mutation(app,'/api/conversations/'+id+'/messages',{
   messageId,question:'fixture report for isolation',sourceId:w.value.sources[0].id,
 },cookie);assert.equal(turn.status,202,turn.text);
 const detailPath='/api/conversations/'+id, reportPath=detailPath+'/messages/'+messageId+'/report.md';
 let deadline=Date.now()+5000;
 while(Date.now()<deadline){
   const result=await send(app,reportPath,{cookie});
   if(result.status===200)return {projectId:w.value.projectId,detailPath,reportPath,sha256:sha256(result.text)};
   await new Promise(r=>setTimeout(r,30));
 }
 assert.fail('fixture report not ready');
}
test('auth is a mandatory backend boundary; only intended public paths are exposed',async t=>{
 const auth=fixtureAuth(),root=await workspace(t),app=await startAccountSite({projectRoot:root,origin,auth});
 t.after(()=>app.close());
 assert.equal((await send(app,'/')).status,303);
 assert.equal((await send(app,'/account/login')).status,200);
 for(const path of ['/api/workspace','/gui.mjs','/gui.css','/markdown.mjs','/vendor/marked-16.4.2.mjs','/financial-chart-view.mjs','/api/conversations/c/m/m/report.md'])
   assert.equal((await send(app,path)).status,401,path);
 assert.equal((await mutation(app,'/api/conversations',{})).status,401);
 assert.equal((await mutation(app,'/api/auth/sign-up/email',creds[0])).status,404);
 assert.equal((await mutation(app,'/api/auth/sign-in/email',creds[0],undefined,{Origin:''})).status,403);
 assert.equal((await mutation(app,'/api/auth/sign-in/email',creds[0],undefined,{Origin:'https://wrong.example.test'})).status,403);
 assert.equal((await send(app,'/api/workspace',{headers:{Host:'forwarded.example.test','X-Forwarded-Host':host}})).status,403);
 assert.equal((await send(app,'/api/workspace?userId=someone')).status,400);
 assert.equal((await send(app,'/api/workspace',{headers:{'X-Agent-User-Id':'someone'}})).status,400);
 assert.equal((await send(app,'/api/%61uth/sign-up/email')).status,400);
 assert.equal(auth.seen.length,0);
 auth.setUnavailable(true);
 assert.equal((await send(app,'/api/workspace')).status,503);
});
test('two accounts have distinct durable Projects and old cookies cannot replay after logout',async t=>{
 const root=await workspace(t),auth=fixtureAuth(),app=await startAccountSite({projectRoot:root,origin,auth});
 t.after(()=>app.close());
 const a=await signIn(app,creds[0]),b=await signIn(app,creds[1]);
 for(const path of ['/markdown.mjs','/vendor/marked-16.4.2.mjs','/financial-chart-view.mjs']){
   const asset=await send(app,path,{cookie:a});
   assert.equal(asset.status,200,path);
   assert.match(asset.headers['content-type'],/^text\/javascript/);
 }
 const html=(await send(app,'/',{cookie:a})).text;
 assert.match(html,/<details id="daily-watch" hidden>/);
 assert.match(html,/<details id="chart-skill-picker" class="composer-option" hidden>/);
 assert.match(html,/<details id="pdf-picker" class="composer-option" hidden>/);
 const caps=(await send(app,'/api/workspace',{cookie:a})).value.capabilities;
 for(const cap of ['financial-chart-skill','financial-chart-auto','daily-watch','pdf-attachment'])assert.equal(caps.includes(cap),false,cap);
 assert.ok(auth.seen.every(x=>x.ip===null));
 const report=await createSyntheticReport(app,a);
 const own=await send(app,report.reportPath,{cookie:a});
 assert.equal(sha256(own.text),report.sha256);
 const sibling=await send(app,'/api/workspace',{cookie:b});
 assert.notEqual(report.projectId,sibling.value.projectId);
 assert.deepEqual(sibling.value.conversations,[]);
 assert.equal((await send(app,report.detailPath,{cookie:b})).status,404);
 assert.equal((await send(app,report.reportPath,{cookie:b})).status,404);
 assert.equal((await mutation(app,'/api/auth/sign-out',{},a)).status,200);
 assert.equal((await send(app,report.reportPath,{cookie:a})).status,401);
 assert.equal((await send(app,'/api/workspace',{cookie:b})).status,200);
 const again=await signIn(app,creds[0]);
 await app.close();
 const reopen=await startAccountSite({projectRoot:root,origin,auth});
 t.after(()=>reopen.close());
 assert.equal(sha256((await send(reopen,report.reportPath,{cookie:again})).text),report.sha256);
});
test('file-backed conversation catalog keeps identity and title across reopen in its own Project',async t=>{
 const root=await workspace(t),auth=fixtureAuth();
 const app=await startAccountSite({projectRoot:root,origin,auth});t.after(()=>app.close());
 const a=await signIn(app,creds[0]),b=await signIn(app,creds[1]);
 const create=async cookie=>{
   const r=await mutation(app,'/api/conversations',{},cookie);
   assert.equal(r.status,201,r.text);
   return r.value.id;
 };
 const id=await create(a),otherId=await create(b),path='/api/conversations/'+id;
 const catalog=async (site,cookie)=>{
   const r=await send(site,'/api/workspace',{cookie});
   assert.equal(r.status,200,r.text);
   return r.value;
 };
 const detail=async site=>{
   const r=await send(site,path,{cookie:a});
   assert.equal(r.status,200,r.text);
   return r.value;
 };
 const initial=await catalog(app,a);
 assert.deepEqual(initial.conversations,[{id,title:null}]);
 assert.deepEqual(await detail(app),{id,title:null,messages:[]});
 const question='Catalog  fixture   title';
 const turn=await mutation(app,path+'/messages',{messageId:'catalog-fixture',question,sourceId:initial.sources[0].id},a);
 assert.equal(turn.status,202,turn.text);
 const title='Catalog fixture title';
 const verify=async site=>{
   const own=await catalog(site,a),other=await catalog(site,b),entry=await detail(site);
   assert.equal(own.projectId,initial.projectId);
   assert.notEqual(other.projectId,own.projectId);
   assert.deepEqual(own.conversations,[{id,title}]);
   assert.deepEqual(other.conversations,[{id:otherId,title:null}]);
   assert.equal(entry.id,id);
   assert.equal(entry.title,title);
   assert.deepEqual(entry.messages.map(row=>row.id),['catalog-fixture']);
   assert.equal((await send(site,path,{cookie:b})).status,404);
 };
 await verify(app);
 await app.close();
 const reopened=await startAccountSite({projectRoot:root,origin,auth});t.after(()=>reopened.close());
 await verify(reopened);
});
test('restored Project preserves published body and sources without redispatch',async t=>{
 const root=await workspace(t),snapshot=await workspace(t),auth=fixtureAuth();
 const app=await startAccountSite({projectRoot:root,origin,auth});t.after(()=>app.close());
 const owner=await signIn(app,creds[0]),other=await signIn(app,creds[1]);
 const {detailPath,reportPath}=await createSyntheticReport(app,owner);
 const paths=[reportPath,...['body','sources'].map(s=>reportPath.replace(/report[.]md$/,s))];
 const read=async site=>{
   const contents=[];
   for(const path of paths){
     const response=await send(site,path,{cookie:owner});
     assert.equal(response.status,200,path);
     assert.ok(response.text);
     contents.push(response.text);
     const denied=await send(site,path,{cookie:other});
     assert.equal(denied.status,404,path);
     if(path!==reportPath)assert.deepEqual(denied.value,{error:'NOT_FOUND'},path);
   }
   const workspacePath='/api/workspace';
   const own=await send(site,workspacePath,{cookie:owner}), sibling=await send(site,workspacePath,{cookie:other});
   assert.equal(own.status,200);assert.equal(sibling.status,200);
   assert.equal(own.value.conversations[0].id,detailPath.split('/').at(-1));
   assert.deepEqual(sibling.value.conversations,[]);
   return {projectId:own.value.projectId,conversations:own.value.conversations,contents};
 };
 const before=await read(app);
 await app.close();
 await cp(root,snapshot,{recursive:true});
 const outbound=t.mock.method(globalThis,'fetch',async()=>assert.fail('unexpected outbound fetch'));
 const restored=await startAccountSite({projectRoot:snapshot,origin,auth});t.after(()=>restored.close());
 assert.deepEqual(await read(restored),before);
 assert.equal(outbound.mock.callCount(),0);
});
test('operator cookie policy fails closed and unsafe subject cannot become a filesystem path',async t=>{
 const root=await workspace(t);
 const auth={getSession:async()=>({user:{id:'../escape'}}),
   handler:async()=>new Response('',{headers:{'set-cookie':'sid=weak; SameSite=Lax'}})};
 const app=await startAccountSite({origin,projectRoot:root,auth});t.after(()=>app.close());
 assert.equal((await mutation(app,'/api/auth/sign-in/email',creds[0])).status,503);
 assert.equal((await send(app,'/api/workspace')).status,503);
 assert.throws(()=>accountProjectBasename('../escape'),{code:'ACCOUNT_SUBJECT_UNAVAILABLE'});
 await assert.rejects(startAccountSite({origin:'https://unsafe.example.test/path',projectRoot:root,auth}),{code:'ACCOUNT_ORIGIN_CONFIG'});
});
test('real Better Auth database revokes prior cookies and survives process restart',
 {skip:process.env.OPEN_ACCOUNT_REAL_TEST!=='1'},async t=>{
 const {openBetterAuth,prepareAccountDatabase,provisionOfflineAccount}=await import('../src/account-better-auth.mjs');
 const root=await workspace(t),stateDir=join(root,'auth'),secretFile=join(root,'secret');
 await writeFile(secretFile,randomBytes(32).toString('base64url'),{mode:0o600});
 const db={origin,secretFile,stateDir};
 await prepareAccountDatabase(db);
 for(const [i,c]of creds.entries()){
   const passwordFile=join(root,'password-'+i);await writeFile(passwordFile,c.password,{mode:0o600});
   const r=await provisionOfflineAccount({...db,...c,passwordFile,name:'Local fixture '+i});
   assert.match(accountProjectBasename(r.subject),/^u-[a-f0-9]{64}$/);
 }
 let auth=await openBetterAuth(db);
 const projectRoot=join(root,'projects');
 let app=await startAccountSite({origin,projectRoot,auth});
 t.after(async()=>{await app.close();auth?.close();});
 const a=await signIn(app,creds[0]),b=await signIn(app,creds[1]);
 const report=await createSyntheticReport(app,a);
 assert.equal((await send(app,report.reportPath,{cookie:b})).status,404);
 const out=await mutation(app,'/api/auth/sign-out',{},a);assert.equal(out.status,200,out.text);
 assert.equal((await send(app,report.reportPath,{cookie:a})).status,401);
 const again=await signIn(app,creds[0]);
 await app.close();auth.close();auth=null;
 auth=await openBetterAuth(db); app=await startAccountSite({origin,projectRoot,auth});
 assert.equal(sha256((await send(app,report.reportPath,{cookie:again})).text),report.sha256);
 assert.equal((await send(app,report.reportPath,{cookie:a})).status,401);
});
test('logout does not claim revocation if a previously issued cookie still resolves',async t=>{
 const root=await workspace(t);
 const auth={getSession:async headers=>headers.has('cookie')?{user:{id:'present'}}:null,
   handler:async()=>new Response(null,{headers:{'set-cookie':cookieName+'=; Max-Age=0'+attrs}})};
 const app=await startAccountSite({origin,projectRoot:root,auth}); t.after(()=>app.close());
 const r=await mutation(app,'/api/auth/sign-out',{},cookieName+'=stale');
 assert.equal(r.status,503);
 assert.equal(r.value.error,'ACCOUNT_REVOCATION_UNVERIFIED');
 assert.equal(r.headers['set-cookie'],undefined);
});
