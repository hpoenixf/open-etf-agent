import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openSession } from '../../src/session.mjs';
import { openArtifactStore } from '../../src/artifacts.mjs';

const [kind, directory, identity] = process.argv.slice(2);
const hash = value => createHash('sha256').update(value).digest('hex');
if (kind === 'publication') {
  const before = hash(await readFile(join(directory, 'session.sqlite')));
  // Publication methods are on the existing regular Session facade. This process
  // calls only read/confirm methods, never creates a Run or takes an execution claim.
  const store = await openSession({ directory }); let result;
  try {
    const run = store.inspect(identity); const published = store.publication(identity);
    const confirmed = store.confirmPublication(published.receipt);
    result = { pid: process.pid, status: run.status, receipt: confirmed.receipt,
      bytes: Buffer.byteLength(confirmed.content.text), sha256: hash(confirmed.content.text) };
  } finally { store.close(); }
  const after = hash(await readFile(join(directory, 'session.sqlite')));
  if (before !== after) throw new Error('Synthetic readback changed database bytes');
  process.stdout.write(JSON.stringify({ ...result, databaseBytesUnchanged: true }) + '\n');
} else if (kind === 'artifact') {
  const store = await openArtifactStore({ directory, readOnly: true }); const artifact = await store.read(identity);
  process.stdout.write(JSON.stringify({ pid: process.pid, artifactId: artifact.artifactId, bytes: artifact.bytes.length, sha256: hash(artifact.bytes) }) + '\n');
} else throw new Error('Unsupported synthetic readback mode');
