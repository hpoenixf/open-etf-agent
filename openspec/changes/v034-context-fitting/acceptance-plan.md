# Frozen real-acceptance preparation, not execution

Runtime candidate: `93d060f1c3cfce9b4b30ef67e860cbb1a9b3eaeb`.
Its exact-head [Verify #132](https://github.com/hpoenixf/open-etf-agent/actions/runs/44288992028)
passed 1521 tests with 4 existing optional skips and zero failures; build passed.
This preparation does not modify those Runtime bytes. The JSON contract pins
all five changed Runtime source hashes and ten exact question hashes/byte counts.
The fixed synthetic source is local, public test data, not real securities.

## Provider-free preparation

Run `node scripts/acceptance/check-v034-inputs.mjs` at the repository root.
It reads only fixed local contract/source/code paths, checks shape and hashes,
and returns input fingerprints. It neither imports a runner nor reads credentials,
contacts a provider, or dispatches tasks. Extra CLI arguments are rejected.
`node --test test/v034-acceptance-preparation.test.mjs` additionally imports the
original source importer and Project APIs, validates all ten profiles, and submits
ten fixture tasks without calling work. This proves admission, not live execution.
The two initial integration-test assertion mistakes (Run versus task-definition
identity and expanded versus original question) were corrected against the
actual API, not by changing Runtime or weakening question equality.

## Normal ten-task cohort

`acceptance-inputs.json` fixes ten IDs/questions/rubrics and source identity.
All ten expect a completed, source-cited saved report. Case 1 is the no-soft-policy
control; cases 2–10 use a 256-byte advisory old-read target. The common profile
fixes capabilities, allowed tools, raw capacity and task limits. There are no
knowledge/embedding, Child, network-source or compaction capabilities.

Nine of ten is the normal semantic/delivery threshold, not a mechanical test
threshold. Count all ten original outcomes, including not-run, failed and unknown;
never substitute tasks or sum unrelated successful attempts. A successful report
must satisfy its frozen rubric, original citation readback, runtime completion,
artifact-required delivery and the declared deadline. Exact arithmetic/identity,
missing facts, units, dates, corrections and opaque identifiers are reviewed by
someone other than the executor. A substring matcher is not independent review.

The source asks for repeated explicit rereads. If a model does not actually make
them, a correct report alone does not prove A14 behavior. Preserve the original
Host trace: older read reference, protected latest two complete groups, same-ref
cold reread and source history equality. Missing observations remain unproven;
do not invent or retry a task to repair the denominator. Original
`research-cohort-delivery.mjs` may supply delivery observations only, never a
semantic/projection or release verdict.

## Separate mandatory engineering safety gate

`test/context-fitting-v034.test.mjs` covers hard-capacity refusal before new
reservation, narrow capability profiles, recovery, original byte preservation,
source identity rejection, paired groups and saved report behavior. Expected
capacity refusal, interrupted/recovered work and a saved report followed by a
capacity stop are **not** successful normal-cohort tasks. They were mixed into
the earlier scenario outline; this frozen plan deliberately separates them.
All safety checks must pass regardless of any 9/10 content result.

## Execution handoff after explicit authorization only

1. Recheck the contract and candidate hashes; freeze final commit/tree, returned
   input fingerprint and approved provider/model/protocol/encoded limit/config
   identity. Record independent reviewer and unchanged task IDs before dispatch.
2. Reconcile the existing cumulative request ledger and retain the two v0.33
   unknown outcomes and billing. Freeze remaining request/cost caps and stop rules;
   this plan supplies neither credit nor approval. No probe is permitted here.
3. Create isolated projects using the frozen common profile and each task's
   optional soft policy plus the approved live gateway config. Import exactly
   `acceptance-source.txt`; record the import receipt and manifest hash. Do not
   silently reuse a differently named or differently versioned manifest.
4. Submit each exact question with its fixed run ID and `artifact-required@1`
   through the original Project APIs/`research-cli.mjs`. Live submit requires the
   existing provider/data/cost approvals. Only the subsequently authorized executor
   may call `run work`; this preparation does not include an auto-start wrapper.
5. Execute serially, no automatic retries. Keep each physical dispatch, response,
   usage/billing and unknown record. Local refusal is not a remote request;
   timeout is not proof of zero fee. Resume only the same Run under its original
   recovery contract; do not replay an unknown request.
6. Read original report/Publication receipts and actual input projections, then
   independently assess the ten rubrics and separate safety gate. Freeze all ten
   outcomes before any release review; do not publish raw logs or credentials.

The existing `scripts/live-validate.mjs` supports only its old v01–v05 contract;
it must not be relabelled or used as a v0.34 executor. The supported path is the
original Project flow above, whose input admission is tested offline here.

Route, budget/ledger reconciliation and authorization are part of starting real
acceptance, still deliberately unbound. No real acceptance or release is claimed.
