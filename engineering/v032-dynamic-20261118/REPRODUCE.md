# Reproduce the fixed 0.32 candidate

Behavioral execution pin: `4238a6471c9f653c1e8cf3d3cd9a5f3b66694654`.
The final package only changes version metadata, documentation/specification and
reviewed evidence after this pin. Every `src/`, `scripts/`, test and fixture byte
and every locked dependency remains equal to this execution source. The full
427-file inventory in `final/PLAN.safe.json` describes the **pre-packaging** inputs;
the later version/docs bytes are explicitly different.

## Provider-free checks

Use Node 26.11.1 (declared supported range >=26.8.1 <27), a canonical absolute
`TMPDIR` you own and the checked-in lockfile:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run docs:check
npm run build
npm test
node scripts/check-article-coverage.mjs --check
node scripts/release-qualification.mjs engineering/v032-dynamic-20261118/final/QUALIFICATION.safe.json
openspec validate v032-knowledge-continuation --strict --no-interactive
```

The release declaration checks structure and recorded eligibility; it does not
execute or authenticate a real task. Article `--check` reads immutable existing
fixture receipts; it does not run new article cases. The two real-model receipts
are separate from those checks. Python contract fixtures run with the pinned
Python: `python test/local-embedding-worker.test.py` (six tests).

## Rebuild original admitted inputs

1. Obtain the exact public E5 model revision and pinned Python wheels using the
   hashes in `engineering/a20-local-embedding/model-download-receipt.json`,
   `model-manifest.json` and `requirements.lock`. Do not use a floating model.
2. Write each `cohort.json` document's `text` bytes, **without a trailing newline**,
   to `<id>.txt`. Import all eight with `importProjectSources` or
   `source import --files FILES.json`. The resulting manifest must be
   `c16c472150d398815823e21b6d91b0d589a218eeeba5e1c19b66a1b364ec3b8c`.
3. Start a Project with the final config's Knowledge/limits and with
   `knowledgeQuery` omitted for initial preparation. Prepare one seed query
   `["__page_vector_cache_seed__"]` with `scripts/prepared-knowledge.mjs prepare`
   and the verified absolute Python/model/manifest paths. Use acquisition `pages`.
   Export its frozen evidence with `prepared-knowledge.mjs export`.
4. Call `pageVectorIdentity(evidence)` from `src/knowledge-query-tool.mjs`. Set
   `knowledgeQuery` to the final config, substituting that identity and your verified
   manifest identity, then update with `updateResearchProject` using the original
   config digest. The eight page vectors are reused; none of the ten business
   query hashes may appear in the prepared queries. Model manifest digest for the
   qualification is `943e6f6e81786dcbddbebd3d52f7f3df8ea535abf24e9823b5ec8374249bf3de`.
5. Submit the ten **unaltered** question strings from `final/PLAN.safe.json`, with
   the imported source manifest and the exported page evidence. Explicit provider,
   selected-data and cost approval is required for a live Project. Supply a private
   `local-embedding-runtime@1` mapping at work time; see
   [the usage guide](../../docs/dynamic-knowledge.md). Keep the exact configured
   DeepSeek model and official endpoint. No backend injection is accepted for live.

## Execution and judgment

The recorded tasks were executed once each in sequence, reserving every physical
send durably **before** fetch. The fixed global cap was 30 requests at a conservative
$1.75 hold each, no automatic retry, no top-up, no new billing, stop immediately on
unknown outcome, nonzero/unknown cost, wrong model or non-Go billing. A failed
process stops subsequent dispatch; do not continue merely because an earlier
outcome is no longer `not-run`. Historical allocations and the first cohort's
25×$3.50 holds remain retained. This record is not an authorization to reuse the
original account or spend its remaining allowance.

For each task: preserve exact query/limit/scoping, original Session/effect/grant,
source IDs and hashes, local-operation counters, actual model/cost/token usage,
and output digest; reopen `run report` in a fresh process. A complete query effect
must show two reserved and dispatched local operations, one completed query and
zero unsettled queries. Cold terminal readback needs no embedding runtime and
must not add ledger entries. Retain every outcome and all failures in a denominator
of ten. A new installation/run can produce different model prose; no deterministic
model-quality reproduction is promised.

Review returned original pages against each frozen `expectedContent`, including
both saved report and final answer. Reject invented facts, zero substitutions,
changed conditions/exclusions or whole-collection absence from partial evidence.
N01 is an explicit missing-value statement, while N02–N06 lack sufficient returned
evidence. Relevance labels and ranking thresholds were not changed. Qualification
requires at least nine complete eligible tasks, plus separate safety/install/CI
checks. The final observed result is ten; the first candidate remains eight strict
content successes and is not merged into that numerator.

Raw requests, credentials, model weights and Session databases remain excluded.
`first/` and `final/` contain reviewed original product outputs, source excerpts,
per-task receipts and hashes, not raw request logs. Full regression and compiled
CPU reference receipts have their own provenance and do not increase the real-task
count. The older prepared Luna cohort remains a separate historical observation.
