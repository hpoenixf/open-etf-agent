import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { validateManifest, renderTable, commandFor, verifyTap, gitBlob, sourceIdentity, confirmCommit, validateReceipt, smokeEnvironment, validateVersions, confirmVersions } from '../scripts/check-article-coverage.mjs';
const manifest = JSON.parse(await readFile(new URL('../docs/verification/article-coverage.json', import.meta.url)));
const versions = JSON.parse(await readFile(new URL('../versions.json', import.meta.url)));
const changeVersions = f => { const copy = structuredClone(versions); f(copy); return copy; };
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
test('coverage: generated table separates introduction from fixed verification and keeps exact titles', () => {
  const table=renderTable(manifest,manifest.verifiedAt,versions); assert.match(table,/\| 文章 \| since · 引入版本 \| verifiedAt · 固定 commit \+ case \| 状态 \|/);
  assert.equal(table.split('\n').filter(line=>line.startsWith('| [')).length,31);
  assert.match(table,/Memory：从保存、召回到安全遗忘/);
});
test('coverage: stale source, input, target and checker hashes are independently rejected', async () => {
  const receipt = JSON.parse(await readFile(new URL('../docs/verification/article-coverage-receipts.json', import.meta.url)));
  const source = {commit:manifest.verifiedAt};
  assert.doesNotThrow(() => validateReceipt(receipt,manifest,source,receipt.inputSha256,receipt.runnerSha256));
  for (const field of ['sourceCommit','inputSha256','runnerSha256','targetsSha256']) {
    const bad = {...receipt,[field]:'0'.repeat(field === 'sourceCommit' ? 40 : 64)};
    assert.throws(() => validateReceipt(bad,manifest,source,receipt.inputSha256,receipt.runnerSha256), /Stale receipt: source, case or checker changed/);
  }
  assert.throws(() => validateReceipt(receipt,manifest,{commit:'0'.repeat(40)},receipt.inputSha256,receipt.runnerSha256), /Stale receipt: verifiedAt differs/);
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
  for (const path of ['scripts/check-article-coverage.mjs','docs/verification/article-coverage.json','docs/verification/article-coverage-source.json','versions.json']) {
    await copyFile(new URL('../'+path, import.meta.url), join(root,path));
  }
  const original = Buffer.from('before\n<!-- article-coverage:end -->\nmiddle\n<!-- article-coverage:start -->\nafter\n');
  await writeFile(join(root,'README.md'), original);
  const result = spawnSync(process.execPath, ['scripts/check-article-coverage.mjs','--render'], {cwd:root, env:smokeEnvironment(root), encoding:'utf8', shell:false, timeout:5000});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /markers are reversed/);
  assert.deepEqual(await readFile(join(root,'README.md')), original);
});

test('coverage: planned versions, missing provenance and substituted selectors fail closed', () => {
  validateVersions(versions, manifest);
  assert.throws(() => validateVersions(changeVersions(v => delete v.targets.mcp), manifest), /exactly one since/);
  assert.throws(() => validateVersions(changeVersions(v => v.targets.mcp.since = '2.0'), manifest), /since/);
  assert.throws(() => validateVersions(changeVersions(v => v.versions['0.2'].commit = 'main'), manifest), /fixed public/);
  assert.throws(() => validateVersions(changeVersions(v => v.versions['0.2'].status = 'planned'), manifest), /fixed public/);
  assert.throws(() => validateVersions(changeVersions(v => v.targets.mcp.evidencePath = '../private.mjs'), manifest), /evidence path/);
  assert.throws(() => validateVersions(changeVersions(v => v.targets.mcp.selector = 'different-case'), manifest), /selector/);
});
test('coverage: newer verification anchors never rewrite since or invent introduction for absent modules', () => {
  const before = JSON.stringify(versions); const m = change(x => x.verifiedAt = 'a'.repeat(40));
  const table = renderTable(m, m.verifiedAt, versions);
  assert.ok(table.includes('[v0.2](https://github.com/hpoenixf/open-etf-agent/commit/a79e89bf709d4a2245b5a8652882a591ba467519)'));
  assert.ok(table.includes('[v0.5](https://github.com/hpoenixf/open-etf-agent/commit/05c0dd2dc550f4f7e5da034340ff5c3159768fcf)'));
  assert.match(table, /\[aaaaaaa\].*--case skill-mcp/);
  const absent = m.articles.find(a => a.slug === '021-agent-web-research-from-search-to-deep-reading');
  assert.equal(absent.status, '无公开对应'); assert.equal(absent.target, null);
  assert.ok(table.split('\n').find(line => line.includes('/articles/' + absent.slug)).includes('| — | —<br>'));
  assert.equal(JSON.stringify(versions), before);
  assert.throws(() => renderTable(m, manifest.verifiedAt, versions), /verifiedAt differs/);
  assert.throws(() => validateManifest(change(x => delete x.verifiedAt)), /verifiedAt/);
});
test('coverage: PDF introduction binds only the qualified local text-layer case, not the full article', () => {
  const pdf = manifest.articles.find(a => a.slug === '024-agent-pdf-from-text-to-evidence');
  const name = '11.3 PDF CLI exits then a fresh process verifies page report and original binary';
  assert.equal(pdf.status, 'verified'); assert.equal(pdf.target, 'pdf-local');
  assert.deepEqual(manifest.targets[pdf.target], {kind:'test', file:'test/pdf-cli.test.mjs', name});
  assert.deepEqual(versions.targets[pdf.target], {since:'0.11', evidencePath:'test/pdf-cli.test.mjs', evidenceGitBlob:'798dddb45495f251e672f5cf79782d4e2c4e8852', selector:name});
  assert.deepEqual(versions.versions['0.11'], {commit:'5f42c33892d57ed05e8cd09cad48573e6901995b', tree:'35d3ecef7d66527cad422a25da35766fd73d4463'});
  assert.equal(pdf.scope, '仅本地文本层 PDF：物理页、原文件与报告独立进程回读；不含 OCR、页图、版面、多模态或活跃解析恢复');
  const table = renderTable(manifest, manifest.verifiedAt, versions);
  const row = table.split('\n').find(line => line.includes('/articles/' + pdf.slug));
  assert.ok(row.includes('[v0.11](https://github.com/hpoenixf/open-etf-agent/commit/5f42c33892d57ed05e8cd09cad48573e6901995b)'));
  assert.ok(row.includes('`test/pdf-cli.test.mjs` · ' + name)); assert.ok(row.includes(pdf.scope));
});
test('coverage: historical commit/tree/path/blob are checked against actual local Git objects', async () => {
  await mkdir('test-output', {recursive:true}); const root = await mkdtemp(resolve('test-output/coverage-history-')); const gitDir = join(root,'objects.git');
  function git(args, input) { const p = spawnSync('git',args,{encoding:'utf8',input,shell:false,timeout:5000,env:{PATH:process.env.PATH,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}); assert.equal(p.status,0,p.stderr);return p.stdout.trim(); }
  git(['init','--bare',gitDir]); const g = (...args) => ['--git-dir',gitDir,...args];
  const blob = git(g('hash-object','-w','--stdin'),'export const fixture = 1;\n');
  const src = git(g('mktree'),`100644 blob ${blob}\texample.mjs\n`);
  const tree = git(g('mktree'),`040000 tree ${src}\tsrc\n`);
  const commit = git(g('hash-object','-t','commit','-w','--stdin'),`tree ${tree}\nauthor Synthetic <synthetic@example.invalid> 0 +0000\ncommitter Synthetic <synthetic@example.invalid> 0 +0000\n\nSynthetic history fixture\n`);
  const v = {versions:{'0.1':{commit,tree}},targets:{fixture:{since:'0.1',evidencePath:'src/example.mjs',evidenceGitBlob:blob}}};
  const confirmed = await confirmVersions(root,v,gitDir);assert.equal(confirmed[0].method,'actual-local-git-objects');
  await assert.rejects(confirmVersions(root,{...v,targets:{fixture:{...v.targets.fixture,evidenceGitBlob:'0'.repeat(40)}}},gitDir),/Historical source differs/);
  await assert.rejects(confirmVersions(root,{...v,versions:{'0.1':{commit,tree:'0'.repeat(40)}}},gitDir),/tree mismatch/);
  await assert.rejects(confirmVersions(root,{...v,versions:{'0.1':{commit:'0'.repeat(40),tree}}},gitDir),/lacks the fixed commit/);
});
test('coverage: article verification stays strict but separate from code delivery', async () => {
  const yaml = await readFile(new URL('../.github/workflows/verify.yml', import.meta.url),'utf8');
  assert.match(yaml,/permissions:\n  contents: read/); assert.match(yaml,/persist-credentials: false/);
  assert.match(yaml,/actions\/checkout@[a-f0-9]{40}/);assert.match(yaml,/actions\/setup-node@[a-f0-9]{40}/);
  const articles = await readFile(new URL('../.github/workflows/articles.yml', import.meta.url),'utf8');
  assert.match(articles,/run: node scripts\/check-article-coverage\.mjs --check/);
  assert.match(articles,/workflow_dispatch:/); assert.match(articles,/permissions:\n  contents: read/);
  assert.match(articles,/actions\/checkout@[a-f0-9]{40}/); assert.match(articles,/actions\/setup-node@[a-f0-9]{40}/);
  assert.doesNotMatch(yaml,/check-article-(coverage|backlinks)\.mjs/);
  assert.match(yaml,/run: npm test/); assert.match(yaml,/run: npm run build/);
  assert.doesNotMatch(yaml,/--smoke|secrets\.|pull_request_target|contents: write/);
});
