import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile,readFile,cp,symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {acquireProjectWebSources} from '../src/web-acquisition.mjs';
import {createResearchProject,submitResearchTask,workResearchTask,readResearchOutput} from '../src/research-project.mjs';
import {importProjectSources} from '../src/project-sources.mjs';
import {mockWebNetwork} from './fixtures/web-network.mjs';
const url='https://example.com/selected';
const query='https://example.com/account?key=secret-fixture-token';
const body='# Synthetic report\n\nPublic observation [1]. Local observation [2]. Restricted link [3].\n\n## Acquired sources\n\nThis heading belongs to the report body.\n';
const call=(id,name,args)=>({kind:'calls',calls:[{id,name,arguments:args}]});
const cli=(...args)=>{
  const offline=args[0]==='verify'?['--permission','--allow-fs-read=*']:[];
  return spawnSync(process.execPath,[...offline,'src/report-bundle-cli.mjs',...args],{encoding:'utf8',timeout:20000});
};

async function fixture(t){
  await mkdir('test-output',{recursive:true});
  const root=await mkdtemp(resolve('test-output/bundle-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const projectDir=join(root,'project');
  await createResearchProject({directory:projectDir,config:{schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'bundle'},capabilities:['report']}});
  const privateFile=join(root,'private-do-not-copy.md');
  await writeFile(privateFile,'private-source-excerpt');
  const imported=await importProjectSources({projectDir,files:[privateFile]});
  const page={status:200,headers:{'content-type':'text/html; charset=utf-8'},body:'<h1>Selected source</h1><p>Synthetic public fact.</p>'};
  mockWebNetwork(t,{routes:{'https://example.com/robots.txt':{body:'User-agent: *\nAllow: /\n'},[url]:page,[query]:page}});
  const acquired=await acquireProjectWebSources({projectDir,acquisitionId:'internal-acquisition-id',urls:[url,query],baseManifestSha256:imported.manifestSha256,approvePublicFetch:true});
  const documents=[acquired.catalog.documents.find(d=>d.web?.finalUrl===url),acquired.catalog.documents.find(d=>!d.web),acquired.catalog.documents.find(d=>d.web?.finalUrl===query)];
  return {root,projectDir,documents,manifestSha256:acquired.manifestSha256};
}

test('published report exports complete body and only public citations; copy verifies without project',async t=>{
  const f=await fixture(t);
  const request={projectDir:f.projectDir,runId:'bundle-report',question:'Save synthetic research.',sourceManifestSha256:f.manifestSha256};
  await submitResearchTask(request);
  const missing=join(f.root,'unpublished');
  assert.equal(cli('export','--project',f.projectDir,'--run',request.runId,'--out',missing).status,1);
  const done=await workResearchTask({...request,gateway:{mode:'fixture',next({messages}){
    const sources=messages.filter(m=>m.role==='tool').map(m=>m.result.value);
    if(sources.length<3)return call('read-'+sources.length,'read_page',{documentId:f.documents[sources.length].id,page:1});
    if(sources.length===3)return call('save','save_report',{text:body,sourceIds:sources.map(v=>v.sourceId)});
    return {kind:'final',text:'The final chat response is not the report body.'};
  }}});
  assert.equal(done.run.status,'completed',done.run.snapshot.code);
  const view=await readResearchOutput(request);
  assert.equal(view.publicationStatus,'published');
  assert.equal(view.revision.sources.length,3);
  const bundle=join(f.root,'bundle'),copied=join(f.root,'transferred');
  const exported=cli('export','--project',f.projectDir,'--run',request.runId,'--out',bundle);
  assert.equal(exported.status,0,exported.stderr);
  assert.equal(await readFile(join(bundle,'report.md'),'utf8'),body);
  const citations=JSON.parse(await readFile(join(bundle,'citations.json'),'utf8'));
  assert.deepEqual(citations.publicCitations.map(({number,url,location})=>({number,url,location})),[{number:1,url,location:{page:null,section:null,extractionChunk:1}}]);
  assert.equal(citations.omittedCitations,2);
  for(const name of ['report.md','manifest.json','citations.json']){
    assert.doesNotMatch(await readFile(join(bundle,name),'utf8'),/private-do-not-copy|private-source-excerpt|secret-fixture-token|internal-acquisition-id|artifact:sha256:|ResultRef|bundle-report/);
  }
  assert.equal(cli('export','--project',f.projectDir,'--run',request.runId,'--out',bundle).status,1);
  await cp(bundle,copied,{recursive:true});
  await rm(f.projectDir,{recursive:true});
  const manifest=JSON.parse(exported.stdout).manifestSha256;
  assert.equal(cli('verify','--bundle',copied,'--expect-manifest',manifest).status,0);
  for(const name of ['report.md','citations.json','manifest.json']){
    const path=join(copied,name),original=await readFile(path);
    await writeFile(path,Buffer.concat([original,Buffer.from(' ')]));
    assert.equal(cli('verify','--bundle',copied,'--expect-manifest',manifest).status,1,name);
    await writeFile(path,original);
  }
  await rm(join(copied,'report.md'));
  await symlink(join(bundle,'report.md'),join(copied,'report.md'));
  assert.equal(cli('verify','--bundle',copied).status,1);
});
