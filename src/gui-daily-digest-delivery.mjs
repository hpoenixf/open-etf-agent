import {createHash} from 'node:crypto';
import {createDailyDigestHook,inspectDailyDigestEmail} from './daily-digest-email.mjs';
import {prepareScheduledSmtp} from './scheduled-smtp.mjs';

const fail=()=>{throw Object.assign(new Error('GUI_DAILY_DIGEST_CONFIG_INVALID'),{code:'GUI_DAILY_DIGEST_CONFIG_INVALID'});};

// Operator-only: no browser form can select hostname, credentials, origin, or
// recipient. Never fall back to per-watch mail when Resend is requested.
export function prepareOwnerDailyDigest(env,smtpOptions){
 const enabled=env.ETF_DAILY_DIGEST_ENABLED;
 if(enabled===undefined||enabled==='0')return null;
 if(enabled!=='1'||env.ETF_SCHEDULED_SMTP_PROFILE!=='resend-smtp')fail();
 const adapter=prepareScheduledSmtp(env,smtpOptions);
 if(!adapter)fail();
 const recipient=adapter.resolveDestination();
 const ownerOrigin=env.ETF_DAILY_DIGEST_OWNER_ORIGIN;
 const mode=env.ETF_DAILY_DIGEST_CONTENT??'links-only';
 if(!['links-only','full-report'].includes(mode))fail();
 createDailyDigestHook({ownerOrigin,mode,transport:adapter.transport,resolveConfirmedDestination:()=>null}); // Validate declared origin at startup.
 const version='digest-resend-'+createHash('sha256').update(JSON.stringify([recipient.version,ownerOrigin,...(mode==='full-report'?[mode]:[])])).digest('hex');
 return Object.freeze({
  version,contentMode:mode,
  recipientPreview:recipient.address.replace(/^(.).*@/,'$1***@'),
  inspect:inspectDailyDigestEmail,
  deliver(job){
   const hook=createDailyDigestHook({ownerOrigin,mode,transport:adapter.transport,
    resolveConfirmedDestination:selector=>selector.ownerId===job.ownerId&&selector.date===job.date&&job.confirmed()?recipient:null});
   return hook(job);
  },
 });
}
