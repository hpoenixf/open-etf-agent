import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {sha256,normalizeDocumentCatalog,documentCatalogBinding,readCatalogPage,validateSource} from '../src/source.mjs';
import {normalizeWebProvenance,webDocumentIdentity,webOriginalArtifactId,webOriginalBytes,webProvenanceSha256} from '../src/web-source.mjs';
import {createResultStore} from '../src/results.mjs';
import {createToolHost} from '../src/tools.mjs';
import {openArtifactStore} from '../src/artifacts.mjs';
import {startReader} from '../src/reader.mjs';
import {run} from '../src/runtime.mjs';

const raw=Buffer.from('<!doctype html><html><body><p>Original synthetic selected fact.</p><script>throw Error("must never execute")</script></body></html>');
const text='Original synthetic selected fact.';
function document(patch={}){
 const web=normalizeWebProvenance({schemaVersion:'web-source@1',acquisitionId:'synthetic-acquisition',projectId:'synthetic-project',baseManifestSha256:null,admissionSha256:'1'.repeat(64),transportSha256:'2'.repeat(64),requestedUrl:'https://example.org/selected',finalUrl:'https://example.org/selected',retrievedAt:'2026-11-08T09:00:00.000Z',originalSha256:sha256(raw),originalBytes:raw.length,originalMediaType:'text/html',extraction:{profile:'static-html-parse5@8.1.0',coverage:'static-text-only',visualInspection:'not-performed'},pageMap:[{page:1,sha256:sha256(text),bytes:Buffer.byteLength(text)}],...patch});
 return {...webDocumentIdentity(web),name:'Synthetic selected public-page observation',pages:[text],web,originalBase64:raw.toString('base64')};
}
const catalog=(d=document())=>({schemaVersion:'document-catalog@2',id:'selected-web',documents:[d]});
async function owned(t){await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/web-consumers-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
const call=(host,id,name,args)=>host.execute({id,name,arguments:args});

test('Web provenance binds occurrence, exact base and original bytes, not just selected text',()=>{
 const d=document(),p=readCatalogPage(catalog(d),{documentId:d.id,page:1});
 assert.equal(p.web.projectId,'synthetic-project');assert.equal(p.originalBase64,undefined);assert.equal(p.web.baseManifestSha256,null);
 assert.deepEqual(webOriginalBytes(d.web,d.originalBase64),raw);
 for(const patch of [{acquisitionId:'another-observation'},{requestedUrl:'https://example.org/other'},{retrievedAt:'2026-11-08T09:00:01.000Z'},{baseManifestSha256:'3'.repeat(64)},{admissionSha256:'4'.repeat(64)},{transportSha256:'5'.repeat(64)}])assert.notEqual(document(patch).id,d.id);
 const omitted=structuredClone(d.web);delete omitted.baseManifestSha256;assert.throws(()=>normalizeWebProvenance(omitted),/INVALID_WEB_SOURCE/);
 assert.throws(()=>webOriginalBytes(d.web,Buffer.from('replacement').toString('base64')),/INVALID_WEB_SOURCE/);
});
test('Web catalog validates page extraction and rejects forged provenance before consumption',()=>{
 const d=document();for(const mutate of [d=>d.pages[0]+='forged',d=>d.web.finalUrl='https://example.org/other',d=>d.originalBase64=Buffer.from('x').toString('base64'),d=>d.web.extraction.visualInspection='performed',d=>d.web.originalMediaType='application/xhtml+xml']){const bad=structuredClone(d);mutate(bad);assert.throws(()=>normalizeDocumentCatalog(catalog(bad)));}
 const source=readCatalogPage(catalog(d),{documentId:d.id,page:1});assert.throws(()=>validateSource({...source,pdf:{}}));assert.throws(()=>validateSource({...source,web:{...source.web,transportSha256:'6'.repeat(64)}}));
});
test('Legacy catalog bytes and hashes remain unchanged, including a legitimate colliding v1 identifier',()=>{
 const d=document();const plain={id:d.id,name:d.name,version:d.version,pages:[text]};const legacy={schemaVersion:'document-catalog@1',id:'legacy-web-looking-id',documents:[plain]};
 assert.equal(JSON.stringify(normalizeDocumentCatalog(legacy)),JSON.stringify(legacy));assert.equal(documentCatalogBinding(legacy).sha256,sha256(JSON.stringify(legacy)));
 const mixed={...catalog(d),documents:[d,{id:'ordinary',name:'local',version:'v1',pages:['Local text.']}]};assert.equal(normalizeDocumentCatalog(mixed).documents.length,2);
 assert.throws(()=>normalizeDocumentCatalog({...catalog(d),schemaVersion:'document-catalog@1'}));
});
test('Result identity separates Web provenance from an identical legacy seven-field payload',async t=>{
 const d=document(),source=readCatalogPage(catalog(d),{documentId:d.id,page:1}),{web,...legacy}=source;
 const a=await owned(t),b=await owned(t),left=await createResultStore({directory:a}),right=await createResultStore({directory:b});
 const webRef=await left.add(source),legacyRef=await right.add(legacy);assert.notEqual(webRef.resultRef,legacyRef.resultRef);assert.equal(webRef.webSha256,webProvenanceSha256(web));assert.equal(legacyRef.webSha256,undefined);const c=await owned(t),forgedStore=await createResultStore({directory:c});const forgedRef=await forgedStore.add({...legacy,webSha256:webRef.webSha256});assert.equal(forgedRef.resultRef,legacyRef.resultRef);assert.notEqual(forgedRef.resultRef,webRef.resultRef);
 await assert.rejects(left.add(legacy),/Source identity rebind conflict/);await assert.rejects(right.add(source),/Source identity rebind conflict/);
 const recordPath=join(a,webRef.recordPath),record=JSON.parse(await readFile(recordPath));delete record.value.web;await writeFile(recordPath,JSON.stringify(record)+'\n');await assert.rejects(left.read(webRef.resultRef),/Corrupt record snapshot hash/);
});
test('Real Host, Result, Report and Artifact retain Web identity and attach inert original bytes',async t=>{
 const directory=await owned(t),d=document(),c=catalog(d);const host=await createToolHost({directory,documentCatalog:c,allowedDocuments:[d.id],allowedTools:['read_page','read_result','save_report']});
 const got=await call(host,'read','read_page',{documentId:d.id,page:1});assert.equal(got.status,'succeeded',got.error);assert.deepEqual(got.value.web,d.web);
 const reread=await call(host,'reread','read_result',{resultRef:got.value.resultRef});assert.equal(reread.status,'succeeded',reread.error);assert.deepEqual(reread.value.web,d.web);
 const saved=await call(host,'report','save_report',{text:'# Synthetic observation [1]',sourceIds:[got.value.sourceId]});assert.equal(saved.status,'succeeded',saved.error);assert.deepEqual(saved.value.attachmentIds,[webOriginalArtifactId(d.web)]);
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json')));assert.equal(manifest.synthetic,false);assert.deepEqual(manifest.sources[0].web,d.web);assert.match(await readFile(join(directory,'report.md'),'utf8'),/Web acquisition synthetic-acquisition/);
 const store=await openArtifactStore({directory,readOnly:true});assert.deepEqual((await store.readRevision(saved.value.revisionId)).sources[0].web,d.web);assert.deepEqual((await store.read(saved.value.attachmentIds[0])).bytes,raw);
 const cold=await createToolHost({directory,documentCatalog:c,allowedDocuments:[d.id],allowedTools:['read_page','read_result','save_report'],readOnly:true,restore:host.snapshot()});await cold.verifyResult({id:'read',name:'read_page',arguments:{documentId:d.id,page:1}},got);
 const forged=structuredClone(got);delete forged.value.web;await assert.rejects(cold.verifyResult({id:'read',name:'read_page',arguments:{documentId:d.id,page:1}},forged),/Web source provenance mismatch/);
});
test('Artifact revision refuses missing original Web attachment and altered original bytes',async t=>{
 const directory=await owned(t),store=await openArtifactStore({directory}),d=document(),source=readCatalogPage(catalog(d),{documentId:d.id,page:1});
 const report=await store.put({format:'markdown',content:'Synthetic report'});await store.put({format:'web-original',content:raw});await assert.rejects(store.revise({reportId:report.artifactId,sources:[source]}),/Web original attachment mismatch/);
 const original=await store.read(webOriginalArtifactId(d.web));await writeFile(join(directory,original.contentPath),Buffer.from('tampered'));await assert.rejects(store.revise({reportId:report.artifactId,attachmentIds:[original.artifactId],sources:[source]}),/Artifact identity or bytes mismatch/);
});
test('Ordinary Runtime report and cold HTTP Reader return original bytes without acquisition callbacks',async t=>{
 const directory=await owned(t),d=document();let n=0;
 const result=await run({question:'Read the selected static observation and save its provenance.',documentCatalog:catalog(d),allowedDocuments:[d.id],allowedTools:['read_page','save_report'],outputRoot:join(directory,'runs'),gateway:{mode:'fixture',async next({messages}){n++;if(n===1)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:d.id,page:1}}]};if(n===2)return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'# Selected fact [1]',sourceIds:[messages.at(-1).result.value.sourceId]}}]};return{kind:'final',text:'Saved.'};}}});
 assert.equal(result.status,'completed',result.code);assert.equal(n,3);const reader=await startReader({directory:result.directory});t.after(()=>reader.close());
 const response=await fetch(reader.origin+'/artifacts/'+webOriginalArtifactId(d.web));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.match(response.headers.get('content-disposition'),/^attachment;/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.deepEqual(Buffer.from(await response.arrayBuffer()),raw);
 const revision=await(await fetch(reader.origin+'/revisions/'+result.receipt.revisionId)).json();assert.deepEqual(revision.sources[0].web,d.web);const page=await fetch(reader.origin+'/sources/'+result.receipt.revisionId+'/0');assert.equal(await page.text(),text);assert.equal(n,3);
});
