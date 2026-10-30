import test from 'node:test';
import assert from 'node:assert/strict';
import { connectFixtureMcp } from '../src/mcp.mjs';
const args = { documentId: 'atlas-b', page: 1 };
async function rejectsConnection(mode, pattern) {
  let unexpected;
  try { await assert.rejects(async () => { unexpected = await connectFixtureMcp({ mode }); }, pattern); }
  finally { await unexpected?.close(); }
}
test('2.3 actual stdio child discovers paginated tools, reads and terminates', async () => {
  const session = await connectFixtureMcp();
  try {
    assert.ok(Number.isInteger(session.pid) && session.pid > 0, 'an actual child process must exist');
    assert.deepEqual(session.tools.map(t => t.name), ['read_page']);
    assert.equal(session.discoveredCount, 2, 'second discovery page must be consumed even though it grants no extra tool');
    const result = await session.call('read_page', args, { modelCallId: 'model-9' });
    assert.equal(result.version, 'B-2026-02'); assert.match(result.text, /300 rows/);
    assert.equal(result.mcp.modelCallId, 'model-9'); assert.ok(Number.isInteger(result.mcp.protocolRequestId));
    assert.notEqual(String(result.mcp.protocolRequestId), 'model-9');
    assert.equal(session.protocolEra, 'legacy');
  } finally { const closed = await session.close(); assert.equal(closed.closed, true); }
  assert.throws(() => process.kill(session.pid, 0), { code: 'ESRCH' });
});
test('2.3 discovery does not authorize non-allowlisted tools or extra args', async () => {
  const session = await connectFixtureMcp();
  try {
    await assert.rejects(session.call('not_allowed', {}, { modelCallId: 'bad' }), /allow|unknown/i);
    await assert.rejects(session.call('read_page', { ...args, path: '../secret' }, { modelCallId: 'bad-args' }), /argument|schema/i);
  } finally { await session.close(); }
});
test('2.3 duplicate names and nonterminating catalog pages reject cleanly', async () => {
  await rejectsConnection('duplicate', /duplicate/i);
  await rejectsConnection('endless-pages', /pagination|page/i);
});
test('2.3 stdout pollution is a protocol failure, not ignored success', async () => {
  await rejectsConnection('pollution', /protocol|parse|closed/i);
});
test('2.3 business errors and unsupported content never become successful sources', async () => {
  for (const mode of ['business-error', 'unsupported-content', 'bad-result', 'exit-on-call']) {
    const session = await connectFixtureMcp({ mode });
    try { await assert.rejects(session.call('read_page', args, { modelCallId: 'call' })); }
    finally { await session.close(); }
  }
});
test('2.3 acquired source page must match the requested page, not only its own hash', async () => {
  const session = await connectFixtureMcp({ mode: 'wrong-page' });
  try { await assert.rejects(session.call('read_page', args, { modelCallId: 'wrong-page-call' }), /requested|identity|page/i); }
  finally { await session.close(); }
});
test('2.3 an advertised schema incompatible with the local allowlist is rejected', async () => {
  await rejectsConnection('bad-schema', /schema/i);
});

test('2.3 active call cancellation closes the owned child', async () => {
  const session = await connectFixtureMcp({ mode: 'stall-call' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('active cancellation')), 50);
  try { await assert.rejects(session.call('read_page', args, { modelCallId: 'cancel-call', signal: controller.signal }), /cancel|abort/i); }
  finally { clearTimeout(timer); await session.close(); }
  assert.throws(() => process.kill(session.pid, 0), { code: 'ESRCH' });
});
test('2.3 pending call timeout closes the owned child', async () => {
  const session = await connectFixtureMcp({ mode: 'stall-call', timeoutMs: 800 });
  try { await assert.rejects(session.call('read_page', args, { modelCallId: 'timeout-call' }), /time.*out/i); }
  finally { await session.close(); }
  assert.throws(() => process.kill(session.pid, 0), { code: 'ESRCH' });
});
