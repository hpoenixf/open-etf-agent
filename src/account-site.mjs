import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {createLocalGuiWorkspace} from './gui-server.mjs';
import {ensureSafeDirectory, safeDirectory} from './storage-files.mjs';

const cleanHeaders={
  'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  'cross-origin-resource-policy':'same-origin',
};
const SESSION_COOKIE='__Secure-open-etf-account.session_token';
const allowedAuth=new Map([['/api/auth/sign-in/email','sign-in'],['/api/auth/sign-out','sign-out']]);
const identityHint=/^(?:x-(?:open-|agent-|verified-)?(?:user-id|tenant-id|scope-id|identity|scope)|authorization)$/i;
const identityQuery=new Set(['userId','tenantId','scopeId','scope','verifiedIdentity','projectDir']);
const err=(status,code)=>Object.assign(new Error(code),{status,code});

export function canonicalAccountOrigin(value){
  let url;
  try{url=new URL(value);}catch{throw err(400,'ACCOUNT_ORIGIN_CONFIG');}
  if(url.protocol!=='https:'||url.origin!==value||!url.hostname||url.username||url.password||
    ['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw err(400,'ACCOUNT_ORIGIN_CONFIG');
  return url;
}
export function accountProjectBasename(subject){
  if(typeof subject!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(subject))throw err(503,'ACCOUNT_SUBJECT_UNAVAILABLE');
  return 'u-'+createHash('sha256').update('open-etf-account-project@1\0').update(subject).digest('hex');
}
function json(res,status,value,{method='GET',headers={}}={}){
  const bytes=Buffer.from(JSON.stringify(value));
  res.writeHead(status,{...cleanHeaders,'content-type':'application/json; charset=utf-8','content-length':bytes.length,...headers});
  res.end(method==='HEAD'?undefined:bytes);
}
function countHeaders(req,name){
  return req.rawHeaders.reduce((n,value,i)=>(i%2===0&&value.toLowerCase()===name?n+1:n),0);
}
function checkRequest(req,canonical){
  if(countHeaders(req,'host')!==1||req.headers.host!==canonical.host||
    countHeaders(req,'origin')>1||(req.headers.origin&&req.headers.origin!==canonical.origin))throw err(403,'ACCOUNT_ORIGIN_REQUIRED');
  if(!['GET','HEAD','POST'].includes(req.method))throw err(405,'ACCOUNT_METHOD');
  if(req.method==='POST'&&(req.headers.origin!==canonical.origin||req.headers['sec-fetch-site']==='cross-site'))throw err(403,'ACCOUNT_ORIGIN_REQUIRED');
  // Reject absolute-form, backslash canonicalization, encoded or dot paths
  // before authorization dispatch. Routing accepts no client identity hint.
  if(typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//')||
     /[\\%\0]/.test(req.url.split('?')[0])||req.url.split('?')[0].split('/').some(part=>part==='.'||part==='..'))throw err(400,'ACCOUNT_PATH');
  const url=new URL(req.url,canonical);
  if(Object.keys(req.headers).some(k=>identityHint.test(k))||[...url.searchParams.keys()].some(k=>identityQuery.has(k)))throw err(400,'ACCOUNT_IDENTITY_OVERRIDE');
  return url;
}
async function authBody(req,action){
  if(req.headers['content-type']?.split(';')[0]!=='application/json'||req.headers['content-encoding']!==undefined)throw err(415,'ACCOUNT_JSON_REQUIRED');
  if(Number(req.headers['content-length'])>4096)throw err(413,'ACCOUNT_INPUT_LIMIT');
  const pieces=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>4096)throw err(413,'ACCOUNT_INPUT_LIMIT');pieces.push(chunk);}
  let value;
  try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(pieces)));}catch{throw err(400,'ACCOUNT_INPUT');}
  const exact=value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===(action==='sign-in'?'email,password':'');
  if(!exact||(action==='sign-in'&&(![value.email,value.password].every(x=>typeof x==='string'&&x.length>0)||value.email.length>254||value.password.length>128)))throw err(400,'ACCOUNT_INPUT');
  return action==='sign-in'?JSON.stringify({email:value.email,password:value.password,rememberMe:false}):'{}';
}
function authHeaders(req,canonical){
  const headers=new Headers({origin:canonical.origin,'content-type':'application/json','x-open-account-ip':'127.0.0.1'});
  if(typeof req.headers['sec-fetch-site']==='string')headers.set('sec-fetch-site',req.headers['sec-fetch-site']);
  // Do not trust forwarded client IP from peer. A distinct local admission
  // gate can later populate per-IP rate limits from a verified proxy boundary.
  return headers;
}
function sessionHeaders(req){
  const values=typeof req.headers.cookie==='string'?req.headers.cookie.split(';').map(v=>v.trim()).filter(v=>v.startsWith(SESSION_COOKIE+'=')):[];
  if(values.length>1)throw err(400,'ACCOUNT_COOKIE_AMBIGUOUS');
  return new Headers(values.length===1?{cookie:values[0]}:{});
}
function verifyCookieAttributes(cookies){
  for(const cookie of cookies)if(!/;\s*Secure(?:;|$)/i.test(cookie)||!/;\s*HttpOnly(?:;|$)/i.test(cookie)||
    !/;\s*SameSite=Strict(?:;|$)/i.test(cookie)||!/;\s*Path=\/(?:;|$)/i.test(cookie)||/;\s*Domain=/i.test(cookie))throw err(503,'ACCOUNT_COOKIE_POLICY');
}
const loginAssets = new Map([['/account/login',['login.html','text/html']],['/account/',['login.html','text/html']],['/account',['login.html','text/html']],['/account/login.mjs',['login.mjs','text/javascript']]]);
export async function startAccountSite({origin,projectRoot,auth,port=0,maxWorkspaces=6}={}){
  const canonical=canonicalAccountOrigin(origin);
  if(!Number.isInteger(port)||port<0||port>65535||!Number.isInteger(maxWorkspaces)||maxWorkspaces<1||maxWorkspaces>16||
    !auth||typeof auth.handler!=='function'||typeof auth.getSession!=='function')throw err(400,'ACCOUNT_SITE_CONFIG');
  await ensureSafeDirectory(projectRoot);
  const root=await safeDirectory(projectRoot), bySubject=new Map(),assets=new Map();
  for(const [route,[file,type]] of loginAssets)assets.set(route,[await readFile(new URL('./account-ui/'+file,import.meta.url)),type]);
  let closing;
  async function workspace(subject){
    if(closing)throw err(503,'ACCOUNT_SITE_CLOSING');
    const key=accountProjectBasename(subject);
    if(!bySubject.has(key)){
      if(bySubject.size>=maxWorkspaces)throw err(503,'ACCOUNT_WORKSPACE_CAPACITY');
      // Select only the authenticated subject's deterministic directory. Do
      // not propagate deployment provider credentials or a live task config.
      const path=join(root,key);
      const pending=ensureSafeDirectory(path).then(projectDir=>createLocalGuiWorkspace({projectDir,origin:canonical.origin,env:Object.freeze({})}));
      bySubject.set(key,pending);
      pending.catch(()=>{if(bySubject.get(key)===pending)bySubject.delete(key);});
    }
    return bySubject.get(key);
  }
  async function handle(req,res){
    try{
      if(closing)throw err(503,'ACCOUNT_SITE_CLOSING');
      const url=checkRequest(req,canonical);
      if(assets.has(url.pathname)&&req.method!=='POST'&&!url.search){
        const [bytes,type]=assets.get(url.pathname);
        res.writeHead(200,{...cleanHeaders,'content-type':type+'; charset=utf-8','content-length':bytes.length});
        res.end(req.method==='HEAD'?undefined:bytes);return;
      }
      const action=allowedAuth.get(url.pathname);
      if(action&&req.method==='POST'&&!url.search){
        const chosen=sessionHeaders(req);
        const headers=authHeaders(req,canonical);
        headers.delete('cookie');
        if(chosen.has('cookie'))headers.set('cookie',chosen.get('cookie'));
        const response=await auth.handler(new Request(url,{method:'POST',headers,body:await authBody(req,action)}));
        const cookies=response.headers.getSetCookie();
        if(response.ok&&!cookies.some(c=>c.startsWith(SESSION_COOKIE+'=')))throw err(503,'ACCOUNT_COOKIE_POLICY');
        verifyCookieAttributes(cookies);
        // Never expose the library's session token, error details, profile or
        // redirect values to JavaScript; return only status and secured cookie.
        if(!response.ok)throw err(response.status===429?429:401,response.status===429?'ACCOUNT_THROTTLED':'ACCOUNT_SIGN_IN_FAILED');
        if(action==='sign-in'){
          const signed=cookies.find(c=>c.startsWith(SESSION_COOKIE+'=')).split(';')[0];
          let fresh;
          try{fresh=await auth.getSession(new Headers({cookie:signed}));}
          catch{throw err(503,'ACCOUNT_SESSION_UNAVAILABLE');}
          if(!fresh?.user?.id)throw err(503,'ACCOUNT_SESSION_UNAVAILABLE');
          accountProjectBasename(fresh.user.id);
        }
        if(action==='sign-out'){
          // Upstream can return success after logging a delete error. Confirm
          // the exact previously presented cookie no longer resolves on disk.
          let old;
          try{old=await auth.getSession(chosen);}catch{throw err(503,'ACCOUNT_REVOCATION_UNVERIFIED');}
          if(old?.user?.id)throw err(503,'ACCOUNT_REVOCATION_UNVERIFIED');
        }
        json(res,200,{status:action==='sign-in'?'signed-in':'signed-out'},{method:req.method,headers:{'set-cookie':cookies}});
        return;
      }
      if(url.pathname.startsWith('/api/auth/')||url.pathname==='/api/auth')throw err(404,'ACCOUNT_AUTH_ROUTE_DISABLED');
      const chosen=sessionHeaders(req);
      let session;
      try { session=await auth.getSession(chosen); }
      catch { throw err(503,'ACCOUNT_SESSION_UNAVAILABLE'); }
      if(url.pathname==='/api/account/status'&&req.method==='GET'&&!url.search){
        json(res,200,{authenticated:!!session?.user?.id});return;
      }
      if(!session?.user?.id){
        if(req.method!=='POST'&&url.pathname==='/'&&!url.search){
          res.writeHead(303,{...cleanHeaders,location:'/account/login'});res.end();return;
        }
        throw err(401,'ACCOUNT_REQUIRED');
      }
      const selected=await workspace(session.user.id);
      return await selected.handle(req,res);
    }catch(e){
      if(!res.headersSent&&!res.destroyed)json(res,e.status??503,{error:e.status?e.code:'ACCOUNT_SERVICE_UNAVAILABLE'},{method:req.method});
      else if(!res.writableEnded)res.destroy();
    }
  }
  const server=createServer({maxHeaderSize:8192},handle);
  server.requestTimeout=10000;server.headersTimeout=8000;server.keepAliveTimeout=5000;
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve();});
  });
  return Object.freeze({port:server.address().port,origin:canonical.origin,async close(){
    if(!closing){
      // Stop admission first; let completion release exactly the selected workspaces.
      const stopped=new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
      closing=Promise.all([stopped,...[...bySubject.values()].map(p=>p.then(w=>w.close(),()=>{}))]).then(()=>undefined);
    }
    await closing;
  }});
}
