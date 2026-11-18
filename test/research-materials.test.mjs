import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,rm,readFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {openResearchMaterials} from '../src/research-materials.mjs';
import {loadProjectSources} from '../src/project-sources.mjs';
async function setup(fn){await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/materials-'));try{await fn({root,file:join(root,'input.txt'),open:()=>openResearchMaterials({projectDir:root,projectId:'synthetic',create:true})});}finally{await rm(root,{recursive:true,force:true});}}
const code=c=>e=>e.code===c;
test('logical identity is durable; same bytes idempotent; old manifest survives replacement',()=>setup(async({root,file,open})=>{
 await writeFile(file,'old original');const store=await open();const first=await store.import({id:'source',file});assert.equal(first.revision,1);
 assert.deepEqual(await store.import({id:'source',file}),first);
 await writeFile(file,'new original');const next=await store.import({id:'source',file,expectedRevision:1});assert.equal(next.revision,2);
 assert.equal((await (await open()).read('source')).versions.length,2);
 assert.equal((await loadProjectSources({projectDir:root,manifestSha256:first.versions[0].manifestSha256})).catalog.documents[0].pages[0],'old original');
 assert.ok(!JSON.stringify(await store.list()).includes(root));
}));
test('failed/cancelled replacement preserves active revision and conflicts are explicit',()=>setup(async({file,open})=>{
 await writeFile(file,'valid');const store=await open(),first=await store.import({id:'source',file});await writeFile(file,'');
 await assert.rejects(store.import({id:'source',file,expectedRevision:1}));assert.deepEqual(await store.read('source'),first);
 await writeFile(file,'next');const controller=new AbortController();controller.abort();await assert.rejects(store.import({id:'source',file,expectedRevision:1,signal:controller.signal}));assert.deepEqual(await store.read('source'),first);
 await store.import({id:'source',file,expectedRevision:1});await assert.rejects(store.remove({id:'source',expectedRevision:1}),code('MATERIAL_CONFLICT'));
}));
test('concurrent replacements admit one generation; removal blocks new selections, retains history',()=>setup(async({root,file,open})=>{
 await writeFile(file,'one');const store=await open();await store.import({id:'source',file});const other=join(root,'other.txt');await writeFile(file,'two');await writeFile(other,'three');
 const results=await Promise.allSettled([store.import({id:'source',file,expectedRevision:1}),store.import({id:'source',file:other,expectedRevision:1})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'MATERIAL_CONFLICT');
 const current=await store.read('source');assert.equal(current.revision,2);assert.equal((await store.select({id:'source',version:1})).version,1);
 await store.remove({id:'source',expectedRevision:2});assert.equal((await store.list()).length,0);assert.equal((await store.read('source')).versions.length,2);
 await assert.rejects(store.select({id:'source',version:1}),code('MATERIAL_REMOVED'));
}));
test('missing snapshot is not silently recreated; explicit recovery uses sealed prepared bytes',()=>setup(async({root,file,open})=>{
 await writeFile(file,'one');const store=await open();await store.import({id:'source',file});
 const snapshot=join(root,'materials','00000002.json');await unlink(snapshot);
 await assert.rejects(store.list(),code('MATERIAL_RECOVERY_NEEDED'));
 const recovered=await openResearchMaterials({projectDir:root,projectId:'synthetic',recover:true});assert.equal((await recovered.read('source')).revision,1);
 await writeFile(snapshot,'{}');await assert.rejects(recovered.list(),code('MATERIAL_CORRUPT'));
}));

test('identical bytes under a different name reuse interpretation identity; past-content rollback is explicit',()=>setup(async({root,file,open})=>{
 const store=await open();await writeFile(file,'same');const first=await store.import({id:'s',file});const alias=join(root,'alias.md');await writeFile(alias,'same');assert.deepEqual(await store.import({id:'s',file:alias,expectedRevision:1}),first);
 await writeFile(file,'changed');await store.import({id:'s',file,expectedRevision:1});await assert.rejects(store.import({id:'s',file:alias,expectedRevision:2}),code('MATERIAL_HISTORICAL_CONTENT'));
}));

test('selected old manifest is frozen by original task owner after replacement/removal and registry loss',()=>setup(async({root,file})=>{
 const {createResearchProject,submitResearchTask,inspectResearchTask,workResearchTask,readResearchReport}=await import('../src/research-project.mjs');
 const p=await createResearchProject({directory:root,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'fixture'},capabilities:['report']}});
 const store=await openResearchMaterials({projectDir:root,projectId:p.projectId,create:true});await writeFile(file,'historical');await store.import({id:'source',file});const selected=await store.select({id:'source',version:1});
 await writeFile(file,'current');await store.import({id:'source',file,expectedRevision:1});
 await submitResearchTask({projectDir:root,runId:'frozen',question:'Synthetic question',sourceManifestSha256:selected.manifestSha256});await store.remove({id:'source',expectedRevision:2});await rm(join(root,'materials'),{recursive:true});
 assert.equal((await inspectResearchTask({projectDir:root,runId:'frozen'})).definition.sourceManifestSha256,selected.manifestSha256);
 assert.equal((await loadProjectSources({projectDir:root,manifestSha256:selected.manifestSha256})).catalog.documents[0].pages[0],'historical');
 const doc=(await loadProjectSources({projectDir:root,manifestSha256:selected.manifestSha256})).catalog.documents[0];
 const gateway={mode:'fixture',async next({messages}){const results=messages.filter(m=>m.role==='tool').map(m=>m.result);if(!results.length)return{kind:'calls',calls:[{id:'read',name:'read_page',arguments:{documentId:doc.id,page:1}}],usage:null};const source=results.find(r=>r.value?.sourceId);if(!results.some(r=>r.value?.path==='report.md'))return{kind:'calls',calls:[{id:'save',name:'save_report',arguments:{text:'# Synthetic historical evidence',sourceIds:[source.value.sourceId]}}],usage:null};return{kind:'final',text:'Saved.',usage:null};}};
 assert.equal((await workResearchTask({projectDir:root,runId:'frozen',gateway})).run.status,'completed');assert.equal((await readResearchReport({projectDir:root,runId:'frozen'})).revision.sources[0].documentId,doc.id);

}));

test('two independent processes race the same expected revision: exactly one commit',()=>setup(async({root,file,open})=>{
 const {spawn}=await import('node:child_process');await writeFile(file,'base');const store=await open();await store.import({id:'s',file});
 const a=join(root,'a.txt'),b=join(root,'b.txt');await writeFile(a,'first');await writeFile(b,'second');
 const run=path=>new Promise(resolve=>{const script=`import {openResearchMaterials} from ${JSON.stringify(new URL('../src/research-materials.mjs',import.meta.url).href)};try{const s=await openResearchMaterials(${JSON.stringify({projectDir:root,projectId:'synthetic'})});await s.import(${JSON.stringify({id:'s',file:path,expectedRevision:1})});console.log('ok');}catch(e){console.log(e.code);}`;const child=spawn(process.execPath,['--input-type=module','-e',script]);let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('close',code=>resolve({code,out:out.trim(),err}));});
 const results=await Promise.all([run(a),run(b)]);assert.ok(results.every(r=>r.code===0),JSON.stringify(results));assert.deepEqual(results.map(r=>r.out).sort(),['MATERIAL_CONFLICT','ok']);assert.equal((await store.read('s')).revision,2);
}));

test('scope mismatch, symlinks and corrupt seals fail closed without blank reinitialization',()=>setup(async({root,file,open})=>{
 const {symlink}=await import('node:fs/promises');await writeFile(file,'base');const store=await open();await store.import({id:'s',file});
 await assert.rejects(openResearchMaterials({projectDir:root,projectId:'another',create:true}),code('MATERIAL_SCOPE'));
 const seal=join(root,'.materials-registration','00000002.json'),bytes=await readFile(seal);await writeFile(seal,'{}');await assert.rejects(open(),code('MATERIAL_CORRUPT'));await writeFile(seal,bytes);
 const record=join(root,'materials','00000002.json');await unlink(record);await symlink(file,record);await assert.rejects(store.list());
}));

test('lost CLI response can replay the same completed replacement/removal without another revision',()=>setup(async({file,open})=>{
 await writeFile(file,'first');const s=await open();await s.import({id:'s',file});await writeFile(file,'second');const second=await s.import({id:'s',file,expectedRevision:1});assert.deepEqual(await s.import({id:'s',file,expectedRevision:1}),second);
 const removed=await s.remove({id:'s',expectedRevision:2});assert.deepEqual(await s.remove({id:'s',expectedRevision:2}),removed);assert.equal(removed.revision,3);
}));

test('new material version cannot reuse old dynamic-knowledge source binding or change config implicitly',()=>setup(async({root,file})=>{
 const {createResearchProject,updateResearchProject,submitResearchTask,inspectResearchProject}=await import('../src/research-project.mjs');
 const {acquireKnowledgeVectors}=await import('../src/knowledge-acquisition.mjs');const {pageVectorIdentity}=await import('../src/knowledge-query-tool.mjs');
 const config={schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'fixture'},capabilities:['report','knowledge'],knowledge:{algorithm:'hybrid'}};
 const project=await createResearchProject({directory:root,config}),store=await openResearchMaterials({projectDir:root,projectId:project.projectId,create:true});await writeFile(file,'Synthetic old liquidity evidence.');await store.import({id:'s',file});const first=await store.select({id:'s',version:1});
 const identity={model:'synthetic-local',manifestSha256:'a'.repeat(64)},backend={identity,maxTokens:8,tokenize:async()=>({tokenIds:[1],truncated:false}),encodeDocument:async r=>({vector:[1,0],truncated:false,tokenIdsSha256:r.tokenIdsSha256}),encodeQuery:async r=>({vector:[1,0],truncated:false,tokenIdsSha256:r.tokenIdsSha256})};
 const prepared=await acquireKnowledgeVectors({projectDir:root,manifestSha256:first.manifestSha256,acquisitionId:'synthetic-pages',provider:{id:'local-sentence-transformers',model:identity.model,revision:identity.manifestSha256},dimensions:2,queries:['seed'],backend,approveSelectedText:true});
 const frozen=await updateResearchProject({projectDir:root,expectedConfigSha256:project.configSha256,config:{...config,knowledgeQuery:{schemaVersion:'local-knowledge-query@1',sourceManifestSha256:first.manifestSha256,modelManifestSha256:identity.manifestSha256,pageEvidenceSha256:pageVectorIdentity(prepared.vectorEvidence),maxTokens:8,maxQueries:2}}});
 await writeFile(file,'Different synthetic new evidence.');await store.import({id:'s',file,expectedRevision:1});const next=await store.select({id:'s',version:2});
 await assert.rejects(submitResearchTask({projectDir:root,runId:'stale-vectors',question:'Synthetic query',sourceManifestSha256:next.manifestSha256,knowledgeVectorEvidence:prepared.vectorEvidence}),code('PROJECT_KNOWLEDGE_QUERY_BINDING'));assert.equal((await inspectResearchProject({projectDir:root})).configSha256,frozen.configSha256);
}));

test('PDF equivalence includes extraction snapshot and keeps original provenance',()=>setup(async({root,open})=>{
 const bytes=Buffer.from(JSON.parse(await readFile(new URL('../fixtures/local-pdf.json',import.meta.url),'utf8')).documents.text.base64,'base64');const a=join(root,'a.pdf'),b=join(root,'b.pdf');await writeFile(a,bytes);await writeFile(b,bytes);const s=await open(),first=await s.import({id:'pdf',file:a});assert.deepEqual(await s.import({id:'pdf',file:b}),first);
 const selected=await s.select({id:'pdf',version:1}),bundle=await loadProjectSources({projectDir:root,manifestSha256:selected.manifestSha256});assert.equal(bundle.pdfSnapshot.synthetic,false);assert.equal(bundle.pdfSnapshot.pages.length,3);assert.ok(bundle.manifest.files[0].snapshotSha256);
}));

test('version limit retains last valid selection without deleting older snapshots',()=>setup(async({root,file,open})=>{
 const s=await open();for(let i=1;i<=32;i++){await writeFile(file,'synthetic revision '+i);await s.import({id:'bounded',file,...(i>1?{expectedRevision:i-1}:{})});}
 const before=await s.read('bounded');await writeFile(file,'over limit');await assert.rejects(s.import({id:'bounded',file,expectedRevision:32}),code('MATERIAL_LIMIT'));assert.deepEqual(await s.read('bounded'),before);assert.equal((await s.select({id:'bounded',version:1})).version,1);
}));
