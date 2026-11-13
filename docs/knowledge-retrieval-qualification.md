# Knowledge retrieval qualification: v0.31 candidate

This is an **unreleased candidate procedure**, not a release receipt. The current
implementation can consume a finite frozen set of page and exact-query vectors.
It does not acquire embeddings, authenticate provider labels, or prove semantic
relevance from synthetic vectors. Do not equate successful recovery, a good
fixture score, or backup completion with product acceptance.

## Inputs and isolation

Use an existing project with imported, explicitly authorized sources. Obtain its
fixed manifest and actual SourceIDs using the project's existing source tools.
Do not put credentials, raw provider logs or private source data into a repository.
Use a separate local evaluation JSON file with up to 16 manually reviewed queries:

```json
{"schemaVersion":"knowledge-retrieval-evaluation@1","provenance":"externally-supplied","k":4,"cases":[{"query":"the exact query","relevantSourceIds":["actual-document@actual-version:p1"]}]}
```

The `knowledge-vector-evidence@1` file must contain provider id/model/revision,
fixed dimensions, every admitted page's SourceID and original text SHA256 plus
its vector, and each supported query's SHA256 plus its vector. The schema and
bounds are checked by `src/knowledge-vectors.mjs`. Vectors must come from the same
model/revision and compatible dimensions; the supplied labels are a claim, not
an authenticated proof that this happened. Manually authored vectors must use
`synthetic` evaluation provenance. Missing exact query vectors are reported and
fall back to lexical retrieval; they are not successful vector coverage.

Acquiring real embeddings is a separate authorized operation. Confirm its input
scope, existing identity, budget/unknown-call ledger and retention before any
provider request. This evaluator has no network/provider transport and does not
request a model or retry missing vectors.

## Reproducible comparison

Run with the project's supported Node runtime:

```sh
node scripts/evaluate-knowledge.mjs --project PROJECT_DIR --manifest MANIFEST_SHA256 --vectors VECTORS_JSON --cases CASES_JSON
```

The command only reads the selected project source snapshot and the two explicit
JSON files. It prints JSON to stdout, with no auto-publication or task execution.
The output binds the catalog, labels and vector evidence by digest and compares
legacy lexical, BM25 and frozen hybrid against the same original sources and
query labels. Each query lists returned SourceIDs, Recall@k, reciprocal rank,
vector availability and byte/encoding truncation. Aggregate MRR@k and Recall@k
include fallback queries; inspect `vectorCoveredQueries` separately. A missing
vector must not be counted as an independently tested semantic result.

Review the actual original pages before accepting the relevance labels. Include
synonyms with no lexical overlap, lexical exact-match controls, ambiguous terms,
wrong-version documents, query scope only/prefer and no-evidence cases. The
current label evaluator requires at least one relevant SourceID per case;
no-evidence false-positive cases remain a separate behavioral test, not a zero
label set silently excluded from metrics. Consider context byte limits when
interpreting recall. There is no automatic numeric pass threshold and every
output remains `qualification: not-certified`, including external inputs.

## Remaining release evidence

- Real provider provenance and permitted data scope, with reviewed query labels.
- Exact provider/query coverage, failures and unknown-call accounting.
- Original Host report citations and separate-process recovery without replay.
- Cancellation, immutable task admission, changed-source failures and scope tests.
- Complete exact-head regression, independent review and applicable original CI.
- Existing qualified model-run gate under the shared verified budget.
- Separate code, documentation, remote readback and deployment/release receipts.

Do not publish v0.31 as full A20 parity until the outstanding contracts in its
proposal and these release boundaries are actually satisfied.
