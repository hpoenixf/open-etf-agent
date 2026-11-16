# v0.31 Local Knowledge: Runtime qualification and limits

[简体中文](v031-release.zh-CN.md)

Scope: explicitly selected text import, BM25 free queries and original source readback. [Use the local workflow](../local-knowledge.md). Existing interfaces remain; dynamic embeddings, new retrieval controls, hybrid qualification, health features, reports as a new requirement and private A20 parity are not this release's claims.

Fixed execution source: `18af35f3f84eb962e83f7eff7c48befc79e316f9`. [Frozen execution inputs](v031-execution-inputs.safe.json) · [Machine-readable Runtime decision](v031-decision.safe.json) · [Original prospective ten-task plan](../../engineering/v031-minimal-handoff/PLAN.safe.json).

The final independent cohort attempted all ten original tasks through the application with OpenCode Go / `gpt-6-luna`. Nine completed with original source identity, persisted output and fresh-process readback. All 27 physical requests returned complete model responses, were adopted by the original Runtime and reported Go subscription coverage with zero additional cost. No new unknown occurred. B03 remains failed: the model requested limit 5 although the advertised maximum was 4, and the original tool validator correctly refused before query execution. This is 9/10, not 10/10.

After proving B03 had a settled Gateway and no unknown or partial effects, only the pre-frozen, unattempted B04–B10 continued. The failure, original STOP and continuation proof remain; no task was replaced or replayed, and no source, question, model, limit or denominator changed.

Model instruction and prose quality are separate. The strict instruction score remains 8/10: B10 changed `imported documents` to `fictional notice`, despite delivering the original notice's correct storage statement. B04 retains extra commentary about other operations. B09 used the exact original no-match query once, scoped absence to the admitted collection, and completed with a persisted answer without invented citations. On 2026-11-16 the maintainer explicitly confirmed that model errors do not block Runtime-qualified publication. No failed task was promoted and the strict score was not rewritten.

The original `a18317f` cohort remains eight Runtime completions / six strict successes, 26 requests, an expired-credential refusal and one unknown cost. The first repair remains ten completions / nine strict successes with 29 requests. The second repair remains eight completions, a B09 correction-limit failure and one not-run task with 28 requests. They do not supply this cohort's numerator. All prior unknowns, allocations, failures and original evidence remain retained locally; no old balance was inferred or refunded.

Fixed-source provider-free regression passed **1,396 tests**, zero failures, with four optional historical-binary compatibility checks skipped. Those skips are not passes. Actual local runtime: Node 26.11.1 on macOS arm64; declared support remains Node 26.8.1–26.x. Build and reviewed module documentation checks passed. Independent read-only code review found no implementation blocker; its endpoint documentation finding was fixed and re-reviewed. CI and install evidence are recorded separately in [release packaging verification](v031-packaging.safe.json).

Release preparation changes package/root-lockfile version metadata, documentation and historical recovery-test timing only. Every `src/` byte and locked dependency version remains identical to the execution source. The package/version changes are explicitly recorded as metadata equivalence, not as identical execution hashes or a new model cohort.

The first packaging CI retained two failed historical recovery tests: their 150ms wall-clock Session leases expired before the checkpoint. A deterministic 220ms delay reproduced the failure, and controlled test lease clocks removed that scheduling dependency. The original persisted Runtime deadline still expires in real wall time. All 12 affected tests passed locally; final release CI remains a separate required check. Product code was unchanged.

These observations establish the named Runtime/source/delivery paths over fictional, non-private documents. They do not certify general model instruction following, semantic or financial accuracy, browser behavior, all safety branches with a live provider, real-provider concurrency, or production readiness. Raw prompts/responses, databases and credentials are not publication material.
