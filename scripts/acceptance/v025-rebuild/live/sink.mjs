import {requireActualToken} from './authorization.mjs';
import {mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
const CAUSE_CODES=new Set(['EAI_AGAIN','ENOTFOUND','ECONNREFUSED','ECONNRESET','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
export function safeFetchCause(error){for(const code of [error?.cause?.code,error?.code])if(typeof code==='string'&&CAUSE_CODES.has(code))return code;return null;}
export async function createActualSink({token,...options}){const claim=requireActualToken(token);return createSink({...options,directory:join(claim.directory,'sink'),batchId:claim.batchId,mode:'actual',actualClaim:{path:token.claimPath,sha256:token.claimSha256,allocation:claim}});}
export async function createPreflightSink(options){return createSink({...options,mode:'injected-preflight',actualClaim:null});}
async function createSink({directory,batchId,caseCaps,taskCaps,bindings,authority,verifyReservation,mode,actualClaim}){
 // A real sink only references the pre-existing permanent root allocation; never mints one.
 await mkdir(directory,{recursive:false,mode:0o700});
 const owner=await open(join(directory,'owner.lock'),'wx',0o600);
 await owner.writeFile(JSON.stringify({mode,scope:mode,actualBudgetReservation:mode==='actual',batchId,pid:process.pid})+'\n');await owner.sync();
 const ledger=await open(join(directory,'events.jsonl'),'wx',0o600);
 let stopped=false,closed=false,seq=0,prior='0'.repeat(64),queue=Promise.resolve();const attempts=[],events=[];
 const append=async data=>{const event=structuredClone({seq:++seq,previousSha256:prior,...data});const line=JSON.stringify(event);prior=hash(line);await ledger.write(line+'\n');await ledger.sync();events.push(event);};
 await append({kind:'batch-header',scope:mode,actualBudgetReservation:mode==='actual',batchId,cap:108,actualClaim,historicalSummary:authority.historicalSummary,sourceBindings:bindings,retention:mode==='actual'?'Original missing ledger not reconstructed; historical held/unknown unchanged. Whole real 108 allocation permanently held, including unused requests.':'Preflight only: simulated whole108 held; no real allocation or historical ticket reconstructed.'});
 const serial=fn=>{const p=queue.then(()=>{if(closed)fail('SINK_CLOSED');return fn();});queue=p.catch(()=>{});return p;};
 const find=t=>{const a=attempts.find(x=>x.ticket.id===t?.id);if(!a)fail('SINK_TICKET');return a;};
 const counters=()=>({requestReservations:attempts.length,durableDispatchIntents:attempts.filter(a=>a.dispatchIntent).length,fetchReturnObservations:attempts.filter(a=>a.fetchObservation?.outcome==='returned').length,fetchRejectObservations:attempts.filter(a=>a.fetchObservation?.outcome==='rejected').length});
 const api={
  register:data=>serial(async()=>{for(const id of Object.keys(data.bindings))if(bindings[id])fail('SINK_DUPLICATE_BINDING');await append({kind:'bindings',...data});Object.assign(bindings,data.bindings);Object.assign(taskCaps,data.taskCaps);}),
  reserve:data=>serial(async()=>{if(stopped)fail('SINK_STOPPED');const binding=bindings[data.context.runId];if(!binding)fail('SINK_RUN_BINDING');const count=attempts.filter(a=>a.caseId===binding.caseId).length,taskCount=attempts.filter(a=>a.runId===data.context.runId).length;if(attempts.length>=108||count>=caseCaps[binding.caseId]||taskCount>=taskCaps[data.context.runId])fail('SINK_CAP');if(typeof verifyReservation!=='function')fail('SINK_ORIGINAL_RESERVATION_VERIFIER_REQUIRED');const originalProof=await verifyReservation(data.context,binding);const ticket={id:batchId+'-'+String(attempts.length+1).padStart(3,'0'),ordinal:attempts.length+1,mode};const a={ticket,caseId:binding.caseId,runId:data.context.runId,...data,originalProof,go:false,adopted:false,bodySha256:null};await append({kind:'reserved',...a});attempts.push(a);return ticket;}),
  recordDispatchIntent:data=>serial(async()=>{const a=find(data.ticket);if(stopped||a.dispatchIntent||!a.originalProof)fail('SINK_DISPATCH_INTENT_STATE');await append({kind:'dispatch-intent',ticket:a.ticket,requestSha256:a.requestSha256,context:a.context,scope:mode,meaning:'pre-fetch durable intent; upper bound, not proof provider received'});a.dispatchIntent=true;}),
  recordFetchObservation:data=>serial(async()=>{const a=find(data.ticket);if(!a.dispatchIntent||a.fetchObservation||!['returned','rejected'].includes(data.outcome)||data.outcome==='returned'&&(!Number.isSafeInteger(data.httpStatus)||data.httpStatus<100||data.httpStatus>599))fail('SINK_FETCH_OBSERVATION_STATE');const observation={outcome:data.outcome,...(data.outcome==='rejected'&&CAUSE_CODES.has(data.causeCode)?{causeCode:data.causeCode}:{}),...(data.outcome==='returned'?{httpStatus:data.httpStatus}:{}),meaning:'local fetch observation only; no remote settlement claim'};await append({kind:'fetch-observation',ticket:a.ticket,...observation});a.fetchObservation=observation;}),
  recordBody:data=>serial(async()=>{const a=find(data.ticket);if(stopped||a.bodySha256)fail('SINK_BODY_STATE');if(hash(data.bytes)!==data.bodySha256)fail('SINK_BODY_HASH');const file=await open(join(directory,data.ticket.id+'.body'),'wx',0o600);try{await file.writeFile(data.bytes);await file.sync();}finally{await file.close();}await append({kind:'body',ticket:data.ticket,context:data.context,bodySha256:data.bodySha256,bodyBytes:data.bytes.length});a.bodySha256=data.bodySha256;}),
  recordGo:data=>serial(async()=>{const a=find(data.ticket);if(stopped||a.go||a.bodySha256!==data.bodySha256||data.cost!==0||data.billingSource!=='go'||data.estimated!==false)fail('SINK_GO_STATE');await append({kind:'go',...data});a.go=true;}),
  recordAdoption:data=>serial(async()=>{const a=find(data.ticket);if(stopped||!a.go||a.adopted||a.bodySha256!==data.bodySha256)fail('SINK_ADOPTION_STATE');await append({kind:'adoption',...data});a.adopted=true;}),
  stop:data=>serial(async()=>{stopped=true;await append({kind:'stopped',...data});}),
  readBody:async ticket=>readFile(join(directory,ticket.id+'.body')),
  snapshot:()=>structuredClone({...counters(),stopped,closed,attempts,events,allocationHeld:108,mode,unusedStillHeld:108-attempts.length,unknown:attempts.filter(a=>!a.go).length}),
  async close(){await queue;await append({kind:'owner-terminal',stopped,...counters(),unknown:attempts.filter(a=>!a.go).length,unusedStillHeld:108-attempts.length});closed=true;await ledger.close();await owner.close();}
 };return api;
}
