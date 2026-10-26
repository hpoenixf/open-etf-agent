import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,access,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {openMemoryLibrary} from '../src/memory.mjs';
import {createResultStore} from '../src/results.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/v05-cli-'));}
const execute=args=>spawnSync(process.execPath,args,{encoding:'utf8',timeout:20000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=256'}});
test('5.5 Memory demo refuses a missing explicit library before output creation',async()=>{
  const output=join(await directory(),'not-created');const child=execute(['src/cli.mjs','--case','explicit-memory','--output',output]);assert.equal(child.status,2);assert.match(child.stderr,/explicit.*memory.*library|memory-library.*required/i);await assert.rejects(access(output));
});
test('5.5 explicit Memory demo returns real save/revise/forget receipts and retained old revisions',async()=>{
  const root=await directory();const libraryPath=join(root,'selected-library');const child=execute(['src/cli.mjs','--case','explicit-memory','--memory-library',libraryPath,'--output',join(root,'runs')]);assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);assert.equal(result.caseId,'explicit-memory');assert.deepEqual(result.memory.receipts.map(r=>r.operation),['saved','revised','forgotten']);assert.deepEqual(result.memory.receipts.map(r=>r.revision),[1,2,3]);assert.ok(result.runs.every(r=>r.status==='completed'));assert.equal(result.semanticStatus,'unreviewed');
  const library=await openMemoryLibrary({directory:libraryPath});try{assert.deepEqual(await library.list(),[]);await assert.rejects(library.read(result.memory.entryId),/forgotten|unavailable/i);}finally{await library.close();}assert.equal((await readdir(join(libraryPath,'entries',result.memory.entryId))).length,3);const last=result.runs.at(-1);const manifest=JSON.parse(await readFile(join(last.directory,'manifest.json'),'utf8'));assert.equal(manifest.sources.length,2);
});
test('5.5 compaction demo persists derived notes and independently rereads original report sources',async()=>{
  const child=execute(['src/cli.mjs','--case','compact-and-reread','--output',await directory()]);assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);assert.equal(result.status,'completed');assert.equal(result.caseId,'compact-and-reread');assert.equal(result.semanticStatus,'unreviewed');const events=(await readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);const notes=events.filter(e=>e.type==='working_note'&&e.status==='applied');assert.ok(notes.length>0);assert.ok(notes.every(e=>e.afterBytes<e.beforeBytes));const store=await createResultStore({directory:result.directory});for(const event of notes)assert.equal((await store.readNote(event.noteRef)).kind,'derived-working-note');const manifest=JSON.parse(await readFile(join(result.directory,'manifest.json'),'utf8'));for(let i=0;i<manifest.resultRefs.length;i++)assert.deepEqual(await store.read(manifest.resultRefs[i].resultRef),manifest.sources[i]);assert.equal(manifest.sources.length,2);assert.ok(events.some(e=>e.type==='tool_result'&&e.name==='read_note'&&e.status==='succeeded'));
});

test('5.5 observe accepts actual compaction events using typed metadata without note text',async()=>{
  const child=execute(['src/cli.mjs','--case','compact-and-reread','--output',await directory()]);assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);const observed=execute(['src/cli.mjs','--observe',result.directory]);assert.equal(observed.status,0,observed.stderr);const serialized=observed.stdout;assert.match(serialized,/working_note/);assert.doesNotMatch(serialized,/Derived synthetic working note/);
});
