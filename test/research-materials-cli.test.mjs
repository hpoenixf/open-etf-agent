import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {runResearchCli} from '../src/research-cli.mjs';
const cli=async args=>{let out='',err='';const code=await runResearchCli(args,{stdout:{write:s=>out+=s},stderr:{write:s=>err+=s}});return{code,out,err,json:out?JSON.parse(out):null};};
test('CLI register/list/read/select/replace/remove produces bounded metadata and original submit accepts selection',async()=>{
 await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/material-cli-'));try{
 const project=join(root,'project'),config=join(root,'config.json'),file=join(root,'source.txt'),question=join(root,'question.txt');await writeFile(config,JSON.stringify({schemaVersion:'research-project@1',gateway:{mode:'fixture',provider:'test',protocol:'fixture@1',model:'fixture'},capabilities:['report']}));await writeFile(file,'synthetic original text');await writeFile(question,'Read this synthetic source.');
 assert.equal((await cli(['project','init','--project',project,'--config',config])).code,0);
 const run=(verb,args=[])=>cli(['material',verb,'--project',project,...args]);
 const first=await run('register',['--id','m','--file',file]);assert.equal(first.code,0,first.err);assert.equal(first.json.revision,1);assert.ok(!first.out.includes(root));assert.ok(!first.out.includes('synthetic original text'));
 assert.equal((await run('list')).json.materials.length,1);assert.equal((await run('read',['--id','m'])).json.revision,1);
 const selected=await run('select',['--id','m','--version','1']);assert.equal(selected.code,0,selected.err);
 assert.equal((await cli(['run','submit','--project',project,'--run','frozen','--question',question,'--manifest',selected.json.manifestSha256])).code,0);
 await writeFile(file,'replacement');assert.equal((await run('replace',['--id','m','--file',file,'--revision','1'])).json.revision,2);
 assert.equal((await run('remove',['--id','m','--revision','2'])).json.removed,true);assert.equal((await run('list')).json.materials.length,0);
 assert.match((await run('select',['--id','m','--version','1'])).err,/MATERIAL_REMOVED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
