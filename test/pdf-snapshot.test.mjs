import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {preparePdfSnapshot,normalizePdfSnapshot,pdfSnapshotBinding,openPdfInput} from '../src/pdf-input.mjs';
import {openArtifactStore} from '../src/artifacts.mjs';
const fixture=JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8')).documents.text;
test('prepared PDF restores original bytes and pages after selected input is unavailable',async()=>{
 await mkdir('test-output',{recursive:true});const directory=await mkdtemp(resolve('test-output/pdf-snapshot-'));let first,second;
 try{
  const path=join(directory,'selected.pdf');await writeFile(path,Buffer.from(fixture.base64,'base64'));
  const snapshot=await preparePdfSnapshot({input:{path}}),binding=pdfSnapshotBinding(snapshot);
  assert.equal(snapshot.pages.length,3);assert.equal(snapshot.pages[1],'');
  await rm(path); // This test-owned copy is no longer used by the prepared API.
  const store=await openArtifactStore({directory});first=openPdfInput({input:{snapshot},store});
  const page=await first.readPage(3);assert.match(page.text,/Physical page three/);await first.close();
  const restored=JSON.parse(JSON.stringify(snapshot));second=openPdfInput({input:{snapshot:restored},store});
  const again=await second.readPage(3);assert.deepEqual(again,page);assert.deepEqual(pdfSnapshotBinding(restored),binding);
  assert.deepEqual((await store.read(page.pdf.originalArtifactId)).bytes,Buffer.from(fixture.base64,'base64'));
  await assert.rejects(second.readPage(2),error=>error.code==='PDF_NO_TEXT');
 }finally{await first?.close();await second?.close();await rm(directory,{recursive:true,force:true});}
});
test('snapshot validation rejects altered originals, parser identity and oversized pages; extraction changes alter binding',async()=>{
 const snapshot=await preparePdfSnapshot();
 for(const edit of [s=>{s.originalSha256='0'.repeat(64);},s=>{s.originalBase64+='junk';},s=>{s.parser='other';},s=>{s.pages[0]='x'.repeat(64001);},s=>{s.extra=true;}]){
  const value=structuredClone(snapshot);edit(value);assert.throws(()=>normalizePdfSnapshot(value),/PDF_INVALID_SNAPSHOT/);
 }
 const changed=structuredClone(snapshot);changed.pages[0]='Host-supplied altered text';
 assert.notEqual(pdfSnapshotBinding(changed).snapshotSha256,pdfSnapshotBinding(snapshot).snapshotSha256);
 const value=structuredClone(snapshot);const normal=normalizePdfSnapshot(value);value.pages[0]='mutation';assert.notEqual(normal.pages[0],value.pages[0]);assert.ok(Object.isFrozen(normal.pages));
 assert.throws(()=>openPdfInput({input:{snapshot,path:'unused.pdf'},store:{put(){}}}),/PDF_INVALID_INPUT/);
});
