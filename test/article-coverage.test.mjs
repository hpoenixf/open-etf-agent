import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { validateManifest, renderTable, commandFor, verifyTap, gitBlob, sourceIdentity, confirmCommit, validateReceipt, smokeEnvironment } from '../scripts/check-article-coverage.mjs';
const manifest = JSON.parse(await readFile(new URL('../docs/verification/article-coverage.json', import.meta.url)));
const change = f => { const copy = structuredClone(manifest); f(copy); return copy; };

test('coverage: full module list and only three statuses', () => {
  validateManifest(manifest); assert.equal(manifest.articles.length, 31);
  assert.throws(() => validateManifest(change(m => m.articles.pop())), /Catalog count/);
  for (const count of [0, 1.5, 257]) assert.throws(() => validateManifest(change(m => m.articleCatalog.count = count)), /Catalog count/);
  const future = change(m => { m.articles.push({...m.articles[0], slug: 'synthetic-future-module'}); m.articleCatalog.count = 32; });
  validateManifest(future);
  assert.throws(() => validateManifest(change(m => m.articles[0].status = 'passing')), /status/);
});
test('coverage: verified requires a genuine selected target', () => {
  assert.throws(() => validateManifest(change(m => m.articles[0].status = 'verified')), /target/);
  assert.throws(() => validateManifest(change(m => m.articles[4].target = 'invented')), /Unknown/);
});
test('coverage: no-public-match cannot borrow an adjacent mechanism', () => {
  assert.throws(() => validateManifest(change(m => m.articles[0].target = 'child')), /No-public-match/);
});
test('coverage: live, injected flags and shell paths are refused', () => {
  for (const value of ['model-child', '--live', 'fixture-child; echo unsafe']) assert.throws(() => validateManifest(change(m => m.targets.child.case = value)), /Unsupported/);
  assert.throws(() => validateManifest(change(m => m.targets.child.args = ['--live'])), /unsafe/);
  assert.throws(() => validateManifest(change(m => m.targets.provider.file = '../scripts/live-validate.mjs')), /Unsafe/);
});
test('coverage: commands invoke existing CLI or exact node:test without a shell', () => {
  const cli = commandFor(manifest.targets.child, 'synthetic-output'); assert.deepEqual(cli, ['src/cli.mjs','--case','fixture-child','--output','synthetic-output']);
  const args = commandFor({kind:'test',file:'test/example.test.mjs',name:'literal (a.b) [x]$'}, 'unused');
  assert.ok(args.includes('--test-name-pattern=^literal \\(a\\.b\\) \\[x\\]\\$$'));
});
test('coverage: renamed, absent and skipped cases cannot produce pass receipts', () => {
  const output = 'ok 1 - actual target\n# pass 1\n# fail 0\n# skipped 0\n';
  assert.equal(verifyTap(output, 'actual target').passed, 1);
  for (const invalid of [output.replace('actual target','other'), output.replace('actual target','actual target # SKIP'), output.replace('# pass 1','# pass 0'), output.replace('# skipped 0','# skipped 1')]) assert.throws(()=>verifyTap(invalid,'actual target'));
});
test('coverage: generated table is three-column and exact catalog titles survive', () => {
  const table=renderTable(manifest,'a'.repeat(40)); assert.match(table,/\| 文章 \| 对应 commit \+ case \| 状态 \|/);
  assert.equal(table.split('\n').filter(line=>line.startsWith('| [')).length,31);
  assert.match(table,/Memory：从保存、召回到安全遗忘/);
});
test('coverage: stale source and checker receipts never retain verified', () => {
  const receipt={schemaVersion:1,kind:'actual-provider-free-runtime-execution',modelCalls:0,semanticStatus:'unreviewed',sourceCommit:'a',inputSha256:'old',runnerSha256:'old',targetsSha256:'old'};
  assert.throws(()=>validateReceipt(receipt,manifest,{commit:'a'},'new','new'),/Stale receipt/);
});
test('coverage: changed source and unlisted source file require requalification', async () => {
  await mkdir('test-output',{recursive:true});const root=await mkdtemp(resolve('test-output/coverage-selftest-'));
  await mkdir(join(root,'src'));await mkdir(join(root,'fixtures'));
  const original=Buffer.from('export const synthetic = 1;\n');await writeFile(join(root,'src/example.mjs'),original);
  const source={schemaVersion:1,repository:'hpoenixf/open-etf-agent',commit:'a'.repeat(40),tree:'b'.repeat(40),inputs:[{path:'src/example.mjs',gitBlob:gitBlob(original)}]};
  assert.match(await sourceIdentity(root,source),/^[a-f0-9]{64}$/);
  await writeFile(join(root,'src/example.mjs'),'changed');await assert.rejects(sourceIdentity(root,source),/Source changed/);
  await writeFile(join(root,'src/example.mjs'),original);await writeFile(join(root,'src/unlisted.mjs'),'new');await assert.rejects(sourceIdentity(root,source),/Unqualified executable/);
});
test('coverage: missing actual commit objects cannot be replaced by a claimed JSON SHA', async () => {
  await assert.rejects(confirmCommit(process.cwd(),{commit:'0'.repeat(40),tree:'1'.repeat(40)},'test-output/absent-git-object-store'),/lacks the fixed commit/);
});
test('coverage: unavailable public metadata fails closed, never becomes an offline pass', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('synthetic network unavailable'); };
  try { await assert.rejects(confirmCommit(process.cwd(),{commit:'0'.repeat(40),tree:'1'.repeat(40)}),/COMMIT_UNCONFIRMED.*not a complete pass/); }
  finally { globalThis.fetch = original; }
});

test('coverage: table-breaking exact test names are rejected', () => {
  assert.throws(() => validateManifest(change(m => m.targets.provider.name = 'one | unexpected column')), /Unsafe test target/);
});
test('coverage: smoke uses only a fixed child heap and an owned temporary directory', () => {
  const env = smokeEnvironment('/owned/synthetic-smoke-output');
  assert.equal(env.NODE_OPTIONS, '--max-old-space-size=512');
  assert.equal(env.TMPDIR, '/owned/synthetic-smoke-output');
  assert.deepEqual(Object.keys(env).sort(), ['LANG','NODE_OPTIONS','PATH','TMPDIR','TZ']);
});

test('coverage: render refuses reversed markers without changing README bytes', async () => {
  await mkdir('test-output', {recursive:true});
  const root = await mkdtemp(resolve('test-output/coverage-render-'));
  await mkdir(join(root,'scripts'));
  await mkdir(join(root,'docs/verification'), {recursive:true});
  for (const path of ['scripts/check-article-coverage.mjs','docs/verification/article-coverage.json','docs/verification/article-coverage-source.json']) {
    await copyFile(new URL('../'+path, import.meta.url), join(root,path));
  }
  const original = Buffer.from('before\n<!-- article-coverage:end -->\nmiddle\n<!-- article-coverage:start -->\nafter\n');
  await writeFile(join(root,'README.md'), original);
  const result = spawnSync(process.execPath, ['scripts/check-article-coverage.mjs','--render'], {cwd:root, env:smokeEnvironment(root), encoding:'utf8', shell:false, timeout:5000});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /markers are reversed/);
  assert.deepEqual(await readFile(join(root,'README.md')), original);
});
