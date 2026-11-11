import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {DatabaseSync} from "node:sqlite";
import * as project from "../src/research-project.mjs";
import {importProjectSources} from "../src/project-sources.mjs";
for(const kind of ["expired","live-lease","not-due"])test("Project new task work discovers old dispatched: "+kind,async t=>{
 const directory=await mkdtemp(join(process.env.RELEASE_TEST_ROOT??tmpdir(),"project-lost-"));t.after(()=>rm(directory,{recursive:true,force:true}));
 await project.createResearchProject({directory,config:{schemaVersion:"research-project@1",gateway:{mode:"fixture",provider:"local",protocol:"fixture@1",model:"synthetic"},capabilities:["report"]}});
 const file=join(directory,"source.md");await writeFile(file,"SYNTHETIC source only.");const bundle=await importProjectSources({projectDir:directory,files:[file]});
 for(const runId of ["old","new"])await project.submitResearchTask({projectDir:directory,runId,question:"Read synthetic source.",sourceManifestSha256:bundle.manifestSha256});
 let resolveGateway,notify,calls=0;const started=new Promise(r=>notify=r);const running=project.workResearchTask({projectDir:directory,runId:"old",gateway:{mode:"fixture",next(){calls++;return new Promise(r=>{resolveGateway=r;notify();});}}}).then(result=>({result}),error=>({error}));await started;
 const original=(await project.inspectResearchCapacity({projectDir:directory,runId:"old"})).requests.find(t=>t.runId==="old");const observed=original.createdAt+(kind==="not-due"?7200000:7200001);
 if(kind==="live-lease"){const db=new DatabaseSync(join(directory,"sessions/old/session.sqlite"));db.prepare("UPDATE runs SET lease_until=? WHERE run_id=?").run(observed+30000,"old");db.close();}
 t.mock.timers.enable({apis:["Date"],now:observed});
 try{
 // Abort only the new synthetic task. The real work entry must run route
 // maintenance before assembly; no second Gateway is allowed in this proof.
 const controller=new AbortController();controller.abort(new Error("Synthetic new task no-dispatch"));
 await project.workResearchTask({projectDir:directory,runId:"new",signal:controller.signal,gateway:{mode:"fixture",next(){throw new Error("Unexpected second gateway");}}}).catch(()=>{});
 const after=(await project.inspectResearchCapacity({projectDir:directory,runId:"old"})).requests.find(t=>t.ticketId===original.ticketId);const state=await project.inspectResearchTask({projectDir:directory,runId:"old"});
 if(kind==="expired"){assert.equal(after.state,"unknown");assert.equal(after.localRelease?.billingOutcome,"unknown");assert.equal(after.localRelease?.refund,false);assert.equal(state.run.status,"cancelled");assert.equal(state.run.owner,null);}
 else{assert.equal(after.state,"dispatched");assert.equal(after.localRelease,undefined);assert.equal(state.run.status,"active");}
 assert.equal(state.run.rootUsage.model,1);assert.equal(calls,1);
 }finally{resolveGateway({kind:"final",text:"Late synthetic response",usage:null});await running;}
});
