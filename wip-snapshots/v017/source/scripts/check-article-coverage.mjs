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

// One catalog article may describe several independently qualified bounded slices.
export function articleSlices(row) {
  return [row, ...(row.additionalTargets || []).map(slice=>({...slice,slug:row.slug,title:row.title}))];
}
export function validateManifest(m) {
  ensure(Buffer.byteLength(JSON.stringify(m))<=1048576,'Coverage manifest exceeds existing read budget');
  ensure([2, 3].includes(m.schemaVersion) && m.repository === REPO, 'Unsupported coverage manifest');
  ensure(m.versions === 'versions.json' && /^[a-f0-9]{40}$/.test(m.verifiedAt), 'Missing fixed verifiedAt or versions registry');
  ensure(m.source === 'docs/verification/article-coverage-source.json' && m.receipt === 'docs/verification/article-coverage-receipts.json', 'Unexpected evidence path');
  ensure(Number.isInteger(m.articleCatalog?.count) && m.articleCatalog.count >= 1 && m.articleCatalog.count <= 256 && m.articles?.length === m.articleCatalog.count, 'Catalog count must be an integer from 1 to 256 matching the article list');
  ensure(/^[a-f0-9]{40}$/.test(m.articleCatalog.commit), 'Article catalog must use a fixed commit');
  const slugs = new Set(), used = new Set();
  for (const a of m.articles) {
    ensure(/^[a-z0-9-]+$/.test(a.slug) && !slugs.has(a.slug), 'Invalid or duplicate article slug'); slugs.add(a.slug);
    ensure(typeof a.title === 'string' && a.title && typeof a.scope === 'string' && a.scope && !/[\n|]/.test(a.title + a.scope), 'Invalid title or slice boundary');
    ensure(['verified', '无公开对应', 'draft'].includes(a.status), 'Invalid article status');
    ensure(a.additionalTargets === undefined || m.schemaVersion===3 && Array.isArray(a.additionalTargets) && a.additionalTargets.length>0, 'Invalid additional article slices');
    for(const slice of a.additionalTargets || []) ensure(slice && Object.keys(slice).sort().join(',')==='articleCommit,scope,status,target','Unexpected additional slice fields');
    const ids=new Set();
    for(const slice of articleSlices(a)) {
      ensure(!ids.has(slice.target), 'Duplicate target in one article');ids.add(slice.target);
      if(slice!==a) ensure(Object.keys(slice).sort().join(',')==='articleCommit,scope,slug,status,target,title' && typeof slice.scope==='string' && slice.scope && !/[\n|]/.test(slice.scope) && ['verified','draft'].includes(slice.status) && /^[a-f0-9]{40}$/.test(slice.articleCommit), 'Invalid additional slice');
      if (slice.target !== null) { ensure(Object.hasOwn(m.targets,slice.target),'Unknown target');used.add(slice.target); }
      ensure(slice.status!=='verified' || slice.target!==null,'Verified article lacks an executable target');
      ensure(slice.status!=='无公开对应' || slice.target===null,'No-public-match article cannot claim a target');
    }
    if (a.target !== null) { ensure(Object.hasOwn(m.targets, a.target), 'Unknown target'); used.add(a.target); }
    ensure(a.status !== 'verified' || a.target !== null, 'Verified article lacks an executable target');
    ensure(a.status !== '无公开对应' || a.target === null, 'No-public-match article cannot claim a target');
  }
  for (const [id, t] of Object.entries(m.targets)) {
    ensure(/^[a-z][a-z0-9-]*$/.test(id) && used.has(id), 'Unused or invalid target ID');
    if (t.kind === 'cli') ensure(Object.keys(t).sort().join(',') === 'case,kind' && CLI_CASES.has(t.case), 'Unsupported CLI case or unsafe arguments');
    else if (m.schemaVersion === 3 && t.kind === 'scenario') ensure(Object.keys(t).sort().join(',') === 'kind,name' && Object.hasOwn(SCENARIOS,t.name), 'Unsupported independent scenario');
    else ensure(t.kind === 'test' && Object.keys(t).sort().join(',') === 'file,kind,name' && /^test\/[a-z0-9-]+\.test\.mjs$/.test(t.file) && typeof t.name === 'string' && t.name.length <= 200 && !/[\r\n\0|]/.test(t.name), 'Unsafe test target');
  }
  if (m.schemaVersion === 2) ensure(used.size <= 16, 'Smoke target bound exceeded');
  else validateQualifications(m);
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
    if(m.schemaVersion===3 && m.targets[id].kind==='scenario') ensure(v.versions[entry.since].commit===m.qualifications[m.targetEvidence[id]].commit,'Scenario since/source identity mismatch');
  }
}

// Presentation is deliberately separate from target/status/since/execution facts.
// A translated title alone does not establish that an English article exists.
export function validateLocalization(locale, m) {
  ensure(locale?.schemaVersion === 1 && locale.kind === 'coverage-display-only', 'Invalid coverage localization');
  ensure(Object.keys(locale).sort().join(',') === 'articles,kind,schemaVersion', 'Localization cannot introduce execution facts');
  ensure(locale.articles && stable(Object.keys(locale.articles).sort()) === stable(m.articles.map(a => a.slug).sort()), 'Localization must cover exactly the registered articles');
  for (const [slug,a] of Object.entries(locale.articles)) {
    ensure(a && Object.keys(a).sort().join(',') === (a.additionalScopes ? 'additionalScopes,articleBlob,englishAvailable,scope,title' : 'articleBlob,englishAvailable,scope,title'), 'Localization cannot override status, target or since');
    ensure(typeof a.title === 'string' && a.title && typeof a.scope === 'string' && a.scope && !/[\n\r|<>\[\]]/.test(a.title + a.scope), 'Invalid localized display text');
    const row=m.articles.find(row=>row.slug===slug), extra=row.additionalTargets || [];
    ensure(stable(Object.keys(a.additionalScopes || {}).sort())===stable(extra.map(s=>s.target).sort()),'Additional localized scopes differ from article targets');
    for(const v of Object.values(a.additionalScopes || {})) ensure(v && Object.keys(v).sort().join(',')==='articleBlob,scope' && typeof v.scope==='string' && v.scope && !/[\n\r|<>\[\]]/.test(v.scope) && /^[a-f0-9]{40}$/.test(v.articleBlob),'Invalid additional localized scope');
    ensure(typeof a.englishAvailable === 'boolean' && /^[a-f0-9]{40}$/.test(a.articleBlob), 'Missing article-language availability or fixed body identity');
  }
}

export function renderTable(m, commit, versions, language = 'zh', locale) {
  ensure(language === 'zh' || language === 'en', 'Unsupported coverage language');
  if (language === 'en') validateLocalization(locale, m);
  validateVersions(versions, m);
  ensure(commit === m.verifiedAt, 'verifiedAt differs from fixed verification source');
  const rows = m.articles.map(a => {
    const display=language==='en'?locale.articles[a.slug]:a;
    const translated=language==='en' && display.englishAvailable;
    const suffix=language==='en' && !translated?' (Chinese original)':'';
    const pieces=articleSlices(a).map((slice,index)=>{
      const t=slice.target && m.targets[slice.target];
      const pin=m.schemaVersion===3 && t?m.qualifications[m.targetEvidence[slice.target]].commit:commit;
      const label=!t?'—':t.kind==='scenario'?`independent ${t.name} CLI scenario`:t.kind==='cli'?`\`--case ${t.case}\``:`\`${t.file}\` · ${t.name}`;
      const link=t?`[${pin.slice(0,7)}](https://github.com/${REPO}/commit/${pin}) + ${label}`:label;
      const origin=t && versions.targets[slice.target];
      const since=origin?`[v${origin.since}](https://github.com/${REPO}/commit/${versions.versions[origin.since].commit})`:'—';
      const scope=language==='en'?(index?display.additionalScopes[slice.target].scope:display.scope):slice.scope;
      const status=language==='en' && slice.status==='无公开对应'?'no public counterpart':slice.status;
      return {since,link:link+'<br>'+scope,status};
    });
    return `| [${display.title}](https://hpoenixf.com/eff-agent-article/${translated?'en/':''}articles/${a.slug})${suffix} | ${pieces.map(p=>p.since).join('<br>')} | ${pieces.map(p=>p.link).join('<br><br>')} | ${pieces.map(p=>p.status).join('<br>')} |`;
  });
  const header = language === 'en' ? '| Article | since · introduced in | verifiedAt · fixed commit + case | Status |' : '| 文章 | since · 引入版本 | verifiedAt · 固定 commit + case | 状态 |';
  return [BEGIN, header, '| --- | --- | --- | --- |', ...rows, END].join('\n');
}

export function updateReadmeTable(readme, table) {
  ensure(readme.split(BEGIN).length === 2 && readme.split(END).length === 2, 'Missing/duplicate generated table markers');
  ensure(readme.indexOf(BEGIN) < readme.indexOf(END), 'Generated table markers are reversed; README not modified');
  return readme.slice(0, readme.indexOf(BEGIN)) + table + readme.slice(readme.indexOf(END) + END.length);
}

export function validateReadmeEntry(text, guide) {
  // Reject legacy embedded tables rather than silently maintaining two owners.
  if (text.includes(BEGIN) || text.includes(END)) {
    if (text.includes(BEGIN) && text.includes(END)) ensure(text.indexOf(BEGIN) < text.indexOf(END), 'Generated table markers are reversed; README not modified');
    throw new Error('README must link to its standalone article guide, not embed a coverage table');
  }
  const visible = [];
  let fence = null;
  for (const line of text.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) { if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null; continue; }
    if (marker) { fence = marker[1]; continue; }
    if (!/^( {4}|\t)/.test(line)) visible.push(line.replace(/(`+)[\s\S]*?\1/g, ''));
  }
  const links = [...visible.join('\n').matchAll(/(?<![!\\])\[[^\[\]\n]+\]\(([^\s)]+)\)/g)];
  ensure(links.some(match => match[1] === guide), 'README is missing its visible article-guide link');
}

export async function readmeViews(root, m, source, versions) {
  // README is the entry; each standalone language guide owns one generated table.
  const specifications = [['README.md', 'docs/articles-and-code.md', 'en'], ['README.zh-CN.md', 'docs/articles-and-code.zh-CN.md', 'zh']];
  for (const [entry, path] of specifications) validateReadmeEntry(await readFile(join(root, entry), 'utf8'), path);
  const views = [];
  for (const [, path, language] of specifications) {
    const text = await readFile(join(root, path), 'utf8');
    updateReadmeTable(text, ''); // validation only; no write
    views.push({ path, language, text });
  }
  const locale = await json(join(root, 'docs/verification/article-coverage.en.json'));
  validateLocalization(locale, m);
  return views.map(view => ({ path: view.path, text: view.text,
    expected: updateReadmeTable(view.text, renderTable(m, source.commit, versions, view.language, locale)) }));
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
export async function metadataFailure(response,path) {
  let message='unavailable';
  try {const body=await response.json();if(typeof body.message==='string')message=body.message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[redacted IP]').replace(/\b(?:[a-f0-9]{1,4}:){2,}[a-f0-9:]+\b/gi,'[redacted IP]').slice(0,240);} catch {}
  const diagnostic={message,remaining:response.headers.get('x-ratelimit-remaining'),reset:response.headers.get('x-ratelimit-reset'),retryAfter:response.headers.get('retry-after')};
  return `COMMIT_UNCONFIRMED: public metadata HTTP ${response.status} (${path}); ${JSON.stringify(diagnostic)}; not a complete pass`;
}
async function github(path) {
  let response;
  try { response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
  catch { throw new Error('COMMIT_UNCONFIRMED: no local Git object and public GitHub metadata unavailable; not a complete pass'); }
  if(!response.ok) throw new Error(await metadataFailure(response,path));
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
  if (m.schemaVersion === 3) m = legacyManifest(m);
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
// A qualification owns its execution identity. Historical receipts never inherit main's bytes.
const HASH40 = /^[a-f0-9]{40}$/, HASH64 = /^[a-f0-9]{64}$/;
const SCENARIOS = {
  'memory-consumer': {kind:'memory-consumer-provider-free-code-qualification',version:'0.14.0',section:'independent',receipt:'docs/verification/v014-memory-consumer.safe.json',stages:['independent-install','independent-build','independent-seed','independent-recall','independent-artifact-read','independent-memory-read','independent-temporary']},
  temporal: { kind:'temporal-provider-free-code-qualification', version:'0.12.0', section:'independentInstall', stages:['independent-install','independent-build','independent-submit','independent-work','independent-read','independent-artifact-read'] },
  'ordinary-response': { kind:'ordinary-response-code-qualification', version:'0.13.0', section:'independent', stages:['independent-install','independent-build','independent-start','independent-receive','independent-resume','independent-question-read','independent-artifact-read'] }
};
export function validateQualifications(m) {
  ensure(m.qualifications && m.targetEvidence && Object.keys(m.targetEvidence).sort().join(',') === Object.keys(m.targets).sort().join(','), 'Each target requires exactly one evidence binding');
  const used = new Set(), identities = new Set(); let legacy = 0;
  for (const [id, q] of Object.entries(m.qualifications)) {
    ensure(/^[a-z][a-z0-9-]*$/.test(id) && q && HASH40.test(q.commit) && HASH40.test(q.tree) && HASH40.test(q.evidenceCommit) && HASH40.test(q.evidenceTree), 'Invalid qualification identity');
    ensure(['legacy-runtime','independent-scenario'].includes(q.kind), 'Unknown qualification kind');
    ensure(q.receipt && safePath(q.receipt.path) && q.receipt.path.startsWith('docs/verification/') && HASH40.test(q.receipt.gitBlob), 'Invalid immutable receipt');
    const identity = `${q.commit}:${q.receipt.path}`; ensure(!identities.has(identity), 'Duplicate qualification identity'); identities.add(identity);
    if(q.kind === 'legacy-runtime') {
      legacy++; ensure(q.commit === m.verifiedAt && q.source?.path === m.source && q.receipt.path === m.receipt && HASH40.test(q.source.gitBlob) && q.runner?.path === 'scripts/check-article-coverage.mjs' && HASH40.test(q.runner.gitBlob), 'Invalid frozen legacy qualification');
      ensure(Object.keys(q).sort().join(',') === 'commit,evidenceCommit,evidenceTree,kind,receipt,runner,source,tree', 'Unknown legacy qualification property');
    } else {
      ensure(Object.hasOwn(SCENARIOS,q.scenario) && Object.keys(q).sort().join(',') === 'commit,evidenceCommit,evidenceTree,kind,receipt,scenario,tree', 'Unknown independent scenario identity');
      ensure(q.receipt.path === (SCENARIOS[q.scenario].receipt || (q.scenario === 'temporal' ? 'docs/verification/v012-temporal.safe.json' : 'docs/verification/v013-ordinary-response.safe.json')), 'Wrong scenario receipt path');
    }
  }
  ensure(legacy === 1, 'Exactly one frozen legacy group required');
  for(const [id,t] of Object.entries(m.targets)) {
    const qid=m.targetEvidence[id], q=m.qualifications[qid]; ensure(q, 'Unknown target qualification'); used.add(qid);
    if(q.kind==='independent-scenario') for(const a of m.articles.flatMap(articleSlices).filter(a=>a.target===id)) ensure(HASH40.test(a.articleCommit),'Missing fixed scenario article source');
    ensure(q.kind === 'legacy-runtime' ? t.kind !== 'scenario' : t.kind === 'scenario' && t.name === q.scenario, 'Target/scenario binding mismatch');
  }
  ensure(used.size === Object.keys(m.qualifications).length, 'Orphan qualification');
  const relationships=m.articles.flatMap(articleSlices).filter(a=>a.target!==null);
  ensure(Object.keys(m.targets).every(id=>relationships.some(a=>a.target===id)), 'Orphan target');
  const targetSignatures=Object.entries(m.targets).map(([id,t])=>m.targetEvidence[id]+':'+stable(Object.keys(t).sort().map(key=>[key,t[key]])));
  ensure(new Set(targetSignatures).size===targetSignatures.length,'Duplicate executable target identity');
}
export function legacyManifest(m) {
  validateQualifications(m);
  const targets=Object.fromEntries(Object.entries(m.targets).filter(([id])=>m.qualifications[m.targetEvidence[id]].kind==='legacy-runtime'));
  return {...m,schemaVersion:2,targets,articles:m.articles.flatMap(articleSlices).filter(a=>a.target && Object.hasOwn(targets,a.target))};
}
export function validateScenarioReceipt(receipt, scenario) {
  const spec=SCENARIOS[scenario], q=receipt?.[spec?.section];
  ensure(spec && receipt.schemaVersion===1 && receipt.kind===spec.kind && receipt.version===spec.version && receipt.modelCalls===0 && q?.modelCalls===0, 'Wrong scenario qualification receipt');
  ensure(Array.isArray(q.observations) && q.observations.length<=64 && new Set(q.observations.map(o=>o.stage)).size===q.observations.length, 'Duplicate/missing scenario stages');
  for(const stage of spec.stages) {
    const o=q.observations.find(o=>o.stage===stage); ensure(o?.exitCode===0 && HASH64.test(o.stdoutSha256) && HASH64.test(o.stderrSha256), `Missing successful scenario stage: ${stage}`);
  }
  ensure(Number.isSafeInteger(q.report?.bytes) && q.report.bytes>0 && HASH64.test(q.report.sha256) && /^revision:sha256:[a-f0-9]{64}$/.test(q.report.revisionId), 'Missing original artifact identity');
  ensure(Array.isArray(q.inputFiles) && q.inputFiles.length>0 && q.inputFiles.length<=4096 && new Set(q.inputFiles.map(f=>f.path)).size===q.inputFiles.length, 'Invalid scenario input inventory');
  for(const f of q.inputFiles) ensure(safePath(f.path) && /^(src\/|fixtures\/|package(?:-lock)?\.json$|scripts\/build\.mjs$)/.test(f.path) && HASH64.test(f.sha256), 'Invalid scenario input');
  if(scenario==='temporal') ensure(stable(q.taskTime)===stable({schemaVersion:'task-time@1',anchorInstant:'2026-10-28T00:30:00.000Z',timeZone:'America/Los_Angeles',taskDate:'2026-10-27',yesterday:'2026-10-26',tomorrow:'2026-10-28'}), 'Temporal original task identity differs');
  else if(scenario==='memory-consumer') {
    ensure(q.unchangedLibraryBytes===true && q.paidCalls===0 && q.memory?.mode==='read-only' && typeof q.memory.libraryId==='string','Missing read-only Memory observation');
    const consumed=q.memory.consumed,requests=q.memory.requests;
    ensure(Array.isArray(consumed) && consumed.length>0 && Array.isArray(requests) && requests.length>0,'Missing actual Memory consumption');
    for(const item of consumed) ensure(item.libraryId===q.memory.libraryId && typeof item.id==='string' && Number.isSafeInteger(item.revision) && item.revision>0 && HASH64.test(item.sha256),'Invalid current Memory identity');
    ensure(requests.some(req=>Array.isArray(req.consumed) && req.consumed.length===0) && requests.some(req=>stable(req.consumed)===stable(consumed)), 'No transition from retrieval to actual request consumption');
    for(const req of requests) ensure(Number.isSafeInteger(req.sequence) && req.sequence>0 && HASH64.test(req.bodySha256) && Array.isArray(req.consumed) && req.consumed.every(item=>consumed.some(c=>stable(c)===stable(item))), 'Request consumed a different Memory identity');
    ensure(Array.isArray(q.libraryInventory) && q.libraryInventory.length>0 && q.libraryInventory.every(f=>safePath(f.path) && HASH64.test(f.sha256) && Number.isSafeInteger(f.bytes) && f.bytes>0),'Missing unchanged library inventory');
  }
  else ensure(typeof q.questionId==='string' && q.questionId && typeof q.responseId==='string' && q.responseId && HASH64.test(q.responseHash) && HASH64.test(q.adoptionCheckpointHash) && q.paidCalls===0, 'Missing question/response/adoption identity');
  return q;
}
export async function checkQualifications(root,m,gitDir) {
  validateQualifications(m); const cache=new Map(), confirmations=[]; let totalBytes=0;
  async function fixedBytes(q,path,expected) {
    const key=expected;
    if(cache.has(key)) return cache.get(key);
    const local=git(['show',`${q.commit}:${path}`],root,gitDir);
    let bytes;
    if(local.status===0) bytes=Buffer.from(local.stdout,'utf8');
    else {
      ensure(!gitDir,'Explicit object store lacks fixed qualification bytes');
      const response=await fetch(`https://raw.githubusercontent.com/${REPO}/${q.commit}/${path}`,{redirect:'error',signal:AbortSignal.timeout(15000)});
      ensure(response.ok,`Fixed qualification unavailable: ${path}: HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());
    }
    totalBytes+=bytes.length; ensure(totalBytes<=64*1024*1024,'Qualification read byte budget exceeded');
    ensure(bytes.length<=1048576 && gitBlob(bytes)===expected,`Fixed qualification blob mismatch: ${path}`);cache.set(key,bytes);return bytes;
  }
  for(const [id,q] of Object.entries(m.qualifications)) {
    const {entries,method}=await committedTree(root,q,gitDir);
    const publication={commit:q.evidenceCommit,tree:q.evidenceTree};
    const published=await committedTree(root,publication,gitDir);
    const evidenceBlobs=new Map(published.entries.filter(e=>e.type==='blob' && e.mode==='100644').map(e=>[e.path,e.sha]));
    const blobs=new Map(entries.filter(e=>e.type==='blob' && e.mode==='100644').map(e=>[e.path,e.sha]));
    async function declared(ref,runner=false) {ensure((runner?blobs:evidenceBlobs).get(ref.path)===ref.gitBlob,`Immutable qualification declaration mismatch: ${ref.path}`);return fixedBytes(runner?q:publication,ref.path,ref.gitBlob);}
    const receiptBytes=await declared(q.receipt), receipt=JSON.parse(receiptBytes);
    // Local historical files must retain their published identity, not merely a valid-looking shape.
    ensure((await readFile(join(root,q.receipt.path))).equals(receiptBytes),`Local receipt changed: ${q.receipt.path}`);
    if(q.kind==='legacy-runtime') {
      const sourceBytes=await declared(q.source), source=JSON.parse(sourceBytes), runner=await declared(q.runner,true);
      ensure((await readFile(join(root,q.source.path))).equals(sourceBytes),'Legacy source bytes changed');
      ensure(source.commit===q.commit && source.tree===q.tree,'Legacy fixed source mismatch');
      const selected=entries.filter(e=>e.type==='blob' && (/^(src\/|fixtures\/|test\/)/.test(e.path) || ['package.json','package-lock.json'].includes(e.path))).map(e=>({path:e.path,gitBlob:e.sha})).sort((a,b)=>a.path.localeCompare(b.path));
      ensure(stable(selected)===stable([...source.inputs].sort((a,b)=>a.path.localeCompare(b.path))),'Legacy input inventory differs from fixed tree');
      validateReceipt(receipt,m,source,sha(stable(source.inputs)),sha(runner));
    } else {
      const observed=validateScenarioReceipt(receipt,q.scenario), paths=new Set(observed.inputFiles.map(f=>f.path));
      for(const e of entries.filter(e=>e.type==='blob' && /^(src\/|fixtures\/)/.test(e.path))) ensure(paths.has(e.path),`Unqualified scenario executable input: ${e.path}`);
      // Read fixed public bytes only; never import or execute downloaded code. Bounded four-at-a-time reads.
      for(let start=0;start<observed.inputFiles.length;start+=4) await Promise.all(observed.inputFiles.slice(start,start+4).map(async f=>{
        ensure(blobs.has(f.path),`Missing fixed scenario input: ${f.path}`);
        ensure(sha(await fixedBytes(q,f.path,blobs.get(f.path)))===f.sha256,`Scenario input hash mismatch: ${f.path}`);
      }));
    }
    confirmations.push({id,commit:q.commit,evidenceCommit:q.evidenceCommit,method,receiptGitBlob:q.receipt.gitBlob,executedNow:false});
  }
  return confirmations;
}

async function main(args) {
  let mode = '--check', gitDir;
  if (args[0]?.startsWith('--') && ['--check', '--smoke', '--render'].includes(args[0])) mode = args.shift();
  if (args[0] === '--git-dir' && args.length === 2) { gitDir = args[1]; args.splice(0); }
  ensure(args.length === 0, 'Usage: node scripts/check-article-coverage.mjs [--check|--smoke|--render] [--git-dir READ_ONLY_OBJECT_STORE]');
  const m = await json(join(ROOT, MANIFEST)); validateManifest(m);
  const source = await json(join(ROOT, m.source));
  const versions = await json(join(ROOT, m.versions)); validateVersions(versions, m);
  // Validate both views before any write so a missing/malformed counterpart fails closed.
  const views = await readmeViews(ROOT, m, source, versions);
  if (mode === '--render') {
    for (const view of views) await writeFile(join(ROOT, view.path), view.expected);
    console.log('Rendered English and Chinese article-guide tables only; README entries checked; no verification claimed.'); return;
  }
  for (const view of views) ensure(view.expected === view.text, `${view.path} table drift; run --render`);
  if (m.schemaVersion === 3) {
    ensure(mode !== '--smoke', 'Schema 3 preserves immutable per-target receipts; no implicit historical re-execution');
    const qualifications = await checkQualifications(ROOT, m, gitDir);
    await confirmVersions(ROOT, versions, gitDir);
    console.log(JSON.stringify({status:'passed', mode, qualifications, executedOnThisInvocation:false, semanticStatus:'unreviewed'}, null, 2)); return;
  }
  const identity = await sourceIdentity(ROOT, source);
  const confirmation = await confirmCommit(ROOT, source, gitDir);
  const lineageConfirmation = await confirmVersions(ROOT, versions, gitDir);
  const receipt = mode === '--smoke' ? await smoke(ROOT, m, source, identity, confirmation) : await json(join(ROOT, m.receipt));
  validateReceipt(receipt, m, source, identity, sha(await readFile(fileURLToPath(import.meta.url))));
  console.log(JSON.stringify({ status: 'passed', mode, confirmation, lineageConfirmation, verifiedAt: source.commit, articles: m.articles.length, verified: m.articles.filter(a => a.status === 'verified').length, uniqueExecutedTargets: new Set(Object.values(receipt.results).map(r=>stable(r.target))).size, executionTime: receipt.executedAt, executedOnThisInvocation: mode === '--smoke', scope: 'Runtime only; original synthetic fixtures; no live/model-quality claim' }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
