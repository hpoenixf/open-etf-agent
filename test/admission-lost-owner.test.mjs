import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createSharedAdmission} from '../src/admission.mjs';import {openSession} from '../src/session.mjs';import {submitRun,run} from '../src/runtime.mjs';
const bindings={gateway:{mode:'fixture',provider:'local',protocol:'fixture@1',model:'synthetic',version:'1'},plugins:[],adapters:[]};
async function activeFixture(t,kind){
 const {DatabaseSync}=await import('node:sqlite');const directory=await mkdtemp(join(process.env.RELEASE_TEST_ROOT??tmpdir(),'active-boundary-'));let clock=Date.now();const session=await openSession({directory:join(directory,'session'),clock:()=>clock,leaseMs:30000}),admission=await createSharedAdmission({directory:join(directory,'capacity'),routeId:'test-route'}),db=new DatabaseSync(join(directory,'session','session.sqlite'));let resolveGateway,started;const ready=new Promise(r=>started=r);let calls=0,aborted=false;let sealedNotify,sealRelease;const sealed=new Promise(r=>sealedNotify=r),sealGate=new Promise(r=>sealRelease=r);
 t.after(async()=>{db.close();admission.close();session.close();await rm(directory,{recursive:true,force:true});});
 const gateway=admission.wrap({mode:'fixture',next({signal}){calls++;signal.addEventListener('abort',()=>aborted=true,{once:true});return new Promise(resolve=>{resolveGateway=resolve;started();});}},{session,runId:'active'});const options={question:'Synthetic owner boundary',gateway,requireReport:false,outputRoot:join(directory,'outputs'),durable:{store:session,runId:'active',grantId:'active',bindings,rootLimits:{model:3,tool:3},async onCheckpoint({phase}){if(kind==="real-sealed"&&phase==="proposal-sealed"){sealedNotify();await sealGate;}if(kind!=='child'||phase!=='model-reserved')return;const p=session.inspect('active');session.create({runId:'child',rootId:'active',parentRunId:'active',parentClaim:{owner:p.owner,fence:p.fence},directory,definition:{...p.definition,config:{...p.definition.config,taskId:'child'}},snapshot:{schemaVersion:'runtime-checkpoint@1',phase:'ready'}});}}};await submitRun(options);const running=run(options);const settled=running.then(result=>({result}),error=>({error}));await ready;const ticket=admission.snapshot().requests[0];return{directory,session,admission,db,ticket,settled,sealed,sealRelease,resolve:resolveGateway,setClock:v=>clock=v,calls:()=>calls,aborted:()=>aborted};
}

test("existing maintenance recovers expired original owner through exact fence",async t=>{
 const f=await activeFixture(t);f.setClock(f.session.inspect("active").leaseUntil+1);t.mock.timers.enable({apis:["Date"],now:f.ticket.createdAt+7200001});
 assert.equal(f.admission.maintainUnknown({session:f.session,rootId:"active"}).items[0].state,"released");assert.equal(f.admission.snapshot().occupied,0);
 try { const result=f.admission.recoverExpiredOwner({session:f.session,ticketId:f.ticket.ticketId,expectedTicketSha256:f.ticket.ticketSha256});assert.equal(result.release.billingOutcome,"unknown");assert.equal(f.admission.snapshot().occupied,0); }
 finally {f.resolve({kind:"final",text:"Late synthetic result",usage:null});await f.settled;}
});

for(const kind of ["boundary","live-lease","wrong-ticket","sealed","new-owner","crash","duplicate"])test("lost owner CAS: "+kind,async t=>{
 const f=await activeFixture(t);const ticket=f.ticket;f.setClock(f.session.inspect("active").leaseUntil+1);t.mock.timers.enable({apis:["Date"],now:ticket.createdAt+7200001});
 const recover=()=>f.admission.recoverExpiredOwner({session:f.session,ticketId:ticket.ticketId,expectedTicketSha256:kind==="wrong-ticket"?"0".repeat(64):ticket.ticketSha256});
 try{
 if(kind==="boundary")t.mock.timers.setTime(ticket.createdAt+7200000);
 if(kind==="live-lease")f.setClock(ticket.createdAt);
 if(kind==="new-owner")f.db.prepare("UPDATE runs SET owner=?,fence=fence+1 WHERE run_id=?").run("replacement","active");
 if(kind==="sealed"){const current=f.session.inspect("active").snapshot;current.phase="proposal-sealed";f.db.prepare("UPDATE runs SET snapshot=? WHERE run_id=?").run(JSON.stringify(current),"active");}
 if(["boundary","live-lease","wrong-ticket","sealed","new-owner"].includes(kind)){assert.throws(recover);assert.equal(f.admission.inspect(ticket.ticketId).state,"dispatched");assert.equal(f.admission.snapshot().occupied,1);}
 else {
 if(kind==="crash"){
 f.db.exec("CREATE TRIGGER fail_commit BEFORE UPDATE ON runs BEGIN SELECT RAISE(ABORT,'synthetic fault'); END");assert.throws(recover);assert.equal(f.admission.inspect(ticket.ticketId).state,"unknown");assert.equal(f.admission.snapshot().occupied,1);assert.equal(f.session.inspect("active").status,"active");f.db.exec("DROP TRIGGER fail_commit");}
 const one=recover();assert.deepEqual(recover(),one);assert.equal(f.admission.snapshot().occupied,0);assert.equal(f.admission.inspect(ticket.ticketId).state,"unknown");assert.equal(f.session.inspect("active").rootUsage.model,1);assert.equal(one.release.refund,false);
 const before=JSON.stringify(f.session.inspect("active"));f.resolve({kind:"final",text:"Late result must not adopt",usage:null});await f.settled;assert.equal(JSON.stringify(f.session.inspect("active")),before);assert.equal(f.calls(),1);
 }
 } finally {f.resolve({kind:"final",text:"Cleanup original synthetic request",usage:null});await f.settled;}
});

test("real proposal adoption before recovery wins and cannot be cancelled",async t=>{
 const f=await activeFixture(t,"real-sealed");f.resolve({kind:"final",text:"Adopted synthetic result",usage:null});await f.sealed;
 const before=JSON.stringify(f.session.inspect("active"));assert.equal(f.session.inspect("active").snapshot.phase,"proposal-sealed");
 f.setClock(f.session.inspect("active").leaseUntil+1);t.mock.timers.enable({apis:["Date"],now:f.ticket.createdAt+7200001});
 try{assert.throws(()=>f.admission.recoverExpiredOwner({session:f.session,ticketId:f.ticket.ticketId,expectedTicketSha256:f.ticket.ticketSha256}));assert.equal(JSON.stringify(f.session.inspect("active")),before);assert.equal(f.admission.inspect(f.ticket.ticketId).expiryStop,undefined);}
 finally{f.sealRelease();await f.settled;}
});
test("two independent SQLite handles converge on one fence and one release",async t=>{
 const f=await activeFixture(t);const time=f.session.inspect("active").leaseUntil+1;f.setClock(time);t.mock.timers.enable({apis:["Date"],now:f.ticket.createdAt+7200001});
 const secondSession=await openSession({directory:join(f.directory,"session"),clock:()=>time}),secondAdmission=await createSharedAdmission({directory:join(f.directory,"capacity"),routeId:"test-route",existingOnly:true});
 try{const invoke=(admission,session)=>admission.recoverExpiredOwner({session,ticketId:f.ticket.ticketId,expectedTicketSha256:f.ticket.ticketSha256});const [a,b]=await Promise.all([Promise.resolve().then(()=>invoke(f.admission,f.session)),Promise.resolve().then(()=>invoke(secondAdmission,secondSession))]);assert.deepEqual(a,b);assert.equal(secondAdmission.snapshot().occupied,0);}
 finally{secondAdmission.close();secondSession.close();f.resolve({kind:"final",text:"Late result",usage:null});await f.settled;}
});

test("independent child processes barrier race preserves exactly one durable stop/release",async t=>{
 const {fork}=await import("node:child_process");const f=await activeFixture(t);const time=f.session.inspect("active").leaseUntil+1,observed=f.ticket.createdAt+7200001;f.setClock(time);
 const children=[];try{
 const ready=Array.from({length:2},()=>new Promise((resolve,reject)=>{const child=fork(new URL("./fixtures/lost-owner-contender.mjs",import.meta.url),[],{execArgv:[],env:{},stdio:["ignore","ignore","pipe","ipc"]});children.push(child);let stderr="";child.stderr.on("data",b=>stderr+=b);child.once("error",reject);child.once("message",m=>m.ready?resolve(child):reject(new Error(JSON.stringify(m))));child.once("exit",code=>{if(code)reject(new Error(stderr));});}));await Promise.all(ready);
 const done=children.map(child=>new Promise((resolve,reject)=>{let outcome;child.once("message",m=>outcome=m);child.once("exit",code=>code===0&&outcome?resolve(outcome):reject(new Error("child exit "+code)));}));
 for(const child of children)child.send({directory:f.directory,time,observed,ticketId:f.ticket.ticketId,expectedTicketSha256:f.ticket.ticketSha256});
 const results=await Promise.all(done);assert.ok(results.some(r=>r.ok));for(const r of results)if(!r.ok)assert.ok(["ADMISSION_ACTIVE_OWNER_MISMATCH","ADMISSION_STOP_CAS"].includes(r.code),JSON.stringify(r));
 const ticket=f.admission.inspect(f.ticket.ticketId);assert.equal(ticket.state,"unknown");assert.ok(ticket.expiryStop);assert.ok(ticket.localRelease);assert.equal(f.admission.snapshot().occupied,0);assert.equal(f.session.inspect("active").rootUsage.model,1);
 }finally{for(const child of children)if(child.exitCode===null)child.kill("SIGTERM");f.resolve({kind:"final",text:"Late synthetic completion",usage:null});await f.settled;}
});

for(const mode of ["automatic","manual"])test("preexisting competing "+mode+" release is distinguished",async t=>{
 const f=await activeFixture(t);f.setClock(f.session.inspect("active").leaseUntil+1);t.mock.timers.enable({apis:["Date"],now:f.ticket.createdAt+7200001});
 const recover=()=>f.admission.recoverExpiredOwner({session:f.session,ticketId:f.ticket.ticketId,expectedTicketSha256:f.ticket.ticketSha256});
 try{
 f.db.exec("CREATE TRIGGER fail_commit BEFORE UPDATE ON runs BEGIN SELECT RAISE(ABORT,'synthetic fault'); END");assert.throws(recover);f.db.exec("DROP TRIGGER fail_commit");f.session.cancel("active");
 if(mode==="automatic")f.admission.maintainUnknown({session:f.session,rootId:"active"});
 else {const t=f.admission.inspect(f.ticket.ticketId);f.admission.releaseUnknown({session:f.session,operationId:"other-manual",identity:{routeId:"test-route",...Object.fromEntries(["ticketId","reservationId","rootId","runId","modelOrdinal","inputHash","owner","fence"].map(k=>[k,t[k]]))},expectedTicketSha256:t.ticketSha256,reason:"Separate manual intent",acknowledgements:{preserveUnknown:true,noReplay:true,noRefund:true}});}
 const before=JSON.stringify(f.admission.inspect(f.ticket.ticketId));
 if(mode==="automatic"){const result=recover();assert.equal(result.alreadyReleased,true);assert.equal(result.release.policy,"two-hour-local-release@1");}
 else assert.throws(recover,{code:"ADMISSION_RELEASE_CONFLICT"});
 assert.equal(JSON.stringify(f.admission.inspect(f.ticket.ticketId)),before);assert.equal(f.admission.snapshot().occupied,0);
 }finally{f.resolve({kind:"final",text:"Late synthetic cleanup",usage:null});await f.settled;}
});
