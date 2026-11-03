import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {watch} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {importProjectSources,loadProjectSources} from '../src/project-sources.mjs';
import {sha256,readCatalogPage} from '../src/source.mjs';
import {openPdfInput} from '../src/pdf-input.mjs';
const testRoot=fileURLToPath(new URL('../test-output/',import.meta.url));
async function setup(fn){await mkdir(testRoot,{recursive:true});const root=await mkdtemp(join(testRoot,'project-sources-'));try{await mkdir(join(root,'inputs'));return await fn({root,projectDir:join(root,'project'),input:join(root,'inputs')});}finally{await rm(root,{recursive:true,force:true});}}
const reason=code=>e=>e.code===code;
const selected=async(input,name,bytes)=>{const path=join(input,name);await writeFile(path,bytes);return path;};
const fixture=async()=>Buffer.from(JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8')).documents.text.base64,'base64');
test('project sources import multiple selected files, stable identity and original byte ranges',()=>setup(async({projectDir,input})=>{
  const bytes=Buffer.from('\ufeff'+ '中🙂'.repeat(10000)+'\nend');
  const a=await selected(input,'notes.md',bytes),b=await selected(input,'facts.txt','Fact: 42.');
  const result=await importProjectSources({projectDir,files:[a,b]});
  assert.equal(result.catalog.documents.length,2);assert.equal(result.pdfSnapshot,null);
  const file=result.manifest.files[0],doc=result.catalog.documents.find(d=>d.id===`text:${sha256(bytes)}`);
  assert.deepEqual(Buffer.from(doc.pages.join('')),bytes);assert.equal(doc.pages.length,2);
  for(const p of file.pageMap){assert.equal(sha256(bytes.subarray(p.startByte,p.endByte)),p.sha256);assert.equal(readCatalogPage(result.catalog,{documentId:doc.id,page:p.page}).sha256,p.sha256);}
  assert.equal(file.pageMap.at(-1).endByte,bytes.length);
  assert.equal((await importProjectSources({projectDir,files:[a,b]})).manifestSha256,result.manifestSha256);
  assert.ok(!JSON.stringify(result.manifest).includes(input));
}));
test('restore uses immutable owned bytes after source replacement or removal, old and new versions coexist',()=>setup(async({projectDir,input})=>{
  const path=await selected(input,'selected.txt','old text');const old=await importProjectSources({projectDir,files:[path]});
  await writeFile(path,'new text');const newer=await importProjectSources({projectDir,files:[path]});await rm(path);
  assert.notEqual(old.manifestSha256,newer.manifestSha256);
  assert.deepEqual(await loadProjectSources({projectDir,manifestSha256:old.manifestSha256}),old);
}));
test('PDF snapshot preserves physical blank pages and original binary with text in same selection',()=>setup(async({projectDir,input})=>{
  const original=await fixture(),pdf=await selected(input,'sample.pdf',original),text=await selected(input,'explanation.md','Supplement.');
  const first=await importProjectSources({projectDir,files:[text,pdf]});await rm(pdf);await rm(text);
  const restored=await loadProjectSources({projectDir,manifestSha256:first.manifestSha256});
  assert.deepEqual(restored,first);assert.equal(restored.pdfSnapshot.pages.length,3);assert.equal(restored.pdfSnapshot.pages[1],'');
  let stored;const owner=openPdfInput({input:{snapshot:restored.pdfSnapshot},store:{async put({content}){stored=content;return {artifactId:`artifact:sha256:${sha256(content)}`};}}});
  try{const page=await owner.readPage(3);assert.equal(page.page,3);assert.equal(page.pdf.originalSha256,sha256(original));assert.deepEqual(stored,original);}finally{await owner.close();}
}));
test('PDF-only bundle does not invent text catalog',()=>setup(async({projectDir,input})=>{
  const pdf=await selected(input,'sample.pdf',await fixture());assert.equal((await importProjectSources({projectDir,files:[pdf]})).catalog,null);
}));
test('invalid selection, empty, binary, malformed UTF8, duplicate, oversized and page overflow rejected',()=>setup(async({projectDir,input})=>{
  for(const [name,bytes,code] of [['bad.csv','abc','PROJECT_SOURCE_UNSUPPORTED_TYPE'],['empty.txt','','PROJECT_SOURCE_EMPTY_OR_BINARY'],['binary.txt',Buffer.from([0]),'PROJECT_SOURCE_EMPTY_OR_BINARY'],['utf8.txt',Buffer.from([0xff]),'PROJECT_SOURCE_INVALID_UTF8'],['large.txt',Buffer.alloc(1048577),'PROJECT_SOURCE_LIMIT_BYTES'],['pages.txt','a'.repeat(1024001),'PROJECT_SOURCE_LIMIT_PAGES']]){
    const path=await selected(input,name,bytes);await assert.rejects(importProjectSources({projectDir,files:[path]}),reason(code));
  }
  const path=await selected(input,'a.txt','same');await assert.rejects(importProjectSources({projectDir,files:[path,path]}),reason('PROJECT_SOURCE_DUPLICATE'));
  await assert.rejects(importProjectSources({projectDir,files:[]}),reason('PROJECT_SOURCE_INVALID_INPUT'));
  await assert.rejects(importProjectSources({projectDir,files:Array(65).fill(path)}),reason('PROJECT_SOURCE_INVALID_INPUT'));
  await assert.rejects(importProjectSources({projectDir,files:['https://example.test/a.txt']}),reason('PROJECT_SOURCE_INVALID_INPUT'));
  await assert.rejects(importProjectSources({projectDir,files:['a.pdf','b.pdf']}),reason('PROJECT_SOURCE_LIMIT_PDFS'));
}));
test('symlink files, directory traversal via symlink, nonfiles and owned-dir symlinks rejected',()=>setup(async({root,projectDir,input})=>{
  const path=await selected(input,'a.txt','text'),link=join(input,'link.txt');await symlink(path,link);
  await assert.rejects(importProjectSources({projectDir,files:[link]}),reason('PROJECT_SOURCE_UNSAFE_PATH'));
  const linked=join(root,'linked');await symlink(input,linked);
  await assert.rejects(importProjectSources({projectDir,files:[join(linked,'a.txt')]}),reason('PROJECT_SOURCE_UNSAFE_PATH'));
  const directory=join(input,'dir.txt');await mkdir(directory);await assert.rejects(importProjectSources({projectDir,files:[directory]}),reason('PROJECT_SOURCE_UNSAFE_PATH'));
  await rm(join(projectDir,'sources'),{recursive:true});await symlink(input,join(projectDir,'sources'));
  await assert.rejects(importProjectSources({projectDir,files:[path]}),reason('PROJECT_SOURCE_UNSAFE_PATH'));
}));
test('manifest and original object mutations reject; existing polluted CAS object never overwritten',()=>setup(async({projectDir,input})=>{
  const path=await selected(input,'a.txt','original'),first=await importProjectSources({projectDir,files:[path]});
  const object=join(projectDir,'sources','objects',`${sha256('original')}.bin`);await writeFile(object,'tampered');
  await assert.rejects(loadProjectSources({projectDir,manifestSha256:first.manifestSha256}),reason('PROJECT_SOURCE_HASH_MISMATCH'));
  await assert.rejects(importProjectSources({projectDir,files:[path]}),reason('PROJECT_SOURCE_HASH_MISMATCH'));assert.equal(await readFile(object,'utf8'),'tampered');
  const manifest=join(projectDir,'sources','manifests',`${first.manifestSha256}.json`);await writeFile(manifest,'{}');
  await assert.rejects(loadProjectSources({projectDir,manifestSha256:first.manifestSha256}),reason('PROJECT_SOURCE_HASH_MISMATCH'));
  await assert.rejects(loadProjectSources({projectDir,manifestSha256:'../escape'}),reason('PROJECT_SOURCE_INVALID_MANIFEST'));
}));
test('self-hashed forged manifest cannot alter ranges, bindings or introduce paths',()=>setup(async({projectDir,input})=>{
  const path=await selected(input,'a.txt','original'),first=await importProjectSources({projectDir,files:[path]});
  for(const mutate of [m=>{m.files[0].pageMap[0].startByte=1;},m=>{m.files[0].path='../a.txt';},m=>{m.catalogBinding.sha256='0'.repeat(64);}]){
    const m=structuredClone(first.manifest);mutate(m);const bytes=JSON.stringify(m),id=sha256(bytes);await writeFile(join(projectDir,'sources','manifests',`${id}.json`),bytes);
    await assert.rejects(loadProjectSources({projectDir,manifestSha256:id}),e=>['PROJECT_SOURCE_BINDING_MISMATCH','PROJECT_SOURCE_INVALID_MANIFEST'].includes(e.code));
  }
}));
test('catalog aggregate limit is enforced and pre-cancelled import refuses work',()=>setup(async({projectDir,input})=>{
  const a=await selected(input,'a.txt','a'.repeat(600000)),b=await selected(input,'b.txt','b'.repeat(600000));
  await assert.rejects(importProjectSources({projectDir,files:[a,b]}),reason('INVALID_DOCUMENT_CATALOG'));
  const controller=new AbortController();controller.abort();await assert.rejects(importProjectSources({projectDir,files:[a],signal:controller.signal}),reason('PROJECT_SOURCE_CANCELLED'));
}));

test('cold process restore consumes only selected snapshot identity',()=>setup(async({projectDir,input})=>{
  const path=await selected(input,'a.md','Persisted evidence.'),first=await importProjectSources({projectDir,files:[path]});await rm(input,{recursive:true});
  const moduleUrl=new URL('../src/project-sources.mjs',import.meta.url).href;
  const script=`import {loadProjectSources} from ${JSON.stringify(moduleUrl)};const result=await loadProjectSources(${JSON.stringify({projectDir,manifestSha256:first.manifestSha256})});process.stdout.write(JSON.stringify(result));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000});assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),first);
}));
test('PDF snapshot corruption and CAS symlinks are rejected on restoration',()=>setup(async({projectDir,input})=>{
  const path=await selected(input,'a.pdf',await fixture()),first=await importProjectSources({projectDir,files:[path]});
  const file=first.manifest.files[0],snapshot=join(projectDir,'sources','objects',`${file.snapshotSha256}.json`);
  const bytes=await readFile(snapshot);await writeFile(snapshot,'{}');await assert.rejects(loadProjectSources({projectDir,manifestSha256:first.manifestSha256}),reason('PROJECT_SOURCE_HASH_MISMATCH'));
  await rm(snapshot);const replacement=await selected(input,'replacement.json',bytes);await symlink(replacement,snapshot);await assert.rejects(loadProjectSources({projectDir,manifestSha256:first.manifestSha256}),reason('PROJECT_SOURCE_UNSAFE_PATH'));
}));

test('concurrent identical imports share only complete atomically published objects',()=>setup(async({projectDir,input})=>{
  const content='Evidence 中🙂.\n'.repeat(30000),path=await selected(input,'atomic.md',content);
  const objects=join(projectDir,'sources','objects');await mkdir(objects,{recursive:true});
  const expected=Buffer.from(content),filename=`${sha256(expected)}.bin`;
  let observedResolve,observedReject;const observed=new Promise((resolve,reject)=>{observedResolve=resolve;observedReject=reject;});
  const watcher=watch(objects,(event,name)=>{if(name!==filename)return;readFile(join(objects,filename)).then(bytes=>{try{assert.deepEqual(bytes,expected);observedResolve();}catch(e){observedReject(e);}},observedReject);});
  const timer=setTimeout(()=>observedReject(new Error('No final atomic publication observed')),5000);
  try{
    const results=await Promise.all(Array.from({length:4},()=>importProjectSources({projectDir,files:[path]})));
    await observed;assert.ok(results.every(r=>r.manifestSha256===results[0].manifestSha256));
    assert.deepEqual(await loadProjectSources({projectDir,manifestSha256:results[0].manifestSha256}),results[0]);
  }finally{clearTimeout(timer);watcher.close();}
}));
