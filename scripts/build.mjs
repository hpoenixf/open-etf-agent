import { mkdir, readdir, copyFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { safeDirectory } from '../src/tools.mjs';

await mkdir('dist', { recursive: true }); await safeDirectory('dist');
for (const folder of ['src', 'fixtures']) {
  await mkdir(join('dist', folder), { recursive: true }); await safeDirectory(join('dist', folder));
  for (const filename of await readdir(folder)) {
    const source = join(folder, filename); const target = join('dist', folder, filename);
    if (!(await lstat(source)).isFile()) throw new Error('Build accepts ordinary source files only');
    try { if ((await lstat(target)).isSymbolicLink()) throw new Error('Refuse symlink build target'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (filename.endsWith('.mjs')) {
      const checked = spawnSync(process.execPath, ['--check', source], { encoding: 'utf8', timeout: 5000 });
      if (checked.status !== 0) throw new Error(`Syntax check failed: ${source}`);
    }
    await copyFile(source, target);
  }
}
process.stdout.write(JSON.stringify({ build: 'syntax-checked native ESM copy', directory: resolve('dist'), typescript: false }) + '\n');
