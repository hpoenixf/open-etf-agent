import { open, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { openMemoryLibrary } from './memory.mjs';
import { createMemoryBindings } from './memory-tools.mjs';
import { safeDirectory } from './storage-files.mjs';
import { sha256 } from './source.mjs';

const schemaVersion = 'durable-memory@1';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = /^[a-f0-9]{64}$/;
const token = /^[A-Za-z0-9_-]{1,100}$/;
const operations = { saved: 'save', revised: 'revise', forgotten: 'forget' };
const fail = message => { throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');

async function readJSON(directory, name, limit) {
  await safeDirectory(directory);
  const handle = await open(join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) fail('Unsafe or oversized Memory recovery record');
    const bytes = Buffer.alloc(limit + 1); let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset > limit) fail('Oversized Memory recovery record');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset)));
  } finally { await handle.close(); }
}

function selectedIntents(intents, libraryId) {
  if (!Array.isArray(intents) || intents.length > 16) fail('Invalid selected Memory intents');
  const seen = new Set();
  return intents.map(value => {
    const keys = ['explicit', 'libraryId', 'operation', 'intentId', 'origin'];
    if (value?.operation !== 'forget') keys.push('approvedTextHash');
    if (value?.operation !== 'save') keys.push('entryId', 'expectedRevision');
    if (!exact(value, keys) || value.explicit !== true || value.libraryId !== libraryId || !['save', 'revise', 'forget'].includes(value.operation) || !token.test(value.intentId) || !token.test(value.origin) || seen.has(value.intentId)) fail('Invalid selected Memory intent identity');
    if (value.operation !== 'forget' && !hash.test(value.approvedTextHash)) fail('Invalid selected Memory content identity');
    if (value.operation !== 'save' && (!uuid.test(value.entryId) || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 1)) fail('Invalid selected Memory revision identity');
    seen.add(value.intentId);
    // Explicit ordering makes the authority digest independent of object insertion order.
    return Object.fromEntries(keys.map(key => [key, value[key]]));
  }).sort((a, b) => a.intentId < b.intentId ? -1 : a.intentId > b.intentId ? 1 : 0);
}

// This adapter owns a write handle only during one original Memory operation. It
// neither repairs a prior writer lock nor invents a successful mid-write result.
export async function openDurableMemory({ directory, intents = [] } = {}) {
  if (typeof directory !== 'string' || !directory || !Array.isArray(intents) || intents.length > 16) fail('Explicit Memory directory and bounded intents required');
  let initial;
  try { initial = await openMemoryLibrary({ directory }); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    initial = await openMemoryLibrary({ directory, writable: true });
  }
  const libraryId = initial.libraryId;
  await initial.close();
  directory = await safeDirectory(directory);
  const approved = selectedIntents(intents, libraryId);
  const intentDigest = sha256(JSON.stringify(approved));

  async function operation(method, args) {
    const writable = ['save', 'revise', 'forget'].includes(method);
    const library = await openMemoryLibrary({ directory, writable });
    let result; let error;
    try {
      if (library.libraryId !== libraryId) fail('Memory recovery library identity changed');
      result = await library[method](...args);
    } catch (caught) { error = caught; }
    try { await library.close(); }
    catch {
      if (!error) error = Object.assign(new Error('Memory owner close failed'), { code: 'MEMORY_OWNER_CLOSE_FAILED' });
      error.cleanupFailed = true;
      if (result?.kind === 'memory-write-receipt') error.memoryEffect = { kind: 'memory-partial-effect', libraryId, intentId: result.intentId, entryId: result.id, revision: result.revision, intentConsumed: true, revisionPublished: true };
    }
    if (error) throw error;
    return result;
  }
  const facade = { libraryId };
  for (const method of ['list', 'search', 'read', 'state', 'save', 'revise', 'forget']) facade[method] = (...args) => operation(method, args);
  Object.freeze(facade);

  async function state(ref) {
    if (object(ref)) {
      if (ref.libraryId !== libraryId) fail('Memory recovery state library scope mismatch');
      ref = ref.id;
    }
    return facade.state(ref);
  }

  async function verifyReceipt(input) {
    const keys = ['kind', 'libraryId', 'id', 'revision', 'sha256', 'operation', 'intentId', 'recordHash'];
    if (!exact(input, keys) || input.kind !== 'memory-write-receipt' || input.libraryId !== libraryId || !uuid.test(input.id) || !Number.isSafeInteger(input.revision) || input.revision < 1 || !Object.hasOwn(operations, input.operation) || !token.test(input.intentId) || !hash.test(input.recordHash) || (input.operation === 'forgotten' ? input.sha256 !== null : !hash.test(input.sha256))) fail('Invalid Memory recovery receipt identity');
    const receipt = structuredClone(input);
    const operationName = operations[receipt.operation];
    const current = await facade.state(receipt.id);
    if (current.revision < receipt.revision || (current.revision === receipt.revision && (current.recordHash !== receipt.recordHash || current.sha256 !== receipt.sha256 || current.active !== (operationName !== 'forget')))) fail('Memory receipt revision is not committed in current index');
    const records = await safeDirectory(join(directory, 'entries', receipt.id));
    const record = await readJSON(records, receipt.revision + '.json', 16384);
    const recordKeys = ['kind', 'libraryId', 'id', 'revision', 'provenance', ...(operationName === 'forget' ? [] : ['text', 'sha256'])];
    if (!exact(record, recordKeys) || sha256(JSON.stringify(record)) !== receipt.recordHash || record.kind !== (operationName === 'forget' ? 'memory-tombstone' : 'memory-entry') || record.libraryId !== libraryId || record.id !== receipt.id || record.revision !== receipt.revision || !exact(record.provenance, ['intentId', 'origin', 'operation']) || record.provenance.intentId !== receipt.intentId || record.provenance.operation !== operationName || !token.test(record.provenance.origin)) fail('Memory recovery record hash or receipt identity mismatch');
    if (operationName !== 'forget' && (typeof record.text !== 'string' || !record.text.trim() || Buffer.byteLength(record.text) > 8000 || sha256(record.text) !== receipt.sha256 || record.sha256 !== receipt.sha256)) fail('Memory recovery content hash mismatch');
    const reservation = await readJSON(join(directory, 'intents'), sha256(receipt.intentId) + '.json', 16384);
    if (!exact(reservation, ['libraryId', 'intent']) || reservation.libraryId !== libraryId) fail('Memory recovery intent library mismatch');
    const [intent] = selectedIntents([reservation.intent], libraryId);
    if (intent.intentId !== receipt.intentId || intent.operation !== operationName || intent.origin !== record.provenance.origin || (operationName !== 'forget' && intent.approvedTextHash !== receipt.sha256) || (operationName === 'save' ? receipt.revision !== 1 : intent.entryId !== receipt.id || intent.expectedRevision + 1 !== receipt.revision)) fail('Memory recovery receipt intent mismatch');
    // Return only the original acknowledgement, never a historical text payload.
    return receipt;
  }
  const extensions = createMemoryBindings({ library: facade, intents: approved }).map(binding => Object.freeze(binding.memoryEffect ? { ...binding, verifyResult: verifyReceipt } : binding));
  return Object.freeze({ schemaVersion, libraryId, intentDigest, binding: Object.freeze({ schemaVersion, libraryId }), extensions: Object.freeze(extensions), state, verifyReceipt });
}
