import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const [planFile, outDir] = process.argv.slice(2);
if (!planFile || !outDir) throw new Error('Use: node run.mjs plan.json new-output-directory');
const plan = JSON.parse(await readFile(planFile, 'utf8'));
const apiOrigin = 'http://127.0.0.1:4182';
const sha = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value ?? null)).digest('hex');
const led = resolve(outDir, 'ledger.jsonl');
await mkdir(outDir, {mode:0o700});
const log = async (event, facts={}) => {
  const row={time:new Date().toISOString(),event,...facts};
  await appendFile(led,JSON.stringify(row)+'\n',{mode:0o600});
};
class Stop extends Error {}
async function api(path,{json,expected=200}={}) {
  const writing=json!==undefined;
  let r;
  try{
    r=await fetch(apiOrigin+path,{method:writing?'POST':'GET',redirect:'error',
      ...(writing?{headers:{origin:apiOrigin,'content-type':'application/json','sec-fetch-site':'same-origin'},body:JSON.stringify(json)}:{}),
      signal:AbortSignal.timeout(10000)});
  }catch(e){throw new Stop(writing?'POST_OUTCOME_UNKNOWN':'OBSERVATION_UNAVAILABLE');}
  if(r.status!==expected)
    throw new Stop((writing&&r.status>=500?'POST_OUTCOME_UNKNOWN_':'HTTP_')+r.status);
  try{return await r.json();}catch{throw new Stop(writing?'POST_OUTCOME_UNKNOWN_BAD_RECEIPT':'OBSERVATION_BAD_RECEIPT');}
}
const cidRe=/^[A-Za-z0-9_-]{1,48}$/;
const sanitizedCode=x=>typeof x==='string'&&/^[A-Z0-9_]{1,90}$/.test(x)?x:null;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const terminal=new Set(['completed','failed','cancelled']);
let current;
try{
 const w=await api('/api/workspace');
 assert.equal(w.schemaVersion,'local-gui@1');
 assert.equal(w.mode,'live-research');
 assert.equal(w.liveNotice.freeform,true);
 assert.deepEqual(w.sources,[]);
 assert.equal(w.liveNotice.connectivity.searchProvider,'exa-public-preview');
 assert.equal(w.liveNotice.connectivity.web,true);
 assert.equal(w.liveNotice.connectivity.wind,true);
 assert.equal(w.liveNotice.connectivity.searchAlternates?.length??0,0);
 assert.deepEqual(w.conversations,[],'Use a clean isolated Project; never write to owner History');
 await log('cohort_started',{candidate:plan.candidate,runtimeSrc:plan.runtimeSrc,manifestSha256:sha(plan),profile:'Go, public HTTPS, Exa and Wind; paid search alternates disabled'});
 for(const c of plan.cases){
   current={caseId:c.id};
   if(c.browserPdfPending){await log('pending_browser_pdf',current);continue;}
   await log('before_create',current);
   const created=await api('/api/conversations',{json:{},expected:201});
   if(!cidRe.test(created.id??''))throw new Stop('CREATE_RECEIPT_INVALID');
   current={...current,cid:created.id};
   for(let n=0;n<c.turns.length;n++){
     const question=c.turns[n];
     const mid='m'+randomUUID().replaceAll('-','');
     const base='/api/conversations/'+created.id;
     current={caseId:c.id,cid:created.id,turn:n+1,mid};
     await log('before_new_turn',{...current,inputSha256:sha(question)});
     const a=await api(base+'/messages',{json:{messageId:mid,question},expected:202});
     if(a.id!==mid||typeof a.runId!=='string')throw new Stop('TURN_RECEIPT_UNKNOWN');
     current={...current,runId:a.runId};
     await log('admitted',current);
     let seen,activeSteps=0,p={steps:[]};
     const deadline=Date.now()+170000;
     while(Date.now()<deadline){
        const d=await api(base);
        const matches=d.messages.filter(m=>m.id===mid);
        if(matches.length!==1||matches[0].runId!==a.runId)throw new Stop('HISTORY_IDENTITY_MISMATCH');
        seen=matches[0];
        if(c.id==='Q10'||terminal.has(seen.status)){
          p=await api(base+'/messages/'+mid+'/progress');
          if(p.schemaVersion!=='gui-research-progress@1')throw new Stop('PROGRESS_SCHEMA_MISMATCH');
          if(seen.status==='active')activeSteps=Math.max(activeSteps,p.steps.length);
        }
        if(terminal.has(seen.status))break;
        await pause(1100);
     }
     if(!seen||!terminal.has(seen.status))throw new Stop('OBSERVATION_DEADLINE_OUTCOME_UNKNOWN');
     const cold=(await api(base)).messages.filter(m=>m.id===mid);
     if(cold.length!==1||cold[0].runId!==a.runId||cold[0].status!==seen.status||sha(cold[0].output)!==sha(seen.output))throw new Stop('COLD_READBACK_MISMATCH');
     await log('terminal',{...current,status:seen.status,code:sanitizedCode(seen.code),outputSha256:sha(seen.output),questionRoundTrips:seen.question===question,
       finalAvailable:!!(seen.output?.answer||seen.output?.report),activeSteps,
       stepCodes:p.steps.map(s=>s.code).filter(x=>/^[a-z_-]{1,40}$/.test(x))});
     if(seen.status!=='completed')throw new Stop('KNOWN_RUNTIME_NON_COMPLETION_REVIEW_REQUIRED');
   }
   await log('needs_evidence_grade',{caseId:c.id});
 }
 await log('observation_complete_no_pass_claim');
}catch(e){
 await log('halted',{...current,reason:e instanceof Stop?e.message:'LOCAL_PREFLIGHT_OR_RUNNER_ASSERTION'});
 process.exitCode=1;
}
