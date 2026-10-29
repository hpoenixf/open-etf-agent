# Explicit, bounded live validation

Default `npm test`, `npm run build` and `npm run demo` remain offline. The explicit runner requires **your own** provider, synthetic-data and cost authorization; no previous operator's private ceiling is inherited. No command reads a real config or starts a request by default.

Use Node 26.11.1. Select a clean baseline repository root checked out at one of the fixed original or read-back remote commits in `scripts/live-version-pins.json`; do not overwrite uncommitted work. The CLI never switches revisions itself. Every source/fixture blob is checked before code import. Published and original commits have different IDs but independently verified identical trees. Unknown commits, wrong version selections, dirty worktrees and non-root directories are rejected before network dispatch.

The following is an explicit command shape, **not an instruction to spend money without authorization**. Replace placeholder paths, endpoint and model with your own approved scope. `--max-total-cny 800` reserves at most eight CNY 100 attempts for a single version; it is a ceiling, not a target. The same selected ledger must be reused across versions and process restarts, never reset to evade the cumulative limit.

```sh
node scripts/live-validate.mjs \
  --version v01 --baseline /your/clean/pinned/baseline \
  --config /your/owner-only/ignored.env \
  --ledger /your/shared/local-ledger --output /your/new/local-output \
  --base-url https://your-approved-provider.example/v1 --model your-approved-model \
  --max-total-cny 800 \
  --confirm-provider --confirm-synthetic-data --confirm-cost
```

The owner-only ignored config contains exactly `CHAT_BASE_URL`, `CHAT_API_KEY`, `CHAT_MODEL`. Never put credentials in command arguments or baseline tracked files. Unknown request outcomes block further use of that ledger; there is no automatic resume or retry. Configuration scope and budget checks are local safeguards, not a provider-side billing guarantee.

Tests inject a test-owned Git identity/status executable while hashing an immutable seven-file original public v0.1 fixture closure and running that original Runtime/Gateway with a fake provider. They create no extra Git worktree and require no sibling checkout. This fixture test is not a claim of a new remote live run; the original five real runs retain their earlier adapter hashes.

<a id="release-qualification"></a>
## Release qualification amendment — 2026-10-29

This amendment raises the existing release gate for **normal real-model tasks** and for requalification of previously delivered versions with comparable live claims. It supersedes the earlier Runtime-only acceptance policy for these claims; it does not rewrite historical evidence, certify investment quality or authorize requests. Offline Runtime, installation, original-byte readback and other required Spec checks remain necessary. An offline-only demonstration may retain its explicit experimental/offline scope, but cannot stand in for a qualified normal real-model release.

### Freeze the claim and experiment before dispatch

Record the plan in the existing version's Spec/verification evidence, not a second release registry. Freeze:

- Repository, full implementation commit and relevant input/fixture/adapter hashes; Runtime/environment and supported configuration.
- Approved provider route, model/version and request settings; exact prompt/method and input/corpus identities (keep private material local; publish only approved summaries/hashes).
- Representative task-case matrix, per-case end-to-end success criteria, required mechanisms and readback evidence, planned repetitions and order, and explicit exclusions. Cover the declared normal workflows and affected shared Runtime contracts; broader release claims need representative cases across the supported functionality and input/complexity ranges. Repeating one easy example is not full-feature coverage.
- Per-request and whole-task deadlines, bounded model/tool/retry/token/response limits, total run/request allowance and shared cumulative cost ledger, plus stop conditions and the authorized no-overage boundary. A task run and each physical request are counted separately.
- How task completion, bounded answer correctness/usefulness, required-mechanism coverage and Runtime anomaly handling will be assessed **separately**. A mechanism pass does not prove useful/correct answers; answer review must not promote unreviewed financial semantics.

### Normal end-to-end floor: at least 80%

An eligible success completes the pre-registered normal task through the actual Runtime/provider path within its frozen deadline and limits, satisfies the stated task criteria, and has the required original-output/readback evidence. HTTP 200, process exit, a terminal Run, a tool call or a readable empty/irrelevant report alone is not task success. A lawfully refused or safely stopped normal task may demonstrate correct Runtime behavior but is not a completed normal task.

For each version in the authorized real-request recheck, pre-register **five independent end-to-end runs for that version and require at least four successes (4/5)**. Do not pool runs across versions and do not silently expand the user's five-run allowance into five per case. The version's fixed task-case matrix assigns those five runs to its declared workflows and required mechanisms before dispatch; its coverage requirements remain separate from the aggregate 80% floor. A mandatory capability left unexercised does not become qualified because easier runs passed. Broader release claims need a representative matrix across supported functionality, not repetition of one easy example; if five runs cannot support that scope, narrow the claim or obtain the additional authorized evaluation scope before proceeding.

This is an observed sample gate, **not a statistical guarantee that population success is at least 80%**. Publish each version's case assignments, sample size and limits with the claim; stronger reliability claims require an appropriately designed larger evaluation, not an unapproved increase in this recheck's repetitions.

Use all pre-registered normal runs as the planned denominator; show attempted and not-run counts separately. Every started run remains in the attempted denominator, including failures, timeouts, cancellation, unknown outcomes and missing readback. Not-run cases do not count as successes, and an incomplete planned batch cannot pass. Late output after the task deadline does not turn that run into an on-time success. Do not aggregate unrelated versions, models or changed freezes to manufacture a qualifying percentage.

If the plan requires Child, MCP or another mechanism and the model does not exercise it, record **not exercised** and the case does not qualify, even if some prose was delivered. If a task does not need that mechanism, do not force it into every case. Keep task outcome, mechanism coverage and Runtime correctness as separate columns. In particular, the historical v0.1–v0.5 record's 16 physical requests across five Runs, or four completed Runs out of five across versions, is not five repeats of any one version/case and is not current qualification.

### Runtime exceptions and safety are a separate gate

Pre-register the applicable abnormal-case matrix from the actual Runtime/Spec boundary: slow or absent responses, per-request and overall timeout, cancellation/disconnect, malformed/truncated/oversized responses and tool arguments, provider errors/rate limits, budget exhaustion, partial execution, unknown request/effect outcomes, and supported process interruption/restart/readback. Exercise only supported contracts and disclose untested recovery profiles. Use controlled fault injection where appropriate and label it as provider-free; never pass it off as a real provider observation.

Each required abnormal case must show its expected bounded stop/refusal/recovery, preserved identities/evidence and resource cleanup; unsupported unsafe retries remain refused. These expected failures are **not normal-task successes** and must not be added to the normal 80% numerator or denominator. A timeout safely handled is evidence of timeout handling, not evidence that the original task completed.

Safety/authorization violations, forged source/provenance or execution-success claims, and unintended duplicate side effects are **zero-tolerance release blockers**, regardless of the normal success percentage. Safe refusal of hostile input is not such a violation. Missing mandatory abnormal-case evidence also blocks the corresponding support/release claim.

Calibrate reasonable deadlines during a separate diagnostic phase using the scenario, expected work/request count and observed latency within the user-acceptable window. Freeze the deadline rationale before qualification. Do not use unlimited retries, progressively longer timeouts or relaxed criteria to turn a failed batch green; a longer deadline is a changed support claim, not repair evidence.

### Debugging, qualification and historical rechecks

Keep diagnostic runs separate from the pre-registered qualification batch. Retain **all** diagnostic and qualification attempts, failures, unknowns, elapsed time and physical-request/cost totals in the existing shared ledger/evidence; publish sanitized counts, not private raw logs. An unknown cost is not zero or a refund. Existing unknown-outcome ledger blocks and authorization limits remain in force.

Changing code, provider/model/settings, prompt/method, cases, limits, deadline or success criteria ends that freeze. Diagnose and repair the relevant cause, record the reason, then pre-register and freeze a new qualification batch (a separate new set of five runs for that version in this recheck, within the valid cumulative authorization). Do not mix old and new results, erase the previous denominator/cost, rerun until a preferred result appears, or present only the last green batch. Show both the new fixed-batch result and the complete campaign history; a new batch needs a documented rationale, not selection of a lucky run. Already-sent effects and unknown requests must not be replayed to improve a score.

For the user-requested recheck of earlier comparable live validations, inspect each original fixed version and its declared scope before selecting cases. Preserve tags, releases, old Specs and immutable receipts. Record a dated amendment linking the original version/evidence, what the higher standard does or does not establish, the actual new fixed baseline, the case plan, results and remediation owner. Where the old version cannot meet the gate, distinguish observed failure from missing/not-run/blocked evidence and explicitly say **not qualified under the 2026-10-29 standard**; do not claim every old version failed empirically. Fix maintained code and requalify a new fixed candidate where authorized; never move an old tag or backfill new measurements as if they existed at its release.

A release decision links the complete frozen normal batch, separate anomaly/safety evidence, required engineering/install/readback checks and remaining limitations through the existing verification index. Insufficient evidence stays pending/blocked or a narrower explicitly experimental claim; having already published a Release does not waive this gate. This document does not execute cases, implement an automated 80% gate, certify any existing version, expand authorization, or replace the sole publisher's review and remote readback.

## Reusable boundaries

- `loadLiveConfig` accepts an explicit trusted authorization object, expected endpoint/model, and selected file. It validates scope before reading; returns a non-enumerable credential; does not mutate `process.env` or evaluate shell text.
- `openLiveLedger` owns a single durable ledger shared across versions. It reserves before sending and blocks restart continuation after an unsettled prior-owner request. A reserve is not a charge. No automatic retries or automatic release of unknown costs.
- `createControlledFetch` constrains requests, tokens, response bytes, deadlines, endpoint and honest identity. Provider failures and billing anomalies are observable, not reasons to switch accounts or impersonate another client.
- `runPinnedValidation` injects the controlled transport into the exact frozen Gateway/Runtime. It checks real report bytes after return and retains typed proposal-shape diagnostics without logging arbitrary text or authorization headers.

The [first-batch record](verification/live-v01-v05-first-batch.md) distinguishes Runtime behavior, actual file receipts, subscription billing and historical model-prose observations. Its Runtime-only acceptance policy was the historical 2026-10-27 scope; the dated release amendment above now governs normal real-task qualification and earlier-version rechecks. This legacy runner by itself makes no task-success-rate or semantic-success assertion.
