import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {extractWebPdfLinks} from '../src/web-extraction.mjs';
import {LINKED_PDF_NATIVE_TABLES,openLinkedWebPdfOwner} from '../src/web-linked-pdf.mjs';
import {parsePdfBytes} from '../src/pdf-input.mjs';
import {LINKED_PDF_LIMITS} from '../src/pdf-parse-limits.mjs';
import {acquireApprovedWebPdf,acquireWebPage} from '../src/web-transport.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';
import {multiPagePdf,pdf} from './fixtures/native-table-pdf.mjs';

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
  [{responseChanges:{body:Buffer.alloc(LINKED_PDF_LIMITS.bytes+1)}},'WEB_BODY_LIMIT'],
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
const tableOptions={tableRevision:LINKED_PDF_NATIVE_TABLES};
const pdfCell=(page=1,column=1)=>({page,table:1,row:1,column});
test('linked native table and exact cell identity survive cold reopen without any extra acquisition',async()=>{
 const f=await fixture({pdfBytes:pdf(rows)});
 const opts={...tableOptions,fetchPdf:()=>assert.fail('must not fetch or reparse on cold read')};
 assert.equal((await f.open(tableOptions).readTables(link.id,1)).status,'unknown');
 const got=await f.open(tableOptions).acquire(link.id);
 assert.equal(got.status,'saved');
 const cold=f.open(opts), page=await cold.readPage(link.id,1);
 assert.equal(Object.hasOwn(page,'tables'),false);
 assert.deepEqual(await f.open().readPage(link.id,1),page);
 assert.equal(typeof f.open().readCell,'undefined');
 const table=await cold.readTables(link.id,1);
 assert.equal(table.kind,'web-pdf-original-tables@1');
 assert.equal(table.page,1);
 assert.equal(table.url,link.url);
 assert.equal(table.originalSha256,page.originalSha256);
 assert.deepEqual(table.tables.map(t=>[t.caption,t.unit,t.headers,t.rows.map(r=>r.label)]),
  [['PERFORMANCE (%)','%',['2025','2026'],['NAV','Benchmark']]]);
 const first=await cold.readCell(link.id,pdfCell()), second=await cold.readCell(link.id,pdfCell(1,2));
 assert.equal(first.kind,'web-pdf-original-cell@1');
 assert.equal(first.text,'0.32');
 assert.equal(second.text,first.text);
 assert.equal(second.sha256,first.sha256);
 assert.equal(first.cell.header,'2025');
 assert.equal(second.cell.header,'2026');
 assert.equal(second.cell.rowLabel,'NAV');
 assert.equal(second.cell.unit,'%');
 assert.deepEqual(second.cell.at,table.tables[0].rows[0].cells[1].at);
 assert.notEqual(second.sourceRef,first.sourceRef);
 assert.notEqual(first.sourceRef,page.sourceRef);
 assert.deepEqual(await f.open(opts).readCell(link.id,pdfCell(1,2)),second);
 assert.deepEqual(await cold.acquire(link.id),got);
 assert.equal(f.responses(),1);
 const [dir]=await readdir(join(f.projectDir,'web-linked-pdf'));
 const receiptPath=join(f.projectDir,'web-linked-pdf',dir,'final.json');
 const receipt=JSON.parse(await readFile(receiptPath));
 assert.equal(receipt.schemaVersion,'web-linked-pdf-record@2');
 assert.equal(Object.hasOwn(receipt.snapshot,'originalBase64'),false);
 const tableHash=()=>createHash('sha256').update(JSON.stringify([receipt.binding,receipt.snapshotBinding,receipt.tableSnapshot])).digest('hex');
 assert.equal(Object.hasOwn(receipt.snapshot,'tables'),false);
 receipt.tableSnapshot[0][0].rows[0].cells[1].text='9.99';
 await writeFile(receiptPath,JSON.stringify(receipt));
 await assert.rejects(cold.readCell(link.id,pdfCell(1,2)),{code:'WEB_PDF_RECORD_CHANGED'});
 assert.deepEqual(await cold.readPage(link.id,1),page);
 receipt.tableSnapshot[0][0].headers[1]='2026 (USD)';
 receipt.tableSnapshotSha256=tableHash();
 await writeFile(receiptPath,JSON.stringify(receipt));
 await assert.rejects(cold.readTables(link.id,1),{code:'WEB_PDF_RECORD_CHANGED'});
 assert.deepEqual(await cold.readPage(link.id,1),page);
 receipt.tableSnapshot=null;
 receipt.tableSnapshotSha256=tableHash();
 await writeFile(receiptPath,JSON.stringify(receipt));
 assert.equal((await cold.readCell(link.id,pdfCell())).code,'WEB_PDF_TABLE_EVIDENCE_LIMIT');
 assert.deepEqual(await cold.readPage(link.id,1),page);
 assert.equal(f.responses(),1);
});
test('no-table and legacy receipts are distinguishable, never upgraded by another fetch',async()=>{
 const fixtureV1=await fixture({pdfBytes:pdf(rows)});
 const first=await fixtureV1.open().acquire(link.id);
 const now=fixtureV1.open(tableOptions);
 assert.equal((await now.readTables(link.id,1)).code,'WEB_PDF_TABLES_NOT_RETAINED');
 assert.deepEqual(await now.acquire(link.id),first);
 assert.equal(fixtureV1.responses(),1);
 const incompleteRows=rows.map((r,i)=>i===3?r.slice(0,-1):r);
 const noTable=await fixture({pdfBytes:pdf(incompleteRows)});
 const modern=noTable.open(tableOptions);
 assert.equal((await modern.acquire(link.id)).status,'saved');
 assert.equal((await modern.readCell(link.id,pdfCell())).code,'WEB_PDF_NO_STRUCTURED_TABLE');
 assert.match((await modern.readPage(link.id,1)).text,/Benchmark/);
 assert.equal(noTable.responses(),1);
});
test('table access uses the same run, link and page authority plus bounded cell indices',async()=>{
 const f=await fixture({pdfBytes:pdf(rows)});
 const o=f.open(tableOptions);
 await o.acquire(link.id);
 await assert.rejects(o.readTables(link.id,2),{code:'WEB_PDF_PAGE_INVALID'});
 await assert.rejects(o.readCell(link.id,pdfCell(1,9)),{code:'WEB_PDF_CELL_INVALID'});
 await assert.rejects(o.readCell(link.id,null),{code:'WEB_PDF_CELL_INVALID'});
 await assert.rejects(o.readCell(link.id,{...pdfCell(),url:link.url}),{code:'WEB_PDF_CELL_INVALID'});
 assert.equal((await o.readCell(link.id,pdfCell(1,3))).code,'WEB_PDF_CELL_UNAVAILABLE');
 await assert.rejects(f.open({...tableOptions,authority:{...authority,runId:'unrelated-run'}})
  .readCell(link.id,pdfCell()),{code:'WEB_PDF_LINK_UNKNOWN'});
 await assert.rejects(o.readCell('https://issuer.example/reports/holdings.pdf',pdfCell()),{code:'WEB_PDF_LINK_UNKNOWN'});
 assert.throws(()=>f.open({tableRevision:'arbitrary-override'}),{code:'WEB_PDF_SCOPE_DENIED'});
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


test('larger parse and transport limits stay confined to approved linked originals',async t=>{
 const robot='https://issuer.example/robots.txt';
 const oversized=multiPagePdf(Array.from({length:65},()=>[]));
 const large=multiPagePdf(Array.from({length:20},()=>[]),{padding:1050000});
 const long=multiPagePdf(Array.from({length:20},()=>[]));
 await assert.rejects(parsePdfBytes(large),{code:'PDF_LIMIT_BYTES'});
 await assert.rejects(parsePdfBytes(long),{code:'PDF_LIMIT_PAGES'});
 const f=await fixture({pdfBytes:oversized});
 assert.equal((await f.open().acquire(link.id)).code,'PDF_LIMIT_PAGES');
 const html='https://issuer.example/oversized';
 let tooLarge=false;
 mockWebNetwork(t,{routes:{[robot]:{body:'User-agent: *\nAllow: /'},
  [html]:{body:'x'.repeat(262145),headers:{'content-type':'text/html'}},
  [link.url]:()=>({body:large,headers:{'content-type':'application/pdf',...(tooLarge?{'content-length':String(LINKED_PDF_LIMITS.bytes+1)}:{})}}),
 }});
 await assert.rejects(acquireWebPage({url:html,allowedUrls:[html]}),{code:'WEB_BODY_LIMIT'});
 const picked=await fixture();
 const owner=picked.open({fetchPdf:acquireApprovedWebPdf});
 assert.equal((await owner.acquire(link.id)).pages,20);
 tooLarge=true;
 const next=await fixture();
 assert.equal((await next.open({fetchPdf:acquireApprovedWebPdf}).acquire(link.id)).code,'WEB_BODY_LIMIT');
});
