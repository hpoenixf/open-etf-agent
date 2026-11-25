import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir,mkdtemp,rm,writeFile,symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const cliPath=resolve('src/deploy-doctor-cli.mjs');
const execute=promisify(execFile);
const cli=async (...args)=>{
  try{const {stdout,stderr}=await execute(process.execPath,[cliPath,...args],{encoding:'utf8',timeout:10000,env:{...process.env,ETF_GUI_PROVIDER_KEY:''}});return {code:0,stdout,stderr};}
  catch(e){return {code:e.code,stdout:e.stdout,stderr:e.stderr};}
};
async function fixture(t){
  await mkdir('test-output',{recursive:true});
  const root=await mkdtemp(resolve('test-output/doctor-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  return root;
}
test('first-start and optional services are distinct from missing required config',async t=>{
  const directory=await fixture(t);
  const result=await cli('--json','--project',directory);
  assert.equal(result.code,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.schemaVersion,'deploy-doctor@1');
  assert.equal(report.checks.installation.code,'READY');
  assert.equal(report.checks.runtime.code,'SUPPORTED');
  assert.equal(report.checks.configuration.code,'PROJECT_NOT_INITIALIZED');
  assert.equal(report.checks.permissions.code,'ACCESSIBLE');
  assert.equal(report.checks.health.status,'skipped');
  const live=await cli('--json','--mode','live','--project',directory);
  assert.equal(live.code,1,live.stderr);
  assert.equal(JSON.parse(live.stdout).checks.configuration.code,'LIVE_CONFIG_REQUIRED');
});
test('version mismatch and inaccessible path are separate, with no path or config content in the report',async t=>{
  const directory=await fixture(t);
  const path=join(directory,'private-configuration-name');
  await writeFile(path,'sensitive-private-contents');
  const linked=join(directory,'untrusted-project');
  await symlink(directory,linked);
  const result=await cli('--json','--project',linked,'--expect-version','0.0.0','--expect-node','1.2.3','--mode','live','--live-config',path);
  assert.equal(result.code,1,result.stderr);
  assert.doesNotMatch(result.stdout+result.stderr,/private-configuration-name|sensitive-private-contents|untrusted-project/);
  const report=JSON.parse(result.stdout);
  assert.equal(report.checks.runtime.code,'VERSION_MISMATCH');
  assert.equal(report.checks.permissions.code,'DIRECTORY_UNSAFE');
  assert.equal(report.checks.configuration.code,'LIVE_CONFIG_INVALID');
});
test('actual loopback HEAD only and service down have separate outcomes',async t=>{
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push([req.method,req.url]);
    res.writeHead(200,{'content-type':'text/html','referrer-policy':'no-referrer','cross-origin-resource-policy':'same-origin'});
    res.end(req.method==='HEAD'?undefined:'private business body');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>server.close());
  const port=String(server.address().port);
  let result=await cli('--json','--port',port);
  assert.equal(result.code,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).checks.health.code,'HTTP_RESPONDING');
  assert.deepEqual(requests,[['HEAD','/']]);
  assert.doesNotMatch(result.stdout,/private business body/);
  await new Promise(resolve=>server.close(resolve));
  result=await cli('--json','--port',port);
  assert.equal(result.code,1);
  assert.equal(JSON.parse(result.stdout).checks.health.code,'SERVICE_UNREACHABLE');
});
test('uninstalled dependencies are reported independently, and unsafe options are refused',async t=>{
  const directory=await fixture(t);
  await mkdir(join(directory,'src'));
  await writeFile(join(directory,'src','gui-cli.mjs'),'');
  await writeFile(join(directory,'package.json'),JSON.stringify({name:'open-etf-agent',version:'0.51.0',engines:{node:'>=26.8.1 <27'},dependencies:{zod:'4.6.7'}}));
  await writeFile(join(directory,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages:{'':{name:'open-etf-agent',version:'0.51.0'},'node_modules/zod':{version:'4.6.7'}}}));
  const result=await cli('--json','--root',directory);
  assert.equal(result.code,1);
  assert.equal(JSON.parse(result.stdout).checks.installation.code,'DEPENDENCIES_INCOMPLETE');
  assert.equal((await cli('--port','https://example.com')).code,2);
  assert.match((await cli()).stdout,/Installation/);
});

test('real offline GUI answers the check without reading its workspace or starting work',async t=>{
  const directory=join(await fixture(t),'project');
  const {startLocalGui}=await import('../src/gui-server.mjs');
  const gui=await startLocalGui({projectDir:directory});
  t.after(()=>gui.close());
  const result=await cli('--json','--project',directory,'--port',new URL(gui.origin).port);
  assert.equal(result.code,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.checks.health.code,'HTTP_RESPONDING');
  assert.equal(report.checks.health.serviceVersion,null);
  assert.equal(report.checks.configuration.code,'CONFIG_PRESENT');
});

test('missing launch environment and redirects are reported without disclosing values',async t=>{
  const config=join(await fixture(t),'local-live.json');
  await writeFile(config,JSON.stringify({gateway:{provider:'synthetic',endpoint:'https://example.com/v1/chat/completions',model:'synthetic-model',
    apiKeyEnv:'ETF_GUI_PROVIDER_KEY',stream:false},limits:{model:2}}));
  const live=await cli('--json','--mode','live','--live-config',config);
  assert.equal(JSON.parse(live.stdout).checks.configuration.code,'LIVE_ENV_REQUIRED');
  assert.doesNotMatch(live.stdout,/example\.com|synthetic-model/);
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push(req.url);
    res.writeHead(302,{location:'https://example.com/secret'});
    res.end();
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>server.close());
  const result=await cli('--json','--port',String(server.address().port));
  assert.equal(JSON.parse(result.stdout).checks.health.code,'UNEXPECTED_HTTP_RESPONSE');
  assert.deepEqual(requests,['/']);
  assert.doesNotMatch(result.stdout,/example\.com|secret/);
});
