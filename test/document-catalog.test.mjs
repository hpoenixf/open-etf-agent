import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {normalizeDocumentCatalog,documentCatalogBinding} from '../src/source.mjs';
import {createToolHost} from '../src/tools.mjs';
import {openSession} from '../src/session.mjs';
import {submitRun} from '../src/runtime.mjs';
import {workRun} from '../src/worker.mjs';
const catalog=()=>({schemaVersion:'document-catalog@1',id:'custom-research',documents:[{id:'synthetic-fund-x',name:'Synthetic fund X',version:'2026-11',pages:['Synthetic research data.','Second page.','Third page outside the old demo maximum.']}]});
async function owned(fn){await mkdir('test-output',{recursive:true});const dir=await mkdtemp(resolve('test-output/catalog-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
const call=(host,id,name,args)=>host.execute({id,name,arguments:args});
test('custom catalog is immutable and bounded, not an implicit source grant',async()=>{
 const c=catalog(),normalized=normalizeDocumentCatalog(c),binding=documentCatalogBinding(c);c.documents[0].pages[0]='changed';assert.notEqual(documentCatalogBinding(c).sha256,binding.sha256);assert.equal(normalized.documents[0].pages[0],'Synthetic research data.');
 assert.throws(()=>normalizeDocumentCatalog({...catalog(),url:'https://example.test'}),/INVALID_DOCUMENT_CATALOG/);
 assert.throws(()=>normalizeDocumentCatalog({...catalog(),documents:[...catalog().documents,...catalog().documents]}),/INVALID_DOCUMENT_CATALOG/);
 await owned(async directory=>{const host=await createToolHost({directory,documentCatalog:catalog(),allowedDocuments:['synthetic-fund-x'],allowedTools:['read_page','read_result','save_report']});
 const denied=await call(host,'denied','read_page',{documentId:'atlas-a',page:1});assert.equal(denied.dispatched,false);
 const read=await call(host,'read','read_page',{documentId:'synthetic-fund-x',page:3});assert.equal(read.status,'succeeded');assert.match(read.value.text,/Third/);
 const saved=await call(host,'save','save_report',{text:'# Synthetic catalog report',sourceIds:[read.value.sourceId]});assert.equal(saved.status,'succeeded');assert.match(await readFile(join(directory,'report.md'),'utf8'),/synthetic-fund-x/);
 });
});
test('custom catalog binds original Worker Run and rejects changed content before model dispatch',async()=>owned(async directory=>{
 const store=await openSession({directory,leaseMs:5000});let calls=0;
 const bindings={gateway:{mode:'fixture',provider:'synthetic',protocol:'fixture@1',model:'catalog-test',version:'1'},plugins:[],adapters:[{id:'publication',version:'publication@1'}]};
 const options={question:'Synthetic catalog question',documentCatalog:catalog(),allowedDocuments:['synthetic-fund-x'],publication:true,outputRoot:join(directory,'runs'),gateway:{mode:'fixture',async next(){calls++;return {kind:'final',text:'Synthetic fixture final.',usage:null};}},durable:{store,runId:'catalog-run',grantId:'catalog-grant',bindings}};
 try{const before=await submitRun(options);assert.equal(calls,0);assert.deepEqual(before.definition.config.documentCatalog,documentCatalogBinding(catalog()));
 const changed=catalog();changed.documents[0].pages[0]='replacement bytes';await assert.rejects(workRun({...options,documentCatalog:changed}),/RUN_BINDINGS_MISMATCH/);assert.equal(calls,0);
 const result=await workRun(options);assert.equal(result.run.status,'completed');assert.equal(calls,1);const repeated=await workRun(options);assert.equal(repeated.run.runId,result.run.runId);assert.equal(calls,1);
 }finally{store.close();}
}));
