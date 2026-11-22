import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isAbsolute } from 'node:path';
import { createScheduledReportEmailHook } from './scheduled-report-email.mjs';

const worker=fileURLToPath(new URL('./scheduled-smtp-worker.py',import.meta.url));
const fail=()=>{throw Object.assign(new Error('SCHEDULED_SMTP_CONFIG_INVALID'),{code:'SCHEDULED_SMTP_CONFIG_INVALID'});};
const mailbox=v=>typeof v==='string'&&v.length<=254&&/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(v);
const scalar=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\x00-\x20\x7f]/.test(v);

// Only the service operator supplies env/options. The browser cannot configure
// a relay host, submit SMTP credentials, or choose a recipient.
export function prepareScheduledSmtp(env,{python='/usr/bin/python3',testCaFile}={}){
 const prefix='ETF_SCHEDULED_SMTP_';
 const get=name=>Object.hasOwn(env,prefix+name)?env[prefix+name]:undefined;
 if(get('ENABLED')===undefined||get('ENABLED')==='0')return null;
 const host=get('HOST'),tls=get('TLS'),sender=get('FROM'),target=get('VERIFIED_TO'),version=get('VERIFIED_TO_VERSION');
 const user=get('USER'),password=get('PASSWORD'),port=get('PORT')??(tls==='implicit'?'465':'587');
 const profile=get('PROFILE')??'generic-smtp';
 // A generic relay does not promise deduplication. Bind the vendor header to
 // the explicit Resend profile and exact official TLS endpoint only.
 if(!['generic-smtp','resend-smtp'].includes(profile)||
   profile==='resend-smtp'&&(host!=='smtp.resend.com'||user!=='resend'||(tls==='implicit'?port!=='465':port!=='587')))fail();
 if(get('ENABLED')!=='1'||!scalar(host,253)||!(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i).test(host)||
   !['implicit','starttls'].includes(tls)||!(/^[1-9]\d{0,4}$/).test(port)||Number(port)>65535||
   !mailbox(sender)||!mailbox(target)||!scalar(version,120)||!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(version)||
   !scalar(user,320)||typeof password!=='string'||!password.length||password.length>2048||password.includes('\0')||
   typeof python!=='string'||!isAbsolute(python)||testCaFile!==undefined&&(typeof testCaFile!=='string'||!isAbsolute(testCaFile)))fail();
 const childEnv={SMTP_HOST:host,SMTP_TLS:tls,SMTP_PORT:port,SMTP_FROM:sender,SMTP_USER:user,SMTP_PASSWORD:password,SMTP_PROFILE:profile,
   ...(testCaFile?{SMTP_TEST_CA:testCaFile}:{})};
 // Bind actual recipient and declared verifier revision. If the operator edits
 // the address but forgets to bump the revision, prior watches still cannot send.
 const recipientVersion='smtp-owner-'+createHash('sha256').update(JSON.stringify([target,version])).digest('hex');
 const destination=Object.freeze({address:target,version:recipientVersion,enabled:true,verified:true});
 return Object.freeze({
  // Values including recipient and credentials are never returned by JSON.
  resolveDestination:()=>destination,
  async transport(payload){
   if(payload?.to!==target||typeof payload.subject!=='string'||typeof payload.text!=='string'||
      !(/^[a-f0-9]{64}$/).test(payload.idempotencyKey))return {status:'not-dispatched'};
   return new Promise(resolve=>{
    const proc=execFile(python,['-I',worker],{env:childEnv,timeout:25000,maxBuffer:1024},(error,stdout)=>{
     if(error)return resolve({status:['ENOENT','EACCES'].includes(error.code)?'not-dispatched':'unknown'});
     const status=stdout.trim();
     // SMTP has no portable idempotency receipt. This is a local reference to
     // the stable Message-ID, not proof of recipient delivery or deduplication.
     if(status==='accepted')return resolve({status,receiptId:'smtp-'+payload.idempotencyKey});
     resolve({status:status==='not-dispatched'?status:'unknown'});
    });
    proc.stdin.on('error',()=>{});
    proc.stdin.end(JSON.stringify(payload));
   });
  }
 });
}

// CLI/host can compose this only after reading a currently confirmed watch
// destination policy; the env is the operator's verified recipient binding,
// not a self-service verification flow.
export function createScheduledSmtpHook(env,{resolveConfirmedWatch,...options}={}){
 const adapter=prepareScheduledSmtp(env,options);
 if(!adapter)return undefined;
 if(typeof resolveConfirmedWatch!=='function')fail();
 return createScheduledReportEmailHook({
  transport:adapter.transport,
  resolveConfirmedDestination:async selector=> {
   const destination=adapter.resolveDestination();
   return await resolveConfirmedWatch({...selector,recipientVersion:destination.version})===true?destination:null;
  },
 });
}
