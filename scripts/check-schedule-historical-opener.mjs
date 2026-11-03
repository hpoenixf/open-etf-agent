// Explicit historical compatibility check; never downloads or executes an unfixed source.
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [, ,flag,source,...extra]=process.argv;
assert.ok(flag==='--source-root' && source && extra.length===0,'Usage: node scripts/check-schedule-historical-opener.mjs --source-root PATH_TO_FIXED_V016_CHECKOUT');
const old=resolve(source),pin='35f244f2e06da447c110325d2ac5a5c39f36e842';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(join(old,'docs/verification/v016-revocable-rag.safe.json'));
const blob=createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
assert.equal(blob,'99b6dc614dc42528fd617b04029306dfdea430b6','Historical receipt differs from fixed public v0.16 source');
const files=JSON.parse(bytes).independent.inputFiles;
for(const f of files){assert.ok(/^(src\/|fixtures\/|package(?:-lock)?\.json$|scripts\/build\.mjs$)/.test(f.path) && !f.path.split('/').includes('..'));assert.ok((await lstat(join(old,f.path))).isFile());assert.equal(sha(await readFile(join(old,f.path))),f.sha256,`Historical execution input differs: ${f.path}`);}
const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',TZ:'UTC',NODE_OPTIONS:'--max-old-space-size=512',...(process.env.TMPDIR?{TMPDIR:process.env.TMPDIR}:{}),SCHEDULE_BASE_SESSION:pathToFileURL(join(old,'src/session.mjs')).href};
const run=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency=1','--test-name-pattern=18 schema5 opt-in','test/schedule.test.mjs'],{cwd:root,env,timeout:30000,maxBuffer:2**20,encoding:'utf8'});
const receipt={historicalSourceCommit:pin,historicalReceiptGitBlob:blob,historicalInputFiles:files.length,mode:'explicit historical opener, not current legacy-profile fallback',exitCode:run.status,stdoutSha256:sha(run.stdout??''),stderrSha256:sha(run.stderr??''),modelCalls:0,paidCalls:0};
console.log(JSON.stringify(receipt,null,2));assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);
assert.match(run.stdout,/# pass 1\b/);assert.match(run.stdout,/# fail 0\b/);
