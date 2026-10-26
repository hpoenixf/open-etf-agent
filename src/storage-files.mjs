import { lstat, realpath, open, link, unlink, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const fail = message => { throw new Error(message); };
export async function safeDirectory(directory) {
  const path = resolve(directory);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(path) !== path) fail('Unsafe directory or symlink');
  return path;
}
export async function ensureSafeDirectory(directory) {
  const path = resolve(directory);
  try { return await safeDirectory(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  // Verify every existing ancestor before making the first missing component.
  await ensureSafeDirectory(dirname(path));
  try { await mkdir(path, { mode: 0o700 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  return safeDirectory(path);
}
const checkSignal = signal => signal?.throwIfAborted();

// Link publishes a fully written temporary inode without overwriting a target.
// This is not a multi-file transaction: partial paths are explicit on failure.
export async function publishImmutable(directory, filename, bytes, signal) {
  await safeDirectory(directory); checkSignal(signal);
  const temp = join(directory, '.' + filename + '-' + randomUUID());
  const destination = join(directory, filename);
  let handle;
  try {
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null;
    checkSignal(signal); await safeDirectory(directory);
    await link(temp, destination);
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temp).catch(() => {});
  }
}

