import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {acquireProjectWebSources,inspectWebAcquisition} from '../src/web-acquisition.mjs';
import {createResearchProject,submitResearchTask,workResearchTask,readResearchReport} from '../src/research-project.mjs';
import {importProjectSources,loadProjectSources} from '../src/project-sources.mjs';
import {sha256} from '../src/source.mjs';
import {runResearchCli,parseResearchArguments} from '../src/research-cli.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';

const url='https://example.com/selected',second='https://example.com/second';
const page={status:200,headers:{'content-type':'text/html; charset=utf-8'},body:'<h1>Selected source</h1><p>CSV export costs 12 units.</p><script>throw Error("never execute")</script>'};
const routes={'https://example.com/robots.txt':{body:'User-agent: *\nAllow: /\n'},[url]:page,[second]:page};
async function fixture(t){await mkdir('test-output',{recursive:true});const projectDir=await mkdtemp(resolve('test-output/web-acquire-'));t.after(()=>rm(projectDir,{recursive:true,force:true}));await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'web-synthetic'},capabilities:['report']}});return projectDir;}
const acquire=(projectDir,acquisitionId,extra={})=>acquireProjectWebSources({projectDir,acquisitionId,urls:[url],approvePublicFetch:true,...extra});
test('Web explicit acquisition creates immutable source, ordinary report and cold inspection without network',async t=>{
 const network=mockWebNetwork(t,{routes}),projectDir=await fixture(t),result=await acquire(projectDir,'first');
 assert.equal(result.acquisition.status,'succeeded');assert.equal(result.acquisition.requestCount,2);assert.equal(result.catalog.schemaVersion,'document-catalog@2');
 const doc=result.catalog.documents[0];assert.equal(doc.web.requestedUrl,url);assert.doesNotMatch(doc.pages.join(''),/never execute/);
 await submitResearchTask({projectDir,runId:'web-report',question:'State the observed export cost and save a report.',sourceManifestSha256:result.manifestSha256});
 let calls=0;const gateway={mode:'fixture',next({messages}){calls++;const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!values.length)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:doc.id,page:1}}]};if(!values.some(v=>v.path==='report.md'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'# Observation\nCSV export costs 12 units.',sourceIds:[values[0].sourceId]}}]};return{kind:'final',text:'Saved.'};}};
 const worked=await workResearchTask({projectDir,runId:'web-report',gateway});assert.equal(worked.run.status,'completed',worked.run.snapshot.code);assert.equal(calls,3);
 const report=await readResearchReport({projectDir,runId:'web-report'});assert.equal(report.revision.sources[0].web.requestedUrl,url);assert.match(report.report.text,/https:\/\/example.com\/selected/);
 const count=network.calls.length;assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'first'})).status,'succeeded');assert.deepEqual((await loadProjectSources({projectDir,manifestSha256:result.manifestSha256})).catalog,result.catalog);assert.equal(network.calls.length,count);
 await assert.rejects(acquire(projectDir,'first'),e=>e.code==='WEB_ACQUISITION_ALREADY_EXISTS');assert.equal(network.calls.length,count);
});
test('Web occurrence differs for identical original bytes and exact admitted local base remains intact',async t=>{
 mockWebNetwork(t,{routes});const projectDir=await fixture(t),path=join(projectDir,'local.txt');await writeFile(path,'A local selected source.');const base=await importProjectSources({projectDir,files:[path]});
 const a=await acquire(projectDir,'two-pages',{urls:[url,second],baseManifestSha256:base.manifestSha256});assert.equal(a.catalog.documents.length,3);
 const web=a.catalog.documents.filter(d=>d.web);assert.equal(web.length,2);assert.equal(web[0].web.originalSha256,web[1].web.originalSha256);assert.notEqual(web[0].id,web[1].id);assert.ok(web.every(d=>d.web.baseManifestSha256===base.manifestSha256));
 assert.deepEqual((await loadProjectSources({projectDir,manifestSha256:base.manifestSha256})).catalog,base.catalog);
 const b=await acquire(projectDir,'next',{baseManifestSha256:a.manifestSha256});assert.equal(b.catalog.documents.length,4);assert.equal(b.manifest.webEntries.length,3);
});
test('Concurrent same operation has one transport owner and no automatic replay after a known failure',async t=>{
 const network=mockWebNetwork(t,{routes:{...routes,[url]:{status:403,body:'denied'}}}),projectDir=await fixture(t);
 const result=await Promise.allSettled([acquire(projectDir,'one-owner'),acquire(projectDir,'one-owner')]);
 assert.deepEqual(result.map(r=>r.reason.code).sort(),['WEB_ACCESS_DENIED','WEB_ACQUISITION_ALREADY_EXISTS'].sort());assert.equal(network.calls.length,2);
 const saved=await inspectWebAcquisition({projectDir,acquisitionId:'one-owner'});assert.equal(saved.status,'failed');assert.equal(saved.requestCount,2);assert.equal(saved.automaticReplayAllowed,false);
 await assert.rejects(acquire(projectDir,'one-owner'));assert.equal(network.calls.length,2);
});
test('In-flight cancellation records unknown transport and inspect never resumes it',async t=>{
 const controller=new AbortController(),network=mockWebNetwork(t,{routes:{...routes,[url]:()=>{setImmediate(()=>controller.abort());return{hang:true};}}}),projectDir=await fixture(t);
 await assert.rejects(acquire(projectDir,'stopped',{signal:controller.signal}));const state=await inspectWebAcquisition({projectDir,acquisitionId:'stopped'});assert.equal(state.status,'failed');assert.equal(state.unknownRequests,1);assert.equal(state.automaticReplayAllowed,false);assert.equal(network.requests.at(-1).destroyed,true);assert.equal(network.requests[0].response.readableEnded,true);const count=network.calls.length;await assert.rejects(acquire(projectDir,'stopped'));assert.equal(network.calls.length,count);
});
test('A claimed operation without a plan is unknown, held and not reconstructed',async t=>{
 const network=mockWebNetwork(t,{routes}),projectDir=await fixture(t);await mkdir(join(projectDir,'web-acquisitions'));await mkdir(join(projectDir,'web-acquisitions','missing-plan'));
 assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'missing-plan'})).status,'unknown');await assert.rejects(acquire(projectDir,'missing-plan'),e=>e.code==='WEB_ACQUISITION_ALREADY_EXISTS');assert.equal(network.calls.length,0);
});
test('Tampered base receipt and changed raw source fail cold validation with no requests',async t=>{
 const network=mockWebNetwork(t,{routes}),projectDir=await fixture(t),result=await acquire(projectDir,'sealed');const count=network.calls.length;
 const changed=structuredClone(result.manifest);delete changed.acquisition.baseManifestSha256;const bytes=Buffer.from(JSON.stringify(changed)),digest=sha256(bytes);await writeFile(join(projectDir,'sources','manifests',digest+'.json'),bytes);
 await assert.rejects(loadProjectSources({projectDir,manifestSha256:digest}));
 const raw=join(projectDir,'sources','objects',result.catalog.documents[0].web.originalSha256+'.bin');await writeFile(raw,'changed');await assert.rejects(loadProjectSources({projectDir,manifestSha256:result.manifestSha256}));assert.equal(network.calls.length,count);
});
test('CLI acquisition requires exact explicit selection and uses the original owner',async t=>{
 const network=mockWebNetwork(t,{routes}),projectDir=await fixture(t),urlsFile=join(projectDir,'urls.json');await writeFile(urlsFile,JSON.stringify([url]));
 assert.throws(()=>parseResearchArguments(['source','acquire','--project',projectDir,'--acquisition','cli','--urls',urlsFile]));
 let output='',error='';const code=await runResearchCli(['source','acquire','--project',projectDir,'--acquisition','cli','--urls',urlsFile,'--approve-public-fetch'],{stdout:{write:v=>output+=v},stderr:{write:v=>error+=v}});assert.equal(code,0,error);assert.equal(JSON.parse(output).acquisition.status,'succeeded');assert.equal(network.calls.length,2);
});

test('Cold terminal inspection rejects forged counters and validates the selected acquisition, not inherited pages',async t=>{
 const network=mockWebNetwork(t,{routes}),projectDir=await fixture(t),base=await acquire(projectDir,'base-counts');
 const result=await acquire(projectDir,'current-counts',{baseManifestSha256:base.manifestSha256});
 const state=await inspectWebAcquisition({projectDir,acquisitionId:'current-counts'});assert.equal(state.completedPages,1);assert.equal(state.requestCount,2);assert.equal(result.catalog.documents.length,2);
 const path=join(projectDir,'web-acquisitions','current-counts','terminal.json'),original=await readFile(path),saved=JSON.parse(original),count=network.calls.length;
 for(const delta of [{unknownRequests:-1},{requestCount:1},{requestCount:3},{completedPages:0},{originalBytes:saved.originalBytes+1},{textBytes:saved.textBytes+1},{extra:true}]){
  await writeFile(path,JSON.stringify({...saved,...delta}));await assert.rejects(inspectWebAcquisition({projectDir,acquisitionId:'current-counts'}));
 }
 await writeFile(path,original);assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'current-counts'})).status,'succeeded');assert.equal(network.calls.length,count);
});

test('Failed terminal counters are bounded local observations, and unobserved dispatch stays null',async t=>{
 const {validateWebAcquisitionTerminal}=await import('../src/web-acquisition-records.mjs');
 const network=mockWebNetwork(t,{routes:{...routes,[url]:{status:403,body:'denied'}}}),projectDir=await fixture(t);await assert.rejects(acquire(projectDir,'failure-counts'));
 const path=join(projectDir,'web-acquisitions','failure-counts','terminal.json'),original=await readFile(path),saved=JSON.parse(original),plan=JSON.parse(await readFile(join(projectDir,'web-acquisitions','failure-counts','plan.json'))),count=network.calls.length;
 for(const delta of [{requestCount:17},{requestCount:-1},{unknownRequests:-1},{unknownRequests:3},{dispatchOutcomeKnown:false},{completedPages:2},{manifestSha256:'f'.repeat(64)},{originalBytes:1}]){
  await writeFile(path,JSON.stringify({...saved,...delta}));await assert.rejects(inspectWebAcquisition({projectDir,acquisitionId:'failure-counts'}));
 }
 const unknown={...saved,dispatchOutcomeKnown:false,unknownRequests:null};assert.deepEqual(validateWebAcquisitionTerminal(unknown,plan),unknown);
 await writeFile(path,original);assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'failure-counts'})).status,'failed');assert.equal(network.calls.length,count);
});
