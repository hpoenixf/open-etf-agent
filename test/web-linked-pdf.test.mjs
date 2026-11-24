import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {extractWebPdfLinks} from '../src/web-extraction.mjs';
import {openLinkedWebPdfOwner} from '../src/web-linked-pdf.mjs';
import {acquireApprovedWebPdf} from '../src/web-transport.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';

const originals=JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8')).documents;
const fixtureRoot=resolve('test-output');
await mkdir(fixtureRoot,{recursive:true});
const scope={accountId:'owner-a',projectId:'project-a',runId:'run-a'};
const authority={kind:'authenticated-owner-public-web',protected:false,...scope};
const body=Buffer.from('<a href="./holdings.pdf">Read actual report</a>');
const contentType='text/html',finalUrl='https://issuer.example/reports/latest';
const {originalSha256,links:[link]}=extractWebPdfLinks(body,contentType,{finalUrl});
const source={scope,protected:false,status:'consumed',acquisitionId:'html-1',body,contentType,finalUrl,originalSha256};
async function fixture({name='text',responseChanges,sourceChanges,issue,pdfBytes}={}){
 const projectDir=await mkdtemp(join(fixtureRoot,'linked-pdf-'));
 let responses=0;
 const fetchPdf=({url,signal})=>{
  responses++;
  assert.equal(url,link.url);
  assert.ok(!signal?.aborted);
  if(issue)throw issue;
  return {requestedUrl:url,finalUrl:url,redirects:[],fetchedAt:'2026-11-24T00:00:00Z',
   body:pdfBytes??Buffer.from(originals[name].base64,'base64'),contentType:'application/pdf',...responseChanges};
 };
 const open=(changes={})=>openLinkedWebPdfOwner({projectDir,authority,resolveConsumedHtml:async()=>({...source,...sourceChanges}),fetchPdf,...changes});
 return {projectDir,open,responses:()=>responses};
}
test('physical page is read using the retained artifact after cold reopen, with one PDF dispatch',async()=>{
 const f=await fixture();
 assert.equal((await f.open().readPage(link.id,3)).status,'unknown');
 const got=await f.open().acquire(link.id);
 assert.deepEqual(got,{kind:'web-pdf-acquisition@1',status:'saved',originalSha256:originals.text.sha256,pages:3});
 const owner=f.open({fetchPdf:()=>assert.fail('cold read must not fetch')});
 const second=await owner.readPage(link.id,3),first=await owner.readPage(link.id,1);
 assert.equal(second.kind,'web-pdf-original-page');
 assert.equal(second.page,3);
 assert.equal(second.originalSha256,originals.text.sha256);
 assert.notEqual(second.sha256,first.sha256);
 assert.notEqual(second.sourceRef,first.sourceRef);
 assert.equal(second.url,link.url);
 assert.notEqual(second.text,first.text);
 assert.equal((await owner.readPage(link.id,3)).sourceRef,second.sourceRef);
 assert.deepEqual(await owner.acquire(link.id),got);
 await assert.rejects(owner.readPage(link.id,4),{code:'WEB_PDF_PAGE_INVALID'});
 assert.equal(f.responses(),1);
 const dirs=await readdir(join(f.projectDir,'web-linked-pdf'));
 const record=join(f.projectDir,'web-linked-pdf',dirs[0],'final.json');
 const saved=JSON.parse(await readFile(record));
 saved.snapshotBinding={...saved.snapshotBinding,snapshotSha256:'0'.repeat(64)};
 await writeFile(record,JSON.stringify(saved));
 await assert.rejects(owner.readPage(link.id,3),{code:'WEB_PDF_RECORD_CHANGED'});
 assert.equal(f.responses(),1);
});
test('other account/project/run and invented links fail before dispatch',async()=>{
 const f=await fixture();
 assert.throws(()=>f.open({authority:{...authority,protected:true}}),{code:'WEB_PDF_SCOPE_DENIED'});
 for(const [field,value] of [['accountId','other'],['runId','other'],['projectId','other']])
  await assert.rejects(f.open({authority:{...authority,[field]:value}}).acquire(link.id),{code:'WEB_PDF_LINK_UNKNOWN'});
 await assert.rejects(f.open().acquire('web-pdf-link:sha256:'+'0'.repeat(64)),{code:'WEB_PDF_LINK_UNKNOWN'});
 assert.equal(f.responses(),0);
 // Real transport rejects the invalid/non-public literal before any DNS or HTTPS operation.
 await assert.rejects(acquireApprovedWebPdf({url:'https://127.0.0.1/forbidden.pdf'}),{code:'WEB_URL_INVALID'});
});
test('wrong format, encrypted and blank pages become explicit unavailable; settled results do not re-fetch',async()=>{
 for(const [changes,code] of [
  [{responseChanges:{contentType:'text/html'}},'WEB_PDF_CONTENT_TYPE'],
  [{responseChanges:{body:Buffer.from('Not PDF')}},'WEB_PDF_INVALID_MAGIC'],
  [{responseChanges:{body:Buffer.alloc(262145)}},'WEB_BODY_LIMIT'],
  [{name:'encrypted'},'PDF_ENCRYPTED']
 ]){
  const f=await fixture(changes);
  assert.equal((await f.open().acquire(link.id)).code,code);
  assert.equal((await f.open().readPage(link.id,1)).code,code);
  assert.equal((await f.open().acquire(link.id)).code,code);
  assert.equal(f.responses(),1);
 }
 const f=await fixture({name:'blank'});
 assert.equal((await f.open().acquire(link.id)).status,'saved');
 assert.deepEqual(await f.open().readPage(link.id,1),{kind:'web-pdf-page-unavailable@1',status:'unavailable',code:'WEB_PDF_NO_EXTRACTABLE_TEXT',page:1});
});
test('a held operation remains unknown after an unobserved dispatch and never re-dispatches',async()=>{
 const f=await fixture({issue:Object.assign(new Error('unknown'),{code:'WEB_TIMEOUT',dispatchState:'outcome-unknown'})});
 await assert.rejects(f.open().acquire(link.id),{code:'WEB_TIMEOUT'});
 assert.equal((await f.open().acquire(link.id)).status,'unknown');
 assert.equal((await f.open().readPage(link.id,1)).status,'unknown');
 assert.equal(f.responses(),1);
});
function pdf(rows) {
 const s=rows.flatMap(([y,...items])=>items.map(([x,value])=>`BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${value.replace(/[()]/g,'\\$&')}) Tj ET\n`)).join('');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`];
 let out='%PDF-1.4\n',offsets=[];
 objects.forEach((v,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${v}\nendobj\n`;});
 const xref=out.length;
 return Buffer.from(out+'xref\n0 6\n0000000000 65535 f \n'+offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
}
const rows=[[740,[26,'PERFORMANCE (%)']],[722,[142,'2025'],[232,'2026']],[706,[28,'NAV'],[142,'0.32'],[232,'0.32']],[690,[28,'Benchmark'],[142,'1.10'],[232,'1.20']]];

test('text page does not expose structured table claims or retained binary',async()=>{
 const f=await fixture({pdfBytes:pdf(rows)});
 assert.equal((await f.open().acquire(link.id)).status,'saved');
 const page=await f.open().readPage(link.id,1);
 assert.match(page.text,/0\.32/);
 assert.equal(Object.hasOwn(page,'tables'),false);
 const dirs=await readdir(join(f.projectDir,'web-linked-pdf'));
 const record=JSON.parse(await readFile(join(f.projectDir,'web-linked-pdf',dirs[0],'final.json')));
 assert.equal(Object.hasOwn(record.snapshot,'originalBase64'),false);
 assert.equal(f.responses(),1);
});
test('PDF path with the actual shared broker respects same security and distinct MIME handling',async t=>{
 const robot='https://issuer.example/robots.txt';
 let redirect=false;
 const mocked=mockWebNetwork(t,{routes:{[robot]:{body:'User-agent: *\nAllow: /'},[link.url]:()=>redirect
  ?{status:302,headers:{location:'https://different.example/redirect.pdf'}}
  :{headers:{'content-type':'application/pdf'},body:Buffer.from(originals.text.base64,'base64')}}});
 const f=await fixture();
 const owner=f.open({fetchPdf:acquireApprovedWebPdf});
 assert.equal((await owner.acquire(link.id)).status,'saved');
 assert.equal(mocked.calls.filter(v=>v.url===link.url).length,1);
 const dispatch=mocked.calls.find(v=>v.url===link.url);
 assert.equal(dispatch.options.rejectUnauthorized,true);
 assert.equal(dispatch.options.headers.Accept,'application/pdf');
 assert.equal(dispatch.options.headers.Cookie,undefined);
 assert.equal(dispatch.options.headers.Authorization,undefined);
 assert.equal((await owner.readPage(link.id,3)).page,3);
 assert.equal(mocked.calls.length,2);
 redirect=true;
 const isolated=await fixture();
 assert.equal((await isolated.open({fetchPdf:acquireApprovedWebPdf}).acquire(link.id)).code,'WEB_REDIRECT_NOT_ADMITTED');
 assert.equal(mocked.calls.some(v=>v.url.includes('different.example')),false);
});
