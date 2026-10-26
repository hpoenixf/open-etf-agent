import { mkdir, readdir, copyFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { safeDirectory } from '../src/tools.mjs';

async function copyTree(folder, targetDirectory) {
  await mkdir(targetDirectory, { recursive: true }); await safeDirectory(targetDirectory);
  for (const filename of await readdir(folder)) {
    const source = join(folder, filename); const target = join(targetDirectory, filename);
    const stat = await lstat(source);
    if (stat.isSymbolicLink()) throw new Error('Build refuses symlink source');
    try { if ((await lstat(target)).isSymbolicLink()) throw new Error('Refuse symlink build target'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (stat.isDirectory()) { await copyTree(source, target); continue; }
    if (!stat.isFile()) throw new Error('Build accepts ordinary files only');
    if (filename.endsWith('.mjs')) {
      const checked = spawnSync(process.execPath, ['--check', source], { encoding: 'utf8', timeout: 5000 });
      if (checked.status !== 0) throw new Error(`Syntax check failed: ${source}`);
    }
    await copyFile(source, target);
  }
}
await mkdir('dist', { recursive: true }); await safeDirectory('dist');
for (const folder of ['src', 'fixtures']) await copyTree(folder, join('dist', folder));
process.stdout.write(JSON.stringify({ build: 'syntax-checked native ESM copy', directory: resolve('dist'), typescript: false }) + '\n');
