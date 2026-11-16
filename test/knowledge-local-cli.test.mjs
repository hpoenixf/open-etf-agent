import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256} from '../src/source.mjs';
const cli=(args)=>{const p=spawnSync(process.execPath,['src/research-cli.mjs',...args],{encoding:'utf8',timeout:15000});return {...p,json:p.status===0?JSON.parse(p.stdout):null};};
async function setup(t){
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/local-knowledge-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const project=join(root,'project'),files=join(root,'files.json'),query=join(root,'query.txt');
 const originals=[['terms.md','Annual fee is 12 units. Cancellation needs 30 days notice.'],['notes.md','产品支持 CSV 导出，不支持离线编辑。']];
 for(const [name,text]of originals)await writeFile(join(root,name),text);
 await writeFile(files,JSON.stringify(originals.map(([name])=>join(root,name))));
 const p=cli(['knowledge','import','--project',project,'--files',files]);assert.equal(p.status,0,p.stderr);
 const manifest=p.json.manifestSha256;
 const search=()=>cli(['knowledge','query','--project',project,'--manifest',manifest,'--query',query]);
 return {root,project,query,manifest,originals,search};
}
test('reader imports actual files and freely queries original sources without key or model',async t=>{
 const f=await setup(t);await writeFile(f.query,'cancellation');const first=f.search();assert.equal(first.status,0,first.stderr);
 assert.equal(first.json.algorithm,'bm25');assert.equal(first.json.status,'complete');assert.equal(first.json.sources.length,1);
 const source=first.json.sources[0];assert.equal(source.text,f.originals[0][1]);assert.equal(source.name,'terms.md');assert.equal(source.sha256,sha256(source.text));assert.ok(source.sourceId);assert.equal(source.resultRef,undefined);assert.equal(first.json.retrieval,undefined);
 await writeFile(f.query,'导出');const chinese=f.search();assert.equal(chinese.status,0,chinese.stderr);assert.equal(chinese.json.sources[0].text,f.originals[1][1]);
 await writeFile(f.query,'zxqvnonexistent921');const none=f.search();assert.equal(none.status,0,none.stderr);assert.equal(none.json.status,'no-evidence');assert.deepEqual(none.json.sources,[]);
 assert.deepEqual(await readdir(f.project),['sources'],'local query must not create a project config, Agent task or report');
});
test('fresh CLI process uses imported snapshot after original changes, without changing project files',async t=>{
 const f=await setup(t);await writeFile(f.query,'cancellation');const first=f.search();assert.equal(first.status,0,first.stderr);
 const snapshot=async()=>{const rows=[];async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else rows.push([path,sha256(await readFile(path))]);}}await walk(f.project);return rows.sort();};
 const before=await snapshot();await writeFile(join(f.root,'terms.md'),'Changed outside the imported snapshot.');await rm(join(f.root,'notes.md'));
 const again=f.search();assert.equal(again.status,0,again.stderr);assert.deepEqual(again.json,first.json);assert.deepEqual(await snapshot(),before);
});
test('corrupt stored bytes are errors, never successful no-evidence',async t=>{
 const f=await setup(t);await writeFile(f.query,'cancellation');const original=f.originals[0][1];await writeFile(join(f.project,'sources','objects',sha256(original)+'.bin'),'corrupt');const p=f.search();assert.equal(p.status,1);assert.equal(p.stdout,'');assert.match(p.stderr,/PROJECT_SOURCE_HASH_MISMATCH/);
});
test('local query rejects empty, oversized, unknown and repeated arguments',async t=>{
 const f=await setup(t);for(const q of ['', 'x'.repeat(513)]){await writeFile(f.query,q);assert.equal(f.search().status,1);}
 await writeFile(f.query,'fee');const base=['knowledge','query','--project',f.project,'--manifest',f.manifest,'--query',f.query];
 for(const extra of [['--api-key','unused'],['--query',f.query],['--document-mode','prefer']])assert.equal(cli([...base,...extra]).status,1);
});
test('local selected text is returned byte-exact even when it resembles a credential example',async t=>{
 const f=await setup(t),file=join(f.root,'credential-example.md'),files=join(f.root,'example-files.json');
 const original='Documentation example only: Bearer exampletoken. Password: placeholder. Never a real credential.';
 await writeFile(file,original);await writeFile(files,JSON.stringify([file]));const imported=cli(['knowledge','import','--project',f.project,'--files',files]);assert.equal(imported.status,0,imported.stderr);await writeFile(f.query,'Documentation');
 const p=cli(['knowledge','query','--project',f.project,'--manifest',imported.json.manifestSha256,'--query',f.query]);assert.equal(p.status,0,p.stderr);assert.equal(p.json.sources[0].text,original);assert.equal(sha256(p.json.sources[0].text),p.json.sources[0].sha256);
});
test('more than four matching pages explicitly remains partial rather than complete',async t=>{
 const f=await setup(t),paths=[];for(let i=0;i<5;i++){const file=join(f.root,`match-${i}.md`);await writeFile(file,`Unique ${i}: all documents contain liquidity.`);paths.push(file);}
 const files=join(f.root,'many-files.json');await writeFile(files,JSON.stringify(paths));const imported=cli(['knowledge','import','--project',f.project,'--files',files]);assert.equal(imported.status,0,imported.stderr);await writeFile(f.query,'liquidity');
 const p=cli(['knowledge','query','--project',f.project,'--manifest',imported.json.manifestSha256,'--query',f.query]);assert.equal(p.status,0,p.stderr);assert.equal(p.json.status,'partial');assert.equal(p.json.sources.length,4);assert.equal(p.json.coverage.matched,5);assert.equal(p.json.coverage.limit,4);
});
test('local import retains literal selected filename and manifest digest',async t=>{
 const f=await setup(t),name='sk-examplekey01.md',file=join(f.root,name),files=join(f.root,'literal-files.json');await writeFile(file,'Example filename, not a credential.');await writeFile(files,JSON.stringify([file]));
 const p=cli(['knowledge','import','--project',f.project,'--files',files]);assert.equal(p.status,0,p.stderr);assert.equal(p.json.manifest.files[0].name,name);assert.equal(sha256(JSON.stringify(p.json.manifest)),p.json.manifestSha256);
});
