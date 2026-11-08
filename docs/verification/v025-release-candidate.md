# v0.25.0 candidate: once Scheduled tasks

[简体中文](v025-release-candidate.zh-CN.md) · [Module and commands](../scheduled-tasks.md)

**Prepared candidate, not a publication/CI declaration.** The release owner makes
the final Runtime-only gate declaration; model research quality is reported
separately, not introduced as an additional hard release gate here.

The module adds explicit confirm/list/inspect/run-due/cancel over original
Project/Schedule/Session/Worker and Admission. Atomic fresh observation prevents
a competing wake from implicitly resuming another materialized Run. No cron,
recurrence, notifications, new executor, or Schedule+Knowledge/Response/Child.

## Fixed sources and real evidence

The tested product core is `1afb49ae75c6322cd95442a1868d1ec90f7164cf`.
Candidate preparation exports the staged WIP tree
`e7caceb0652c350539494f92454a2538f57bb7ec` (WIP `d5714402`); product src and scripts remain byte-identical; the test-only checkpoint fixture correction is documented below. Version metadata and documentation changes
are separate from that real execution, not invented as a new tested commit.

The [independent supplement record](v025-rebuild-supplement03.safe.json) retains:
- nine frozen scenarios RB25-02–10, Runtime contracts observed 9/9;
- ten prospectively selected normal model-bearing logical tasks: RB25-02/03/04,
  two distinct RB25-05 tasks, and the RB25-06/07 survivors plus RB25-08/09/10;
- ten persisted, byte-read reports and 30 original complete responses / native
  adoptions, all `usage.cost=0`, `billing_source=go`, no new unknown;
- both original estimated fields omitted on all 30 bodies. The sink's normalized
  `estimated=false` is **not** an explicit provider field;
- old unknown requests, failures and the canceled whole allocation remain held.
  Unused 78 of this whole108 allocation are not refunded.

The ten-task mapping was defined by questions/aliases before execution, not chosen
from successful reports. It is not ten scenarios, not a rerun of RB25-01, and not
a merged completion of the original interrupted cohort. Original nine-case score
remains unchanged. Owner exit0 and registered-group readback do not establish all
escaped descendants stopped or remote settlement.

## Content quality remains separate

Eight logical-task reports have confirmed acceptable content quality; two retain
original model issues despite correct core facts/source assignment:
- **RB25-06:** treats the numerical difference between 20 and 50 as unknown when
  explicit negation is absent, confusing a deducible difference with missing text.
- **RB25-09:** narrows the stated category support for UTF-8 labels to individual
  examples, treating other labels as unknown.

Neither is a Runtime rewrite. Do not call all ten answers semantically correct.
Scope is synthetic materials, not real fund research or investment advice. Final
CI, release metadata, README generation and publication are still separate steps.

## Later CI failure and test-fixture correction

WIP `d5714402` CI built successfully but passed 997/999. Two `durable-correction` process-death tests expected SIGKILL but observed signal null; the failures remain recorded. The original fixture has a 150ms lease: one controlled pause beyond that lease reproduced STALE_WRITER and natural exit, establishing a mechanism, **not the actual CI root cause**. The candidate only changes `test/fixtures/correction-child.mjs` to wait synchronously for at most four seconds after checkpoint IPC flush, allowing the original parent to perform real SIGKILL within its existing five-second bound. Product Runtime/Session, lease, test deadline and assertions are unchanged. All four original `durable-correction` tests passed after this correction (824ms). The earlier 999-test suite is not relabeled as a complete run after this test-only change, and the failed CI is not hidden by a rerun.
