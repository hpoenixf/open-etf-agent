# v0.25: once Scheduled tasks

[简体中文](v025-release.zh-CN.md) · [Commands](../scheduled-tasks.md) · [Detailed evidence](v025-release-candidate.md)

## Runtime qualification, not ten perfect answers

The independent supplemental run has **ten preplanned normal logical tasks in nine scenarios**. RB25-05 contains two different questions; the canceled and expired siblings in RB25-06/07 were safety controls, not normal tasks. All ten original tasks completed within their original deadlines and retained their report bytes, original Admission, response and native-proposal adoption. The existing frozen Runtime threshold is at least 9/10: observed **10/10**. The original scenario result remains **9/9**. No failed batch or unknown request is relabeled or pooled into this cohort.

The [ten-task declaration](v025-runtime-release-decision.safe.json) binds the [fixed execution inputs](v025-execution-inputs.safe.json). The declaration checker validates its fields, not the underlying evidence or permission to publish. Independent readback separately verified the original 30 complete bodies/adoptions and ten reports. Each task used three requests. All original bodies said `usage.cost=0` and `billing_source=go`; both estimated fields were absent, not explicitly false. No new unknown occurred. The previous unknown, aborted attempt and all whole-range allocations remain recorded; unused reservations are not refunded.

**Content quality is separate: eight confirmed passes, two retained model issues.** RB25-06 treats the deducible difference between 20 and 50 as unknown without explicit negation. RB25-09 weakens stated UTF-8-label support to individual examples. These errors were in original model text, not Runtime rewrites. This is synthetic-source qualification, not real fund research or investment advice.

This execution-manifest digest was constructed after the run to bind the preserved original frozen inputs; it was not a digest recorded before dispatch. All ten reports have file-byte readback; only RB25-09 additionally has cold HTTP readback.

## Fixed implementation and release boundary

The real execution used product core [1afb49ae](https://github.com/hpoenixf/open-etf-agent/tree/1afb49ae75c6322cd95442a1868d1ec90f7164cf). Its local full suite passed 999/999 plus build; later documented WIP CI also passed the same suite. The final package keeps the executable product source bytes; all tests except the single fixture correction below are unchanged. Package/lock changes are version-only, alongside documentation. Final-package validation, remote CI, main/tag/Release publication and article/site publication are distinct steps; this evidence page is not itself a publication receipt.

The CLI reuses original Project/Schedule/Session/Worker/Admission. It supports explicit once confirmation, inspection, cancellation and a finite due-work sweep. Atomic fresh materialization prevents a competing wake from implicitly resuming another Run; unknown work remains occupied. No daemon, cron, recurrence, notifications, new job database, or Schedule+Knowledge/Response/Child support is claimed.

## Later CI failure and test-fixture correction

WIP `d5714402` CI built successfully but passed 997/999. Two `durable-correction` process-death tests expected SIGKILL but observed signal null; the failures remain recorded. The original fixture has a 150ms lease: one controlled pause beyond that lease reproduced STALE_WRITER and natural exit, establishing a mechanism, **not the actual CI root cause**. The candidate only changes `test/fixtures/correction-child.mjs` to wait synchronously for at most four seconds after checkpoint IPC flush, allowing the original parent to perform real SIGKILL within its existing five-second bound. Product Runtime/Session, lease, test deadline and assertions are unchanged. All four original `durable-correction` tests passed after this correction (824ms). The earlier 999-test suite is not relabeled as a complete run after this test-only change, and the failed CI is not hidden by a rerun.
