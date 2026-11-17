# Usable local embedding preparation and frozen-search workflow

New `scripts/prepared-knowledge.mjs` supplies the missing command surface for the
existing local worker and acquisition owner. It does not enable an in-Run dynamic
tool or touch the stopped Session authorization candidate.

## Commands

First import explicitly selected documents using the existing `knowledge import`
command and keep its immutable manifest SHA. Prepare the separately selected local
model manifest with `scripts/prepare-local-model.mjs`; keep its exact file SHA.
Real, qualified Python dependencies and model weights are prerequisites for prepare.
No downloader or synthetic fallback is built into this CLI.

Create a JSON array of exact query strings, for example `["liquidity"]`, then:

```
node scripts/prepared-knowledge.mjs prepare \
  --project /absolute/project --manifest SOURCE_SHA \
  --acquisition selected-query-1 --model-dir /absolute/model \
  --model-manifest /absolute/model-manifest.json --model-sha MODEL_MANIFEST_SHA \
  --python /absolute/python3 --queries /absolute/queries.json --approve-selected-text
```

`--approve-selected-text` is mandatory. Python must be an explicitly chosen trusted
absolute executable. The worker path is fixed by this package, with no user-facing
worker override or remote-code switch. Manifest bytes are checked before backend
creation and checked again by the worker; source/model admission uses the existing
owner. Optional `--timeout-ms` is 1–120000, default 30000, subject to the existing
non-cancellable durable commit boundary. The backend is always closed in finally.

For a new query using exactly the same source/model pages, repeat prepare with a
new acquisition ID, new queries file, and `--reuse selected-query-1`. Existing
query-only restrictions apply: no reuse chains or mismatched identities. A used or
unknown acquisition ID is never automatically retried.

```
node scripts/prepared-knowledge.mjs inspect --project /absolute/project --acquisition selected-query-1
printf liquidity > query.txt
node scripts/prepared-knowledge.mjs query --project /absolute/project \
  --manifest SOURCE_SHA --acquisition selected-query-1 --query query.txt
node scripts/prepared-knowledge.mjs export --project /absolute/project \
  --acquisition selected-query-1 --output /absolute/new-vectors.json
```

Inspection is read-only and does not print full vectors. Query loads the exact
source snapshot and verified frozen vectors, returning original source pages and
channel diagnostics without launching a model. Query bytes are exact: a trailing
newline or paraphrase has a different vector hash. An unprepared query honestly
falls back to BM25, not to invented vectors or a background model call. Export
requires a successful acquisition and creates a new file exclusively; the result
can be passed to the existing run-submit `--knowledge-vectors` option. Export does
not itself create a task, execute a Run or certify semantic quality.

## Verified boundaries

Node 26.11.1: 36/36 CLI/acquisition/query-reuse/process tests passed. Five new CLI
tests cover actual document import, preparation through a trusted in-process fake
backend, fresh-process frozen search, exclusive export, query-only reuse, source
mismatch, absent approval, changed manifest, unknown-operation refusal, resource
closure on backend failure and honest no-backend lexical fallback. Initial tests
failed before the command existed. Production CLI has no fake backend flag; injection
is only a trusted test entry point. The Python SentenceTransformer path was not run.

No HTTP service, task submission, Session authorization change, real model call,
network access or weight/dependency download occurred. Real dependencies and audited
weights remain unavailable here; prepare will fail rather than fabricate success.
This completes the command workflow and its offline wiring, not real embedding
qualification or in-Run dynamic retrieval. Independent review is required before
WIP backup; only the three listed files belong to this increment.

## Read-only labelled retrieval comparison

`evaluate` connects the existing retrieval evaluator to the same frozen source and
acquisition, so an operator can compare lexical, BM25 and hybrid without writing a
custom JavaScript program or reloading an embedding model:

```
node scripts/prepared-knowledge.mjs evaluate --project /absolute/project \
  --manifest SOURCE_SHA --acquisition selected-query-1 --labels /absolute/labels.json
```

Example labels (replace the illustrative SourceID with the exact admitted SourceID
returned by `query`, and independently judge relevance):

```json
{
  "schemaVersion": "knowledge-retrieval-evaluation@2",
  "provenance": "externally-supplied",
  "k": 4,
  "cases": [
    {"query": "liquidity", "relevantSourceIds": ["EXACT_ADMITTED_SOURCE_ID"]},
    {"query": "unrelated subject absent from this collection", "relevantSourceIds": []}
  ]
}
```

The existing evaluator supports at most 16 unique exact queries. Version 2 permits
empty relevance labels for negative cases; version 1 remains supported and requires
positive labels. Labels are bounded to 1 MiB and decoded as strict UTF-8 JSON.
Their exact byte digest, source manifest and acquisition identity accompany the
original evaluator result. Success means evaluation executed, not that any quality
threshold passed. `qualification` remains `not-certified`; external relevance and
model provenance are not authenticated. No automatic manual-review claim is made.

Vector coverage is reported separately from recall/MRR and negative-case false
positives. Queries absent from the frozen vector snapshot use honest lexical
fallback. All-negative cohorts have null positive recall/MRR, not fabricated perfect
scores. Unknown preparation, source mismatch or invalid labels fail without a
partial successful result. The command never starts a backend or changes project
records; compare the same frozen evidence repeatedly without a model call.

Node 26.11.1 tests cover cold-process three-way comparison, unchanged project bytes,
deterministic repeat output, no backend creation, missing/invalid/oversized labels,
out-of-scope labels, unknown evidence, source mismatch, and a deliberately incorrect
synthetic vector producing a reported negative-case false positive. These remain
offline wiring tests, not a manually reviewed real-model relevance cohort.
