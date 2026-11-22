import {DatabaseSync} from 'node:sqlite';
import {constants} from 'node:fs';
import {lstat, open, readFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {canonicalAccountOrigin} from './account-site.mjs';
import {ensureSafeDirectory, safeDirectory} from './storage-files.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const matchesSecret=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)&&
  Buffer.from(value,'base64url').length===32&&Buffer.from(value,'base64url').toString('base64url')===value;
async function privateRead(path,max){
  if(typeof path!=='string'||!isAbsolute(path))fail('ACCOUNT_PRIVATE_ABSOLUTE_PATH_REQUIRED');
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const stat=await file.stat();
    if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>max)fail('ACCOUNT_PRIVATE_FILE_REQUIRED');
    const data=await file.readFile();
    if(data.length>max)fail('ACCOUNT_PRIVATE_INPUT_LIMIT');
    return new TextDecoder('utf-8',{fatal:true}).decode(data);
  }finally{await file.close();}
}
async function privateDatabase(root,{initialize}){
  if(typeof root!=='string'||!isAbsolute(root))fail('ACCOUNT_DATABASE_PATH');
  if(initialize)await ensureSafeDirectory(root);
  await safeDirectory(root);
  const rootMode=(await lstat(root)).mode;
  if((rootMode&0o077)!==0)fail('ACCOUNT_DATABASE_PATH');
  const filename=join(root,'accounts.sqlite');
  if(initialize){
    try{const owned=await open(filename,'wx',0o600);await owned.close();}
    catch(e){if(e.code!=='EEXIST')throw e;}
  }
  const stat=await lstat(filename);
  if(!stat.isFile()||(stat.mode&0o077)!==0||stat.nlink!==1)fail('ACCOUNT_DATABASE_PATH');
  return new DatabaseSync(filename,{enableForeignKeyConstraints:true});
}
async function engine({origin,secretFile,stateDir,initialize=false,allowOfflineSignup=false}){
  const canonical=canonicalAccountOrigin(origin);
  const secret=(await privateRead(secretFile,128)).trim();
  if(!matchesSecret(secret))fail('ACCOUNT_SECRET_INVALID');
  let betterAuth,getMigrations,packageInfo;
  try{
    const entry=import.meta.resolve('better-auth');
    packageInfo=JSON.parse(await readFile(new URL('../package.json',entry),'utf8'));
  }catch{fail('ACCOUNT_DEPENDENCY_UNAVAILABLE');}
  if(packageInfo.name!=='better-auth'||packageInfo.version!=='1.7.27')fail('ACCOUNT_DEPENDENCY_VERSION');
  try {
    ({betterAuth}=await import('better-auth'));
    ({getMigrations}=await import('better-auth/db/migration'));
  }catch{fail('ACCOUNT_DEPENDENCY_UNAVAILABLE');}
  const database=await privateDatabase(stateDir,{initialize});
  try{
    database.exec('PRAGMA busy_timeout=5000');
    const options={
      baseURL:canonical.origin,basePath:'/api/auth',secret,database,trustedOrigins:[canonical.origin],
      emailAndPassword:{enabled:true,disableSignUp:!allowOfflineSignup,autoSignIn:false,minPasswordLength:14,maxPasswordLength:128},
      session:{expiresIn:8*60*60,disableSessionRefresh:true,cookieCache:{enabled:false}},
      account:{accountLinking:{enabled:false}},
      rateLimit:{enabled:true,window:60,max:12,storage:'database',customRules:{'/sign-out':false}},
      advanced:{ipAddress:{ipAddressHeaders:['x-open-account-ip']},useSecureCookies:true,cookiePrefix:'open-etf-account',defaultCookieAttributes:{httpOnly:true,sameSite:'strict',secure:true,path:'/'}},
      logger:{disabled:true},
    };
    const migration=await getMigrations(options);
    if(initialize)await migration.runMigrations();
    else if(migration.toBeCreated.length||migration.toBeAdded.length||migration.toBeAddedIndexes.length)fail('ACCOUNT_MIGRATION_REQUIRED');
    const auth=betterAuth(options);
    return {auth,database,canonical};
  }catch(e){database.close();throw e;}
}
// Service never enables sign-up, automigrates, or opens raw DB tools over HTTP.
export async function openBetterAuth(options={}){
  const {auth,database}=await engine({...options,initialize:false,allowOfflineSignup:false});
  return {handler:request=>auth.handler(request),getSession:headers=>auth.api.getSession({headers}),
    close:()=>database.close()};
}
// Deliberately separate offline-only operator process. Do not run a public
// listener on the account DB before the database and explicit users are staged.
export async function prepareAccountDatabase(options={}){
  const {database}=await engine({...options,initialize:true,allowOfflineSignup:false});
  database.close();
}
export async function provisionOfflineAccount(options={}){
  const {name,email}=options;
  const password=(await privateRead(options.passwordFile,512)).replace(/\r?\n$/,'');
  if(typeof name!=='string'||!name.trim()||name.length>128||typeof email!=='string'||email.length>254||
     !password||password.length<14||password.length>128)fail('ACCOUNT_PROVISION_INVALID');
  const {auth,database,canonical}=await engine({...options,initialize:false,allowOfflineSignup:true});
  try {
    const normalized=email.trim().toLowerCase();
    const subjectAtEmail=database.prepare('SELECT id FROM user WHERE email = ?');
    if(subjectAtEmail.get(normalized))fail('ACCOUNT_EMAIL_EXISTS');
    const result=await auth.api.signUpEmail({body:{name,email:normalized,password},headers:new Headers({origin:canonical.origin})});
    // With autoSignIn:false upstream intentionally returns opaque synthetic
    // success for duplicates. Never use a returned subject absent on disk.
    const persisted=subjectAtEmail.get(normalized);
    if(!result?.user?.id||persisted?.id!==result.user.id)fail('ACCOUNT_PROVISION_FAILED');
    return {subject:persisted.id};
  }finally{database.close();}
}
