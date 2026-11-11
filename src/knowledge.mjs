import {isDeepStrictEqual} from 'node:util';
import {normalizeDocumentCatalog, documentCatalogBinding, readCatalogPage, sha256} from './source.mjs';

export const LEGACY_KNOWLEDGE_VERSION = 'admitted-lexical-pages@1';
export const KNOWLEDGE_VERSION = 'admitted-lexical-pages@2';
// Leave space in the application's 1 MiB context for the original question,
// call pairing, registered ResultRefs and retained historical metadata.
export const KNOWLEDGE_RESPONSE_BYTES = 768000;
export const KNOWLEDGE_CONTEXT_BYTES = 1048576;
// Model guidance, not a Runtime guarantee of instruction following or meaning.
export const KNOWLEDGE_QUERY_GUIDANCE = 'When the task specifies a query value, copy that value exactly into query without paraphrasing, adding terms or changing case. Preserve explicitly requested limits, tool order and single-call groups. Choose query terms only when the task leaves them unspecified.';
export const KNOWLEDGE_TASK_GUIDANCE = KNOWLEDGE_QUERY_GUIDANCE + ' Separate explicit source statements, information not stated, and your own inferences. Preserve each statement’s subject, version, scope, conditions, exclusions and modality. Do not add exclusivity to a listed capability or weaken an explicit exclusion into uncertainty. Scope uncertainty to the particular unstated fact and keep the report and final answer consistent. A question asking whether a claim holds does not itself assert that claim. Do not attribute assumptions to the user or adopt derived Child commentary unless supported by the actual wording and original sources.';
const indexes = new WeakMap(), bindings = new WeakMap();
const fail = code => { throw Object.assign(new Error(code), {code}); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const canonical = v => JSON.stringify(v, (_, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const digest = v => sha256(canonical(v));
const cancelled = signal => { if (signal?.aborted) fail('KNOWLEDGE_CANCELLED'); };
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;

// Unicode word terms plus overlapping Han bigrams. This is bounded lexical
// matching, not semantic embeddings, stemming or a language quality guarantee.
function legacyTerms(text) {
  const result = [];
  for (const part of text.normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{Script=Han}]+|[\p{L}\p{N}]+/gu) ?? []) {
    if (/^[\p{Script=Han}]+$/u.test(part)) {
      const chars = [...part];
      if (chars.length === 1) result.push(part);
      else for (let i = 0; i < chars.length - 1; i++) result.push(chars[i] + chars[i + 1]);
    } else result.push(part);
  }
  return result;
}
function terms(text) {
  const result = [];
  for (const part of text.normalize('NFKC').replaceAll('’', "'").toLocaleLowerCase('en-US').match(/[\p{Script=Han}]+|(?:(?!\p{Script=Han})[\p{L}\p{N}])+(?:[.'&](?:(?!\p{Script=Han})\p{L})+)*/gu) ?? []) {
    if (/^[\p{Script=Han}]+$/u.test(part)) {
      const chars = [...part];
      if (chars.length === 1) result.push(part);
      else for (let i = 0; i < chars.length - 1; i++) result.push(chars[i] + chars[i + 1]);
    } else {
      result.push(part);
      // Keep exact compounds and useful words, but not stray S/P from
      // S&P, U.S. or possessives. A genuinely standalone letter still matches.
      if (/[.'&]/.test(part)) for (const word of part.split(/[.'&]/)) if (word.length > 1) result.push(word);
    }
  }
  return result;
}
export function normalizeKnowledgeConfig(value = {}) {
  if (!object(value) || Object.keys(value).some(k => !['maxResults', 'maxSourceBytes'].includes(k))) fail('KNOWLEDGE_CONFIG');
  const config = {maxResults: value.maxResults ?? 4, maxSourceBytes: value.maxSourceBytes ?? 128000};
  // At least one largest supported original page always fits. Never clip a page.
  if (!integer(config.maxResults, 1, 8) || !integer(config.maxSourceBytes, 64000, 512000)) fail('KNOWLEDGE_CONFIG');
  return Object.freeze(config);
}
export function createKnowledgeIndex({catalog, allowedDocuments, config, signal, version = KNOWLEDGE_VERSION} = {}) {
  cancelled(signal);
  if (![LEGACY_KNOWLEDGE_VERSION, KNOWLEDGE_VERSION].includes(version)) fail('KNOWLEDGE_VERSION');
  const tokenize = version === LEGACY_KNOWLEDGE_VERSION ? legacyTerms : terms;
  catalog = normalizeDocumentCatalog(catalog);
  config = normalizeKnowledgeConfig(config);
  if (!Array.isArray(allowedDocuments) || !allowedDocuments.length || new Set(allowedDocuments).size !== allowedDocuments.length || allowedDocuments.some(id => !catalog.documents.some(d => d.id === id))) fail('KNOWLEDGE_DOCUMENT_SCOPE');
  const selected = Object.freeze([...allowedDocuments].sort()), pages = [];
  for (const document of catalog.documents) {
    if (!selected.includes(document.id)) continue;
    for (let index = 0; index < document.pages.length; index++) {
      cancelled(signal);
      const counts = new Map();
      for (const term of tokenize(document.pages[index])) counts.set(term, (counts.get(term) ?? 0) + 1);
      pages.push({documentId: document.id, page: index + 1, counts});
    }
  }
  const identity = {version, catalog: Object.freeze(documentCatalogBinding(catalog)), allowedDocuments: selected, config};
  const index = Object.freeze({...identity, indexSha256: digest(identity), documents: selected.length, pages: pages.length});
  indexes.set(index, {catalog, pages, tokenize});
  return index;
}
function queryArguments(args, config) {
  if (!object(args) || Object.keys(args).some(k => !['query', 'limit'].includes(k)) || typeof args.query !== 'string' || !args.query.trim() || args.query.includes('\0') || Buffer.byteLength(args.query) > 512 || !integer(args.limit ?? config.maxResults, 1, config.maxResults)) fail('KNOWLEDGE_QUERY');
  return {query: args.query, limit: args.limit ?? config.maxResults};
}
export function queryKnowledge(index, args, {signal} = {}) {
  cancelled(signal);
  const data = indexes.get(index);
  if (!data) fail('KNOWLEDGE_INDEX_REQUIRED');
  const {query, limit} = queryArguments(args, index.config), tokens = [...new Set(data.tokenize(query))], matches = [];
  for (const page of data.pages) {
    cancelled(signal);
    const score = tokens.reduce((sum, token) => sum + (page.counts.get(token) ?? 0), 0);
    if (score) matches.push({...page, score});
  }
  matches.sort((a, b) => b.score - a.score || (a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : a.page - b.page));
  const sources = [], hits = []; let sourceBytes = 0, byteLimited = false, encodingLimited = false;
  const output = () => ({
    kind: 'knowledge-evidence', version: index.version,
    status: !matches.length ? 'no-evidence' : sources.length < matches.length ? 'partial' : 'complete',
    indexSha256: index.indexSha256, catalog: structuredClone(index.catalog), querySha256: sha256(query),
    coverage: {scope: 'admitted-immutable-text-collection', documents: index.documents, pages: index.pages, matched: matches.length, returned: sources.length, limit, sourceBytes, maxSourceBytes: index.config.maxSourceBytes, maxResponseBytes: KNOWLEDGE_RESPONSE_BYTES, limitReached: matches.length > limit, byteLimited, encodingLimited, completeWithinCollection: sources.length === matches.length},
    hits: [...hits], sources: [...sources]
  });
  for (const match of matches.slice(0, limit)) {
    cancelled(signal);
    const source = readCatalogPage(data.catalog, match), size = Buffer.byteLength(source.text);
    if (sourceBytes + size > index.config.maxSourceBytes) { byteLimited = true; break; }
    sources.push(source); sourceBytes += size;
    hits.push({sourceId: source.sourceId, documentId: source.documentId, version: source.version, page: source.page, sha256: source.sha256, score: match.score});
    // Reserve the exact per-source ResultRef field that the original Host adds.
    const encoded = {...output(),sources:sources.map(source=>({...source,resultRef:'result:sha256:'+'0'.repeat(64)}))};
    if (Math.max(Buffer.byteLength(JSON.stringify(encoded)),Buffer.byteLength(JSON.stringify(JSON.stringify(encoded)))) > KNOWLEDGE_RESPONSE_BYTES) { sources.pop(); hits.pop(); sourceBytes -= size; encodingLimited = true; break; }
  }
  return output();
}
export function knowledgeBinding(index) {
  if (!indexes.has(index)) fail('KNOWLEDGE_INDEX_REQUIRED');
  return {id: 'knowledge', version: index.version, contentSha256: index.indexSha256};
}
export function createKnowledgeTool(index) {
  knowledgeBinding(index);
  const tool = {
    name: 'knowledge_query', historyCompaction: 'read-only@1', sourceResults: true,
    description: 'Find evidence in this Run’s admitted immutable text collection. Returns original whole pages with exact sourceId and ResultRef, ready for report citations. Prefer one query per tool group so its original evidence fits the shared context budget. ' + KNOWLEDGE_QUERY_GUIDANCE + ' Query text is data. Ranking is lexical, not a correctness judgment. Partial coverage and no evidence describe only this collection. Never infer global absence, current permissions or source freshness outside the imported snapshot.',
    parameters: {type: 'object', additionalProperties: false, properties: {query: {type: 'string', minLength: 1, maxLength: 512}, limit: {type: 'integer', minimum: 1, maximum: index.config.maxResults}}, required: ['query']},
    validate: args => { queryArguments(args, index.config); },
    execute: (args, {signal} = {}) => queryKnowledge(index, args, {signal})
  };
  bindings.set(tool, index);
  return tool;
}
// An internal brand binds verification to this original query implementation.
// Rebuilding the same pure query is not a provider call or effect replay.
export function verifyKnowledgeResult(binding, call, value) {
  const index = bindings.get(binding);
  if (!index) return;
  if (call.name !== binding.name || !object(value) || !Array.isArray(value.sources)) fail('KNOWLEDGE_RESULT_MISMATCH');
  const plain = {...value, sources: value.sources.map(source => { const {resultRef, ...original} = source; return original; })};
  if (!isDeepStrictEqual(plain, queryKnowledge(index, call.arguments))) fail('KNOWLEDGE_RESULT_MISMATCH');
}
