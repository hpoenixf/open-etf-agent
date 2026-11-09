import test from 'node:test';
import assert from 'node:assert/strict';
import {extractWebText} from '../src/web-extraction.mjs';
const sizes=text=>[Buffer.byteLength(text),Buffer.byteLength(JSON.stringify(text))-2,Buffer.byteLength(JSON.stringify(JSON.stringify(text)))-6];
test('Web new extraction pages respect raw and two JSON encoding budgets without losing text',()=>{
 for(const text of ['a'.repeat(40000),'"\\\t\r'.repeat(8000),'中文😀'.repeat(5000)]){
  const result=extractWebText(Buffer.from(text),'text/plain');assert.equal(result.pages.join(''),text);
  assert.equal(result.extraction.profile,'utf8-text-json-pages@3');assert.ok(result.pages.every(p=>sizes(p).every(n=>n<=131072)));
 }
});
test('Web 256KiB ASCII remains two pages; pure paginator sixteen encoded pages fit and seventeenth refuses',()=>{
 const result=extractWebText(Buffer.alloc(262144,97),'text/plain');assert.equal(result.pages.length,2);assert.ok(result.pages.every(p=>p.length===131072));
 const perPage=Math.floor(131072/7);const bounded='\u0001'.repeat(perPage*16);assert.equal(paginateWebText(bounded).length,16);
 assert.throws(()=>paginateWebText(bounded+'\u0001'),e=>e.code==='WEB_PAGE_LIMIT');
 assert.throws(()=>extractWebText(Buffer.alloc(262145,97),'text/plain'),e=>e.code==='WEB_BODY_LIMIT');
});
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createResultStore} from '../src/results.mjs';
import {createResearchProject,submitResearchTask,workResearchTask} from '../src/research-project.mjs';
import {sha256,normalizeDocumentCatalog,readCatalogPage,validateSource} from '../src/source.mjs';
import {webDocumentIdentity,webOriginalBytes} from '../src/web-source.mjs';
import {persistWebAcquisition,loadProjectSources} from '../src/project-sources.mjs';
import {ACQUISITION_LIMITS} from '../src/web-acquisition-records.mjs';
import {paginateWebText,validWebTextPage} from '../src/web-text-pages.mjs';
const url='https://example.org/text';
const projectIds=new Map();
async function directory(t,contextBytes){await mkdir('test-output',{recursive:true});const d=await mkdtemp(resolve('test-output/web-pagination-'));t.after(()=>rm(d,{recursive:true,force:true}));const project=await createResearchProject({directory:d,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'pagination-synthetic'},capabilities:['report'],...(contextBytes===undefined?{}:{contextBytes})}});projectIds.set(d,project.projectId);return d;}
function observation(text,profile='utf8-text@1'){
 const body=Buffer.from(text);return {body,pages:[text],requestedUrl:url,finalUrl:url,fetchedAt:'2026-11-08T14:00:00.000Z',originalMediaType:'text/plain',extraction:{profile,coverage:'static-text-only',visualInspection:'not-performed'},redirects:[],robots:[{url:'https://example.org/robots.txt',status:404,sha256:null,bytes:0,hops:[{url:'https://example.org/robots.txt',status:404}]}],requestCount:2};
}
const admission=(id,projectDir)=>({schemaVersion:'web-acquisition-plan@1',projectId:projectIds.get(projectDir),acquisitionId:id,baseManifestSha256:null,urls:[url],allowedUrls:[url],profile:'public-static-web@1',limits:{...ACQUISITION_LIMITS}});
test('Web old 64000-byte profile persists and cold loads unchanged, never repaginates',async t=>{
 const projectDir=await directory(t),old=observation('x'.repeat(64000));const saved=await persistWebAcquisition({projectDir,admission:admission('old',projectDir),observations:[old]});
 const cold=await loadProjectSources({projectDir,manifestSha256:saved.manifestSha256});assert.deepEqual(cold.catalog,saved.catalog);assert.equal(cold.catalog.documents[0].pages.length,1);assert.equal(cold.catalog.documents[0].web.extraction.profile,'utf8-text@1');assert.equal(readCatalogPage(cold.catalog,{documentId:cold.catalog.documents[0].id,page:1}).text.length,64000);
});
test('Web new profile rejects correctly hashed but encoded-oversized page at persistence and catalog consumer',async t=>{
 const projectDir=await directory(t),bad=observation('"'.repeat(20000),'utf8-text-json-pages@2');await assert.rejects(persistWebAcquisition({projectDir,admission:admission('bad',projectDir),observations:[bad]}));
 const valid=await persistWebAcquisition({projectDir,admission:admission('valid',projectDir),observations:[observation('valid','utf8-text-json-pages@2')]});
 const forged=structuredClone(valid.catalog),d=forged.documents[0];d.pages=bad.pages;d.web.pageMap=[{page:1,sha256:sha256(bad.pages[0]),bytes:20000}];Object.assign(d,webDocumentIdentity(d.web));assert.throws(()=>normalizeDocumentCatalog(forged));
});
test('Web new HTML profile preserves original artifact and codepoint-complete extraction',async t=>{
 const body=Buffer.from('<main><p>'+ '中😀"\\'.repeat(3000)+'</p></main><script>doNotExecute()</script>'),extracted=extractWebText(body,'text/html');
 assert.equal(extracted.extraction.profile,'static-html-parse5@8.1.0-json-pages@3');assert.ok(extracted.pages.every(p=>p.isWellFormed()&&validWebTextPage(p,extracted.extraction.profile)));assert.equal(extracted.pages.join(''),extracted.text);
 const projectDir=await directory(t),o={...observation(''),...extracted,body};const saved=await persistWebAcquisition({projectDir,admission:admission('html',projectDir),observations:[o]});const cold=await loadProjectSources({projectDir,manifestSha256:saved.manifestSha256});const d=cold.catalog.documents[0];assert.deepEqual(webOriginalBytes(d.web,d.originalBase64),body);assert.equal(d.pages.join(''),extracted.text);
});
test('Web control-character and escaping budgets preserve all codepoints without truncation',()=>{
 for(const text of ['\u0001'.repeat(30000),'"'.repeat(65536),'\\'.repeat(65536),'😀'.repeat(65536)]){const pages=paginateWebText(text);assert.equal(pages.join(''),text);assert.ok(pages.length<=16);assert.ok(pages.every(p=>p.isWellFormed()&&sizes(p).every(n=>n<=131072)));}
 assert.throws(()=>paginateWebText('"'.repeat(524289)),e=>e.code==='WEB_PAGE_LIMIT');assert.throws(()=>paginateWebText('\ud800'),/WEB_TEXT_INVALID/);
});

test('Web 100000-byte v3 page refuses explicit32000 but completes configured1MiB Project flow',async t=>{
 const text='a'.repeat(100000),report='# Selected source\n'+ 'Evidence sentence. '.repeat(100);const results=[];
 for(const contextBytes of [32000,1048576]){
  const projectDir=await directory(t,contextBytes),o=observation(text);Object.assign(o,extractWebText(o.body,'text/plain'));
  const saved=await persistWebAcquisition({projectDir,admission:admission('flow',projectDir),observations:[o]}),doc=saved.catalog.documents[0];
  await submitResearchTask({projectDir,runId:'flow',question:'Read the source, save the specified report, reread the same original result, and finish.',sourceManifestSha256:saved.manifestSha256});
  let turn=0,ref,sourceId;const measured=[];const gateway={mode:'fixture',next({messages}){
   measured.push(Buffer.byteLength(JSON.stringify(messages)));const values=messages.filter(m=>m.role==='tool').map(m=>m.result.value);
   if(turn++===0)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:doc.id,page:1}}]};
   if(turn===2){ref=values.at(-1).resultRef;sourceId=values.at(-1).sourceId;return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:report,sourceIds:[sourceId]}}]};}
   if(turn===3)return{kind:'calls',calls:[{id:'again',name:'read_result',arguments:{resultRef:ref}}]};
   return{kind:'final',text:'Saved and reread.'};
  }};
  const worked=await workResearchTask({projectDir,runId:'flow',gateway});results.push({contextBytes,status:worked.run.status,code:worked.run.snapshot.code,turn,measured});
  if(contextBytes===1048576){assert.equal(worked.run.status,'completed',JSON.stringify(results));assert.equal(turn,4);}else{assert.notEqual(worked.run.status,'completed');assert.equal(turn,1);assert.equal(doc.pages[0],text);}
 }
 t.diagnostic(JSON.stringify({explicitLimits:[32000,1048576],results}));
});

test('Web legacy v2 65536-byte page survives catalog Source Result and cold persistence, legacy/plain cannot widen',async t=>{
 const projectDir=await directory(t),text='x'.repeat(65536),o=observation(text,'utf8-text-json-pages@2');
 const saved=await persistWebAcquisition({projectDir,admission:admission('full-page',projectDir),observations:[o]});
 const cold=await loadProjectSources({projectDir,manifestSha256:saved.manifestSha256}),d=cold.catalog.documents[0],source=readCatalogPage(cold.catalog,{documentId:d.id,page:1});
 assert.equal(validateSource(source).text,text);
 await mkdir(join(projectDir,'page-result'));const store=await createResultStore({directory:join(projectDir,'page-result')});const ref=await store.add(source);assert.equal((await store.read(ref.resultRef)).text,text);
 const {web,...plain}=source;assert.throws(()=>validateSource(plain));
 const forged={...source,web:{...web,extraction:{...web.extraction,profile:'invented-large-profile'}}};assert.throws(()=>validateSource(forged));
 const legacy=structuredClone(cold.catalog);legacy.documents[0].web.extraction.profile='utf8-text@1';assert.throws(()=>normalizeDocumentCatalog(legacy));
 const ordinary={schemaVersion:'document-catalog@1',id:'plain',documents:[{id:'local',name:'Local',version:'1',pages:['x'.repeat(64001)]}]};assert.throws(()=>normalizeDocumentCatalog(ordinary));
});

import {createChatGateway} from '../src/gateway.mjs';
test('Web v3 128KiB exact page is cold-readable while v2 and unknown profiles remain strict',async t=>{
 const text='z'.repeat(131072),projectDir=await directory(t),o=observation(text,'utf8-text-json-pages@3');
 const saved=await persistWebAcquisition({projectDir,admission:admission('v3-full-page',projectDir),observations:[o]});
 const cold=await loadProjectSources({projectDir,manifestSha256:saved.manifestSha256}),d=cold.catalog.documents[0],source=readCatalogPage(cold.catalog,{documentId:d.id,page:1});assert.equal(validateSource(source).text,text);
 await mkdir(join(projectDir,'v3-result'));const store=await createResultStore({directory:join(projectDir,'v3-result')});const ref=await store.add(source);assert.equal((await store.read(ref.resultRef)).text,text);
 assert.equal(validWebTextPage(text,'utf8-text-json-pages@3'),true);assert.equal(validWebTextPage(text+'z','utf8-text-json-pages@3'),false);
 assert.equal(validWebTextPage(text,'utf8-text-json-pages@2'),false);assert.equal(validWebTextPage(text,'unknown'),false);
 const old=structuredClone(cold.catalog);old.documents[0].web.extraction.profile='utf8-text-json-pages@2';assert.throws(()=>normalizeDocumentCatalog(old));
});
test('Web v3 encoded and Unicode boundaries do not expand legacy v2 budgets',()=>{
 for(const [text,profile,accepted] of [['"'.repeat(32768),'utf8-text-json-pages@3',true],['"'.repeat(32769),'utf8-text-json-pages@3',false],['"'.repeat(16384),'utf8-text-json-pages@2',true],['"'.repeat(16385),'utf8-text-json-pages@2',false],['😀'.repeat(32768),'utf8-text-json-pages@3',true]])assert.equal(validWebTextPage(text,profile),accepted);
 const text='😀'.repeat(32769),pages=paginateWebText(text);assert.equal(pages.length,2);assert.equal(pages.join(''),text);assert.ok(pages.every(p=>p.isWellFormed()));
});
test('Web v3 valid pages do not bypass original1MiB encoded Gateway guard',async()=>{
 let calls=0;const gateway=createChatGateway({endpoint:'https://example.invalid/v1/chat/completions',model:'synthetic',apiKey:'synthetic-not-a-secret',authorization:{providerApproved:true,syntheticDataApproved:true,costApproved:true},fetchImpl:()=>{calls++;throw new Error('must not dispatch');}});
 const text='x'.repeat(131072);assert.equal(validWebTextPage(text,'utf8-text-json-pages@3'),true);
 const input={tools:[],messages:Array.from({length:8},()=>({role:'user',content:text}))};assert.ok(gateway.inputBudget.measure(input)>1048576);assert.equal(gateway.inputBudget.maxBytes,1048576);await assert.rejects(gateway.next(input),/PROVIDER_INPUT_BYTE_LIMIT/);assert.equal(calls,0);
});
