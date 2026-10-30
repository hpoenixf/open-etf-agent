# v0.15.1 — focused Runtime repair

This patch is based on the existing public v0.15 main tree. It does not include
v0.16 revocable-library work, a new provider, or the separate portfolio demo.
Existing historical tags and verification records remain unchanged.

## Repairs and regression boundaries

- Preserve effect receipts during working-input compaction. Only complete,
  successful, verified read-only groups are eligible for summarization. A mixed
  or unknown-effect group is retained. `save_report` receipts are not summaries.
- A trusted direct extension can declare `historyCompaction: 'read-only@1'`.
  This is a compaction-selection capability, not permission to execute a tool or
  read a source. Unknown bindings and existing plugin-loader bindings default to
  retention. Memory reads still use their original currentness checks.
- Notes-enabled Hosts capture the trusted capability and bind a stable policy
  identity. Older compaction checkpoints fail closed; this is not an automatic
  migration or replay mechanism. Hosts without notes keep their previous shape.
- Correct nullable SSE fields without accepting invalid tool identities; classify
  recognized non-success finish reasons as failures, never publishable answers.
- Make calculation schema types explicit while retaining the original mutually
  exclusive branches and Host validation. Only the three explicit, unbound,
  zero-dispatch validation errors can receive one bounded correction. Bound
  ResultRef failures, effects and permissions do not gain retries.
- Verify durable correction counters and persisted rejection identities; retain
  the authoritative post-claim state and persisted child cancellation scope.
- Report mandatory Context capacity exhaustion with
  `CONTEXT_CAPACITY_EXCEEDED`, without increasing the context window, replaying a
  saved report or inventing success.

- Narrow specialist Child bindings by removing only the exact Main-only
  Publication capability. Every other binding remains unchanged and handoff
  readback verifies the same restricted identity. Main can publish its own text;
  a Child still cannot publish. This fixes a separately reproduced composition
  failure, not a relaxation of the Runtime or Session authority gates.

## Remaining limitations

Historical provider streams have triggered `TOOL_FRAGMENT_ID`; their original
subcondition was not recorded. The rejection predicate is unchanged. A trusted
local diagnostic now distinguishes non-string versus conflicting-string IDs,
closed JSON type, and two booleans without recording ID values or raw streams.
This observation is **not a root-cause fix**. A later valid response does not close
those historical failures. There is no automatic retry or alternate route.

Capacity safety tests prove explicit failure and receipt retention, not that
arbitrarily large tasks fit a fixed window. Exact source membership remains
mandatory. Earlier version scores and unsuccessful bound-calculation tasks are
not transferred to this patch.

## Verification status

The final code and test revision `90cdf913dad1da04f0fcb94cfa49588570424493`
passed all **490 provider-free tests across 78 files** in one integrated run on
Node 26.11.1, followed by the native ESM build. There were no failures or skips;
input hashes and owned-process cleanup were verified. This includes the new
Main Publication / specialist Child composition regression, receipt-preserving
compaction, correction/recovery, and stream diagnostic tests.

Five independent synthetic tasks then passed **5/5** against that same revision.
The fifth exercised the original source-check Child, its verified handoff, and
Main report plus Publication. Five logical tasks used six Runs and 17 provider
requests (15 Main, two Child), all with verified Go-plan zero-cost responses.
Five fresh terminal/Reader readbacks made no new model calls. An independent
readback verified Session facts, Publication, reports, sources and artifact bytes.
Failed harness setup/readback attempts and their subsequent narrow corrections
remain in the engineering evidence; they were not counted as live samples.

This release's subsequent change to this verification note is documentation-only:
all code and tests remain byte-identical to the executed revision above. The
remote publication commit has its own Git identity; tree/content verification,
not a claim that its new SHA was independently rerun, connects it to these results.

The historical stream-ID cause remains unresolved and was not reproduced in this
five-task batch. Neither 5/5 nor the offline suite establishes universal model
quality or a defect-free guarantee. Seven earlier result/cost-unknown reservations
remain preserved; this batch added none. No private documents, credentials,
databases, dependency directories or raw provider logs are included.
