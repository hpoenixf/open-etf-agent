# Real local embedding diagnostic — 2026-11-17, unreleased

Base: remote `wip/a20-continuation-20261117` at
`61fd7e8a1297276d3c181e7a094a930792f15264`, read back before work.
Stable `main` remains `14be5d2fb29a537b75fcc36ac40774608e1393d8` (v0.31.0).
This increment does not enable the in-Run dynamic-query authorization entry and
contains no material from the previously interrupted local candidate review.

The real model path now runs on the environment recorded below. **Retrieval
quality is not accepted:** all six frozen no-answer cases return sources in each
profile. Runtime success and 100% vector coverage do not establish abstention or
improvement over BM25. No stable version, release or remote publication is claimed.

## Identity, acquisition and license boundary

- Public, ungated `intfloat/multilingual-e5-small`, upstream revision
  `614241f622f53c4eeff9890bdc4f31cfecc418b3`; the pinned model card declares MIT.
  [Pinned upstream card](https://huggingface.co/intfloat/multilingual-e5-small/blob/614241f622f53c4eeff9890bdc4f31cfecc418b3/README.md).
- Nine selected runtime files, 492,795,290 bytes. Downloaded through public HTTPS,
  without credentials, terms circumvention or a hosted inference service. LFS
  files were compared to the upstream API SHA256; other files to upstream Git
  blob identities. All nine additionally have local SHA256 in the
  [download receipt](../../engineering/a20-local-embedding/model-download-receipt.json).
  Pickle/Python weights, ONNX/OpenVINO alternatives and unrelated files were not
  downloaded. The stateless `2_Normalize` module needs an empty local directory,
  as named in upstream `modules.json`; no model file was rewritten.
- [Model manifest](../../engineering/a20-local-embedding/model-manifest.json):
  SHA256 `943e6f6e81786dcbddbebd3d52f7f3df8ea535abf24e9823b5ec8374249bf3de`;
  dimensions 384, maxTokens 512, `passage: ` documents and `query: ` queries.
  Those prefixes follow the pinned card, not a heuristic. HTTPS/upstream checksums
  bind the selected published bytes; they are not a signed author attestation.
- Separate local CPython 3.12.13 environment on macOS arm64, torch 2.9.1,
  transformers 4.57.1, sentence-transformers 5.1.2, tokenizers 0.22.1.
  All 33 packages were pinned, installed as binary wheels from public PyPI with
  required archive hashes, and installed RECORD hashes checked. The complete
  [lock](../../engineering/a20-local-embedding/requirements.lock) and
  [package/license receipt](../../engineering/a20-local-embedding/dependencies.json)
  retain provenance and notices. Primary packages are Apache-2.0/BSD-3-Clause;
  transitive packages also include MIT, MPL-2.0, CNRI-Python, PSF and bundled
  numerical-library notices. Local use only; no packages or weights are redistributed.
  This inventory is not a vulnerability audit or legal opinion.

Weights, environment, imported project, vectors and raw diagnostic logs live only
in ignored `test-output/a20-real-model-20261117/`. Published candidate files contain
code, hashes, authored corpus/labels and compact receipts, without weights,
credentials, databases, private source documents or runtime state.

## Compatibility fixes and actual checks

The first actual model inventory failed with `MODEL_MANIFEST_LIMIT`: its tokenizer
JSON is 17,082,730 bytes. Only root `tokenizer.json` now has a 32 MiB bound; other
JSON remains at 2 MiB. JSON custom-code checks, complete file hashing, total model
limits, safetensors and ordinary-file/path restrictions remain in effect. This
bounded exception applies in both manifest preparation and the worker.

SentenceTransformer 5.1.2 first tokenizes a prompt-only string for pooling metadata.
The worker now admits at most one such exact prompt probe before the full batch,
including standard Transformer's prompt-only whitespace stripping. Full data IDs
must still equal the untruncated preflight IDs, with exactly one full batch. The
first real forward probe rejected the trailing-space token mismatch with
`EMBEDDING_PROCESS_EXIT`; the failure and diagnostic hashes remain in
[failures](../../engineering/a20-local-embedding/failures.json). New fixture
regressions failed before each correction. These fixture results are separate from
the real checks below.

[Real receipt](../../engineering/a20-local-embedding/real-receipt.json):

- Real CPU document and query encoding in both languages, including the same text
  under both role prefixes. Token counts were 11/12/12/13. Token ID digests matched
  the independent tokenizer reference. Vectors matched an independently written
  AutoModel masked-mean-pooling/L2-normalization implementation, maximum absolute
  component difference 0 for all four probes on this environment. Both paths use
  the same pinned weights and upstream tokenizer; this is implementation agreement,
  not independent mathematical/model-quality certification.
- A real 1,205-token document is rejected before encoding rather than truncated.
  Its expected fail-closed worker error is `EMBEDDING_PROCESS_EXIT`.
- One preparation persists 8 page and 16 query vectors. A second acquisition
  reuses exactly those page vectors and encodes one new query only.
- Fresh Node processes execute inspect/query/evaluate/export from frozen evidence.
  Additional readback forbids backend creation; repeat evaluation is byte-identical,
  original source text is read back, and project-file hashes remain unchanged.
  An unprepared exact query falls back to BM25. No model is loaded by readback.
  This is acquisition/frozen-query cold recovery, not a new Host/Run chat cohort.

## Frozen independently adjudicated comparison

The [authored corpus](../../engineering/a20-local-embedding/cohort.json) contains
8 short bilingual passages, 10 positive questions and 6 no-answer questions.
An independent agent in a clean context read every passage and proposed label
before any ranking observation. One ambiguous negative was replaced before the
final freeze; no labels, prompts, k or retrieval thresholds were tuned after results.
The [review receipt](../../engineering/a20-local-embedding/label-review.json) binds
cohort SHA256 `0d9316b5b7ee4fe83de58c47b71da12598497b4e4f3dedadf91770d64b2bfde4`.
The requested reviewer was the latest available Luna (`gpt-6-luna`); the interface
did not expose resolved model identity. This is agent adjudication, not independent
human labelling, a production financial benchmark or paired-language equivalence.

The [labels](../../engineering/a20-local-embedding/labels.json) and
[source binding](../../engineering/a20-local-embedding/cohort-binding.json) were
frozen before preparation. [Full evaluator output](../../engineering/a20-local-embedding/evaluation.json)
includes original SourceIDs and all returned ranks, not selected examples.

| Profile | Recall@4, 10 positives | MRR@4, 10 positives | No-answer false positives, 6 negatives | No-evidence accuracy |
| --- | ---: | ---: | ---: | ---: |
| lexical | 0.90 | 0.85 | 6/6 (100%) | 0/6 |
| BM25 | 1.00 | 1.00 | 6/6 (100%) | 0/6 |
| hybrid | 1.00 | 1.00 | 6/6 (100%) | 0/6 |

Vector coverage is 16/16 queries, including all six negatives; all 8 pages have
vectors. There are no byte/encoding-limited rows in this cohort. Hybrid shows no
measured gain over BM25 here. “False positive” means retrieval returns any source
for an independently empty relevance set; no generated-answer correctness was
measured. The actual lexical token overlap and positive-cosine hybrid admission
rules do not establish answerability. Correcting that contract requires separate
allowed design/implementation work; this increment does not change historical
retrieval/task identities or import a stopped candidate.

## Reproduce explicitly

Use a new local model directory. Fetch each fixed URL in the download receipt,
verify its SHA256, preserve relative names, and create the empty `2_Normalize`
directory. Retain the pinned upstream card/license declaration with local material.
Do not use `snapshot_download` defaults that fetch pickle alternatives or remote
code. The checked-in manifest is external to the model directory.

```sh
uv venv --python /absolute/python3.12 /absolute/a20-env
uv pip sync --python /absolute/a20-env/bin/python --require-hashes --only-binary :all: \
  --index-url https://pypi.org/simple engineering/a20-local-embedding/requirements.lock
node engineering/a20-local-embedding/verify.mjs \
  --python /absolute/a20-env/bin/python --model-dir /absolute/selected-model \
  --model-manifest /absolute/model-manifest.json --output /absolute/new-diagnostic-directory
```

The output directory must not exist. The harness uses only explicitly selected
local model files, authored corpus and existing prepared-knowledge commands. It
never runs chat tasks or enables dynamic retrieval. A runtime-diagnostic pass can
coexist with failed no-answer quality. The structured evaluator remains
`qualification: not-certified` and has no automatic semantic pass threshold.

## Verification and remaining gates

The execution-input hash inventory binds the actual code/tests used by this
increment. Consult the accompanying regression receipt for the single fresh full
batch and its source identity. Earlier `158ede33` and evaluate-only counts remain
historical; do not add them to this batch. The focused tests, Python tests, real
CPU probes and complete Node regression are distinct kinds of evidence.

No paid model request occurred; new billable unknowns are zero. Historical errors,
unknown calls/costs and reservations were not opened, cleared, refunded or replayed.
The old interrupted candidate was not imported or re-reviewed. Its original refusal
is not treated as lifted. Run dynamic-query authorization remains closed.

Release gates still outstanding: meaningful no-answer semantics, broader relevance
qualification, original owner/budget integration if dynamic retrieval is ever
separately allowed, a frozen real ten-task cohort and applicable exact-head CI and
release qualification. This local real-model diagnostic does not replace those gates.

### Final frozen-code local regression

[Regression receipt](../../engineering/a20-local-embedding/regression-receipt.json)
and [416-file execution inventory](../../engineering/a20-local-embedding/execution-inputs.json)
bind the one complete accepted batch: explicit Node 26.11.1, **1,478 passed,
4 skipped, 0 failed** out of 1,482 tests. The four skipped fixed-old-binary cases
remain unverified, with their exact names in the receipt. Python worker-contract
fixtures separately pass 6/6 under Python 3.14.7; actual model probes use CPython
3.12.13. The 48 focused tests are a subset of the full Node suite and are not added
to it. Build and documentation checks also pass under the explicit Node 26.11.1
executable. The frozen inventory was verified unchanged after execution.

The first `npm` invocation selected an ancestor Node 25.9.0 shim and the host's
noncanonical `/var/folders` temporary path, which strict owners rejected. That
owned test process was stopped; its incomplete log remains retained and excluded.
The accepted full batch used an explicit Node 26 executable and a canonical local
temporary directory, without weakening product path checks or editing source to
hide those failures. All failures and older partial observations remain separate.
No exact-head remote CI or real ten-task Run qualification has been executed for
this unpublished increment.
