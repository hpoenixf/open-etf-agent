import { lstat, realpath, open, link, unlink, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
const fail = message => { throw new Error(message); };
// Only called after this module's own mkdir/link operation failed. Lost-code
// fallback accepts the exact native message for that operation and its paths,
// never an arbitrary message containing an errno. Caller still verifies state.
function existingAt(error, { syscall, path, dest }) {
  const expected = syscall === 'link'
    ? `EEXIST: file already exists, link '${path}' -> '${dest}'`
    : `EEXIST: file already exists, mkdir '${path}'`;
  const seen = new Set();
  for (let depth = 0; error && typeof error === 'object' && depth < 8; depth++) {
    if (seen.has(error) || ['AbortError', 'TimeoutError'].includes(error.name)) return false;
    seen.add(error);
    if (error.code !== undefined) {
      return error.code === 'EEXIST'
        && (error.syscall === undefined || error.syscall === syscall)
        && (error.path === undefined || error.path === path)
        && (error.dest === undefined || error.dest === dest);
    }
    if (error.message === expected) return true;
    error = error.cause;
  }
  return false;
}
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
  catch (error) { if (!existingAt(error, { syscall: 'mkdir', path })) throw error; }
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
    try { await link(temp, destination); }
    catch (error) {
      checkSignal(signal);
      if (!existingAt(error, { syscall: 'link', path: temp, dest: destination })) {
        if (error?.code === 'EEXIST') throw Object.assign(new Error('Filesystem error identity mismatch', { cause: error }), { code: 'FILESYSTEM_ERROR_IDENTITY_MISMATCH' });
        throw error;
      }
      if (error?.code === 'EEXIST') throw error;
      throw Object.assign(new Error('EEXIST: immutable destination already exists', { cause: error }), { code: 'EEXIST' });
    }
  } finally {
    await handle?.close().catch(() => {});
    await unlink(temp).catch(() => {});
  }
}
