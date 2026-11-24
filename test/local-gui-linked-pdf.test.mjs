import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {openOwnerWeb,OWNER_WEB_EXCERPTS_LOCAL_MISS,OWNER_LINKED_PDF_REVISION} from '../src/gui-owner-web.mjs';
import {extractWebPdfLinks} from '../src/web-extraction.mjs';
import {inspectResearchTask} from '../src/research-project.mjs';
import {startLocalGui} from '../src/gui-server.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';

const url='https://issuer.example/reports/index';
const pdfUrl='https://issuer.example/reports/data.pdf';
const stock=JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8')).documents;
const pdf=Buffer.from(stock.text.base64,'base64');
const html='<main><h1>Release</h1><a href="./data.pdf">Public disclosure</a><div hidden><a href="other.pdf">hidden</a></div></main>';
const call=(id,name,args)=>({type:'function',id,function:{name,arguments:JSON.stringify(args)}});
const proposal=(...calls)=>Response.json({choices:[{message:{role:'assistant',tool_calls:calls},finish_reason:'tool_calls'}]});

test('owner run consumes HTML link, opens PDF once, cites exact physical page and cold history performs zero requests',async t=>{
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/linked-pdf-live-owner-'));
 t.after(()=>rm(projectDir,{recursive:true,force:true}));
 const network=mockWebNetwork(t,{passthroughLoopback:true,routes:{
  'https://issuer.example/robots.txt':{body:'User-agent: *\nAllow: /\n'},
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
   answer='合成文档第 1 页 [[PDF:'+page.sourceRef+']]';
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
 assert.equal(before.availability,'available');
 const evidenced=before.readSources.filter(row=>row.kind==='web-pdf-original-page');
 assert.deepEqual(evidenced.map(x=>[x.page,x.cited]),[[1,true],[3,false]]);
 assert.equal(evidenced[0].url,pdfUrl);
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
  'https://issuer.example/robots.txt':{body:'User-agent: *\nAllow: /\n'},
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
