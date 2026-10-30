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

// Opt-in document revocation facts. Hash identity is not current permission.
export const DOCUMENT_REVOCATION_PROFILE = 'document-revocation@1';
const protectedFailure = () => { throw Object.assign(new Error('INVALID_PROTECTED_SOURCE_BINDING'), { code: 'INVALID_PROTECTED_SOURCE_BINDING' }); };
const exactProtected = (value, keys) => object(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const protectedId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/.test(value) && !value.includes('://');
const protectedHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function validateDocumentManifest(value) {
 if (!exactProtected(value,['schemaVersion','documentId','name','version','mediaType','pages']) || value.schemaVersion !== 'protected-document@1'
  || !['atlas-a','atlas-b'].includes(value.documentId) || !protectedId(value.version) || typeof value.name !== 'string' || !value.name || value.name.length > 200 || /[\u0000-\u001f]/.test(value.name)
  || value.mediaType !== 'text/plain; charset=utf-8' || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 2) protectedFailure();
 const pages=value.pages.map((p,i)=>{if(!exactProtected(p,['page','sha256']) || p.page!==i+1 || !protectedHash(p.sha256))protectedFailure();return {page:p.page,sha256:p.sha256};});
 return {schemaVersion:'protected-document@1',documentId:value.documentId,name:value.name,version:value.version,mediaType:value.mediaType,pages};
}
export function documentManifestHash(value) { return sha256(JSON.stringify(validateDocumentManifest(value))); }
export function validateDocumentAuthority(value) {
 if(!exactProtected(value,['schemaVersion','authorityId','libraryId']) || value.schemaVersion!=='document-authority@1' || !protectedId(value.authorityId) || !protectedId(value.libraryId))protectedFailure();
 return {schemaVersion:value.schemaVersion,authorityId:value.authorityId,libraryId:value.libraryId};
}
export function bindProtectedSource({authority,manifest,source,resultRef}={}) {
 const a=validateDocumentAuthority(authority),m=validateDocumentManifest(manifest),s=validateSource(source);
 if(s.pdf!==undefined || s.derived===true || s.documentId!==m.documentId || s.name!==m.name || s.version!==m.version || s.mediaType!==m.mediaType || s.sourceId!==`${m.documentId}@${m.version}:p${s.page}` || m.pages[s.page-1]?.sha256!==s.sha256)protectedFailure();
 const identity=Object.fromEntries(['sourceId','documentId','name','version','page','sha256','mediaType'].map(k=>[k,s[k]]));
 if(resultRef!=='result:sha256:'+sha256(JSON.stringify(identity)))protectedFailure();
 return {schemaVersion:'protected-source-binding@1',authorityId:a.authorityId,libraryId:a.libraryId,documentId:m.documentId,documentVersion:m.version,documentManifestHash:documentManifestHash(m),page:s.page,sourceId:s.sourceId,sourceSha256:s.sha256,resultRef};
}
export function validateProtectedSourceBinding(value,authority,manifest) {
 if(!exactProtected(value,['schemaVersion','authorityId','libraryId','documentId','documentVersion','documentManifestHash','page','sourceId','sourceSha256','resultRef']))protectedFailure();
 const a=validateDocumentAuthority(authority),m=validateDocumentManifest(manifest);
 if(value.schemaVersion!=='protected-source-binding@1'||value.authorityId!==a.authorityId||value.libraryId!==a.libraryId||value.documentId!==m.documentId||value.documentVersion!==m.version||value.documentManifestHash!==documentManifestHash(m)||!Number.isSafeInteger(value.page)||value.page<1||m.pages[value.page-1]?.sha256!==value.sourceSha256||value.sourceId!==`${m.documentId}@${m.version}:p${value.page}`)protectedFailure();
 const identity={sourceId:value.sourceId,documentId:m.documentId,name:m.name,version:m.version,page:value.page,sha256:value.sourceSha256,mediaType:m.mediaType};
 if(value.resultRef!=='result:sha256:'+sha256(JSON.stringify(identity)))protectedFailure();return structuredClone(value);
}
