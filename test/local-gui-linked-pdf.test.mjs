import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {openOwnerWeb,OWNER_WEB_EXCERPTS_LOCAL_MISS,OWNER_LINKED_PDF_REVISION,OWNER_LINKED_PDF_LOCAL_MISS} from '../src/gui-owner-web.mjs';
import {extractWebPdfLinks} from '../src/web-extraction.mjs';
import {inspectResearchTask} from '../src/research-project.mjs';
import {startLocalGui} from '../src/gui-server.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';

const url='https://www.cnindex.com.cn/zh_information/notices_news/';
const pdfUrl='https://www.cnindex.com.cn/zh_information/notices_news/2026/202611/P020261106683336733126.pdf?act_menu=2';
const stock=JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8')).documents;
const pdf=Buffer.from(stock.text.base64,'base64');
const html='<main><h1>Release</h1><a href="./2026/202611/P020261106683336733126.pdf?act_menu=2">Public disclosure</a><div hidden><a href="other.pdf">hidden</a></div></main>';
const call=(id,name,args)=>({type:'function',id,function:{name,arguments:JSON.stringify(args)}});
const proposal=(...calls)=>Response.json({choices:[{message:{role:'assistant',tool_calls:calls},finish_reason:'tool_calls'}]});

test('owner run consumes HTML link, opens PDF once, cites exact physical page and cold history performs zero requests',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-live-owner-'));
 t.after(()=>rm(projectDir,{recursive:true,force:true}));
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://www.cnindex.com.cn/robots.txt':{body:'User-agent: *\nAllow: /\n'},
  [url]:{body:html,headers:{'content-type':'text/html'}},
  [pdfUrl]:{body:pdf,headers:{'content-type':'application/pdf'}},
 }});
 const sent=()=>network.calls.filter(value=>value.url===pdfUrl).length;
 let gui, page, answer, modelCalls=0, first;
 t.after(async()=>await gui?.close());
 const options={projectDir,liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
  limits:{model:7},connectivity:{web:true,linkedPdf:true},
 },env:{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder'},async fetchImpl(_url,{body}){
   modelCalls++;
   const req=JSON.parse(body), prior=req.messages.filter(m=>m.role==='tool');
   assert.ok(req.tools.some(item=>item.function.name==='public_web_linked_pdf_page'));
   if(!prior.length)return proposal(call('html','public_web_read',{url}));
   if(prior.length===1){
    first=JSON.parse(prior[0].content).value;
    assert.equal(first.pdfLinks.schemaVersion,'web-pdf-link-inventory@1');
    assert.deepEqual(first.pdfLinks.links.map(link=>link.url),[pdfUrl]);
    return proposal(call('html-again','public_web_read',{url}));
   }
   if(prior.length===2){
    const reread=JSON.parse(prior[1].content).value;
    assert.deepEqual(reread.pdfLinks,first.pdfLinks);
    assert.notEqual(reread.manifestSha256,first.manifestSha256);
    return proposal(call('pdf-first','public_web_linked_pdf_page',{page:1,linkId:reread.pdfLinks.links[0].id}));
   }
   if(prior.length===3){
    page=JSON.parse(prior[2].content).value;
    assert.equal(page.kind,'web-pdf-original-page');
    return proposal(call('pdf-other','public_web_linked_pdf_page',{page:3,linkId:first.pdfLinks.links[0].id}));
   }
   const other=JSON.parse(prior[3].content).value;
   assert.equal(other.kind,'web-pdf-original-page');
   assert.equal(other.page,3);
   assert.notEqual(other.sha256,page.sha256);
   answer='合成文档第 1 页 [[PDF:'+page.sourceRef+']]；公告 [[WEB:'+first.manifestSha256+':1]]；未知 [[WEB:'+'0'.repeat(64)+':1]]';
   return Response.json({choices:[{message:{role:'assistant',content:answer},finish_reason:'stop'}]});
 }};
 gui=await startLocalGui(options);
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const {id}=await post('/api/conversations',{}).then(r=>r.json()), path='/api/conversations/'+id;
 assert.equal((await post(path+'/messages',{messageId:'reading',question:'从公开网页上按链接读取 PDF，引用第一物理页。'})).status,202);
 let status;
 for(let i=0;i<100;i++){
  status=await get(path);
  if(['completed','failed'].includes(status.messages[0]?.status)&&!status.messages[0]?.working)break;
  await delay(35);
 }
 assert.equal(status.messages[0].status,'completed',JSON.stringify(status.messages[0]));
 assert.equal(status.messages[0].output.answer,answer);
 const {definition}=await inspectResearchTask({projectDir,runId:status.messages[0].runId});
 assert.equal(definition.ownerLinkedPdfRevision,OWNER_LINKED_PDF_REVISION);
 assert.equal(sent(),1);
 assert.equal(network.calls.filter(value=>value.url===url).length,2);
 assert.equal(modelCalls,5);
 const sourcePath=path+'/messages/reading/sources', bodyPath=path+'/messages/reading/body';
 const before=await get(sourcePath), bodyBefore=await get(bodyPath);
 assert.equal(before.availability,'partial','unresolved inline WEB ref must not be presented as fully verified');
 const evidenced=before.readSources.filter(row=>row.kind==='web-pdf-original-page');
 assert.deepEqual(evidenced.map(x=>[x.page,x.cited]),[[1,true],[3,false]]);
 assert.equal(evidenced[0].url,pdfUrl);
 assert.equal(before.readSources.find(row=>row.cited&&row.kind==='web-original-excerpt')?.citationRef,'WEB:'+first.manifestSha256+':1');
 assert.equal(evidenced[0].originalSha256,createHash('sha256').update(pdf).digest('hex'));
 assert.equal(evidenced[0].text,page.text);
 assert.equal(evidenced[0].sha256,createHash('sha256').update(page.text).digest('hex'));
 assert.ok(!JSON.stringify(before).includes('originalBase64'));
 await gui.close();gui=await startLocalGui(options);
 assert.deepEqual(await get(sourcePath),before);
 assert.deepEqual(await get(bodyPath),bodyBefore);
 assert.equal(sent(),1);assert.equal(modelCalls,5);
 const sibling=await post('/api/conversations',{}).then(r=>r.json());
 assert.equal((await fetch(gui.origin+'/api/conversations/'+sibling.id+'/messages/reading/sources')).status,404);
});

test('PDF link authority requires a successfully consumed earlier proposal and never dispatches for partial proof',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-evidence-order-'));
 t.after(()=>rm(projectDir,{recursive:true,force:true}));
 const inventory=extractWebPdfLinks(Buffer.from(html),'text/html',{finalUrl:url});
 const web={id:'html',name:'public_web_read',arguments:{url}};
 const pdfCall={id:'pdf-first',name:'public_web_linked_pdf_page',arguments:{linkId:inventory.links[0].id,page:1}};
 const response={role:'tool',callId:web.id,result:{callId:web.id,status:'succeeded',dispatched:true,
  value:{kind:'public-web-page@2',pdfLinks:inventory}}};
 let messages,requests=0;
 const build=profile=>openOwnerWeb({projectDir,projectId:'project-1',runId:'run-1',profile,linkedPdfRevision:profile.linkedPdf?OWNER_LINKED_PDF_REVISION:undefined,
  excerptRevision:OWNER_WEB_EXCERPTS_LOCAL_MISS,readRun:()=>({runId:'run-1',snapshot:{messages}}),
  transport:{fetchPdf(){requests++;throw Error('must not dispatch');},
   inspect(){requests++;throw Error('must not resolve a nonconsumed parent');}}});
 assert.equal(build({web:true}).find(t=>t.name===pdfCall.name),undefined);
 const tool=build({web:true,linkedPdf:true}).find(t=>t.name===pdfCall.name);
 for(const snapshot of [
  [{role:'assistant',calls:[web,pdfCall]},response],
  [{role:'assistant',calls:[pdfCall]},{role:'assistant',calls:[web]},response],
  [{role:'assistant',calls:[web]},response],
  [{role:'assistant',calls:[web]},{...response,result:{...response.result,dispatched:false}},
   {role:'assistant',calls:[pdfCall]}],
 ]){
  messages=snapshot;
  assert.deepEqual(await tool.execute(pdfCall.arguments,{callId:pdfCall.id}),
   {kind:'web-pdf-unavailable@1',status:'unavailable',code:'WEB_PDF_LINK_UNKNOWN'});
 }
 assert.equal(requests,0);
});

test('linked PDF opt-in is frozen on interactive admission, never inherited by Daily Watch',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-daily-scope-'));
 let gui, now=Date.parse('2026-11-25T07:55:00+08:00');
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const seen=[];
 const options={projectDir,dailyClock:()=>now,liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
  limits:{model:2},connectivity:{web:true,linkedPdf:true},
 },env:{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder',ETF_GUI_DAILY_AUTORUN:'1'},async fetchImpl(_url,{body}){
  const request=JSON.parse(body);
  seen.push(request.tools.map(item=>item.function.name));
  return Response.json({choices:[{message:{role:'assistant',content:'合成工作完成'},finish_reason:'stop'}]});
 }};
 gui=await startLocalGui(options);
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const watch=await post('/api/daily-watch',{question:'Daily synthetic question',localTime:'08:00',enabled:true}).then(r=>r.json());
 now=Date.parse('2026-11-25T08:00:00+08:00');
 await gui.sweepDaily();
 const member=(await get('/api/daily-watch')).items.find(item=>item.id===watch.id).history[0];
 assert.equal(member.status,'completed');
 assert.deepEqual(seen,[['public_web_read','public_web_continue']]);
 assert.equal((await inspectResearchTask({projectDir,runId:member.runId})).definition.ownerLinkedPdfRevision,undefined);
 const {id}=await post('/api/conversations',{}).then(r=>r.json());
 const path='/api/conversations/'+id;
 const input={messageId:'manual',question:'Interactive synthetic question'};
 const turn=await post(path+'/messages',input).then(r=>r.json());
 for(let i=0;i<100;i++){
  const message=(await get(path)).messages[0];
  if(message?.status==='completed'&&!message?.working)break;
  await delay(20);
 }
 assert.equal((await inspectResearchTask({projectDir,runId:turn.runId})).definition.ownerLinkedPdfRevision,OWNER_LINKED_PDF_REVISION);
 assert.ok(seen[1].includes('public_web_linked_pdf_page'));
 await gui.close();gui=await startLocalGui(options);
 assert.equal((await post(path+'/messages',input).then(r=>r.json())).runId,turn.runId);
 const dailySources=await get('/api/conversations/'+member.conversationId+'/messages/'+member.messageId+'/sources');
 assert.equal(dailySources.availability,'none');assert.equal(seen.length,2);
});

test('settled ordinary PDF refusal preserves HTML answer, is not auto-replayed, and has no PDF evidence',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-optional-refusal-'));
 let gui;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://www.cnindex.com.cn/robots.txt':{body:'User-agent: *\nAllow: /\n'},
  [url]:{body:html,headers:{'content-type':'text/html'}},
  [pdfUrl]:{body:pdf,headers:{'content-type':'application/pdf','content-encoding':'unknown-synthetic'}},
 }});
 let modelCalls=0;
 const answer='已核验 HTML 公告目录；PDF 无法读取，不能确认页内细节。';
 const options={projectDir,liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
  limits:{model:5},connectivity:{web:true,linkedPdf:true},
 },env:{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder'},async fetchImpl(_url,{body}){
  modelCalls++;
  const request=JSON.parse(body), prior=request.messages.filter(m=>m.role==='tool');
  if(!prior.length)return proposal(call('first','public_web_read',{url}));
  const linkId=JSON.parse(prior[0].content).value.pdfLinks.links[0].id;
  if(prior.length===1)return proposal(call('pdf','public_web_linked_pdf_page',{linkId,page:1}));
  const observation=JSON.parse(prior[1].content).value;
  assert.equal(observation.status,'unavailable');assert.equal(observation.code,'WEB_CONTENT_ENCODING');
  return Response.json({choices:[{message:{role:'assistant',content:answer},finish_reason:'stop'}]});
 }};
 gui=await startLocalGui(options);
 const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const get=path=>fetch(gui.origin+path).then(r=>r.json());
 const {id}=await post('/api/conversations',{}).then(r=>r.json()), path='/api/conversations/'+id;
 assert.equal((await post(path+'/messages',{messageId:'reading',question:'用公开官网给出可核结果'})).status,202);
 let status;
 for(let i=0;i<100;i++){
  status=await get(path);
  if(['completed','failed'].includes(status.messages[0]?.status)&&!status.messages[0]?.working)break;
  await delay(25);
 }
 assert.equal(status.messages[0].status,'completed',JSON.stringify(status.messages[0]));
 assert.equal(status.messages[0].output.answer,answer);
 const sourcePath=path+'/messages/reading/sources', bodyPath=path+'/messages/reading/body';
 const before=await get(sourcePath), originalBody=await get(bodyPath);
 assert.equal(before.availability,'available');assert.deepEqual(before.readSources.map(row=>row.kind),['web-original-excerpt']);
 await gui.close();gui=await startLocalGui(options);
 assert.deepEqual(await get(sourcePath),before);assert.deepEqual(await get(bodyPath),originalBody);
 assert.equal(modelCalls,3);assert.equal(network.calls.filter(value=>value.url===pdfUrl).length,1);
});


test('changing only interactive linked PDF must not pause an existing Daily Watch',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-existing-watch-'));
 let gui, now=Date.parse('2026-11-26T08:00:00+08:00'), runs=0;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const options={projectDir,dailyClock:()=>now,env:{ETF_GUI_PROVIDER_KEY:'synthetic-only',ETF_GUI_DAILY_AUTORUN:'1'},
  async fetchImpl(_url,{body}){runs++;assert.ok(!JSON.parse(body).tools.some(x=>x.function.name==='public_web_linked_pdf_page'));
   return Response.json({choices:[{message:{role:'assistant',content:'Synthetic daily answer'},finish_reason:'stop'}]});}};
 const open=async connectivity=>{await gui?.close();gui=await startLocalGui({...options,liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:2},connectivity}});};
 await open({web:true});
 const put=()=>fetch(gui.origin+'/api/daily-watch',{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify({question:'Daily synthetic watch',localTime:'09:30',enabled:true})});
 const response=await put();assert.equal(response.status,201);
 const id=(await response.json()).id;
 const watch=async()=> (await fetch(gui.origin+'/api/daily-watch').then(r=>r.json())).items.find(item=>item.id===id);
 await open({web:true,linkedPdf:true});
 assert.equal((await watch()).requiresReview,false,'interactive PDF does not change the scheduled tool profile');
 now=Date.parse('2026-11-26T09:30:00+08:00');await gui.sweepDaily();
 assert.equal((await watch()).history[0]?.status,'completed');assert.equal(runs,1);
 await open({web:true});await gui.sweepDaily();
 assert.equal((await watch()).requiresReview,false);assert.equal(runs,1);
 await open(undefined);
 assert.equal((await watch()).requiresReview,true,'changing the actual scheduled tool profile still requires review');
 now=Date.parse('2026-11-27T09:30:00+08:00');await gui.sweepDaily();assert.equal(runs,1);
});

test('cold receipt verification accepts an exact pre-upgrade inventory but not an edited source',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-legacy-inventory-'));
 t.after(()=>rm(projectDir,{recursive:true,force:true}));
 const bytes=Buffer.from(html+'<a href="legacy.pdf">Other public PDF</a>');
 const originalSha256=createHash('sha256').update(bytes).digest('hex');
 const receipt={status:'succeeded',plan:{urls:[url]},manifestSha256:'a'.repeat(64)};
 const acquired={manifestSha256:receipt.manifestSha256,catalog:{documents:[{
  originalBase64:bytes.toString('base64'),pages:['Verified public market notice','Retained second excerpt'],web:{
   requestedUrl:url,finalUrl:url,retrievedAt:'2026-11-25T00:00:00.000Z',originalSha256,originalMediaType:'text/html',
  },
 }]}};
 const messages=[];
 const opts={projectDir,projectId:'project-legacy',runId:'run-legacy',profile:{web:true,linkedPdf:true},
  linkedPdfRevision:OWNER_LINKED_PDF_REVISION,excerptRevision:OWNER_WEB_EXCERPTS_LOCAL_MISS,
  readRun:()=>({runId:'run-legacy',snapshot:{messages}}),
  transport:{inspect:async()=>receipt,load:async()=>acquired,acquire:()=>assert.fail('no fetch on cold read')},
 };
 const tool=()=>openOwnerWeb(opts).find(x=>x.name==='public_web_read');
 const call={id:'legacy',name:'public_web_read',arguments:{url}};
 const fresh=await tool().reconcile(call.arguments,{callId:call.id});
 assert.deepEqual(fresh.pdfLinks.links.map(x=>x.url),[pdfUrl,new URL('legacy.pdf',url).href]);
 const old={...fresh,pdfLinks:extractWebPdfLinks(bytes,'text/html',{finalUrl:url,allowPublicNavigation:false})};
 await tool().verifyResult(old,{call});
 await tool().verifyResult(fresh,{call});
 const continued={id:'old-next',name:'public_web_continue',arguments:{cursor:old.nextCursor}};
 const remember=value=>{messages.splice(0,messages.length,{role:'assistant',calls:[call]},
  {role:'tool',callId:call.id,result:{callId:call.id,status:'succeeded',dispatched:true,value}},
  {role:'assistant',calls:[continued]});};
 const next=()=>openOwnerWeb(opts).find(x=>x.name===continued.name);
 remember(fresh);
 const pageTwo=await next().reconcile(continued.arguments,{callId:continued.id});
 assert.equal(pageTwo.page,2);assert.equal(pageTwo.text,'Retained second excerpt');
 remember(old);
 assert.deepEqual(await next().reconcile(continued.arguments,{callId:continued.id}),pageTwo);
 await next().verifyResult(pageTwo,{call:continued});
 remember({...old,pdfLinks:{...old.pdfLinks,links:[]}});
 await assert.rejects(next().verifyResult(pageTwo,{call:continued}),{code:'WEB_PAGE_EVIDENCE_CHANGED'});
 await assert.rejects(tool().verifyResult({...old,pdfLinks:{...old.pdfLinks,links:[]}},{call}),{code:'WEB_PAGE_EVIDENCE_CHANGED'});
});

test('chart-enabled linked PDF returns a local miss for a bare search URL, then binds an exact earlier HTML receipt and persists body and cold sources',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-chart-local-miss-'));
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://www.cnindex.com.cn/robots.txt':{body:'User-agent: *\nAllow: /\n'},
  [url]:{body:html,headers:{'content-type':'text/html'}},
  [pdfUrl]:{body:pdf,headers:{'content-type':'application/pdf'}},
 }});
 const sent=()=>network.calls.filter(value=>value.url===pdfUrl).length;
 let gui,answer,modelCalls=0;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const opts={projectDir,env:{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder',ETF_GUI_AGENT_FINANCIAL_CHART:'1'},liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
  limits:{model:7},connectivity:{web:true,linkedPdf:true},
 },async fetchImpl(_url,{body}){
  modelCalls++;
  const prior=JSON.parse(body).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
  if(!prior.length)return proposal(call('direct-unproven','public_web_linked_pdf_page',{page:1,linkId:pdfUrl}));
  if(prior.length===1){
   assert.equal(sent(),0);
   assert.equal(prior[0].code,'WEB_PDF_LINK_NOT_IN_EARLIER_HTML');
   assert.equal(prior[0].networkAttempted,false);
   assert.match(prior[0].hint,/answer from verified sources/);
   return proposal(call('html-positive','public_web_read',{url}));
  }
  if(prior.length===2){
   assert.equal(prior[1].pdfLinks.links[0].url,pdfUrl);
   return proposal(call('direct-bound','public_web_linked_pdf_page',{page:1,linkId:pdfUrl}));
  }
  if(prior.length===3){
   assert.equal(prior[2].kind,'web-pdf-original-page');
   assert.equal(sent(),1);
   return proposal(call('exact-receipt','public_web_linked_pdf_page',{page:3,linkId:prior[1].pdfLinks.links[0].id}));
  }
  assert.equal(prior[3].kind,'web-pdf-original-page');
  answer='Verified official PDF evidence [[PDF:'+prior[2].sourceRef+']]';
  return Response.json({choices:[{message:{role:'assistant',content:answer},finish_reason:'stop'}]});
 }};
 gui=await startLocalGui(opts);
 const post=(p,v)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const get=p=>fetch(gui.origin+p).then(r=>r.json());
 const path='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const request=await post(path+'/messages',{messageId:'pdf-chart',question:'Read the original PDF and preserve a verified citation.',skillId:'auto'});
 assert.equal(request.status,202,await request.text());
 let message;
 for(let i=0;i<100;i++){
  message=(await get(path)).messages[0];
  if(message&&!message.working&&['completed','failed'].includes(message.status))break;
  await delay(35);
 }
 assert.equal(message.status,'completed',JSON.stringify(message));
 assert.equal(message.output.answer,answer);
 const {definition}=await inspectResearchTask({projectDir,runId:message.runId});
 assert.equal(definition.ownerLinkedPdfRevision,'owner-public-linked-pdf@2');
 const bodyPath=path+'/messages/pdf-chart/body',sourcePath=path+'/messages/pdf-chart/sources';
 const savedBody=await get(bodyPath),savedSources=await get(sourcePath);
 assert.equal(savedSources.availability,'available');
 assert.deepEqual(savedSources.readSources.filter(row=>row.kind==='web-pdf-original-page').map(row=>[row.page,row.cited]),[[1,true],[3,false]]);
 await gui.close();gui=await startLocalGui(opts);
 assert.deepEqual(await get(bodyPath),savedBody);
 assert.deepEqual(await get(sourcePath),savedSources);
 assert.equal(sent(),1);
 assert.equal(modelCalls,5);
});

test('raw URL alias cannot use a sibling proposal, a different URL, duplicate receipt identities, or another run',async()=>{
 const exact='https://www.cnindex.com.cn/notice.pdf';
 const idA='web-pdf-link:sha256:'+'a'.repeat(64),idB='web-pdf-link:sha256:'+'b'.repeat(64);
 const read={id:'read',name:'public_web_read',arguments:{url}};
 const next={...read,id:'read-2'};
 const requested={id:'pdf',name:'public_web_linked_pdf_page',arguments:{linkId:exact,page:1}};
 const result=(call,id,pdf=exact)=>({role:'tool',callId:call.id,result:{callId:call.id,status:'succeeded',dispatched:true,
  value:{kind:'public-web-page@2',pdfLinks:{schemaVersion:'web-pdf-link-inventory@1',links:[{url:pdf,id}]}}}});
 const group=(...calls)=>({role:'assistant',calls});
 let messages,runId='alias-test';
 const noRequest=()=>{throw Error('unexpected web transport or local receipt read');};
 const tool=openOwnerWeb({projectDir:'unused',projectId:'fixture',runId:'alias-test',profile:{web:true,linkedPdf:true},
  linkedPdfRevision:OWNER_LINKED_PDF_LOCAL_MISS,excerptRevision:OWNER_WEB_EXCERPTS_LOCAL_MISS,readRun:()=>({runId,snapshot:{messages}}),
  transport:{inspect:noRequest,fetchPdf:noRequest}}).find(row=>row.name===requested.name);
 for(const snapshot of [
  [group(read,requested),result(read,idA)],
  [group(requested),group(read),result(read,idA)],
  [group(read),result(read,idA,exact+'?id=1'),group(requested)],
  [group(read),result(read,idA),group(next),result(next,idB),group(requested)],
 ]){
  messages=snapshot;
  const miss=await tool.execute(requested.arguments,{callId:requested.id});
  assert.equal(miss.code,'WEB_PDF_LINK_NOT_IN_EARLIER_HTML');
  assert.equal(miss.networkAttempted,false);
  await tool.verifyResult(miss,{call:requested});
 }
 runId='different-run';messages=[group(read),result(read,idA),group(requested)];
 await assert.rejects(tool.execute(requested.arguments,{callId:requested.id}),{code:'WEB_PAGE_RUN_REQUIRED'});
});

test('chart linked-PDF runs persist body after a malformed public URL and a settled ineligible redirect, without trying either target',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-web-url-local-miss-'));
 const host='https://www.tencent.com';
 const stale=host+'/zh-cn/investors/financial-news.html', forbidden=stale.replace('https:','http:');
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  [host+'/robots.txt']:{body:'User-agent: *\nAllow: /\n'},
  [stale]:{status:302,headers:{location:forbidden}},
 }});
 let gui,requests=0;
 t.after(async()=>{await gui?.close();await rm(projectDir,{recursive:true,force:true});});
 const answer='没有读到正式公告，不把未经核实的数值当作原文。';
 const opts={projectDir,env:{ETF_GUI_PROVIDER_KEY:'synthetic-placeholder',ETF_GUI_AGENT_FINANCIAL_CHART:'1'},liveConfig:{
  gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',model:'synthetic',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},
  limits:{model:6},connectivity:{web:true,linkedPdf:true},
 },async fetchImpl(_url,{body}){
  requests++;
  const prior=JSON.parse(body).messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content).value);
  if(!prior.length)return proposal(call('invalid-input','public_web_read',{url:' '+stale}));
  if(prior.length===1){
   assert.equal(network.calls.length,0);
   assert.equal(prior[0].kind,'public-web-page-unavailable@1');
   assert.equal(prior[0].reason,'WEB_URL_INVALID');
   assert.equal(prior[0].networkAttempted,false);
   assert.equal(prior[0].requestOutcome,'not-dispatched');
   return proposal(call('settled-invalid-redirect','public_web_read',{url:stale}));
  }
  assert.equal(prior[1].reason,'WEB_URL_INVALID');
  assert.equal(prior[1].requestOutcome,'no-unobserved-dispatch');
  assert.equal(prior[1].automaticReplayAllowed,false);
  assert.match(prior[1].hint,/do not fetch the rejected redirect/);
  return Response.json({choices:[{message:{role:'assistant',content:answer},finish_reason:'stop'}]});
 }};
 gui=await startLocalGui(opts);
 const post=(p,v)=>fetch(gui.origin+p,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(v)});
 const get=p=>fetch(gui.origin+p).then(r=>r.json());
 const path='/api/conversations/'+(await post('/api/conversations',{}).then(r=>r.json())).id;
 const response=await post(path+'/messages',{messageId:'invalid-page',question:'Read the original publisher report.',skillId:'auto'});
 assert.equal(response.status,202,await response.text());
 let message;
 for(let i=0;i<100;i++){
  message=(await get(path)).messages[0];
  if(message&&!message.working&&['completed','failed'].includes(message.status))break;
  await delay(35);
 }
 assert.equal(message.status,'completed',JSON.stringify(message));
 assert.equal(message.output.answer,answer);
 const {definition}=await inspectResearchTask({projectDir,runId:message.runId});
 assert.equal(definition.ownerWebExcerptRevision,'owner-web-excerpts@3');
 const bodyPath=path+'/messages/invalid-page/body',sourcePath=path+'/messages/invalid-page/sources';
 const savedBody=await get(bodyPath),savedSources=await get(sourcePath);
 assert.equal(savedSources.availability,'none');
 await gui.close();gui=await startLocalGui(opts);
 assert.deepEqual(await get(bodyPath),savedBody);
 assert.deepEqual(await get(sourcePath),savedSources);
 assert.deepEqual(network.calls.map(x=>x.url),[host+'/robots.txt',stale]);
 assert.equal(requests,3);
});
