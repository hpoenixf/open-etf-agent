import { createHash } from 'node:crypto';

// Text-only adaptation of the original Publication contract. Not an Artifact receipt.
export const PUBLICATION_BINDING = Object.freeze({ id: 'publication', version: 'publication@1' });
// Complete UTF-8 display text, separate from transport and JSON envelope bytes.
export const PUBLICATION_TEXT_MAX_BYTES = 256 * 1024;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(value) && !value.includes('://');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sha = value => createHash('sha256').update(value).digest('hex');
function fields(value, names, code = 'INVALID_PUBLICATION') {
 if (!object(value) || Object.keys(value).sort().join(',') !== [...names].sort().join(',')) fail(code);
}
function freeze(value) { for (const child of Object.values(value)) if (object(child)) freeze(child); return Object.freeze(value); }
export function preparePublication(input) {
 fields(input, ['runId', 'rootId', 'text']);
 if (!id(input.runId) || !id(input.rootId) || typeof input.text !== 'string' || !input.text.trim() || Buffer.byteLength(input.text) > PUBLICATION_TEXT_MAX_BYTES || input.text.includes('\0') || Buffer.from(input.text).toString('utf8') !== input.text) fail('INVALID_PUBLICATION');
 const content = { type: 'text', text: input.text };
 return freeze({ schemaVersion: 'publication@1', runId: input.runId, rootId: input.rootId, blockId: 'answer', content, payloadHash: sha(JSON.stringify(content)) });
}
export function validatePublication(value) {
 fields(value, ['schemaVersion', 'runId', 'rootId', 'blockId', 'content', 'payloadHash']); fields(value.content, ['type', 'text']);
 const expected = preparePublication({ runId: value.runId, rootId: value.rootId, text: value.content.text });
 if (value.schemaVersion !== expected.schemaVersion || value.blockId !== expected.blockId || value.content.type !== 'text' || value.payloadHash !== expected.payloadHash) fail('INVALID_PUBLICATION_IDENTITY');
 return expected;
}
export function validatePublicationReceipt(value) {
 const code = 'PUBLICATION_IDENTITY_UNAVAILABLE';
 fields(value, ['schemaVersion', 'runId', 'rootId', 'blockId', 'revision', 'deliveryOrdinal', 'payloadHash', 'bindingHash'], code);
 if (value.schemaVersion !== 'publication-receipt@1' || !id(value.runId) || !id(value.rootId) || value.blockId !== 'answer' || !Number.isSafeInteger(value.revision) || value.revision < 1 || value.revision > 3 || value.deliveryOrdinal !== 1 || !hash(value.payloadHash) || !hash(value.bindingHash)) fail(code);
 return freeze(structuredClone(value));
}
export function committedPublicationEvent(value) {
 const receipt = validatePublicationReceipt(value.receipt);
 const prepared = preparePublication({ runId: receipt.runId, rootId: receipt.rootId, text: value.content?.text });
 if (prepared.payloadHash !== receipt.payloadHash || value.content.type !== 'text') fail('PUBLICATION_IDENTITY_UNAVAILABLE');
 return { type: 'publication-committed', receipt: structuredClone(receipt), content: structuredClone(prepared.content) };
}
