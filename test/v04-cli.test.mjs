import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createResultStore} from '../src/results.mjs';
async function directory(){await mkdir('test-output',{recursive:true});return mkdtemp(resolve('test-output/v04-cli-'));}
const execute=args=>spawnSync(process.execPath,args,{encoding:'utf8',timeout:15000,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=256'}});
test('4.5 retrieval CLI queries drive different actual source pages and post-exit reread',async()=>{
  for(const query of ['Markdown','offline editing']){
    const child=execute(['src/cli.mjs','--case','retrieve-reread','--query',query,'--output',await directory()]);assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout);assert.equal(result.caseId,'retrieve-reread');assert.equal(result.status,'completed');
    const manifest=JSON.parse(await readFile(join(result.directory,'manifest.json'),'utf8'));assert.ok(manifest.sources.every(s=>s.page===(query==='Markdown'?1:2)));if(query==='Markdown')assert.equal(manifest.sources.length,1);
    const reopened=await createResultStore({directory:result.directory});for(let i=0;i<manifest.resultRefs.length;i++)assert.deepEqual(await reopened.read(manifest.resultRefs[i].resultRef),manifest.sources[i]);
  }
});
test('4.5 zero scoped candidates explicitly fail report requirement without reading or saving',async()=>{
  const child=execute(['src/cli.mjs','--case','retrieve-reread','--query','unmatchednothing','--output',await directory()]);assert.equal(child.status,1,child.stderr);const result=JSON.parse(child.stdout);assert.equal(result.code,'REPORT_REQUIRED');assert.equal(result.receipt,null);assert.match(result.answer,/No scoped lexical candidates/);
  const events=(await readFile(join(result.directory,'run.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(events.filter(e=>e.type==='tool_result').map(e=>e.name),['search_pages']);await assert.rejects(access(join(result.directory,'report.md')));
});
test('4.5 built retrieval copy includes exact-source storage and original fixtures',async()=>{
  const built=execute(['scripts/build.mjs']);assert.equal(built.status,0,built.stderr);const child=execute(['dist/src/cli.mjs','--case','retrieve-reread','--query','Markdown','--output',await directory()]);assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).status,'completed');
});
