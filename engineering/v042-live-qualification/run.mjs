import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {constants} from 'node:fs';
import {readFile,mkdir,open,realpath,lstat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {setTimeout as wait} from 'node:timers/promises';

export const PLAN_SHA='d5c4692c24cecb1ac24f2eb9587c61d5daa17c1152afa2ab815ef6f155830d07';
const GO='https://opencode.ai/inference/go/openai/v1/chat/completions';
const sha=value=>createHash('sha256').update(value).digest('hex');
const jsonHash=value=>sha(JSON.stringify(value??null));
const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const oid=/^conversation-[0-9a-f]{40}$/;
const gid=/^[a-zA-Z0-9_-]{1,48}$/;
const hex=/^[a-f0-9]{64}$/;
const safeCode=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(value)?value:null;
const terminal=new Set(['completed','failed','cancelled']);
class Stop extends Error {}
const stop=code=>{throw new Stop(code);};

export async function frozenPlan(){
 const bytes=await readFile(new URL('./plan.json',import.meta.url));
 if(sha(bytes)!==PLAN_SHA)stop('PLAN_DIGEST_MISMATCH');
 const plan=JSON.parse(bytes);
 if(plan.schemaVersion!=='open-v042-real-qualification@1'||plan.cases.length!==10||new Set(plan.cases.map(c=>c.id)).size!==10||
   plan.cases.some((c,i)=>c.id!==String(i+1).padStart(2,'0')||(!c.question&&!c.sameAs))||
   plan.cases.filter(c=>c.mode==='watch').length!==6)stop('PLAN_INVALID');
 return plan;
}

async function syncDirectory(dir){
 const fd=await open(dir,constants.O_RDONLY|constants.O_DIRECTORY);
 try{await fd.sync();}finally{await fd.close();}
}

// One new private cohort path only. Fatal/missing/unknown runs are never
// converted to a second logical Run. Operator may inspect JSON after a crash,
// but this runner cannot resume or create a second dispatcher in that folder.
export async function newLedgers(directory,{physicalCap,fetchOriginal=globalThis.fetch}){
 if(!Number.isSafeInteger(physicalCap)||physicalCap<1||physicalCap>49994)stop('INVALID_PHYSICAL_AUTHORIZATION');
 await mkdir(directory,{mode:0o700});
 const facts=await open(join(directory,'cohort.jsonl'),'ax',0o600);
 const provider=await open(join(directory,'provider.jsonl'),'ax',0o600);
 await syncDirectory(directory);await syncDirectory(dirname(directory));
 let used=0,lock=Promise.resolve(),active;
 const seen=new Set(),physical=new Map();
 const enqueue=operation=>{
  const done=lock.then(operation);lock=done.catch(()=>{});return done;
 };
 const append=async(fd,event,facts)=>{await fd.writeFile(JSON.stringify({event,at:new Date().toISOString(),...facts})+'\n');await fd.sync();};
 return {
  log:(event,data={})=>enqueue(()=>append(facts,event,data)),
  setCase(id){active=id;},
  get count(){return used;},
  requests:runId=>(physical.get(runId)??[]).map(r=>({...r})),
  async fetch(url,opts,context){
   const scope=active;
   if(!/^(?:0[1-9]|10)$/.test(scope??'')||String(url)!==GO||opts?.method!=='POST'||opts.redirect!=='error'||
     !oid.test(context?.runId??'')||context.runId!==context.rootId||context.role!=='main'||context.purpose!=='main'||
     !Number.isSafeInteger(context.modelOrdinal)||context.modelOrdinal<1||!hex.test(context.inputHash??'')||typeof opts.body!=='string')stop('SCOPE_OR_NATIVE_WITNESS_INVALID');
   const key=context.rootId+':'+context.modelOrdinal;
   const row={caseId:scope,runId:context.runId,ordinal:context.modelOrdinal,inputSha256:context.inputHash,wireSha256:sha(opts.body)};
   await enqueue(async()=>{
    if(seen.has(key))stop('DUPLICATE_PHYSICAL_REQUEST_REFUSED');
    if(used>=physicalCap)stop('AUTHORIZED_PHYSICAL_CAP_EXHAUSTED');
    await append(provider,'before_provider_post',{...row,postingOrdinal:used+1});
    seen.add(key);used++;
    const list=physical.get(row.runId)??[];list.push(row);physical.set(row.runId,list);
   });
   let response;
   try{response=await fetchOriginal(url,opts);}catch(error){
    await enqueue(()=>append(provider,'remote_post_outcome_unknown',row));
    throw error;
   }
   row.httpStatus=response.status;
   await enqueue(()=>append(provider,'provider_headers_observed',{...row}));
   return response; // Never consume, clone, replace, or retry the original body.
  },
  billing:data=>enqueue(()=>append(provider,'native_billing_projection',data)),
  async close(){await lock;await facts.close();await provider.close();},
 };
}

function datesFromNow(){
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
 const current=Date.parse(fmt.format(new Date())+'T00:00:00Z');
 return index=>new Date(current+index*86400000).toISOString().slice(0,10);
}
function awaitSlot(date,time){return Date.parse(date+'T'+time+':00+08:00');}
function approvedSource(raw){
 try{const url=new URL(raw);return url.protocol==='https:'&&(!url.username&&!url.password)?{host:url.hostname,url:url.origin+url.pathname,urlSha256:sha(url.href)}:null;}catch{return null;}
}
function hostMatches(host,approved=[]){return approved.some(g=>host===g||host.endsWith('.'+g));}
async function boundedTimeline(directory){
 const path=join(directory,'run.jsonl');
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{
  const stat=await f.stat();if(!stat.isFile()||stat.size>2097152)stop('NATIVE_TIMELINE_UNAVAILABLE');
  return (await f.readFile('utf8')).split('\n').filter(Boolean).map(line=>JSON.parse(line));
 }finally{await f.close();}
}
function amount(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
function billingProjection(event){
 const u=event?.usage,o=u?.opencode;
 return {cost:amount(u?.cost),billingSource:['go','go-plus','balance'].includes(o?.billing_source)?o.billing_source:null,
  allowance:amount(o?.allowance),listCost:amount(o?.list_cost),estimated:typeof o?.estimated==='boolean'?o.estimated:null};
}
function shapeLimits(plan,live){
 return stable(plan.limits)===stable(live?.limits);
}

async function execute({plan,source,project,liveConfig,directory,operatorCap,baseDay,requireIncluded}){
 if(!source||!project||!liveConfig||!directory||!Number.isSafeInteger(operatorCap)||operatorCap<1||operatorCap>plan.maxPhysicalPosts)stop('EXPLICIT_OPERATOR_ARGUMENTS_REQUIRED');
 const root=await realpath(source);
 const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:10000}).trim();
 if(git(['rev-parse','HEAD'])!==plan.candidate||git(['rev-parse','HEAD:src'])!==plan.runtimeSrc||
   git(['status','--porcelain','--untracked-files=all','--','src']))stop('UNPINNED_OR_MODIFIED_SOURCE');
 const config=JSON.parse(await readFile(liveConfig,'utf8'));
 if(config.gateway?.provider!=='opencode-go-owner'||config.gateway.endpoint!==GO||config.gateway.apiKeyEnv!=='ETF_GUI_PROVIDER_KEY'||
   config.connectivity?.web!==true||config.connectivity.search!=='exa-public-preview'||config.connectivity.wind!==undefined||
   config.connectivity.searchAlternates!==undefined||config.toolAccounting!==undefined||!shapeLimits(plan,config))stop('UNVERIFIED_OR_DIFFERENT_LAUNCH_PROFILE');
 const key=process.env.ETF_GUI_PROVIDER_KEY;
 if(typeof key!=='string'||!key.trim())stop('OWNER_PROVIDER_ENV_REQUIRED');
 if(baseDay!==undefined&&(!/^\d{4}-\d{2}-\d{2}$/.test(baseDay)||baseDay!==datesFromNow()(0)))stop('INVALID_QUALIFICATION_START_DAY');
 const projectDir=resolve(project),ledgerDir=resolve(directory);
 if(projectDir===ledgerDir||projectDir.startsWith(root+'/')||ledgerDir.startsWith(root+'/'))stop('NEW_ISOLATED_PROJECT_AND_LEDGER_REQUIRED');
 for(const p of [projectDir,ledgerDir]){
  if(await realpath(dirname(p))!==dirname(p))stop('CANONICAL_STAGING_PARENT_REQUIRED');
  try{await lstat(p);stop('EXISTING_PROJECT_OR_LEDGER_REFUSED');}catch(error){if(error.code!=='ENOENT')throw error;}}
 const modules=Object.fromEntries(await Promise.all(['gui-server','research-project','conversation','web-acquisition'].map(async name=>[name,await import(pathToFileURL(join(root,'src',name+'.mjs')).href)])));
 const ledger=await newLedgers(ledgerDir,{physicalCap:operatorCap});
 let gui,current,clock=0,grant=null;
 const dateAt=datesFromNow(),stateForWatch=new Map(),caseOutputs=new Map();
 const openGui=()=>modules['gui-server'].startLocalGui({projectDir,liveConfig:config,env:{ETF_GUI_PROVIDER_KEY:key,ETF_GUI_DAILY_AUTORUN:'1'},
  dailyClock:()=>{if(grant===null)return clock;const once=grant;grant=null;return once;},fetchImpl:ledger.fetch});
 async function api(path,body,status=200){
  let response;
  try{response=await fetch(gui.origin+path,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(20000),
    ...(body===undefined?{}:{headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)})});}
  catch{stop(body===undefined?'READBACK_UNAVAILABLE':'GUI_POST_OUTCOME_UNKNOWN');}
  if(response.status!==status)stop(body===undefined?'READBACK_HTTP_FAILURE':response.status>=500?'GUI_POST_OUTCOME_UNKNOWN':'GUI_POST_NOT_ACCEPTED');
  try{return await response.json();}catch{stop(body===undefined?'READBACK_INVALID':'GUI_POST_OUTCOME_UNKNOWN');}
 }
 const watches=()=>api('/api/daily-watch');
 const watchBody=(question,enabled=true)=>({question,localTime:'08:00',enabled});
 async function saveWatch(c,question){
  const prior=stateForWatch.get(c.watch);
  if(c.operation==='same'){if(!prior||prior.question!==question)stop('UNCHANGED_WATCH_INTENT_MISMATCH');return;}
  await ledger.log('before_watch_change',{caseId:c.id,watch:c.watch,operation:c.operation,inputSha256:sha(question)});
  const row=await api('/api/daily-watch'+(prior?'/'+prior.id:''),watchBody(question),prior?200:201);
  if(!/^w[0-9a-f]{24}$/.test(row.id??'')||row.question!==question||row.enabled!==true||prior&&prior.id!==row.id)stop('WATCH_IDENTITY_MISMATCH');
  stateForWatch.set(c.watch,{id:row.id,question});
 }
 async function pauseWatch(name){
  const row=stateForWatch.get(name);
  if(!row)return;
  await ledger.log('before_watch_pause',{watch:name,watchId:row.id});
  await api('/api/daily-watch/'+row.id,watchBody(row.question,false));
 }
 async function observe(c,identity,question){
  const path='/api/conversations/'+identity.conversationId;
  const inspect=()=>api(path);
  let turn;
  const deadline=Date.now()+plan.limits.timeoutMs+60000;
  while(Date.now()<deadline){
   const result=await inspect(),matching=result.messages.filter(m=>m.id===identity.messageId);
   if(matching.length!==1||matching[0].runId!==identity.runId||matching[0].question!==question)stop('HISTORY_IDENTITY_MISMATCH');
   turn=matching[0];
   if(terminal.has(turn.status))break;
   await wait(300);
  }
  if(!turn||!terminal.has(turn.status))stop('OBSERVATION_OUTCOME_UNKNOWN');
  const native=modules['research-project'];
  const [{run},capacity,durable]=await Promise.all([
   native.inspectResearchTask({projectDir,runId:identity.runId}),native.inspectResearchCapacity({projectDir,runId:identity.runId}),
   modules.conversation.readConversationMessage({projectDir,...identity}).catch(()=>null),
  ]);
  if(!run||run.status!==turn.status||run.runId!==identity.runId||run.rootId!==identity.runId)stop('NATIVE_RUN_IDENTITY_MISMATCH');
  const witnessed=ledger.requests(identity.runId),anyUnknown=run.snapshot.gatewayOutcome==='unknown'||capacity.requests.some(r=>!r||['unknown','dispatched','queued'].includes(r.state))||
    witnessed.some(x=>x.httpStatus===undefined);
  const timeline=await boundedTimeline(run.directory).catch(()=>[]);
  const own=timeline.filter(e=>e.runId===run.runId&&e.rootId===run.rootId);
  const proposalRows=own.filter(r=>r.type==='model_proposal');
  const ordered=witnessed.length===proposalRows.length&&witnessed.length===capacity.requests.length&&
   witnessed.every((w,i)=>w.ordinal===i+1&&w.httpStatus===200&&capacity.requests[i]?.modelOrdinal===w.ordinal&&capacity.requests[i].state==='completed');
  const costs=ordered?proposalRows.map(billingProjection):[];
  for(let i=0;i<witnessed.length;i++){
   const w=witnessed[i],nativeTicket=capacity.requests.find(x=>x?.modelOrdinal===w.ordinal);
   await ledger.billing({caseId:c.id,runId:run.runId,ordinal:w.ordinal,ticketState:nativeTicket?.state??'missing',
    ...(ordered?{observed:costs[i],attribution:'ordered-complete-main-only'}:{attribution:'unverified'})});
  }
  const outputText=durable?.output?.report?.text??durable?.output?.answer?.text??null;
  const shownText=turn.output?.report?.text??turn.output?.answer??null;
  const bodyHash=outputText!==null?sha(outputText):null;
  const finalVerified=turn.status==='completed'&&bodyHash!==null&&outputText===shownText&&durable?.output?.publicationStatus==='published';
  const pages=[];
  for(const event of own.filter(e=>e.type==='tool_result'&&e.name==='public_web_read'&&typeof e.callId==='string'&&e.callId.length>0&&e.callId.length<=200)){
   const acquisitionId='page-'+sha(JSON.stringify([run.runId,event.callId])).slice(0,40);
   try{
    const a=await modules['web-acquisition'].inspectWebAcquisition({projectDir,acquisitionId});
    const src=approvedSource(a.plan?.urls?.[0]);
    if(src)pages.push({...src,traceState:a.status,code:safeCode(a.code),manifestSha256:hex.test(a.manifestSha256??'')?a.manifestSha256:null});
   }catch{/* no evidence for an unreadable record */}
  }
  const baselineExpected=c.id==='03'?caseOutputs.get('01'):null;
  const baseline=identity.baseline??null;
  const baselineMatch=c.mode!=='watch'||(baselineExpected?baseline?.runId===baselineExpected.runId&&baseline?.sha256===baselineExpected.bodySha256:baseline===null);
  const expectedReject=c.unavailableUrl?pages.some(p=>p.urlSha256===sha(c.unavailableUrl)&&p.traceState==='failed'):null;
  const hasPrimary=pages.some(p=>p.traceState==='succeeded'&&hostMatches(p.host,c.hosts));
  const approvedFailure=pages.some(p=>p.traceState==='failed'&&hostMatches(p.host,c.hosts));
  const stableHash=jsonHash(turn.output);
  const before=ledger.count;
  // Close the original GUI Worker and reopen the same Project, with no
  // qualification clock slots armed, then use only read routes.
  await gui.close();gui=await openGui();
  const after=(await inspect()).messages.filter(m=>m.id===identity.messageId);
  const coldVerified=after.length===1&&after[0].runId===identity.runId&&after[0].status===turn.status&&jsonHash(after[0].output)===stableHash&&ledger.count===before;
  const primaryDocs=new Set(pages.filter(p=>p.traceState==='succeeded'&&hostMatches(p.host,c.hosts)).map(p=>p.urlSha256));
  const scopeVerified=!!(c.unavailableUrl?expectedReject:c.id==='10'?primaryDocs.size>=2:hasPrimary||(c.id==='09'&&approvedFailure));
  const provisional=finalVerified&&baselineMatch&&coldVerified&&scopeVerified?'needs-manual-evidence-grade':'not-passed';
  const record={caseId:c.id,runId:run.runId,conversationId:identity.conversationId,messageId:identity.messageId,questionSha256:sha(question),status:turn.status,
    code:safeCode(turn.code),bodySha256:bodyHash,persistedPublication:finalVerified,coldHistory:coldVerified,baselineMatch,
    baselineRunId:baseline?.runId??null,nativeUsage:run.rootUsage,physicalPosts:witnessed.length,providerOutcomeUnknown:anyUnknown,
    approvedPrimaryRead:hasPrimary,approvedSourceFailure:approvedFailure,pages,expectedRefusal:expectedReject,assessment:provisional};
  await ledger.log('observed_case',record);
  caseOutputs.set(c.id,record);
  if(anyUnknown)stop('UNKNOWN_PROVIDER_OR_ADMISSION_NO_RETRANSMIT');
  if(costs.some(c=>c.cost!==null&&c.cost>0||c.billingSource==='balance'))stop('OUTSIDE_INCLUDED_USAGE_OBSERVED');
  if(requireIncluded&&witnessed.length>0&&(!ordered||costs.some(c=>c.cost!==0||!['go','go-plus'].includes(c.billingSource))))stop('INCLUDED_BILLING_EVIDENCE_UNAVAILABLE');
  if(!coldVerified)stop('COLD_HISTORY_IDENTITY_MISMATCH');
 }
 async function runWatch(c,question,date){
  const row=stateForWatch.get(c.watch);
  if(!row)stop('WATCH_NOT_CREATED');
  await ledger.log('before_watch_slot',{caseId:c.id,watchId:row.id,date,inputSha256:sha(question)});
  if(grant!==null)stop('CLOCK_ALREADY_ARMED');
  grant=awaitSlot(date,'08:00');
  const work=gui.sweepDaily();
  // Only one time projection is permitted to expose a due slot; later
  // timer ticks see 07:55, even if the original research takes a long time.
  const deadline=Date.now()+20000;
  while(grant!==null&&Date.now()<deadline){await wait(50);}
  if(grant!==null){grant=null;stop('WATCH_SLOT_NOT_OBSERVED');}
  await work;
  let occurrence;
  const finish=Date.now()+plan.limits.timeoutMs+60000;
  do{
   const view=await watches();const entries=view.items.find(w=>w.id===row.id)?.history.filter(x=>x.date===date)??[];
   if(entries.length>1)stop('WATCH_DAY_DUPLICATED');
   occurrence=entries[0];
   if(occurrence&&terminal.has(occurrence.status))break;
   // SQLite's cold unresolved claim is unknown, never refreshed into action.
   if(occurrence?.status==='unknown'&&!occurrence.runId){await wait(300);continue;}
   await wait(300);
  }while(Date.now()<finish);
  if(!occurrence||!terminal.has(occurrence.status)||!oid.test(occurrence.runId??'')||
    occurrence.conversationId!=='daily-'+row.id+'-'+date.slice(0,4)||occurrence.messageId!=='day-'+date)stop('WATCH_SLOT_OUTCOME_UNKNOWN');
  await observe(c,occurrence,question);
 }
 try{
  clock=awaitSlot(dateAt(0),'07:55');gui=await openGui();
  const workspace=await api('/api/workspace');
  if(workspace.mode!=='live-research'||!workspace.liveNotice?.freeform||workspace.liveNotice.maxModelCallsPerRun!==plan.limits.model||
   workspace.conversations.length||workspace.sources.length||workspace.liveNotice.connectivity?.searchProvider!=='exa-public-preview'||
   workspace.liveNotice.connectivity?.wind)stop('EXPECTED_FRESH_OWNER_PROFILE_REQUIRED');
  await ledger.log('cohort_started',{candidate:plan.candidate,runtimeSrc:plan.runtimeSrc,manifestSha256:PLAN_SHA,projectId:workspace.projectId,
   sourceMode:'real Go, public HTTPS and keyless Exa; no mail or paid search',date0:dateAt(0),physicalCap:operatorCap,
   excludedPriorProviderPosts:plan.priorExcludedPhysicalPosts,denominator:plan.cases.length});
  const byId=new Map(plan.cases.map(c=>[c.id,c])),questionFor=c=>c.question??byId.get(c.sameAs)?.question;
  for(const [i,c] of plan.cases.entries()){
   current=c.id;ledger.setCase(c.id);
   const question=questionFor(c);
   if(c.mode==='watch'){
    const date=dateAt(c.day);clock=awaitSlot(date,'07:55');
    if(c.id==='01'){await saveWatch(c,question);await saveWatch(byId.get('02'),questionFor(byId.get('02')));}
    if(c.id==='03')await saveWatch(byId.get('04'),questionFor(byId.get('04')));
    if(c.id==='05'){await pauseWatch('A');await pauseWatch('B');}
    if(!['01','02','04'].includes(c.id))await saveWatch(c,question);
    await runWatch(c,question,date);
   }else{
    const messageId='qualification-'+c.id;
    await ledger.log('before_manual_conversation',{caseId:c.id,questionSha256:sha(question)});
    const created=await api('/api/conversations',{},201);
    if(!gid.test(created.id??''))stop('CONVERSATION_ID_INVALID');
    await ledger.log('before_manual_message',{caseId:c.id,conversationId:created.id,messageId,questionSha256:sha(question)});
    const admitted=await api('/api/conversations/'+created.id+'/messages',{messageId,question},202);
    if(admitted.id!==messageId||!oid.test(admitted.runId??''))stop('MANUAL_ADMISSION_OUTCOME_UNKNOWN');
    await observe(c,{conversationId:created.id,messageId,runId:admitted.runId},question);
   }
   if(i===5)await pauseWatch('C');
  }
  await ledger.log('cohort_observed',{casesObserved:caseOutputs.size,physicalProviderPosts:ledger.count,classification:'manual-evidence-grading-required; no release pass asserted'});
 }catch(error){
  await ledger.log('halted',{caseId:current??null,reason:error instanceof Stop?error.message:'LOCAL_PREFLIGHT_OR_RUNNER_FAILURE',physicalPosts:ledger.count});
  throw error;
 }finally{await gui?.close();await ledger.close();}
}

async function main(){
 const {values}=parseArgs({options:{check:{type:'boolean'},source:{type:'string'},project:{type:'string'},config:{type:'string'},ledger:{type:'string'},'max-provider-posts':{type:'string'},
  'start-day':{type:'string'},'require-included-billing':{type:'boolean'},authorize:{type:'string'}},allowPositionals:false,strict:true});
 const plan=await frozenPlan();
 if(values.check){process.stdout.write(JSON.stringify({planSha256:PLAN_SHA,candidate:plan.candidate,runtimeSrc:plan.runtimeSrc,cases:10,noProviderCalls:true})+'\n');return;}
 if(values.authorize!=='GO-042-ONE-REAL-COHORT')stop('EXPLICIT_LIVE_OPERATOR_AUTHORIZATION_REQUIRED');
 await execute({plan,source:values.source,project:values.project,liveConfig:values.config,directory:values.ledger,operatorCap:Number(values['max-provider-posts']),
  baseDay:values['start-day'],requireIncluded:values['require-included-billing']===true});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await main();}
catch(error){process.stderr.write('QUALIFICATION_STOP '+(error instanceof Stop?error.message:'LOCAL_PREFLIGHT_OR_RUNNER_FAILURE')+'\n');process.exitCode=1;}
