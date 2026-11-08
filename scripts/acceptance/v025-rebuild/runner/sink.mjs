import {mkdir,open,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function createStubSink({directory,batchId,caseCaps,taskCaps,bindings,authority,verifyReservation}){
 // No actual epoch reservation: this explicitly synthetic sink cannot be used live.
 await mkdir(directory,{recursive:false,mode:0o700});
 const owner=await open(join(directory,'owner.lock'),'wx',0o600);
 await owner.writeFile(JSON.stringify({mode:'synthetic-stub-only',scope:'synthetic-stub',actualBudgetReservation:false,actualModelCalls:0,batchId,pid:process.pid})+'\n');await owner.sync();
 const ledger=await open(join(directory,'events.jsonl'),'wx',0o600);
 let stopped=false,closed=false,seq=0,prior='0'.repeat(64),queue=Promise.resolve();const attempts=[],events=[];
 const append=async data=>{const event=structuredClone({seq:++seq,previousSha256:prior,...data});const line=JSON.stringify(event);prior=hash(line);await ledger.write(line+'\n');await ledger.sync();events.push(event);};
 await append({kind:'simulation-header',scope:'synthetic-stub',actualBudgetReservation:false,actualModelCalls:0,batchId,cap:108,allocationMode:'SIMULATION_ONLY_NO_REAL_ALLOCATION',historicalSummary:authority.historicalSummary,sourceBindings:bindings,retention:'Original missing ledger not reconstructed; old held/unknown unchanged. All unused simulated allocation retained.'});
 const serial=fn=>{const p=queue.then(()=>{if(closed)fail('SINK_CLOSED');return fn();});queue=p.catch(()=>{});return p;};
 const find=t=>{const a=attempts.find(x=>x.ticket.id===t?.id);if(!a)fail('SINK_TICKET');return a;};
 const api={
  register:data=>serial(async()=>{for(const id of Object.keys(data.bindings))if(bindings[id])fail('SINK_DUPLICATE_BINDING');await append({kind:'bindings',...data});Object.assign(bindings,data.bindings);Object.assign(taskCaps,data.taskCaps);}),
  reserve:data=>serial(async()=>{if(stopped)fail('SINK_STOPPED');const binding=bindings[data.context.runId];if(!binding)fail('SINK_RUN_BINDING');const count=attempts.filter(a=>a.caseId===binding.caseId).length,taskCount=attempts.filter(a=>a.runId===data.context.runId).length;if(attempts.length>=108||count>=caseCaps[binding.caseId]||taskCount>=taskCaps[data.context.runId])fail('SINK_CAP');if(typeof verifyReservation!=='function')fail('SINK_ORIGINAL_RESERVATION_VERIFIER_REQUIRED');const originalProof=await verifyReservation(data.context,binding);const ticket={id:batchId+'-'+String(attempts.length+1).padStart(3,'0'),ordinal:attempts.length+1,mode:'synthetic-stub-only'};const a={ticket,caseId:binding.caseId,runId:data.context.runId,...data,originalProof,go:false,adopted:false,bodySha256:null};await append({kind:'reserved',...a});attempts.push(a);return ticket;}),
  recordBody:data=>serial(async()=>{const a=find(data.ticket);if(stopped||a.bodySha256)fail('SINK_BODY_STATE');if(hash(data.bytes)!==data.bodySha256)fail('SINK_BODY_HASH');const file=await open(join(directory,data.ticket.id+'.body'),'wx',0o600);try{await file.writeFile(data.bytes);await file.sync();}finally{await file.close();}await append({kind:'body',ticket:data.ticket,context:data.context,bodySha256:data.bodySha256,bodyBytes:data.bytes.length});a.bodySha256=data.bodySha256;}),
  recordGo:data=>serial(async()=>{const a=find(data.ticket);if(stopped||a.go||a.bodySha256!==data.bodySha256||data.cost!==0||data.billingSource!=='go'||data.estimated!==false)fail('SINK_GO_STATE');await append({kind:'go',...data});a.go=true;}),
  recordAdoption:data=>serial(async()=>{const a=find(data.ticket);if(stopped||!a.go||a.adopted||a.bodySha256!==data.bodySha256)fail('SINK_ADOPTION_STATE');await append({kind:'adoption',...data});a.adopted=true;}),
  stop:data=>serial(async()=>{stopped=true;await append({kind:'stopped',...data});}),
  readBody:async ticket=>readFile(join(directory,ticket.id+'.body')),
  snapshot:()=>structuredClone({stopped,closed,attempts,events,simulatedAllocationHeld:108,unusedStillHeld:108-attempts.length,unknown:attempts.filter(a=>!a.go).length}),
  async close(){await queue;await append({kind:'owner-terminal',stopped,physicalStubAttempts:attempts.length,unknown:attempts.filter(a=>!a.go).length,unusedStillHeld:108-attempts.length});closed=true;await ledger.close();await owner.close();}
 };return api;
}
