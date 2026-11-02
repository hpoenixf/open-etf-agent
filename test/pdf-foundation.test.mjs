import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { run } from '../src/runtime.mjs';
async function directory() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/pdf-foundation-')); }

test('PDF input does not bypass the selected context reread consumer admission', async () => {
 const outputRoot=await directory();let calls=0;const allowedTools=['read_pdf_page'];
 await assert.rejects(run({question:'Read only the explicitly selected physical page.',pdfInput:{},contextBytes:4000,allowedTools,outputRoot,gateway:{mode:'fixture',async next(){calls++;return{kind:'final',text:'Must not execute.'};}}}),error=>error.code==='WORKING_INPUT_TOOL_UNAVAILABLE');
 assert.equal(calls,0);assert.deepEqual(allowedTools,['read_pdf_page']);assert.deepEqual(await readdir(outputRoot),[]);
});

test('original active PDF recovery refusal still precedes working-input admission without creating a Run', async () => {
 const outputRoot=await directory();let calls=0,creates=0;
 await assert.rejects(run({question:'No active PDF recovery is implemented.',pdfInput:{},contextBytes:4000,allowedTools:['read_pdf_page'],outputRoot,gateway:{mode:'fixture',async next(){calls++;}},durable:{store:{create(){creates++;}},grantId:'synthetic',bindings:{gateway:{mode:'fixture'},plugins:[],adapters:[]}}}),error=>error.code==='PDF_ACTIVE_RECOVERY_UNSUPPORTED');
 assert.equal(calls,0);assert.equal(creates,0);assert.deepEqual(await readdir(outputRoot),[]);
});
