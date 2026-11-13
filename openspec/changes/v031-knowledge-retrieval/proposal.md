# v0.31 candidate: A20 knowledge retrieval

Status: in progress, not released or complete private parity.
Open remote baseline: `8d56f52bfbb16bab4b45c5e68bf4d9bdfab8872c`.
Private contract inspected at `7db13dc5db9214ed97eca52a0d0fce7c496e679d`,
`agent-app/src/server/rag/retriever.ts` blob `85a6a90c0f1eafa58e30073b981a249869f4845c`.

## Module responsibility and target

Turn an authorized query into bounded, original, source-identified evidence.
Keep source admission, Runtime budgets, Host ResultRef registration and publication
with their existing owners. Private's contract includes lexical/vector channels,
RRF, optional local reranking, source/collection filters, domain prefer/only,
explicit channel health, cancellation and attempt budgets. Open v0.23/v2 only
counts lexical occurrences on admitted immutable whole pages. Do not describe
that narrower implementation as full A20 parity.

## First implementation boundary

Opt-in `knowledge.algorithm: "bm25"` selects `admitted-bm25-pages@2` for new
tasks. BM25 k1=1.2 and b=0.75 use frequencies and lengths from admitted pages
only. This addresses term repetition overwhelming a rare relevant term, without
claiming semantic relevance or better investment conclusions. Existing tasks
retain their original v1/v2 bytes, index binding and verifier. Query responses
include the actual algorithm parameters and retain full original page bytes,
source/ResultRef identity, cancellation and existing encoded response limits.
No new dependency, credentials, database, external request or model call.

The BM25 candidate also exposes optional `documentIds` and `documentMode` through
the original `knowledge_query` schema. IDs must be a nonempty unique subset of
the admitted documents. `only` never widens, including no-evidence. `prefer`
widens only when fewer than `min(2, limit)` preferred pages match, preserves
preferred evidence first, and explicitly reports expansion. BM25 statistics are
calculated after the effective scope is selected. Narrowed coverage is labelled
as a document subset rather than complete knowledge of the whole collection.
These are document preferences, not private's domain taxonomy or current ACLs.
The old v1/v2 query schema and outputs remain unchanged.

## Channel health and recovery contract

The candidate response identifies `local-lexical-only`: lexical execution is
`available` even when it finds no evidence or the returned evidence is bounded;
vector and reranker are explicitly `not-configured`, not failed or degraded.
Matched counts follow the effective query scope. The original Host verifies
these diagnostics by recomputing the immutable query, including terminal replay.
Cancellation remains an error, not a fabricated healthy empty response.
Old lexical v1/v2 and pre-health BM25@1 response and tool-description bytes
are unchanged. New admissions freeze BM25@2; existing BM25@1 tasks retain their
old contract rather than retroactively requiring diagnostics during recovery.

Inspection of `src/tools.mjs` and `verifyKnowledgeResult` confirms that recovery
currently synchronously recomputes the query. There is no embedding provider in
the current application. A future live provider must freeze its identity and
retain original response evidence so recovery never reissues paid/provider work;
simple online embedding inside `queryKnowledge` is therefore not safe. Local
lexical health does not claim that vector retrieval has been implemented.

## Remaining before v0.31 completion

- Freeze the full public hybrid/eligibility/rerank/health contract and its
  supported application inputs; do not publish an unused rank helper as a module.
- Extend the frozen-vector candidate below with qualified provider acquisition,
  unknown-response accounting and live fail/degrade/cancel evidence; offline
  fixture fusion is not live semantic quality validation.
- Establish query scopes/domain prefer/only, batching and attempt limits without
  silently broadening document grants or repeating effects on recovery.
- Verify real user workflow, cross-process recovery, independent review,
  complete regression/build and qualified model runs under verified shared budget.
- Update bilingual docs/modules only to observed states; publish only after
  sensitivity audit, remote byte readback and exact-head CI.

This first step is not the release gate and does not replace remaining work.

## Frozen-vector provider evidence and bounded hybrid candidate

`knowledge.algorithm: "hybrid"` now admits `admitted-frozen-hybrid-pages@1`.
Application API `knowledgeVectorEvidence` and CLI `run submit --knowledge-vectors`
accept an explicitly supplied `knowledge-vector-evidence@1` snapshot. It contains
provider id/model/revision, fixed dimensions, all admitted original page SourceIDs
and SHA256s with vectors, and at most 16 exact-query SHA256/vector pairs. It is
bounded to 1 MiB, 1024 dimensions and the existing 1024-page catalog maximum;
zero/nonfinite vectors, unknown/duplicate/mismatched pages and unknown keys fail
closed. No transport, credentials or acquisition callback exists in this path.
Provider labels record provenance supplied by the caller, not authenticity.

Admission persists this snapshot in the original immutable task definition and
binds its normalized digest into the Knowledge adapter. Re-admission cannot
replace it. Index creation copies vectors, so later caller mutations cannot alter
ranking. New processes reconstruct only from the frozen task/source snapshot;
recovery does not regenerate embeddings or issue provider requests. Previous
lexical/BM25 adapters are unchanged.

Hybrid ranking performs actual positive cosine similarity on scoped pages and
BM25 on the same authorized corpus, then reciprocal rank fusion (k=60). Stable
identity tie-breaking and existing document only/prefer rules apply. Results
carry provider/evidence identity and per-channel counts. A missing exact query
vector explicitly reports vector unavailable/query-not-in-snapshot and falls
back to BM25 without retrying an external service. This is a finite precomputed
query contract, NOT dynamic query embedding support or live provider validation.

Tests exercise the CLI admission, actual Host ResultRefs/report, interruption in
a separate worker process after result consumption, and recovery without query
redispatch. Hand-authored synthetic vectors prove the engineering/math contract
only; they do not prove semantic retrieval quality or real-model acceptance.
Online provider acquisition/unknown-response accounting, domain taxonomy and
full release qualification remain incomplete.

## Qualification preparation

`docs/knowledge-retrieval-qualification.md` describes the bounded, explicit-input
`node scripts/evaluate-knowledge.mjs` comparison procedure. It reports actual
returned-source Recall@k/MRR@k for lexical, BM25 and frozen hybrid on the same
manifest and labels, plus exact query-vector coverage and byte truncation.
External input is not automatically authenticated or certified, and synthetic
metrics never satisfy semantic acceptance. No provider requests are made.

Vector validation/ranking now normalize the catalog once and use SourceID lookup
maps rather than re-normalizing the full catalog per candidate. Snapshot hashes
and ranks were compared with commit `477fe45` on 64 pages across full/subset scopes
and were identical. This is a structural cost reduction, not a claimed measured
production throughput or latency improvement.

The fixed Private embedding port/config uses Ollama `bge-m3`, 1024 dimensions.
The snapshot validator accepts that dimension without reducing the 1 MiB total
cap or changing old vector semantics. This is shape compatibility only: no live
Ollama process, configured endpoint or semantic result was established by this
change. Historical TEI rerank acceptance used synthetic embedding and is not an
embedding-service qualification for Open.
