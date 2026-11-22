import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,mkdir,mkdtemp,readFile,readlink,rm,symlink,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {installAccountDeps} from '../scripts/install-account-deps.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const version='1.7.27', canonical='https://registry.npmjs.org/better-auth/-/better-auth-1.7.27.tgz';
const manifest={name:'synthetic-account-runtime',version:'1.0.0',dependencies:{'better-auth':version}};
const integrity='sha512-'+Buffer.alloc(64,10).toString('base64');
function fixtureLock(url=canonical) {
  return JSON.stringify({lockfileVersion:3,packages:{
    '':manifest,'node_modules/better-auth':{version,resolved:url,integrity},
  }});
}
async function setup(t,withFiles=true) {
  await mkdir('test-output',{recursive:true});
  const root=await mkdtemp(resolve('test-output/install-account-deps-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const sidecar=join(root,'tooling','account-auth-runtime');
  await mkdir(join(root,'node_modules'));
  let count=0, configDir;
  const run=async settings=>{
    count++;assert.equal(settings.sidecar,sidecar);
    configDir=settings.configDir;
    for (const name of ['user.npmrc','global.npmrc']) {
      const p=join(configDir,name);
      assert.equal(await readFile(p,'utf8'),'');
      assert.equal((await lstat(p)).mode&0o077,0);
    }
    const p=join(sidecar,'node_modules','better-auth');
    await mkdir(join(p,'dist'),{recursive:true});
    await writeFile(join(p,'package.json'),JSON.stringify({name:'better-auth',version,type:'module',main:'./dist/index.mjs'}));
    await writeFile(join(p,'dist','index.mjs'),'export const marker = 1;');
  };
  async function setLock(data) {
    await mkdir(sidecar,{recursive:true});
    await writeFile(join(sidecar,'package.json'),JSON.stringify(manifest));
    await writeFile(join(sidecar,'package-lock.json'),data);
    return {projectRoot:root,expectedManifestSha:hash(JSON.stringify(manifest)),expectedLockSha:hash(data),expectedPackages:1,run};
  }
  const options=withFiles?await setLock(fixtureLock()):{projectRoot:root,run};
  return {root,sidecar,options,run,setLock,count:()=>count,configDir:()=>configDir};
}
test('absent release inputs and changed SHA fail before npm or Project bind',async t=>{
  const missing=await setup(t,false);
  await assert.rejects(installAccountDeps(missing.options),{code:'ACCOUNT_INSTALL_INPUT_UNAVAILABLE'});
  assert.equal(missing.count(),0);
  const stale=await setup(t);
  await assert.rejects(installAccountDeps({...stale.options,expectedLockSha:'0'.repeat(64)}),{code:'ACCOUNT_INSTALL_LOCK_CHANGED'});
  assert.equal(stale.count(),0);
});
test('even a matching SHA cannot authorize mirrors, userinfo, query or non-HTTPS',async t=>{
  const f=await setup(t);
  for(const url of ['http://registry.npmjs.org/better-auth/-/better-auth-1.7.27.tgz',
    'https://token@registry.npmjs.org/better-auth/-/better-auth-1.7.27.tgz',
    'https://registry.npmjs.org/better-auth/-/better-auth-1.7.27.tgz?token=sample',
    'https://example.test/better-auth/-/better-auth-1.7.27.tgz']) {
    await assert.rejects(installAccountDeps(await f.setLock(fixtureLock(url))),{code:'ACCOUNT_INSTALL_LOCK_ORIGIN'});
  }
  assert.equal(f.count(),0);
});
test('foreign node_modules or account binding is not changed',async t=>{
  const f=await setup(t);
  const bind=join(f.root,'node_modules','better-auth');
  await symlink('../unrelated-deps',bind,'dir');
  await assert.rejects(installAccountDeps(f.options),{code:'ACCOUNT_INSTALL_FOREIGN_BINDING'});
  assert.equal(await readlink(bind),'../unrelated-deps');
  assert.equal(f.count(),0);
  const g=await setup(t);
  await rm(join(g.root,'node_modules'),{recursive:true});
  await symlink(join(f.root,'node_modules'),join(g.root,'node_modules'),'dir');
  await assert.rejects(installAccountDeps(g.options),{code:'ACCOUNT_INSTALL_DIRECTORY'});
  assert.equal(g.count(),0);
});
test('explicit fixture setup binds only own sidecar, supports rerun and removes transient config',async t=>{
  const f=await setup(t), bind=join(f.root,'node_modules','better-auth');
  assert.deepEqual(await installAccountDeps(f.options),{status:'installed',version,verifiedPackages:1});
  assert.equal(await readlink(bind),'../tooling/account-auth-runtime/node_modules/better-auth');
  const child=spawnSync(process.execPath,['--input-type=module','-e','console.log(import.meta.resolve("better-auth"));'],{cwd:f.root,encoding:'utf8',env:{}});
  assert.equal(child.status,0,child.stderr);
  assert.match(child.stdout,/tooling\/account-auth-runtime\/node_modules\/better-auth\/dist\/index[.]mjs/);
  await assert.rejects(lstat(f.configDir()),{code:'ENOENT'});
  await installAccountDeps(f.options);
  assert.equal(f.count(),2);
});
test('npm failure leaves no app binding',async t=>{
  const f=await setup(t);
  await assert.rejects(installAccountDeps({...f.options,run:async()=>{throw new Error('synthetic failure');}}));
  await assert.rejects(lstat(join(f.root,'node_modules','better-auth')),{code:'ENOENT'});
});
