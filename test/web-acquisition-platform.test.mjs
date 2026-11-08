import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile,writeFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createResearchProject,submitResearchTask,workResearchTask,readResearchReport} from '../src/research-project.mjs';
import {acquireProjectWebSources,inspectWebAcquisition} from '../src/web-acquisition.mjs';
import {loadProjectSources} from '../src/project-sources.mjs';
import {validateWebTransportRecord} from '../src/web-acquisition-records.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';
const profile='platform-doh-pinned@1',host='example.com',url='https://example.com/selected',ip='93.184.216.34';
const dnsUrl=(host,type)=>'https://1.1.1.1/dns-query?'+new URLSearchParams({name:host,type});
function platformEnvironment(t){const names=['HTTPS_PROXY','https_proxy','NO_PROXY','no_proxy','NODE_USE_ENV_PROXY'],old=Object.fromEntries(names.map(k=>[k,process.env[k]]));for(const k of names)delete process.env[k];Object.assign(process.env,{HTTPS_PROXY:'http://proxy.example:8080',NODE_USE_ENV_PROXY:'1'});t.after(()=>{for(const k of names){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}});}
function routesFor(urls){const routes={};for(const u of urls){const parsed=new URL(u),host=parsed.hostname;for(const type of ['A','AAAA']){const rr=type==='A'?1:28;routes[dnsUrl(host,type)]={headers:{'content-type':'application/dns-json'},body:JSON.stringify({Status:0,TC:false,Question:[{name:host+'.',type:rr}],Answer:type==='A'?[{name:host+'.',type:rr,TTL:60,data:ip}]:[]})};}routes[`https://${ip}/robots.txt`]={body:'User-agent: *\nAllow: /\n'};routes[`https://${ip}${parsed.pathname}`]={headers:{'content-type':'text/plain; charset=utf-8'},body:'Observed public evidence: CSV export costs 12 units.'};}return routes;}
async function project(t){await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/platform-acquire-'));t.after(()=>rm(dir,{recursive:true,force:true}));await createResearchProject({directory:dir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'no-provider-platform'},capabilities:['report']}});return dir;}
const acquire=(projectDir,acquisitionId,extra={})=>acquireProjectWebSources({projectDir,acquisitionId,urls:[url],approvePublicFetch:true,networkProfile:profile,...extra});

test('Explicit profile archives resolver bodies and preserves real consumer/cold provenance without network replay',async t=>{
 platformEnvironment(t);const network=mockWebNetwork(t,{routes:routesFor([url])}),projectDir=await project(t),result=await acquire(projectDir,'profile-first');
 assert.equal(network.lookups.length,0);assert.equal(network.calls.length,4);assert.equal(result.acquisition.schemaVersion,'web-acquisition-terminal@2');assert.equal(result.acquisition.networkProfile,profile);assert.equal(result.acquisition.requestCount,4);
 const doc=result.catalog.documents[0],plan=JSON.parse(await readFile(join(projectDir,'web-acquisitions','profile-first','plan.json')));assert.equal(plan.schemaVersion,'web-acquisition-plan@2');assert.equal(doc.web.schemaVersion,'web-source@1');
 const originalTransport=JSON.parse(await readFile(join(projectDir,'sources','objects',doc.web.transportSha256+'.json')));assert.equal(originalTransport.schemaVersion,'web-fetch-observation@2');assert.equal(originalTransport.dnsObservations[0].families.length,2);assert.equal(originalTransport.receivedBytes,result.acquisition.receivedBytes);validateWebTransportRecord(originalTransport,plan);
 await submitResearchTask({projectDir,runId:'platform-report',question:'Read the selected source and save a report.',sourceManifestSha256:result.manifestSha256});let calls=0;
 const gateway={mode:'fixture',next({messages}){calls++;const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);if(!values.length)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:doc.id,page:1}}]};if(!values.some(v=>v.path==='report.md'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'# Observation\nCSV export costs 12 units.',sourceIds:[values[0].sourceId]}}]};return{kind:'final',text:'Saved.'};}};
 assert.equal((await workResearchTask({projectDir,runId:'platform-report',gateway})).run.status,'completed');assert.equal(calls,3);assert.equal((await readResearchReport({projectDir,runId:'platform-report'})).revision.sources[0].web.transportSha256,doc.web.transportSha256);
 const count=network.calls.length;assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'profile-first'})).networkProfile,profile);assert.deepEqual((await loadProjectSources({projectDir,manifestSha256:result.manifestSha256})).catalog,result.catalog);assert.equal(network.calls.length,count);
 for(const mutate of [x=>x.networkProfile='system-direct@1',x=>x.receivedBytes++,x=>x.dnsObservations[0].families[0].sha256='f'.repeat(64),x=>x.dnsObservations[0].selectedAddress='8.8.8.8',x=>x.dnsObservations[0].families.pop(),x=>x.requestCount--]){const altered=structuredClone(originalTransport);mutate(altered);assert.throws(()=>validateWebTransportRecord(altered,plan));}
 await writeFile(join(projectDir,'sources','objects',doc.web.transportSha256+'.json'),'{}');await assert.rejects(loadProjectSources({projectDir,manifestSha256:result.manifestSha256}));assert.equal(network.calls.length,count);
});

test('Old direct acquisition remains unchanged and a mixed manifest binds only the newly selected profile counters',async t=>{
 platformEnvironment(t);const routes=routesFor([url]);routes['https://example.com/robots.txt']={body:'User-agent: *\nAllow: /\n'};routes[url]={body:'Old direct source.'};const network=mockWebNetwork(t,{routes}),projectDir=await project(t);
 const old=await acquire(projectDir,'old-direct',{networkProfile:'system-direct@1'}),path=join(projectDir,'web-acquisitions','old-direct','terminal.json'),before=await readFile(path);
 const next=await acquire(projectDir,'new-platform',{baseManifestSha256:old.manifestSha256});assert.equal(next.catalog.documents.length,2);assert.equal(next.acquisition.requestCount,4);assert.equal(next.webAcquisition.completedPages,1);
 const count=network.calls.length;assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'old-direct'})).schemaVersion,'web-acquisition-terminal@1');assert.deepEqual(await readFile(path),before);assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'new-platform'})).networkProfile,profile);
 await assert.rejects(acquire(projectDir,'old-direct'),e=>e.code==='WEB_ACQUISITION_ALREADY_EXISTS');assert.equal(network.calls.length,count);
});

test('Operator configuration is required before claiming, and one frozen environment snapshot spans selected pages',async t=>{
 platformEnvironment(t);const urls=[url,'https://example.com/second'],routes=routesFor(urls),first=routes[dnsUrl(host,'A')];let changed=false;
 routes[dnsUrl(host,'A')]=()=>{if(!changed){changed=true;process.env.HTTPS_PROXY='invalid changed mid-operation';}return first;};const network=mockWebNetwork(t,{routes}),projectDir=await project(t);
 delete process.env.HTTPS_PROXY;await assert.rejects(acquire(projectDir,'no-config'),e=>e.code==='WEB_PLATFORM_PROXY_REQUIRED');await assert.rejects(access(join(projectDir,'web-acquisitions','no-config')));assert.equal(network.calls.length,0);
 process.env.HTTPS_PROXY='http://proxy.example:8080';const result=await acquire(projectDir,'snapshot',{urls});assert.equal(result.acquisition.requestCount,8);assert.equal(network.lookups.length,0);assert.equal(result.acquisition.completedPages,2);
});

test('DNS denial stops the explicit profile and cannot replay or select a fallback on inspection',async t=>{
 platformEnvironment(t);const routes=routesFor([url]);routes[dnsUrl(host,'A')]={status:403,body:'denied'};const network=mockWebNetwork(t,{routes}),projectDir=await project(t);
 await assert.rejects(acquire(projectDir,'dns-denied'),e=>e.code==='WEB_ACCESS_DENIED');const count=network.calls.length,state=await inspectWebAcquisition({projectDir,acquisitionId:'dns-denied'});assert.equal(count,1);assert.equal(state.requestCount,1);assert.equal(state.receivedBytes,0);assert.equal(state.unknownRequests,0);assert.equal(state.networkProfile,profile);await assert.rejects(acquire(projectDir,'dns-denied',{networkProfile:'system-direct@1'}),e=>e.code==='WEB_ACQUISITION_ALREADY_EXISTS');assert.equal(network.calls.length,count);
});

test('DNS, robots and pages share the finite whole-operation request cap across selected URLs',async t=>{
 platformEnvironment(t);const urls=[url,'https://example.com/second','https://example.com/third','https://example.com/fourth'],redirect='https://other.example/final',routes=routesFor([...urls,redirect]);routes[`https://${ip}/selected`]={status:302,headers:{location:redirect},body:''};const network=mockWebNetwork(t,{routes}),projectDir=await project(t);
 await assert.rejects(acquire(projectDir,'request-cap',{urls,allowedRedirectUrls:[redirect]}),e=>e.code==='WEB_REQUEST_LIMIT');const state=await inspectWebAcquisition({projectDir,acquisitionId:'request-cap'});assert.equal(network.calls.length,16);assert.equal(state.requestCount,16);assert.equal(state.completedPages,3);assert.equal(state.manifestSha256,null);assert.equal(state.unknownRequests,0);
});

test('IPv6-only expanded DNS text retains raw evidence but cold-validates the canonical selected address',async t=>{
 platformEnvironment(t);const rawAddress='2606:4700:4700:0000:0000:0000:0000:ABCD',canonical='2606:4700:4700::abcd',routes={};
 for(const type of ['A','AAAA']){const rr=type==='A'?1:28;routes[dnsUrl(host,type)]={headers:{'content-type':'application/dns-json'},body:JSON.stringify({Status:0,TC:false,Question:[{name:host+'.',type:rr}],Answer:type==='AAAA'?[{name:host+'.',type:rr,data:rawAddress}]:[]})};}
 routes[`https://[${canonical}]/robots.txt`]={status:404};routes[`https://[${canonical}]/selected`]={body:'IPv6-only public evidence.'};
 const network=mockWebNetwork(t,{routes}),projectDir=await project(t),result=await acquire(projectDir,'ipv6-canonical'),doc=result.catalog.documents[0];
 const plan=JSON.parse(await readFile(join(projectDir,'web-acquisitions','ipv6-canonical','plan.json'))),observation=JSON.parse(await readFile(join(projectDir,'sources','objects',doc.web.transportSha256+'.json')));
 assert.equal(observation.dnsObservations[0].selectedAddress,canonical);assert.deepEqual(observation.dnsObservations[0].families[1].addresses,[rawAddress]);validateWebTransportRecord(observation,plan);
 const count=network.calls.length;assert.equal((await inspectWebAcquisition({projectDir,acquisitionId:'ipv6-canonical'})).status,'succeeded');assert.deepEqual((await loadProjectSources({projectDir,manifestSha256:result.manifestSha256})).catalog,result.catalog);assert.equal(count,4);assert.equal(network.calls.length,count);
 const altered=structuredClone(observation);altered.dnsObservations[0].selectedAddress=rawAddress;assert.throws(()=>validateWebTransportRecord(altered,plan));
});
