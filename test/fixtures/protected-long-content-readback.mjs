import { createHash } from 'node:crypto';
import { openSession } from '../../src/session.mjs';
import { DOCUMENT_REVOCATION_PROFILE as profile } from '../../src/source.mjs';

const [directory, runId, expected] = process.argv.slice(2);
const store = await openSession({ directory, profile, readOnly: true });
try {
  const state = store.inspect(runId);
  let publication;
  try { publication = store.publication(runId); }
  catch (error) {
    if (expected !== 'revoked' || error.code !== 'DOCUMENT_REVOKED') throw error;
    process.stdout.write(JSON.stringify({ pid: process.pid, denied: error.code }) + '\n');
  }
  if (publication) {
    if (expected === 'revoked') throw new Error('Revoked publication became readable');
    const revisions = store.publicationRevisions(runId);
    const event = store.publicationEvent(runId);
    process.stdout.write(JSON.stringify({ pid: process.pid, status: state.status,
      bytes: Buffer.byteLength(publication.content.text),
      sha256: createHash('sha256').update(publication.content.text).digest('hex'),
      receipt: publication.receipt, revisions: revisions.length, eventPresent: !!event }) + '\n');
  }
} finally { store.close(); }
