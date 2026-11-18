import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {safeDirectory,publishImmutable} from '../src/storage-files.mjs';
import {importProjectSources,loadProjectSources} from '../src/project-sources.mjs';
import {sha256} from '../src/source.mjs';
// Execute the unchanged production function body with controlled native I/O
// dependencies. No test hooks or alternate implementation are shipped in src.
const source=await fs.readFile(new URL('../src/research-materials.mjs',import.meta.url),'utf8');
function instrument(overrides){const deps={open:fs.open,constants,mkdir:fs.mkdir,lstat:fs.lstat,readdir:fs.readdir,unlink:fs.unlink,join,resolve,dirname,basename,safeDirectory,publishImmutable,importProjectSources,loadProjectSources,sha256,...overrides};const body=source.replace(/^import .*;\n/gm,'').replace('export async function','async function');return new Function(...Object.keys(deps),body+';return openResearchMaterials;')(...Object.values(deps));}
async function fixture(fn){await fs.mkdir('test-output',{recursive:true});const root=await fs.mkdtemp(resolve('test-output/material-seams-'));try{await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}}

test('abort at native seal publication boundary does not commit a new version',()=>fixture(async root=>{
 let hook;const openStore=instrument({publishImmutable:async(dir,name,bytes,signal)=>{await hook?.(dir,name,signal);return publishImmutable(dir,name,bytes,signal);}});
 const store=await openStore({projectDir:root,projectId:'synthetic',create:true}),file=join(root,'selected.txt');await fs.writeFile(file,'old');await store.import({id:'m',file});await fs.writeFile(file,'new');const c=new AbortController();
 hook=async(dir,name)=>{if(dir.endsWith('.materials-registration')&&name==='00000003.json')c.abort();};
 await assert.rejects(store.import({id:'m',file,expectedRevision:1,signal:c.signal}),{name:'AbortError'});assert.equal((await store.read('m')).revision,1);
}));

test('reader interleaved with a legitimate committed writer reports conflict, not corruption',()=>fixture(async root=>{
 let hook;const openStore=instrument({readdir:async(path,options)=>{if(hook&&path===join(root,'materials')&&options?.withFileTypes){const run=hook;hook=null;await run();}return fs.readdir(path,options);}});
 const store=await openStore({projectDir:root,projectId:'synthetic',create:true}),file=join(root,'selected.txt');await fs.writeFile(file,'old');await store.import({id:'m',file});await fs.writeFile(file,'new');hook=()=>store.import({id:'m',file,expectedRevision:1});
 await assert.rejects(store.list(),{code:'MATERIAL_CONFLICT'});assert.equal((await store.read('m')).revision,2);
}));

test('owned publication temporary hardlink requires explicit recovery; arbitrary link is never accepted',()=>fixture(async root=>{
 const openStore=instrument({}),store=await openStore({projectDir:root,projectId:'synthetic',create:true}),file=join(root,'selected.txt');await fs.writeFile(file,'old');await store.import({id:'m',file});
 const reg=join(root,'.materials-registration'),seal=join(reg,'00000002.json'),temp=join(reg,'.00000002.json-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');await fs.link(seal,temp);
 await assert.rejects(store.list(),{code:'MATERIAL_RECOVERY_NEEDED'});const recovered=await openStore({projectDir:root,projectId:'synthetic',recover:true});assert.equal((await recovered.read('m')).revision,1);assert.equal((await fs.lstat(seal)).nlink,1);await assert.rejects(fs.lstat(temp),{code:'ENOENT'});
 const foreign=join(root,'foreign-hardlink');await fs.link(seal,foreign);await assert.rejects(openStore({projectDir:root,projectId:'synthetic',recover:true}),{code:'MATERIAL_UNSAFE_FILE'});assert.equal((await fs.lstat(foreign)).nlink,2);
}));

test('actual process SIGKILL after native seal link recovers the committed version without reimport',()=>fixture(async root=>{
 const {spawnSync}=await import('node:child_process');const openStore=instrument({}),store=await openStore({projectDir:root,projectId:'synthetic',create:true}),file=join(root,'selected.txt');await fs.writeFile(file,'old');await store.import({id:'m',file});await fs.writeFile(file,'new committed bytes');
 const storageSource=await fs.readFile(new URL('../src/storage-files.mjs',import.meta.url),'utf8');const storageBody=storageSource.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');const materialBody=source.replace(/^import .*;\n/gm,'').replace('export async function','async function');
 const target=join(root,'.materials-registration','00000003.json');
 const script=`import * as fs from 'node:fs/promises';import {constants} from 'node:fs';import * as path from 'node:path';import {randomUUID} from 'node:crypto';import {sha256} from ${JSON.stringify(new URL('../src/source.mjs',import.meta.url).href)};import {importProjectSources,loadProjectSources} from ${JSON.stringify(new URL('../src/project-sources.mjs',import.meta.url).href)};
 const deps={lstat:fs.lstat,realpath:fs.realpath,open:fs.open,link:async(a,b)=>{await fs.link(a,b);if(b===${JSON.stringify(target)})process.kill(process.pid,'SIGKILL');},unlink:fs.unlink,mkdir:fs.mkdir,resolve:path.resolve,join:path.join,dirname:path.dirname,randomUUID};
 const storage=new Function(...Object.keys(deps),${JSON.stringify(storageBody+';return {safeDirectory,publishImmutable};')})(...Object.values(deps));
 const materialDeps={open:fs.open,constants,mkdir:fs.mkdir,lstat:fs.lstat,readdir:fs.readdir,unlink:fs.unlink,join:path.join,resolve:path.resolve,dirname:path.dirname,basename:path.basename,...storage,importProjectSources,loadProjectSources,sha256};
 const openStore=new Function(...Object.keys(materialDeps),${JSON.stringify(materialBody+';return openResearchMaterials;')})(...Object.values(materialDeps));const store=await openStore(${JSON.stringify({projectDir:root,projectId:'synthetic'})});await store.import(${JSON.stringify({id:'m',file,expectedRevision:1})});`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:10000});assert.equal(child.signal,'SIGKILL',child.stderr);assert.equal((await fs.lstat(target)).nlink,2);await assert.rejects(store.read('m'),{code:'MATERIAL_RECOVERY_NEEDED'});
 await fs.unlink(file);const recovered=await openStore({projectDir:root,projectId:'synthetic',recover:true});assert.equal((await recovered.read('m')).revision,2);assert.equal((await fs.lstat(target)).nlink,1);const selected=await recovered.select({id:'m',version:2});assert.equal((await loadProjectSources({projectDir:root,manifestSha256:selected.manifestSha256})).catalog.documents[0].pages[0],'new committed bytes');
}));

test('cancellation during the final directory check is observed before native link dispatch',()=>fixture(async root=>{
 const {randomUUID}=await import('node:crypto');const storageSource=await fs.readFile(new URL('../src/storage-files.mjs',import.meta.url),'utf8');const storageBody=storageSource.replace(/^import .*;\n/gm,'').replace(/^export /gm,'');let checks=0,links=0;const c=new AbortController();
 const deps={lstat:fs.lstat,realpath:async path=>{const result=await fs.realpath(path);if(++checks===2)c.abort();return result;},open:fs.open,link:async(...args)=>{links++;return fs.link(...args);},unlink:fs.unlink,mkdir:fs.mkdir,resolve,join,dirname,randomUUID};
 const publish=new Function(...Object.keys(deps),storageBody+';return publishImmutable;')(...Object.values(deps));
 await assert.rejects(publish(root,'synthetic-seal.json',Buffer.from('{}'),c.signal),{name:'AbortError'});assert.equal(links,0);await assert.rejects(fs.lstat(join(root,'synthetic-seal.json')),{code:'ENOENT'});
}));

test('explicit recovery also resolves owned prepared and visible snapshot link remnants',()=>fixture(async root=>{
 const openStore=instrument({}),store=await openStore({projectDir:root,projectId:'synthetic',create:true}),file=join(root,'selected.txt');await fs.writeFile(file,'original');await store.import({id:'m',file});const reg=join(root,'.materials-registration'),seal=JSON.parse(await fs.readFile(join(reg,'00000002.json'),'utf8'));
 for(const target of [join(reg,'.prepared-'+seal.stateSha256+'.json'),join(root,'materials','00000002.json')]){const temp=join(dirname(target),'.'+basename(target)+'-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');await fs.link(target,temp);const recovered=await openStore({projectDir:root,projectId:'synthetic',recover:true});assert.equal((await recovered.read('m')).revision,1);assert.equal((await fs.lstat(target)).nlink,1);await assert.rejects(fs.lstat(temp),{code:'ENOENT'});}
}));
