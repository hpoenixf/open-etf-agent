// Coverage is a claim about existing Runtime entry points, not a second execution engine.
import { readFile, writeFile, readdir, lstat, realpath, mkdir, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = 'docs/verification/article-coverage.json';
const BEGIN = '<!-- article-coverage:start -->', END = '<!-- article-coverage:end -->';
const REPO = 'hpoenixf/open-etf-agent';
const CLI_CASES = new Set(['fixture-child', 'retrieve-reread', 'compact-and-reread', 'explicit-memory', 'skill-mcp', 'batch-read']);
const sha = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
export const gitBlob = bytes => sha(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]), 'sha1');
const stable = value => JSON.stringify(value);
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const safePath = path => typeof path === 'string' && /^[a-zA-Z0-9_./-]+$/.test(path) && !isAbsolute(path) && !path.split('/').some(part => part === '..' || part === '.' || !part);

export function validateManifest(m) {
  ensure(m.schemaVersion === 2 && m.repository === REPO, 'Unsupported coverage manifest');
  ensure(m.versions === 'versions.json' && /^[a-f0-9]{40}$/.test(m.verifiedAt), 'Missing fixed verifiedAt or versions registry');
  ensure(m.source === 'docs/verification/article-coverage-source.json' && m.receipt === 'docs/verification/article-coverage-receipts.json', 'Unexpected evidence path');
  ensure(Number.isInteger(m.articleCatalog?.count) && m.articleCatalog.count >= 1 && m.articleCatalog.count <= 256 && m.articles?.length === m.articleCatalog.count, 'Catalog count must be an integer from 1 to 256 matching the article list');
  ensure(/^[a-f0-9]{40}$/.test(m.articleCatalog.commit), 'Article catalog must use a fixed commit');
  const slugs = new Set(), used = new Set();
  for (const a of m.articles) {
    ensure(/^[a-z0-9-]+$/.test(a.slug) && !slugs.has(a.slug), 'Invalid or duplicate article slug'); slugs.add(a.slug);
    ensure(typeof a.title === 'string' && a.title && typeof a.scope === 'string' && a.scope && !/[\n|]/.test(a.title + a.scope), 'Invalid title or slice boundary');
    ensure(['verified', '无公开对应', 'draft'].includes(a.status), 'Invalid article status');
    if (a.target !== null) { ensure(Object.hasOwn(m.targets, a.target), 'Unknown target'); used.add(a.target); }
    ensure(a.status !== 'verified' || a.target !== null, 'Verified article lacks an executable target');
    ensure(a.status !== '无公开对应' || a.target === null, 'No-public-match article cannot claim a target');
  }
  for (const [id, t] of Object.entries(m.targets)) {
    ensure(/^[a-z][a-z0-9-]*$/.test(id) && used.has(id), 'Unused or invalid target ID');
    if (t.kind === 'cli') ensure(Object.keys(t).sort().join(',') === 'case,kind' && CLI_CASES.has(t.case), 'Unsupported CLI case or unsafe arguments');
    else ensure(t.kind === 'test' && Object.keys(t).sort().join(',') === 'file,kind,name' && /^test\/[a-z0-9-]+\.test\.mjs$/.test(t.file) && typeof t.name === 'string' && t.name.length <= 200 && !/[\r\n\0|]/.test(t.name), 'Unsafe test target');
  }
  ensure(used.size <= 16, 'Smoke target bound exceeded');
}

export function validateVersions(v, m) {
  ensure(v?.schemaVersion === 1 && v.repository === REPO && v.kind === 'public-code-lineage-not-release-registry', 'Invalid version lineage registry');
  ensure(v.versions && typeof v.versions === 'object' && !Array.isArray(v.versions) && Object.keys(v.versions).length > 0 && Object.keys(v.versions).length <= 64, 'Missing/bounded version pins');
  for (const [version, pin] of Object.entries(v.versions)) {
    ensure(/^\d+\.\d+(?:\.\d+)?$/.test(version) && pin && Object.keys(pin).sort().join(',') === 'commit,tree' && /^[a-f0-9]{40}$/.test(pin.commit) && /^[a-f0-9]{40}$/.test(pin.tree), 'Version needs a fixed public commit/tree, not planned/released labels');
  }
  ensure(v.targets && stable(Object.keys(v.targets).sort()) === stable(Object.keys(m.targets).sort()), 'Each actual target needs exactly one since entry');
  for (const [id, entry] of Object.entries(v.targets)) {
    ensure(entry && typeof entry.since === 'string' && Object.hasOwn(v.versions, entry.since) && Object.keys(entry).sort().join(',') === 'evidenceGitBlob,evidencePath,selector,since', 'Unknown/malformed since version');
    ensure(safePath(entry.evidencePath) && /^(src|test)\//.test(entry.evidencePath) && /^[a-f0-9]{40}$/.test(entry.evidenceGitBlob), 'Invalid historical evidence path/blob');
    ensure(entry.selector === (m.targets[id].case ?? m.targets[id].name), 'Historical selector differs from actual target');
  }
}

export function renderTable(m, commit, versions) {
  validateVersions(versions, m);
  ensure(commit === m.verifiedAt, 'verifiedAt differs from fixed verification source');
  const rows = m.articles.map(a => {
    const t = a.target && m.targets[a.target];
    const label = !t ? '—' : t.kind === 'cli' ? `\`--case ${t.case}\`` : `\`${t.file}\` · ${t.name}`;
    const link = t ? `[${commit.slice(0, 7)}](https://github.com/${REPO}/commit/${commit}) + ${label}` : label;
    const origin = t && versions.targets[a.target];
    const since = origin ? `[v${origin.since}](https://github.com/${REPO}/commit/${versions.versions[origin.since].commit})` : '—';
    return `| [${a.title}](https://hpoenixf.com/eff-agent-article/articles/${a.slug}) | ${since} | ${link}<br>${a.scope} | ${a.status} |`;
  });
  return [BEGIN, '| 文章 | since · 引入版本 | verifiedAt · 固定 commit + case | 状态 |', '| --- | --- | --- | --- |', ...rows, END].join('\n');
}

async function assertRegular(root, path) {
  ensure(safePath(path), `Unsafe source path: ${path}`);
  const full = join(root, path); const stat = await lstat(full);
  ensure(stat.isFile() && !stat.isSymbolicLink() && relative(root, await realpath(full)) === path, `Unsafe/nonregular source: ${path}`);
  return full;
}
async function inventory(root, dir) {
  const items = [];
  for (const item of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    ensure(!item.isSymbolicLink(), `Symlink source rejected: ${path}`);
    if (item.isDirectory()) items.push(...await inventory(root, path));
    else if (item.isFile()) items.push(path);
    else throw new Error(`Unsupported source: ${path}`);
  }
  return items;
}
export async function sourceIdentity(root, source) {
  ensure(source.schemaVersion === 1 && source.repository === REPO && /^[a-f0-9]{40}$/.test(source.commit) && /^[a-f0-9]{40}$/.test(source.tree), 'Invalid fixed source identity');
  ensure(Array.isArray(source.inputs) && source.inputs.length > 0, 'Missing source inputs');
  const paths = new Set(); const current = [];
  for (const f of source.inputs) {
    ensure(!paths.has(f.path) && /^(src\/|fixtures\/|test\/|package(?:-lock)?\.json$)/.test(f.path) && /^[a-f0-9]{40}$/.test(f.gitBlob), 'Invalid/duplicate source entry'); paths.add(f.path);
    const bytes = await readFile(await assertRegular(root, f.path));
    ensure(gitBlob(bytes) === f.gitBlob, `Source changed: ${f.path}; requalify, do not retain verified`);
    current.push({ path: f.path, gitBlob: f.gitBlob });
  }
  for (const path of [...await inventory(root, 'src'), ...await inventory(root, 'fixtures')]) ensure(paths.has(path), `Unqualified executable input: ${path}`);
  return sha(stable(current));
}

function git(args, root, gitDir) {
  return spawnSync('git', [...(gitDir ? ['--git-dir', resolve(gitDir)] : ['-C', root]), ...args], { encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024, env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' }, shell: false });
}
async function github(path) {
  let response;
  try { response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
  catch { throw new Error('COMMIT_UNCONFIRMED: no local Git object and public GitHub metadata unavailable; not a complete pass'); }
  ensure(response.ok, `COMMIT_UNCONFIRMED: public metadata HTTP ${response.status}; not a complete pass`);
  return response.json();
}
async function committedTree(root, source, gitDir) {
  let entries; let method;
  const local = git(['cat-file', '-p', `${source.commit}^{commit}`], root, gitDir);
  if (local.status === 0) {
    ensure(local.stdout.startsWith(`tree ${source.tree}\n`), 'Fixed commit tree mismatch');
    const listed = git(['ls-tree', '-r', '-z', '--full-tree', source.commit], root, gitDir);
    ensure(listed.status === 0, 'Local fixed commit tree objects missing');
    entries = listed.stdout.split('\0').filter(Boolean).map(line => { const [header, path] = line.split('\t'); const [mode, type, blob] = header.split(' '); return { path, type, sha: blob, mode }; });
    method = 'actual-local-git-objects';
  } else {
    ensure(!gitDir, 'Explicit Git object store lacks the fixed commit; not a complete pass');
    const commit = await github(`git/commits/${source.commit}`);
    ensure(commit.sha === source.commit && commit.tree?.sha === source.tree, 'Public commit identity mismatch');
    const tree = await github(`git/trees/${source.tree}?recursive=1`);
    ensure(tree.sha === source.tree && !tree.truncated && Array.isArray(tree.tree), 'Public tree is incomplete');
    entries = tree.tree; method = 'fresh-public-github-metadata';
  }
  return { entries, method };
}
export async function confirmCommit(root, source, gitDir) {
  const { entries, method } = await committedTree(root, source, gitDir);
  const selected = entries.filter(e => e.type === 'blob' && (/^(src\/|fixtures\/|test\/)/.test(e.path) || ['package.json', 'package-lock.json'].includes(e.path))).map(e => ({ path: e.path, gitBlob: e.sha })).sort((a,b)=>a.path.localeCompare(b.path));
  ensure(stable(selected) === stable([...source.inputs].sort((a,b)=>a.path.localeCompare(b.path))), 'Fixed commit inputs differ from source manifest');
  return { commit: source.commit, tree: source.tree, method };
}

export async function confirmVersions(root, versions, gitDir) {
  const confirmations = [];
  for (const [version, pin] of Object.entries(versions.versions)) {
    const { entries, method } = await committedTree(root, pin, gitDir);
    for (const evidence of Object.values(versions.targets).filter(item => item.since === version)) {
      ensure(entries.some(item => item.type === 'blob' && item.mode === '100644' && item.path === evidence.evidencePath && item.sha === evidence.evidenceGitBlob), `Historical source differs: v${version} ${evidence.evidencePath}`);
    }
    confirmations.push({ version, commit: pin.commit, tree: pin.tree, method });
  }
  return confirmations;
}

export function commandFor(t, output) {
  if (t.kind === 'test') return ['--test', '--test-concurrency=1', '--test-reporter=tap', `--test-name-pattern=^${escapeRegex(t.name)}$`, t.file];
  ensure(CLI_CASES.has(t.case), 'CLI case not authorized');
  return ['src/cli.mjs', '--case', t.case, '--output', output, ...(t.case === 'explicit-memory' ? ['--memory-library', join(output, 'synthetic-memory')] : [])];
}
export function verifyTap(output, name) {
  const escaped = escapeRegex(name);
  ensure(new RegExp(`^ok \\d+ - ${escaped}(?:\\r)?$`, 'm').test(output), 'Selected node:test case did not actually pass (absent/skipped/renamed)');
  ensure(/^# pass 1\r?$/m.test(output) && /^# fail 0\r?$/m.test(output) && /^# skipped 0\r?$/m.test(output), 'Exact target must execute once, without skipped or extra tests');
  return { name, passed: 1, failed: 0, skipped: 0 };
}
async function verifyCli(stdout, t, output) {
  const value = JSON.parse(stdout);
  ensure(value.caseId === t.case, 'CLI returned the wrong case');
  const runs = t.case === 'explicit-memory' ? value.runs : [value];
  ensure(Array.isArray(runs) && runs.length > 0 && runs.every(r => r.status === 'completed'), 'CLI did not complete all selected runs');
  const artifacts = [];
  for (const run of runs) {
    ensure(typeof run.directory === 'string' && relative(resolve(output), resolve(run.directory)).split('/')[0] !== '..', 'CLI escaped synthetic output root');
    if (run.receipt) {
      ensure(safePath(run.receipt.path) && Number.isSafeInteger(run.receipt.bytes) && /^[a-f0-9]{64}$/.test(run.receipt.sha256), 'Invalid report receipt');
      const bytes = await readFile(await assertRegular(resolve(run.directory), run.receipt.path));
      ensure(bytes.length === run.receipt.bytes && sha(bytes) === run.receipt.sha256, 'Saved artifact differs from actual bytes');
      artifacts.push({ bytes: bytes.length, sha256: sha(bytes), mediaType: run.receipt.mediaType });
    }
  }
  ensure(artifacts.length > 0, 'Selected CLI produced no verified saved artifact');
  return { case: t.case, completedRuns: runs.length, artifacts };
}
export function smokeEnvironment(output) {
  return { PATH: `${dirname(process.execPath)}:${process.env.PATH || '/usr/bin:/bin'}`, LANG: 'C.UTF-8', TZ: 'UTC', NODE_OPTIONS: '--max-old-space-size=512', TMPDIR: output };
}
async function smoke(root, m, source, identity, confirmation) {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  ensure(major === 26 && (minor > 8 || minor === 8 && patch >= 1), 'Smoke requires Node >=26.8.1 <27; no unsupported-engine pass');
  await mkdir(join(root, 'test-output'), { recursive: true });
  const output = await mkdtemp(join(root, 'test-output', 'article-coverage-'));
  const results = {}; const cache = new Map(); const started = Date.now();
  // No inherited credentials, NODE_OPTIONS, preload hooks, provider settings or arbitrary commands.
  // Only a literal safe heap option is inherited by nested Node processes; temp files remain owned.
  const env = smokeEnvironment(output);
  for (const [id, t] of Object.entries(m.targets)) {
    ensure(Date.now() - started < 120000, 'Total bounded smoke time exceeded');
    const key = stable(t);
    if (cache.has(key)) { results[id] = cache.get(key); continue; }
    const args = commandFor(t, join(output, id));
    const run = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', shell: false, timeout: Math.min(30000, 120000 - (Date.now() - started)), maxBuffer: 4 * 1024 * 1024 });
    ensure(!run.error && run.status === 0 && !run.signal, `Smoke failed: ${id} (${run.error?.code || run.status || run.signal}); no receipt published`);
    const observed = t.kind === 'test' ? verifyTap(run.stdout, t.name) : await verifyCli(run.stdout, t, join(output, id));
    const record = { target: t, exitCode: 0, observed, stdoutSha256: sha(run.stdout), stderrSha256: sha(run.stderr) };
    cache.set(key, record); results[id] = record;
  }
  ensure(await sourceIdentity(root, source) === identity, 'Inputs changed during smoke');
  const receipt = { schemaVersion: 1, kind: 'actual-provider-free-runtime-execution', executedAt: new Date().toISOString(), node: process.version, sourceCommit: source.commit, inputSha256: identity, runnerSha256: sha(await readFile(join(root, 'scripts/check-article-coverage.mjs'))), targetsSha256: sha(stable(m.targets)), commitConfirmation: confirmation, executionBounds: { nodeHeapMiB: 512, temporaryDirectory: 'owned-smoke-output', perTargetMs: 30000, totalMs: 120000 }, modelCalls: 0, semanticStatus: 'unreviewed', results };
  await writeFile(join(root, m.receipt), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
export function validateReceipt(receipt, m, source, inputHash, runnerHash) {
  ensure(m.verifiedAt === source.commit, 'Stale receipt: verifiedAt differs from fixed source');
  ensure(receipt.schemaVersion === 1 && receipt.kind === 'actual-provider-free-runtime-execution' && receipt.modelCalls === 0 && receipt.semanticStatus === 'unreviewed', 'Missing actual bounded execution receipt');
  ensure(receipt.sourceCommit === source.commit && receipt.inputSha256 === inputHash && receipt.runnerSha256 === runnerHash && receipt.targetsSha256 === sha(stable(m.targets)), 'Stale receipt: source, case or checker changed; re-run smoke or downgrade to draft');
  for (const a of m.articles.filter(a => a.status === 'verified')) {
    const r = receipt.results[a.target];
    ensure(r && r.exitCode === 0 && stable(r.target) === stable(m.targets[a.target]) && /^[a-f0-9]{64}$/.test(r.stdoutSha256), `No executed target receipt: ${a.target}`);
    if (r.target.kind === 'test') ensure(r.observed.name === r.target.name && r.observed.passed === 1 && r.observed.skipped === 0, 'Exact test receipt missing');
    else ensure(r.observed.case === r.target.case && r.observed.completedRuns > 0 && r.observed.artifacts?.length > 0, 'Actual saved-byte CLI receipt missing');
  }
}
async function main(args) {
  let mode = '--check', gitDir;
  if (args[0]?.startsWith('--') && ['--check', '--smoke', '--render'].includes(args[0])) mode = args.shift();
  if (args[0] === '--git-dir' && args.length === 2) { gitDir = args[1]; args.splice(0); }
  ensure(args.length === 0, 'Usage: node scripts/check-article-coverage.mjs [--check|--smoke|--render] [--git-dir READ_ONLY_OBJECT_STORE]');
  const m = await json(join(ROOT, MANIFEST)); validateManifest(m);
  const source = await json(join(ROOT, m.source));
  const versions = await json(join(ROOT, m.versions)); validateVersions(versions, m);
  const readmePath = join(ROOT, 'README.md'), readme = await readFile(readmePath, 'utf8');
  const table = renderTable(m, source.commit, versions);
  ensure(readme.split(BEGIN).length === 2 && readme.split(END).length === 2, 'Missing/duplicate generated table markers');
  ensure(readme.indexOf(BEGIN) < readme.indexOf(END), 'Generated table markers are reversed; README not modified');
  const expected = readme.slice(0, readme.indexOf(BEGIN)) + table + readme.slice(readme.indexOf(END) + END.length);
  if (mode === '--render') { await writeFile(readmePath, expected); console.log('Rendered table only; no verification claimed.'); return; }
  ensure(expected === readme, 'README table drift; run --render');
  const identity = await sourceIdentity(ROOT, source);
  const confirmation = await confirmCommit(ROOT, source, gitDir);
  const lineageConfirmation = await confirmVersions(ROOT, versions, gitDir);
  const receipt = mode === '--smoke' ? await smoke(ROOT, m, source, identity, confirmation) : await json(join(ROOT, m.receipt));
  validateReceipt(receipt, m, source, identity, sha(await readFile(fileURLToPath(import.meta.url))));
  console.log(JSON.stringify({ status: 'passed', mode, confirmation, lineageConfirmation, verifiedAt: source.commit, articles: m.articles.length, verified: m.articles.filter(a => a.status === 'verified').length, uniqueExecutedTargets: new Set(Object.values(receipt.results).map(r=>stable(r.target))).size, executionTime: receipt.executedAt, executedOnThisInvocation: mode === '--smoke', scope: 'Runtime only; original synthetic fixtures; no live/model-quality claim' }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
