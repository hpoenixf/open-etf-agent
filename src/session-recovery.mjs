import { DatabaseSync } from 'node:sqlite';
import { constants, lstatSync, fstatSync, openSync, closeSync, readSync, writeSync, fsyncSync, mkdtempSync, mkdirSync, rmSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const MAX_FILE = 64 * 1048576, MAX_TOTAL = 96 * 1048576, CHUNK = 65536;
const MAGIC = Buffer.from('d9d505f920a163d7', 'hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const same = (a, b) => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].every(key => a[key] === b[key]);
function file(path, optional = false) {
 try {
  const s = lstatSync(path, { bigint: true });
  if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1n) fail('UNSAFE_SESSION_FILE');
  return s;
 } catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
}
function directory(path) {
 const s = lstatSync(path);
 if (!s.isDirectory() || s.isSymbolicLink() || realpathSync(path) !== path) fail('UNSAFE_SESSION_DIRECTORY');
}

// Only SQLITE_READONLY_ROLLBACK callers enter here. Copy validation admits a
// schema, not a lock: trusted callers must not concurrently replace/restore the
// path or change its schema. Compatible Session writers remain SQLite-owned.
export function prepareSessionRecovery({ filename, validateSchema }) {
 if (process.versions.sqlite !== '3.53.4') fail('SESSION_RECOVERY_UNSUPPORTED_SQLITE');
 const sourceDirectory = dirname(filename); directory(sourceDirectory); directory(dirname(sourceDirectory));
 const started = performance.now();
 const bounded = () => { if (performance.now() - started > 5000) fail('SESSION_RECOVERY_SCOPE_EXCEEDED'); };
 const paths = [filename, filename + '-journal'];
 const absent = () => { for (const suffix of ['-wal', '-shm']) if (file(filename + suffix, true)) fail('SESSION_RECOVERY_UNSUPPORTED_SIDECAR'); };
 absent();
 const initial = paths.map(path => file(path));
 if (initial.some(s => s.size > BigInt(MAX_FILE)) || initial.reduce((n, s) => n + s.size, 0n) > BigInt(MAX_TOTAL)) fail('SESSION_RECOVERY_SCOPE_EXCEEDED');
 let workspace, originalStarted = false, originalVerified = false;
 const descriptors = [];
 const cleanup = () => { if (workspace) { rmSync(workspace, { recursive: true }); workspace = undefined; } };
 try {
  for (let i = 0; i < paths.length; i++) {
   const fd = openSync(paths[i], constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0)); descriptors.push(fd);
   if (!same(initial[i], fstatSync(fd, { bigint: true })) || !same(initial[i], file(paths[i]))) fail('SESSION_RECOVERY_SOURCE_CHANGED');
  }
  // This is a bounded resource/external-reference guard, never schema proof.
  const header = Buffer.alloc(28), tail = Buffer.alloc(8), journalSize = Number(initial[1].size);
  if (journalSize < 512 || readSync(descriptors[1], header, 0, header.length, 0) !== header.length || !header.subarray(0, 8).equals(MAGIC)) fail('SESSION_RECOVERY_UNSUPPORTED_JOURNAL');
  if (readSync(descriptors[1], tail, 0, 8, journalSize - 8) !== 8) fail('SESSION_RECOVERY_SOURCE_CHANGED');
  // SQLite 3.53.4 readSuperJournal requires this terminal magic. Conservatively
  // refuse even a coincidental suffix; do not parse or follow an external path.
  if (tail.equals(MAGIC)) fail('SESSION_RECOVERY_SUPER_JOURNAL_REFUSED');
  const pages = header.readUInt32BE(16), sector = header.readUInt32BE(20), page = header.readUInt32BE(24);
  const power = n => n >= 512 && n <= 65536 && (n & (n - 1)) === 0;
  if (!power(page) || !power(sector) || journalSize < sector || pages === 0) fail('SESSION_RECOVERY_UNSUPPORTED_JOURNAL');
  if (pages * page > MAX_FILE) fail('SESSION_RECOVERY_SCOPE_EXCEEDED');
  bounded();
  workspace = mkdtempSync(join(dirname(sourceDirectory), '.session-admission-'));
  const pristine = join(workspace, 'pristine'), candidate = join(workspace, 'candidate');
  mkdirSync(pristine, { mode: 0o700 }); mkdirSync(candidate, { mode: 0o700 });
  const hashes = [];
  for (let i = 0; i < paths.length; i++) {
   const leaf = i ? 'session.sqlite-journal' : 'session.sqlite', outputs = [];
   try {
    outputs.push(openSync(join(pristine, leaf), 'wx', 0o600)); outputs.push(openSync(join(candidate, leaf), 'wx', 0o600));
    const hash = createHash('sha256'), buffer = Buffer.alloc(CHUNK), size = Number(initial[i].size);
    for (let offset = 0; offset < size;) {
     bounded(); const n = readSync(descriptors[i], buffer, 0, Math.min(buffer.length, size - offset), offset);
     if (!n) fail('SESSION_RECOVERY_SOURCE_CHANGED');
     hash.update(buffer.subarray(0, n));
     for (const out of outputs) { let done = 0; while (done < n) { const written = writeSync(out, buffer, done, n - done); if (!written) fail('SESSION_RECOVERY_COPY_FAILED'); done += written; } }
     offset += n;
    }
    if (!same(initial[i], fstatSync(descriptors[i], { bigint: true })) || !same(initial[i], file(paths[i]))) fail('SESSION_RECOVERY_SOURCE_CHANGED');
    hashes.push(hash.digest('hex')); for (const out of outputs) fsyncSync(out);
   } finally { for (const out of outputs) closeSync(out); }
  }
  // All original descriptors close before SQLite opens any connection. POSIX
  // SQLite locks must not be disturbed by closing another fd mid-transaction.
  for (const fd of descriptors.splice(0)) closeSync(fd);
  bounded();
  const copy = new DatabaseSync(join(candidate, 'session.sqlite'));
  try { validateSchema(copy); } finally { copy.close(); }
  bounded();
  function assertCurrent() {
   bounded(); directory(sourceDirectory); absent();
   for (let i = 0; i < paths.length; i++) {
    const before = file(paths[i]); if (!same(initial[i], before)) fail('SESSION_RECOVERY_SOURCE_CHANGED');
    const fd = openSync(paths[i], constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
     if (!same(before, fstatSync(fd, { bigint: true }))) fail('SESSION_RECOVERY_SOURCE_CHANGED');
     const hash = createHash('sha256'), buffer = Buffer.alloc(CHUNK), size = Number(before.size);
     for (let offset = 0; offset < size;) { bounded(); const n = readSync(fd, buffer, 0, Math.min(buffer.length, size - offset), offset); if (!n) fail('SESSION_RECOVERY_SOURCE_CHANGED'); hash.update(buffer.subarray(0, n)); offset += n; }
     if (hash.digest('hex') !== hashes[i] || !same(before, fstatSync(fd, { bigint: true })) || !same(before, file(paths[i]))) fail('SESSION_RECOVERY_SOURCE_CHANGED');
    } finally { closeSync(fd); }
   }
   absent(); bounded();
  }
  return {
   assertCurrent,
   originalStarting() { originalStarted = true; },
   complete() { originalVerified = true; cleanup(); },
   failed(error) {
    if (!originalStarted) { cleanup(); return error; }
    const code = originalVerified ? 'SESSION_RECOVERY_CLEANUP_FAILED' : 'SESSION_RECOVERY_FAILED';
    return Object.assign(new Error(code, { cause: error }), { code, recoveryPhase: originalVerified ? 'cleanup' : 'original-recovery', recoveryVerified: originalVerified, recoveryMayHaveEffects: true, recoveryCaptureDirectory: pristine, recoveryCaptureCompleteness: originalVerified ? 'unknown-after-cleanup-failure' : 'preserved' });
   }
  };
 } catch (error) {
  try { cleanup(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'SESSION_RECOVERY_ADMISSION_FAILED'); }
  throw error;
 } finally { for (const fd of descriptors) closeSync(fd); }
}
