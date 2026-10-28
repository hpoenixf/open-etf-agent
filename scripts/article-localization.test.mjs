import test from 'node:test';
import { createHash } from 'node:crypto';
import { verifyLocalizationBodies } from './check-article-backlinks.mjs';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { validateLocalization, renderTable, updateReadmeTable, readmeViews, validateReceipt, validateReadmeEntry } from './check-article-coverage.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = async path => JSON.parse(await readFile(join(root, path), 'utf8'));
const m = await load('docs/verification/article-coverage.json');
const versions = await load('versions.json');
const locale = await load('docs/verification/article-coverage.en.json');
const clone = value => structuredClone(value);

test('localization: exact article set, display fields only, fixed source identity', () => {
  validateLocalization(locale, m);
  for (const mutate of [
    l => { delete l.articles[m.articles[0].slug]; },
    l => { l.articles.extra = l.articles[m.articles[0].slug]; },
    l => { l.articles[m.articles[0].slug].status = 'verified'; },
    l => { l.articles[m.articles[0].slug].target = 'invented'; },
    l => { l.articles[m.articles[0].slug].since = '0.1'; },
    l => { l.verifiedAt = 'a'.repeat(40); },
    l => { l.articleSource = {commit:'main'}; },
    l => { l.articles[m.articles[0].slug].title = '[misleading](https://example.test)'; },
    l => { l.articles[m.articles[0].slug].scope = 'a | new column'; }
  ]) {
    const bad = clone(locale); mutate(bad); assert.throws(() => validateLocalization(bad, m));
  }
});

test('localization: English routes require an available edition, otherwise explicit Chinese original', () => {
  // Keep the fallback contract test even after every currently registered article is translated.
  const l = clone(locale), slug = m.articles[0].slug;
  l.articles[slug].englishAvailable = false;
  const fallback = renderTable(m, m.verifiedAt, versions, 'en', l);
  const row = fallback.split('\n').find(line => line.includes('/articles/' + slug + ')'));
  assert.ok(row.includes('https://hpoenixf.com/eff-agent-article/articles/' + slug + ') (Chinese original)'));
  assert.ok(!row.includes('/en/articles/' + slug));
  l.articles[slug].englishAvailable = true;
  const translated = renderTable(m, m.verifiedAt, versions, 'en', l);
  assert.ok(translated.includes('https://hpoenixf.com/eff-agent-article/en/articles/' + slug + ')'));
  assert.throws(() => renderTable(m, m.verifiedAt, versions, 'fr', l), /Unsupported/);
});

test('localization: both languages preserve all since, fixed execution pins, cases and statuses', () => {
  const snapshot = JSON.stringify({m, versions, locale});
  const zh = renderTable(m, m.verifiedAt, versions);
  const en = renderTable(m, m.verifiedAt, versions, 'en', locale);
  const rows = table => table.split('\n').filter(line => line.startsWith('| ['));
  assert.equal(rows(zh).length, 31); assert.equal(rows(en).length, 31);
  rows(zh).forEach((line, i) => {
    const a = line.split(' | '), b = rows(en)[i].split(' | ');
    assert.equal(a[1], b[1]); // since
    assert.equal(a[2].split('<br>')[0], b[2].split('<br>')[0]); // verifiedAt + exact case
    assert.equal(a[3].replace('无公开对应', 'no public counterpart'), b[3]);
  });
  assert.equal(JSON.stringify({m, versions, locale}), snapshot);
});

test('localization: existing Chinese render API remains unchanged', async () => {
  const zh = await readFile(join(root, 'docs/articles-and-code.zh-CN.md'), 'utf8');
  assert.equal(updateReadmeTable(zh, renderTable(m, m.verifiedAt, versions)), zh);
  assert.match(zh, /\[English\]\(articles-and-code\.md\)/);
  const en = await readFile(join(root, 'README.md'), 'utf8');
  assert.match(en, /README\.zh-CN\.md">简体中文/);
});

test('localization: both checked standalone guide views are current, marker corruption fails closed', async () => {
  const views = await readmeViews(root, m, {commit:m.verifiedAt}, versions);
  assert.deepEqual(views.map(v => v.path), ['docs/articles-and-code.md', 'docs/articles-and-code.zh-CN.md']);
  for (const v of views) {
    assert.equal(v.expected, v.text, v.path);
    assert.throws(() => updateReadmeTable(v.text + '\n<!-- article-coverage:start -->', 'x'), /duplicate/);
    assert.throws(() => updateReadmeTable(v.text.replace('<!-- article-coverage:end -->',''), 'x'), /Missing/);
  }
  assert.throws(() => updateReadmeTable('<!-- article-coverage:end --><!-- article-coverage:start -->', 'x'), /reversed/);
});

test('localization: missing Chinese guide counterpart is not silently accepted', async () => {
  await mkdir(join(root, 'test-output'), {recursive:true});
  const temporary = await mkdtemp(join(root, 'test-output', 'localization-'));
  await mkdir(join(temporary, 'docs/verification'), {recursive:true});
  await writeFile(join(temporary, 'docs/verification/article-coverage.en.json'), JSON.stringify(locale));
  await writeFile(join(temporary, 'README.md'), '[Guide](docs/articles-and-code.md)');
  await writeFile(join(temporary, 'README.zh-CN.md'), '[指南](docs/articles-and-code.zh-CN.md)');
  await writeFile(join(temporary, 'docs/articles-and-code.md'), '<!-- article-coverage:start -->\n<!-- article-coverage:end -->');
  await assert.rejects(readmeViews(temporary, m, {commit:m.verifiedAt}, versions), /ENOENT/);
});

test('localization: presentation cannot qualify stale Runtime receipts', async () => {
  const receipt = await load(m.receipt);
  const source = await load(m.source);
  const display = clone(locale); display.articles[m.articles[0].slug].title += ' — presentation only';
  renderTable(m, source.commit, versions, 'en', display);
  assert.throws(() => validateReceipt(receipt, m, source, receipt.inputSha256, '0'.repeat(64)), /Stale receipt/);
});

const syntheticBodies = () => {
  const display = clone(locale), files = new Map([['book.en.mjs', 'export const englishArticleSlugs = []']]);
  for (const row of m.articles) {
    const text = 'Synthetic original: ' + row.slug + '\n';
    const body = Buffer.from(text), blob = createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest('hex');
    display.articles[row.slug].englishAvailable = false;
    display.articles[row.slug].articleBlob = blob;
    files.set('articles/' + row.slug + '.md', text);
  }
  const read = async path => { if (!files.has(path)) throw new Error('missing body: ' + path); return files.get(path); };
  return {display, files, read};
};

test('localization: catalog registration, not an English title, controls routing', async () => {
  const {display, read} = syntheticBodies();
  assert.equal((await verifyLocalizationBodies(display, m, read)).chineseOriginals, 31);
  display.articles[m.articles[0].slug].englishAvailable = true;
  await assert.rejects(verifyLocalizationBodies(display, m, read), /language availability drift/);
});
test('localization: changed body bytes fail even when catalog registration stays valid', async () => {
  const {display, files, read} = syntheticBodies();
  files.set('articles/' + m.articles[0].slug + '.md', 'Changed original.');
  await assert.rejects(verifyLocalizationBodies(display, m, read), /body identity drift/);
});
test('localization: a registered but absent English body cannot fall back silently', async () => {
  const {display, files, read} = syntheticBodies(), slug = m.articles[0].slug;
  display.articles[slug].englishAvailable = true;
  files.set('book.en.mjs', 'export const englishArticleSlugs = ' + JSON.stringify([slug]));
  await assert.rejects(verifyLocalizationBodies(display, m, read), /missing body.*en\/articles/);
});
test('localization: unavailable or denied reads remain failures, never empty catalog success', async () => {
  const {display} = syntheticBodies();
  await assert.rejects(verifyLocalizationBodies(display, m, async () => { throw new Error('synthetic read denied'); }), /read denied/);
});


test('localization: README is a visible guide entry, never a second generated-table owner', () => {
  const path = 'docs/articles-and-code.md', link = '[Read the guide](' + path + ')';
  assert.doesNotThrow(() => validateReadmeEntry(link, path));
  for (const invalid of ['[Wrong](docs/other.md)', '<!-- ' + link + ' -->', '```md\n' + link + '\n```', '`' + link + '`', '    ' + link, '!' + link, '\\' + link]) {
    assert.throws(() => validateReadmeEntry(invalid, path), /visible article-guide link/);
  }
  assert.throws(() => validateReadmeEntry(link + '\n<!-- article-coverage:start --><!-- article-coverage:end -->', path), /not embed/);
});
test('localization: English and Chinese README entries resolve to their own standalone guides', async () => {
  for (const [entry, guide] of [['README.md','docs/articles-and-code.md'],['README.zh-CN.md','docs/articles-and-code.zh-CN.md']]) {
    const text = await readFile(join(root,entry),'utf8');
    validateReadmeEntry(text,guide);
    assert.ok(!text.includes('<!-- article-coverage:start -->'));
    assert.ok((await readFile(join(root,guide),'utf8')).includes('<!-- article-coverage:start -->'));
  }
});
