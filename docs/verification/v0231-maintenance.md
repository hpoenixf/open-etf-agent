**English** | [简体中文](v0231-maintenance.zh-CN.md)

# v0.23.1: Runtime finalization maintenance

Knowledge remains the sole main module. This maintenance increment fixes two supporting Runtime lifecycle paths without changing Knowledge retrieval, source identity, model guidance, tool schemas, permissions or request budgets.

1. Keep the original Session heartbeat alive through asynchronous cleanup and final settlement. The existing writer, fence and lease expiry remain authoritative. The original Run deadline does not move, and cleanup cannot start new model or tool work.
2. Return durable cancellation when the Run is cancelled while yielding for a response. A no-op claim release no longer presents a cancelled question as still waiting. Ordinary question identity, deadline and one-time response adoption remain unchanged.

Ordinary Child test leases are now 5000 ms, while the explicit expiry scenario retains 150 ms. Cold-process tests still kill a separate process, read its final persisted Main/Child leases and wait for actual expiry. This changes test timing, not production defaults or recovery authority.

## Original ten tasks plus separately verified maintenance changes

The [existing Runtime-scoped decision](v023-runtime-release-decision.safe.json) remains tied to its original implementation and execution identity. Its ten-task mechanical **9/10**, observed Runtime contracts **10/10**, and strict complete-task quality **5/10** are unchanged. The earlier 8/10 also remains unchanged. No original task, failure, source identity or score has been replaced.

The [validation contract](../live-validation.md) permits reuse where execution inputs and affected contracts remain applicable. Independent review compared all 80 production files: 79 are byte-identical to the original ten-task implementation; only Runtime changes. This is **maintenance applicability**, not whole-source byte equivalence. The old execution-input manifest still describes the old execution and must not be used as a byte-identity claim for the new Runtime.

The two changed lifecycle contracts are covered separately by the seven current product regression cases, two independent review batches, Child cold-recovery checks and the current full suite. Coverage includes cancellation from another Session connection, expired and replaced writers, original deadlines, unknown model outcomes, known/unknown host stops, cleanup/readback exceptions and heartbeat shutdown. Old K10 tests host-stop continuation, not the waiting-for-response branch; the separate cancellation regressions cover that branch.

The fixed implementation [a9223e57](https://github.com/hpoenixf/open-etf-agent/tree/a9223e57b676f0bf0180769a348286d75c5ff647) passed **966/966 provider-free tests**, native ESM build and [exact-head CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/42151778991), including locked dependency installation. Node tested was **26.11.1**; the declared range remains **>=26.8.1 <27**. Independent lifecycle batches passed 12/12 and 13/13 checks, with overlap in product tests. The first batch deliberately retained the then-unfixed cancellation-return observation; the second verifies its repair. These counts are not additive or a new live cohort.

This evidence closes the affected maintenance contracts without another model batch. It does not prove every possible cleanup delay or concurrency pattern safe. Future behavior changes require their own affected-contract assessment.

## Keep subsequent incomplete observations visible

Two additional real-provider observations used the fixed source:

- An original-ten observation completed K01 and stopped on K02 HTTP 429: four physical requests, three complete Go-zero bodies and one unknown. Eight tasks did not run. K01's observed Runtime contract passed; its strict content did not.
- A separately frozen K03–K10 supplement completed K03–K07 and stopped on K08 HTTP 429: twenty physical requests, nineteen complete Go-zero bodies and one unknown. K09/K10 did not run. Five Runtime contracts were observed; strict content passed four of five, with a K03 evidence-description contradiction and a K05 wording caveat retained.

Neither batch qualifies as a new complete ten-task pass. They are not pooled, used to replace original tasks or added to the old numerator. Provider-blocked cases had no usable model answer and are not automatically Runtime or model failures. The particular 429 causes and remote effects remain unknown; unknown requests are not refunded or replayed. Raw requests, bodies, databases and private account records are not published.

## Package and publication boundary

[Structured maintenance record](v0231-maintenance.safe.json) binds the fixed production files, original cohort and separate regressions. The maintenance package changes documentation and root version metadata to 0.23.1; dependency entries remain unchanged. The existing v0.23.0 tag is retained, never moved. The record establishes source applicability, not final-package CI, remote publication or website verification; those remain separate release checks.

[Original Knowledge results and limits](v023-release.md) · [Usage](../knowledge.md) · [Verification index](README.md).
