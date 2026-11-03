import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {watch,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadProjectPlugins} from '../src/project-plugins.mjs';
import {inspectTrustedPlugins} from '../src/plugins.mjs';
import {sha256} from '../src/source.mjs';
const base=fileURLToPath(new URL('../test-output/',import.meta.url));
async function setup(fn){await mkdir(base,{recursive:true});const projectDir=await mkdtemp(join(base,'project-plugins-'));try{return await fn(projectDir);}finally{await rm(projectDir,{recursive:true,force:true});}}
const source=(extra='')=>`import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';${extra}\nexport default {id:'test-plugin',version:'1.0.0',schemaVersion:'trusted-plugin@1',sourceUrl:import.meta.url,contentSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),tools:[]};`;
async function selected(dir,code=source()){const path=join(dir,'selected.mjs');await writeFile(path,code);return {capabilities:['trusted-tools'],trustedPackages:[{modulePath:path,sha256:sha256(code),trustedCodeApproved:true}]};}
const changed=e=>e.code==='PROJECT_TRUSTED_PACKAGE_CHANGED';
test('trusted module uses exact snapshot URL and original inspector accepts entry hash',()=>setup(async dir=>{
 const config=await selected(dir),plugins=await loadProjectPlugins({projectDir:dir,config});
 assert.equal(plugins[0].sourceUrl,pathToFileURL(join(dir,'plugins',config.trustedPackages[0].sha256+'.mjs')).href);
 assert.equal((await inspectTrustedPlugins({plugins})).bindings[0].contentSha256,config.trustedPackages[0].sha256);
 assert.equal((await loadProjectPlugins({projectDir:dir,config}))[0],plugins[0]);
}));
test('modified original after snapshot publication is never imported',()=>setup(async dir=>{
 const config=await selected(dir),directory=join(dir,'plugins');await mkdir(directory);const filename=config.trustedPackages[0].sha256+'.mjs';
 let changedOriginal=false;const watcher=watch(directory,(event,name)=>{if(name===filename){writeFileSync(config.trustedPackages[0].modulePath,'throw new Error("MODIFIED ORIGINAL EXECUTED");');changedOriginal=true;}});
 try{const plugins=await loadProjectPlugins({projectDir:dir,config});assert.equal(plugins.length,1);assert.equal(changedOriginal,true);assert.equal(sha256(await readFile(join(directory,filename))),config.trustedPackages[0].sha256);}finally{watcher.close();}
}));
test('changed input, polluted existing snapshot and symlink input never execute',()=>setup(async dir=>{
 const config=await selected(dir);await writeFile(config.trustedPackages[0].modulePath,'throw Error("bad");');await assert.rejects(loadProjectPlugins({projectDir:dir,config}),changed);
 const fresh=await selected(dir);await mkdir(join(dir,'plugins'),{recursive:true});await writeFile(join(dir,'plugins',fresh.trustedPackages[0].sha256+'.mjs'),'bad');await assert.rejects(loadProjectPlugins({projectDir:dir,config:fresh}),changed);
 const link=join(dir,'link.mjs');await symlink(fresh.trustedPackages[0].modulePath,link);fresh.trustedPackages[0].modulePath=link;await assert.rejects(loadProjectPlugins({projectDir:dir,config:fresh}),changed);
}));
test('relative static and delayed dynamic dependencies explicitly reject',()=>setup(async dir=>{
 const first=await selected(dir,source("import './helper.mjs';"));await assert.rejects(loadProjectPlugins({projectDir:dir,config:first}),e=>e.code==='PROJECT_PLUGIN_DEPENDENCY_UNSUPPORTED');
 const second=await selected(dir,source("export const later=()=>import('./helper.mjs');"));const [plugin]=await loadProjectPlugins({projectDir:dir,config:second});const module=await import(plugin.sourceUrl);await assert.rejects(module.later(),e=>e.code==='PROJECT_PLUGIN_DEPENDENCY_UNSUPPORTED');
}));
test('FIFO selection is rejected without waiting for a writer',()=>setup(async dir=>{
 const path=join(dir,'pipe.mjs');const created=spawnSync('mkfifo',[path]);assert.equal(created.status,0);
 const config={capabilities:['trusted-tools'],trustedPackages:[{modulePath:path,sha256:'a'.repeat(64),trustedCodeApproved:true}]};
 const script=`import {loadProjectPlugins} from ${JSON.stringify(new URL('../src/project-plugins.mjs',import.meta.url).href)};try{await loadProjectPlugins(${JSON.stringify({projectDir:dir,config})});process.exit(2);}catch(e){if(e.code!=='PROJECT_TRUSTED_PACKAGE_CHANGED')process.exit(3);}`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{timeout:3000,encoding:'utf8'});assert.equal(child.status,0,child.stderr);
}));
test('same-content concurrent loaders atomically reuse snapshot',()=>setup(async dir=>{
 const config=await selected(dir);const results=await Promise.all(Array.from({length:4},()=>loadProjectPlugins({projectDir:dir,config})));assert.ok(results.every(r=>r[0]===results[0][0]));
}));

test('verified snapshot restores after original replacement and removal; corrupt CAS never rebuilds',()=>setup(async dir=>{
 const config=await selected(dir),[first]=await loadProjectPlugins({projectDir:dir,config}),original=config.trustedPackages[0].modulePath;
 await writeFile(original,'throw Error("replacement must not execute");');assert.equal((await loadProjectPlugins({projectDir:dir,config}))[0],first);
 await rm(original);assert.equal((await loadProjectPlugins({projectDir:dir,config}))[0],first);
 const snapshot=fileURLToPath(first.sourceUrl);await writeFile(snapshot,'corrupted snapshot');await writeFile(original,source());
 await assert.rejects(loadProjectPlugins({projectDir:dir,config}),changed);assert.equal(await readFile(snapshot,'utf8'),'corrupted snapshot');
}));
