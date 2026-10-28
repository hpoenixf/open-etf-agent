import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const READ_PAGE_SCHEMA = { type: 'object', additionalProperties: false, properties: { documentId: { type: 'string', enum: ['atlas-a', 'atlas-b'] }, page: { type: 'integer', minimum: 1, maximum: 2 } }, required: ['documentId', 'page'] };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
export function validateSource(value) {
  if (!object(value) || !['sourceId', 'documentId', 'name', 'version', 'text', 'sha256', 'mediaType'].every(k => typeof value[k] === 'string' && value[k].length > 0) || !Number.isSafeInteger(value.page) || value.page < 1 || Buffer.byteLength(value.text) > 64000 || value.sha256 !== sha256(value.text) || value.mediaType !== 'text/plain; charset=utf-8') fail('Invalid acquired source snapshot');
  if ([value.sourceId, value.documentId, value.name, value.version].some(s => s.length > 200 || /[\u0000-\u001f]/.test(s))) fail('Invalid source identity');
  if(value.pdf!==undefined){
    const p=value.pdf;
    if(!object(p)||Object.keys(p).sort().join(',')!=='extraction,originalArtifactId,originalBytes,originalSha256,pageCount,parser,synthetic,visualInspection'
      ||!/^artifact:sha256:[a-f0-9]{64}$/.test(p.originalArtifactId)||!/^[a-f0-9]{64}$/.test(p.originalSha256)
      ||!Number.isSafeInteger(p.originalBytes)||p.originalBytes<5||p.originalBytes>1048576||p.parser!=='pdf2json@4.1.0'
      ||!Number.isSafeInteger(p.pageCount)||p.pageCount<value.page||p.pageCount>16||typeof p.synthetic!=='boolean'
      ||p.extraction!=='text-layer'||p.visualInspection!=='not-performed'||value.documentId!==`pdf:${p.originalSha256}`
      ||value.sourceId!==`${value.documentId}:p${value.page}`||value.version!==`${p.parser}:${p.originalSha256}`)fail('Invalid PDF source provenance');
  }
  return structuredClone(value);
}
export async function readFixturePage({ documentId, page }) {
  const input = JSON.parse(await readFile(new URL('../fixtures/documents.json', import.meta.url), 'utf8'));
  const d = input.documents.find(d => d.id === documentId);
  if (!d || !Number.isSafeInteger(page) || page < 1 || page > d.pages.length) fail('Unknown document or invalid page');
  const text = d.pages[page - 1];
  return { sourceId: `${d.id}@${d.version}:p${page}`, documentId, name: d.name, version: d.version, page, text, sha256: sha256(text), mediaType: 'text/plain; charset=utf-8' };
}
