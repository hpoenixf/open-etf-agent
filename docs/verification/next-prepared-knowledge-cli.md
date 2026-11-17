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
