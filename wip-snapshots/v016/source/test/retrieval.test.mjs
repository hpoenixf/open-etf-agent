import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { searchPages } from '../src/retrieval.mjs';
const documents = JSON.parse(await readFile(new URL('../fixtures/documents.json', import.meta.url),'utf8')).documents;
test('4.3 query changes real lexical candidates and stable page locators', () => {
  const formats = searchPages({ query: 'Markdown', documents, allowedDocuments: ['atlas-a','atlas-b'] });
  const edits = searchPages({ query: 'offline editing', documents, allowedDocuments: ['atlas-a','atlas-b'] });
  assert.equal(formats[0]?.documentId,'atlas-b'); assert.equal(formats[0]?.page,1); assert.equal(edits[0]?.page,2); assert.equal(edits[0]?.text,undefined);
  assert.deepEqual(searchPages({ query: 'offline editing', documents, allowedDocuments: ['atlas-a','atlas-b'] }),edits);
});
test('4.3 granted subset and empty query hits never authorize hidden materials', () => {
  const scoped = searchPages({ query: 'CSV', documents, allowedDocuments: ['atlas-a'] }); assert.equal(scoped.length,1); assert.ok(scoped.every(x=>x.documentId==='atlas-a'));
  assert.deepEqual(searchPages({ query: 'unmatched-candidate', documents, allowedDocuments:['atlas-a'] }),[]);
  assert.deepEqual(searchPages({ query:'hidden', documents:[...documents,{id:'private-doc',pages:['hidden']}],allowedDocuments:['atlas-a']}),[]);
});
