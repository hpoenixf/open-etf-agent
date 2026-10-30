import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { openSession } from '../src/session.mjs';
import { run } from '../src/runtime.mjs';
import { startReader } from '../src/reader.mjs';
import { DOCUMENT_REVOCATION_PROFILE as profile } from '../src/source.mjs';
import { initialize, options } from './protected-runtime-fixture.mjs';

const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('protected teaching capacity keeps cold publication and Reader revocation gates', async () => {
  await mkdir('test-output', { recursive: true });
  const directory = await mkdtemp(resolve('test-output/protected-long-content-'));
  const store = await openSession({ directory, profile });
  let reader;
  try {
    const authority = await initialize(store);
    // JSON escaping multiplies these valid UTF-8 bytes; this exercises the
    // complete checkpoint envelope, rather than just a large report file.
    const text = '\u0001'.repeat(256 * 1024);
    let requests = 0;
    const gateway = { mode: 'fixture', async next(request) {
      requests++;
      if (requests === 1) return { kind: 'calls', calls: [{ id: 'read', name: 'read_page', arguments: { documentId: 'atlas-a', page: 1 } }] };
      if (requests === 2) {
        const source = request.messages.find(message => message.role === 'tool').result.value;
        return { kind: 'calls', calls: [{ id: 'report', name: 'save_report', arguments: { text, sourceIds: [source.sourceId] } }] };
      }
      return { kind: 'final', text };
    } };
    const outcome = await run(options(store, join(directory, 'runs'), gateway));
    assert.equal(outcome.status, 'completed', outcome.code);
    assert.equal(requests, 3);
    const publication = store.publication(outcome.runId);
    assert.equal(publication.content.text, text);
    const output = store.protectedOutput(outcome.runId);
    const report = await readFile(join(outcome.directory, 'report.md'));
    assert.equal(report.subarray(0, Buffer.byteLength(text)).toString('utf8'), text);
    const child = fileURLToPath(new URL('./fixtures/protected-long-content-readback.mjs', import.meta.url));
    const cold = async expected => {
      const before = hash(await readFile(join(directory, 'session.sqlite')));
      const { stdout } = await execute(process.execPath, ['--max-old-space-size=256', child, directory, outcome.runId, expected], { timeout: 10000, maxBuffer: 1048576 });
      assert.equal(hash(await readFile(join(directory, 'session.sqlite'))), before);
      return JSON.parse(stdout);
    };
    const readback = await cold('allowed');
    assert.notEqual(readback.pid, process.pid);
    assert.equal(readback.sha256, hash(text));
    assert.deepEqual(readback.receipt, publication.receipt);
    assert.equal(readback.revisions, 1);
    assert.equal(readback.eventPresent, true);
    reader = await startReader({ directory: outcome.directory, protectedContext: { store, runId: outcome.runId } });
    const url = reader.origin + '/artifacts/' + output.reportDescriptor.artifactId;
    const allowed = await fetch(url);
    assert.equal(allowed.status, 200);
    assert.equal(hash(Buffer.from(await allowed.arrayBuffer())), hash(report));
    store.revokeDocument({ authorityId: authority.authorityId, libraryId: authority.libraryId, documentId: 'atlas-a', expectedRevision: 1 });
    assert.equal((await cold('revoked')).denied, 'DOCUMENT_REVOKED');
    for (const method of ['GET', 'HEAD']) {
      const denied = await fetch(url, { method });
      assert.equal(denied.status, 404);
      assert.equal((await denied.arrayBuffer()).byteLength, 0);
    }
    assert.equal(hash(await readFile(join(outcome.directory, 'report.md'))), hash(report));
  } finally { await reader?.close(); store.close(); }
});
