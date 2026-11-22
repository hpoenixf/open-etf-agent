import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startLocalGui } from '../src/gui-server.mjs';

const liveConfig={gateway:{provider:'opencode-go-owner',endpoint:'https://opencode.ai/inference/go/openai/v1/chat/completions',
 model:'synthetic-go-model',apiKeyEnv:'ETF_GUI_PROVIDER_KEY'},limits:{model:4},connectivity:{web:true}};
const env={ETF_GUI_PROVIDER_KEY:'fixture-placeholder'};
const fixture=JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url)));
const pdf=name=>Buffer.from(fixture.documents[name].base64,'base64');
const response=(message,finish_reason)=>Response.json({choices:[{message:{role:'assistant',...message},finish_reason}]});
const call=(name,args)=>response({tool_calls:[{type:'function',id:name,function:{name,arguments:JSON.stringify(args)}}]},'tool_calls');
const final=content=>response({content},'stop');

async function launch(t,options={}){
 await mkdir('test-output',{recursive:true});
 const projectDir=await mkdtemp(resolve('test-output/owner-pdf-'));
 const instances=[];
 t.after(async()=>{try{for(const gui of instances)await gui.close();}finally{await rm(projectDir,{recursive:true,force:true});}});
 const sent=[];
 const fetchImpl=async(_url,options)=>{
  const body=JSON.parse(options.body);
  sent.push(body);
  const tools=body.tools.map(x=>x.function.name), results=body.messages.filter(x=>x.role==='tool').map(x=>JSON.parse(x.content).value);
  if(!tools.includes('read_pdf_page')) {
    assert.ok(tools.includes('public_web_read'));
    return final('普通回答');
  }
  assert.ok(tools.includes('save_report'));
  assert.ok(!tools.includes('public_web_read'));
  if(results.length===0) return call('read_pdf_page',{page:1});
  if(results.length===1){
    assert.ok(results[0].sourceId&&results[0].text.trim());
    return call('save_report',{text:'# PDF 证据\n\n'+results[0].text.trim()+' [1]',sourceIds:[results[0].sourceId]});
  }
  return final('已读取附件并保存报告。');
 };
 async function start(){
  const gui=await startLocalGui({projectDir,liveConfig:{...liveConfig,...options},env,fetchImpl}); instances.push(gui);
  const get=path=>fetch(gui.origin+path);
  const post=(path,body)=>fetch(gui.origin+path,{method:'POST',headers:{origin:gui.origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const upload=(path,bytes,name='基金附件.pdf',headers={})=>fetch(gui.origin+path+'/'+'pdf',{method:'POST',headers:{origin:gui.origin,'content-type':'application/pdf','x-pdf-name':encodeURIComponent(name),...headers},body:bytes});
  return {...gui,get,post,upload};
 }
 return {start,sent};
}
async function settled(gui,path,msg) {
 for(let i=0;i<160;i++){
  const state=await gui.get(path).then(r=>r.json());
  const turn=state.messages.find(x=>x.id===msg);
  if(turn?.status==='completed'||turn?.status==='failed')return turn;
  await delay(25);
 }
 throw Error('Timed out waiting for '+msg);
}
test('owner PDF upload binds one conversation, uses original page evidence and survives restart; ordinary mode retains web',async t=>{
 const {start,sent}=await launch(t),gui=await start();
 const path='/api/conversations/'+(await gui.post('/api/conversations',{}).then(r=>r.json())).id;
 const other='/api/conversations/'+(await gui.post('/api/conversations',{}).then(r=>r.json())).id;
 assert.equal((await gui.upload(path,pdf('text'),'source.pdf',{origin:'https://wrong.example'})).status,403);
 assert.equal((await gui.upload(path,pdf('text'),'source.pdf',{'content-type':'application/json'})).status,415);
 for(const [bytes,name,status,code] of [[Buffer.from('no PDF'),'invalid.pdf',422,'PDF_INVALID_FORMAT'],[pdf('blank'),'blank.pdf',422,'PDF_NO_TEXT_LAYER'],[pdf('encrypted'),'encrypted.pdf',422,'PDF_ENCRYPTED'],[pdf('too-many-pages'),'big.pdf',413,'PDF_LIMIT_PAGES'],[Buffer.alloc(1048577),'large.pdf',413,'INPUT_TOO_LARGE'],[pdf('text'),'../unsafe.pdf',422,'PROJECT_SOURCE_INVALID_INPUT']]){
  const r=await gui.upload(path,bytes,name);
  assert.equal(r.status,status);
  assert.equal((await r.json()).error,code);
 }
 const r=await gui.upload(path,pdf('text'));
 assert.equal(r.status,201);
 const a=await r.json();
 assert.match(a.id,/^[a-f0-9]{64}$/);
 assert.equal(a.name,'基金附件.pdf');
 assert.deepEqual(await gui.upload(path,pdf('text')).then(r=>r.json()),a);
 assert.equal(sent.length,0);
 const earlier={messageId:'before-pdf',question:'PLAIN_BEFORE_PDF_SENTINEL'};
 assert.equal((await gui.post(path+'/messages',earlier)).status,202);
 assert.equal((await settled(gui,path,earlier.messageId)).status,'completed');
 const input={messageId:'pdf-turn',question:'PDF_TURN_ONLY_SENTINEL 附件里写了什么？',attachmentId:a.id};
 assert.equal((await gui.post(other+'/messages',input)).status,400);
 assert.equal((await gui.post(path+'/messages',input)).status,202);
 const m=await settled(gui,path,input.messageId);
 assert.equal(m.status,'completed',JSON.stringify(m));
 assert.deepEqual(m.attachment,a);
 assert.equal(m.output.sources.length,1);
 assert.equal(m.output.sources[0].pdfPage,1);
 assert.ok(m.output.report.text.includes(m.output.sources[0].text.trim()));
 assert.equal((await gui.get(path+'/messages/pdf-turn/report.md')).status,200);
 assert.equal(sent.length,4);
 assert.ok(sent.slice(1).every(request=>!JSON.stringify(request).includes(earlier.question)));
 await gui.close();
 const cold=await start();
 assert.deepEqual(await settled(cold,path,input.messageId),m);
 assert.equal((await cold.post(path+'/messages',input)).status,202);
 assert.equal((await cold.post(path+'/messages',{...input,attachmentId:undefined})).status,409);
 assert.equal(sent.length,4);
 const plain={messageId:'plain-turn',question:'普通问题'};
 assert.equal((await cold.post(path+'/messages',plain)).status,202);
 assert.equal((await settled(cold,path,plain.messageId)).output.answer,'普通回答');
 assert.equal(sent.length,5);
 const ordinaryWire=JSON.stringify(sent.at(-1));
 for (const privateText of [earlier.question,input.question,m.output.sources[0].text.trim(),'已读取附件并保存报告。',a.name]) {
  assert.ok(!ordinaryWire.includes(privateText),'the ordinary model packet must not carry pre-PDF or PDF data');
 }
 const after={messageId:'after-plain-turn',question:'继续刚刚的普通问题'};
 assert.equal((await cold.post(path+'/messages',after)).status,202);
 assert.equal((await settled(cold,path,after.messageId)).status,'completed');
 assert.equal(sent.length,6);
 const followupWire=JSON.stringify(sent.at(-1));
 assert.ok(followupWire.includes(plain.question));
 for (const privateText of [earlier.question,input.question,m.output.sources[0].text.trim(),'已读取附件并保存报告。',a.name]) {
  assert.ok(!followupWire.includes(privateText),'post-PDF follow-ups must not cross the attachment boundary');
 }
});

test('mobile browser can attach a PDF, open cited page evidence and revisit history', {skip:!process.env.GUI_PDF_PLAYWRIGHT},async t=>{
 const {chromium}=await import(process.env.GUI_PDF_PLAYWRIGHT);
 const {start,sent}=await launch(t),gui=await start();
 const browser=await chromium.launch({executablePath:process.env.GUI_PDF_CHROMIUM||'/usr/bin/chromium',headless:true});
 t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.goto(gui.origin);
 const attach=page.locator('#pdf-file');
 await attach.waitFor();
 await attach.setInputFiles({name:'手机附件.pdf',mimeType:'application/pdf',buffer:pdf('text')});
 await page.locator('#question').fill('附件里写了什么？');
 await page.locator('#send').click();
 await page.getByText('PDF：手机附件.pdf · 3 页').waitFor();
 const evidence=page.getByRole('button',{name:/来源.*1/}).first();
 await evidence.click();
 await page.getByRole('dialog').waitFor();
 assert.ok((await page.locator('#mobile-evidence pre').innerText()).trim());
 assert.match(await page.locator('#mobile-evidence h3').innerText(),/PDF 第 1 页/);
 await page.locator('#close-evidence').click();
 const detailBefore=page.url();
 await page.reload();
 await page.getByText('PDF：手机附件.pdf · 3 页').waitFor();
 assert.equal(page.url(),detailBefore);
 assert.equal(sent.length,3);
});

test('owner metered-only mode does not replace the existing PDF/tool scope or cap',async t=>{
 const {start,sent}=await launch(t,{toolAccounting:'metered-only@1',limits:{model:4,maxTools:1,tool:1}}),gui=await start();
 const path='/api/conversations/'+(await gui.post('/api/conversations',{}).then(r=>r.json())).id;
 const attachment=await gui.upload(path,pdf('text')).then(r=>r.json());
 assert.ok(attachment.id);
 assert.equal((await gui.post(path+'/messages',{messageId:'pdf-bounded',question:'Read the private PDF',attachmentId:attachment.id})).status,202);
 const turn=await settled(gui,path,'pdf-bounded');
 assert.equal(turn.status,'failed');
 assert.equal(turn.code,'TOOL_LIMIT');
 assert.equal(Object.hasOwn(turn,'toolAccounting'),false);
 assert.deepEqual(turn.budgetFailure.tools,{used:1,limit:1});
 assert.equal(sent.length,2);
 assert.ok(sent.every(request=>request.tools.some(x=>x.function.name==='read_pdf_page')&&!request.tools.some(x=>x.function.name==='public_web_read')));
});
