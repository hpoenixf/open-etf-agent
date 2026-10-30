import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, symlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createSkillCatalog } from '../src/skills.mjs';
async function root() { await mkdir('test-output', { recursive: true }); return mkdtemp(resolve('test-output/skill-')); }
const text = '---\nname: method\ndescription: A synthetic method.\n---\n\nRead both versions; do not execute scripts.\n';
test('2.1 catalog exposes metadata only; explicit read returns exact snapshot/hash', async () => {
  const r = await root(); await mkdir(join(r, 'method')); await writeFile(join(r, 'method/SKILL.md'), text);
  const catalog = await createSkillCatalog({ root: r });
  assert.deepEqual(catalog.list(), [{ id: 'method', name: 'method', description: 'A synthetic method.' }]);
  assert.equal(catalog.list()[0].text, undefined);
  const loaded = await catalog.read('method'); assert.equal(loaded.text, text);
  assert.equal(loaded.sha256, createHash('sha256').update(text).digest('hex'));
});
test('2.1 explicit resource read stays inside selected skill', async () => {
  const r = await root(); await mkdir(join(r, 'method')); await writeFile(join(r, 'method/SKILL.md'), text); await writeFile(join(r, 'method/check.txt'), 'original checklist');
  const catalog = await createSkillCatalog({ root: r });
  assert.equal((await catalog.resource('method', 'check.txt')).text, 'original checklist');
  for (const path of ['../secret', '/etc/passwd', 'sub/../../secret', 'a\\b']) await assert.rejects(catalog.resource('method', path));
  await assert.rejects(catalog.read('missing'));
});
test('2.1 symlink resources and oversized bodies are refused', async () => {
  const r = await root(); await mkdir(join(r, 'method')); await writeFile(join(r, 'method/SKILL.md'), text); await writeFile(join(r, 'secret.txt'), 'outside skill'); await symlink(join(r, 'secret.txt'), join(r, 'method/link.txt'));
  const catalog = await createSkillCatalog({ root: r, maxBytes: 128 });
  await assert.rejects(catalog.resource('method', 'link.txt'), /path|symlink/i);
  await writeFile(join(r, 'method/big.txt'), 'x'.repeat(129)); await assert.rejects(catalog.resource('method', 'big.txt'), /large|limit/i);
});
test('2.1 malformed metadata and duplicate names cannot enter catalog', async () => {
  const r = await root(); await mkdir(join(r, 'a')); await writeFile(join(r, 'a/SKILL.md'), '---\nname: x\nscript: run\n---\nbody');
  await assert.rejects(createSkillCatalog({ root: r }), /metadata|frontmatter/i);
  await writeFile(join(r, 'a/SKILL.md'), text); await mkdir(join(r, 'b')); await writeFile(join(r, 'b/SKILL.md'), text);
  await assert.rejects(createSkillCatalog({ root: r }), /duplicate/i);
});
