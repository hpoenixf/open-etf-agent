import { readdir, lstat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { sha256, safeDirectory } from './tools.mjs';

async function readText(root, path, maxBytes) {
  const target = resolve(root, path); const rel = relative(root, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || await realpath(target) !== target) throw new Error('Unsafe resource path or symlink');
  const stat = await lstat(target);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error('Resource is not a file or exceeds size limit');
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const buffer = Buffer.alloc(maxBytes + 1); let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maxBytes) throw new Error('Resource exceeds size limit');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, total));
  } finally { await handle.close(); }
}
function metadata(text) {
  const match = /^---\r?\nname: ([a-z0-9][a-z0-9-]{0,63})\r?\ndescription: ([^\r\n]{1,240})\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error('Unsupported Skill frontmatter metadata; only name and description are supported');
  return { name: match[1], description: match[2] };
}
export async function createSkillCatalog({ root, maxBytes = 16384 }) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 65536) throw new Error('Invalid Skill size limit');
  root = await safeDirectory(root); const entries = new Map(); const names = new Set();
  for (const id of (await readdir(root)).sort()) {
    const stat = await lstat(join(root, id));
    if (stat.isSymbolicLink()) throw new Error('Unsafe Skill directory symlink');
    if (!stat.isDirectory()) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw new Error('Invalid Skill directory ID');
    const directory = await safeDirectory(join(root, id));
    const text = await readText(directory, 'SKILL.md', maxBytes); const meta = metadata(text);
    if (names.has(meta.name)) throw new Error('Duplicate Skill name'); names.add(meta.name);
    entries.set(id, { id, ...meta, directory });
  }
  function entry(id) { const e = entries.get(id); if (!e) throw new Error('Unknown Skill ID'); return e; }
  return {
    list: () => [...entries.values()].map(({ id, name, description }) => ({ id, name, description })),
    async read(id) {
      const e = entry(id); const text = await readText(e.directory, 'SKILL.md', maxBytes); const meta = metadata(text);
      if (meta.name !== e.name || meta.description !== e.description) throw new Error('Skill metadata changed since catalog discovery');
      return { id, name: e.name, text, sha256: sha256(text), version: 'sha256:' + sha256(text), mediaType: 'text/markdown; charset=utf-8' };
    },
    async resource(id, path) {
      if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\') || path.split('/').some(p => p === '..' || p === '.' || !p)) throw new Error('Unsafe resource path');
      const e = entry(id); const text = await readText(e.directory, path, maxBytes);
      return { id, resource: path, text, sha256: sha256(text), mediaType: 'text/plain; charset=utf-8' };
    }
  };
}
