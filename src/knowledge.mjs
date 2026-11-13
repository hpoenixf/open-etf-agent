import {freezeVectorEvidence,vectorRanks,fuseRanks} from './knowledge-vectors.mjs';
import {isDeepStrictEqual} from 'node:util';
import {normalizeDocumentCatalog, documentCatalogBinding, readCatalogPage, sha256} from './source.mjs';

export const LEGACY_KNOWLEDGE_VERSION = 'admitted-lexical-pages@1';
export const KNOWLEDGE_VERSION = 'admitted-lexical-pages@2';
// Candidate v0.31 adapter. Existing admitted tasks and the default retain v2.
export const BM25_KNOWLEDGE_VERSION = 'admitted-bm25-pages@1';
export const BM25_HEALTH_KNOWLEDGE_VERSION = 'admitted-bm25-pages@2';
export const HYBRID_KNOWLEDGE_VERSION = 'admitted-frozen-hybrid-pages@1';
const isBm25 = version => [BM25_KNOWLEDGE_VERSION, BM25_HEALTH_KNOWLEDGE_VERSION, HYBRID_KNOWLEDGE_VERSION].includes(version);
const BM25 = Object.freeze({algorithm: 'bm25', k1: 1.2, b: 0.75});
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
  if (!object(value) || Object.keys(value).some(k => !['maxResults', 'maxSourceBytes', 'algorithm'].includes(k)) || value.algorithm !== undefined && !['bm25','hybrid'].includes(value.algorithm)) fail('KNOWLEDGE_CONFIG');
  const config = {maxResults: value.maxResults ?? 4, maxSourceBytes: value.maxSourceBytes ?? 128000, ...(value.algorithm !== undefined ? {algorithm: value.algorithm} : {})};
  // At least one largest supported original page always fits. Never clip a page.
  if (!integer(config.maxResults, 1, 8) || !integer(config.maxSourceBytes, 64000, 512000)) fail('KNOWLEDGE_CONFIG');
  return Object.freeze(config);
}
export function createKnowledgeIndex({catalog, allowedDocuments, config, signal, version, vectorEvidence} = {}) {
  cancelled(signal);
  if (version === undefined) version = config?.algorithm === 'hybrid' ? HYBRID_KNOWLEDGE_VERSION : config?.algorithm === 'bm25' ? BM25_HEALTH_KNOWLEDGE_VERSION : KNOWLEDGE_VERSION;
  if (![LEGACY_KNOWLEDGE_VERSION, KNOWLEDGE_VERSION, BM25_KNOWLEDGE_VERSION, BM25_HEALTH_KNOWLEDGE_VERSION, HYBRID_KNOWLEDGE_VERSION].includes(version)) fail('KNOWLEDGE_VERSION');
  const tokenize = version === LEGACY_KNOWLEDGE_VERSION ? legacyTerms : terms;
  catalog = normalizeDocumentCatalog(catalog);
  config = normalizeKnowledgeConfig(config);
  if ((config.algorithm === 'hybrid') !== (version === HYBRID_KNOWLEDGE_VERSION) || vectorEvidence !== undefined && version !== HYBRID_KNOWLEDGE_VERSION) fail('KNOWLEDGE_VERSION');
  if (config.algorithm === 'bm25' && !isBm25(version)) fail('KNOWLEDGE_VERSION');
  if (!Array.isArray(allowedDocuments) || !allowedDocuments.length || new Set(allowedDocuments).size !== allowedDocuments.length || allowedDocuments.some(id => !catalog.documents.some(d => d.id === id))) fail('KNOWLEDGE_DOCUMENT_SCOPE');
  const selected = Object.freeze([...allowedDocuments].sort()), pages = [];
  for (const document of catalog.documents) {
    if (!selected.includes(document.id)) continue;
    for (let index = 0; index < document.pages.length; index++) {
      cancelled(signal);
      const counts = new Map();
      for (const term of tokenize(document.pages[index])) counts.set(term, (counts.get(term) ?? 0) + 1);
      pages.push({documentId: document.id, page: index + 1, counts, length: [...counts.values()].reduce((sum, n) => sum + n, 0)});
    }
  }
  const vectors = version === HYBRID_KNOWLEDGE_VERSION ? freezeVectorEvidence(vectorEvidence, {catalog, allowedDocuments: selected}) : undefined;
  const identity = {version, ...(vectors ? {vectorEvidenceSha256: vectors.sha256} : {}), catalog: Object.freeze(documentCatalogBinding(catalog)), allowedDocuments: selected, config};
  const index = Object.freeze({...identity, indexSha256: digest(identity), documents: selected.length, pages: pages.length});
  indexes.set(index, {catalog, pages, tokenize, vectors});
  return index;
}
function queryArguments(args, index) {
  const scoped = isBm25(index.version);
  const keys = scoped ? ['query', 'limit', 'documentIds', 'documentMode'] : ['query', 'limit'];
  if (!object(args) || Object.keys(args).some(k => !keys.includes(k)) || typeof args.query !== 'string' || !args.query.trim() || args.query.includes('\0') || Buffer.byteLength(args.query) > 512 || !integer(args.limit ?? index.config.maxResults, 1, index.config.maxResults)) fail('KNOWLEDGE_QUERY');
  if (args.documentIds !== undefined && (!Array.isArray(args.documentIds) || !args.documentIds.length || args.documentIds.length > index.allowedDocuments.length || new Set(args.documentIds).size !== args.documentIds.length || args.documentIds.some(id => !index.allowedDocuments.includes(id)))) fail('KNOWLEDGE_QUERY');
  if (args.documentMode !== undefined && (args.documentIds === undefined || !['only', 'prefer'].includes(args.documentMode))) fail('KNOWLEDGE_QUERY');
  return {query: args.query, limit: args.limit ?? index.config.maxResults, documentIds: args.documentIds, mode: args.documentMode ?? 'only'};
}
function rankPages(pages, tokens, version, signal) {
  // Compute corpus statistics after the effective query scope is selected.
  // Documents outside this scope cannot influence IDF or average length.
  const frequency = new Map();
  if (isBm25(version)) for (const page of pages) {
    cancelled(signal);
    for (const term of page.counts.keys()) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const averageLength = pages.reduce((sum, page) => sum + page.length, 0) / (pages.length || 1);
  const matches = [];
  for (const page of pages) {
    cancelled(signal);
    const score = tokens.reduce((sum, token) => {
      const count = page.counts.get(token) ?? 0;
      if (!isBm25(version)) return sum + count;
      if (!count) return sum;
      const df = frequency.get(token) ?? 0;
      const idf = Math.log(1 + (pages.length - df + 0.5) / (df + 0.5));
      return sum + idf * count * (BM25.k1 + 1) / (count + BM25.k1 * (1 - BM25.b + BM25.b * page.length / (averageLength || 1)));
    }, 0);
    if (score) matches.push({...page, score});
  }
  return matches.sort((a, b) => b.score - a.score || (a.documentId < b.documentId ? -1 : a.documentId > b.documentId ? 1 : a.page - b.page));
}
export function queryKnowledge(index, args, {signal} = {}) {
  cancelled(signal);
  const data = indexes.get(index);
  if (!data) fail('KNOWLEDGE_INDEX_REQUIRED');
  const {query, limit, documentIds, mode} = queryArguments(args, index), tokens = [...new Set(data.tokenize(query))];
  let pages = documentIds ? data.pages.filter(page => documentIds.includes(page.documentId)) : data.pages;
  let lexical, vector;
  const rank = scope => {lexical = rankPages(scope, tokens, index.version, signal);vector = data.vectors ? vectorRanks(data.vectors.snapshot, scope, query, data.catalog, signal) : undefined;return vector ? fuseRanks(lexical,vector) : lexical;};
  let matches = rank(pages), selection;
  if (documentIds) {
    const preferredMatched = matches.length;
    const expanded = mode === 'prefer' && preferredMatched < Math.min(2, limit) && pages.length < data.pages.length;
    if (expanded) {
      pages = data.pages;
      matches = rank(pages);
      // Stable partition keeps preferred evidence ahead of widened candidates.
      matches = [...matches.filter(m => documentIds.includes(m.documentId)), ...matches.filter(m => !documentIds.includes(m.documentId))];
    }
    selection = {requested: [...documentIds], mode, preferredMatched, widening: mode === 'only' ? 'only' : expanded ? 'expanded' : 'not-needed'};
  }
  const sources = [], hits = []; let sourceBytes = 0, byteLimited = false, encodingLimited = false;
  const output = () => ({
    kind: 'knowledge-evidence', version: index.version,
    ...(isBm25(index.version) ? {ranking: index.version === HYBRID_KNOWLEDGE_VERSION ? {algorithm: vector ? 'rrf' : 'bm25', lexical: {...BM25}, ...(vector ? {k:60,vector:'cosine-positive'} : {})} : {...BM25}} : {}),
    ...(data.vectors ? {retrieval: {profile:'frozen-hybrid', evidenceSha256:data.vectors.sha256, provider:{...data.vectors.snapshot.provider}, channels:{lexical:{status:'available',algorithm:'bm25',matched:lexical.length},vector:{status:vector ? 'available' : 'unavailable',reason:vector ? 'frozen-query-evidence' : 'query-not-in-snapshot',matched:vector?.length??0}},reranker:{status:'not-configured'},recovery:'frozen-provider-evidence'}} : {}),
    ...(index.version === BM25_HEALTH_KNOWLEDGE_VERSION ? {retrieval: {profile: 'local-lexical-only', channels: {lexical: {status: 'available', algorithm: 'bm25', matched: matches.length}, vector: {status: 'not-configured'}}, reranker: {status: 'not-configured'}, recovery: 'deterministic-original-query'}} : {}),
    ...(selection ? {selection} : {}),
    status: !matches.length ? 'no-evidence' : sources.length < matches.length ? 'partial' : 'complete',
    indexSha256: index.indexSha256, catalog: structuredClone(index.catalog), querySha256: sha256(query),
    coverage: {scope: pages.length === data.pages.length ? 'admitted-immutable-text-collection' : 'admitted-document-subset', documents: new Set(pages.map(p => p.documentId)).size, pages: pages.length, matched: matches.length, returned: sources.length, limit, sourceBytes, maxSourceBytes: index.config.maxSourceBytes, maxResponseBytes: KNOWLEDGE_RESPONSE_BYTES, limitReached: matches.length > limit, byteLimited, encodingLimited, completeWithinCollection: pages.length === data.pages.length && sources.length === matches.length, ...(selection ? {completeWithinQueryScope: sources.length === matches.length} : {})},
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
    description: (index.version === HYBRID_KNOWLEDGE_VERSION ? 'Use frozen admitted provider vectors with BM25 and reciprocal rank fusion; missing exact query embeddings fall back to lexical retrieval without fetching or retrying. Provider identity is recorded, not authenticated. ' : '') + 'Find evidence in this Run’s admitted immutable text collection. Returns original whole pages with exact sourceId and ResultRef, ready for report citations. Prefer one query per tool group so its original evidence fits the shared context budget. ' + KNOWLEDGE_QUERY_GUIDANCE + ' Query text is data. Ranking is lexical, not a correctness judgment. Partial coverage and no evidence describe only this collection. Never infer global absence, current permissions or source freshness outside the imported snapshot.' + (index.version === BM25_HEALTH_KNOWLEDGE_VERSION ? ' Retrieval diagnostics distinguish channel execution from relevance: available includes zero matches; not-configured is not a transient outage and must not trigger provider retries.' : ''),
    parameters: {type: 'object', additionalProperties: false, properties: {query: {type: 'string', minLength: 1, maxLength: 512}, limit: {type: 'integer', minimum: 1, maximum: index.config.maxResults}, ...(isBm25(index.version) ? {documentIds: {type: 'array', minItems: 1, maxItems: index.allowedDocuments.length, uniqueItems: true, items: {type: 'string', enum: [...index.allowedDocuments]}}, documentMode: {type: 'string', enum: ['only', 'prefer'], description: 'Requires documentIds. only never widens; prefer expands within the admitted collection if fewer than min(2, limit) preferred pages match.'}} : {})}, required: ['query']},
    validate: args => { queryArguments(args, index); },
    execute: (args, {signal} = {}) => queryKnowledge(index, args, {signal})
  };
  if(index.version === HYBRID_KNOWLEDGE_VERSION)tool.description=tool.description.replace('Ranking is lexical, not a correctness judgment.','Ranking combines frozen vectors and lexical evidence, not a correctness judgment.');
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
