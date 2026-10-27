import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const other = '3'.repeat(40);
test('backlinks: changing only the article pin does not manufacture or invalidate Runtime execution', async () => {
 const { validateReceipt } = await import('./check-article-coverage.mjs');
 const load = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
 const m = await load('docs/verification/article-coverage.json'), r = await load(m.receipt), s = await load(m.source);
 m.articleCatalog.commit = other;
 assert.doesNotThrow(() => validateReceipt(r, m, s, r.inputSha256, r.runnerSha256));
});
