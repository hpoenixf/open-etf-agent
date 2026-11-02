# Runtime limit and Session admission maintenance — 2026-11-02

Base: `2eb31d03244591c47370eebcf77d7a4354e2e548` on `maintenance/v0.7-nullable-delta-20261102`.

## Narrow change

The explicit caller-provided `timeoutMs` upper bound is now 3,600,000 ms. Defaults stay **12 rounds, 12 tools, 30,000 ms**. No request-timeout, sampling, model, tool grant, retry, or output-token defaults change. This legal ceiling is not a promise of private-Main execution-policy equivalence.

Session accepts the same explicit upper bound. The existing 1,000 ms SQLite connection wait is applied before the read-only schema preflight and writable initialization checks. Schema/version refusal, file protections, absolute persisted deadlines and debit accounting remain unchanged. No transaction retry is added.

## Verification boundary

Provider-free targeted tests: **7/7** for this maintenance source. Across v0.2–v0.9, 36 targeted cases passed in 6.469 seconds in serial Node 26.11.1 processes. These are not a full-suite, build, release, or new real-provider qualification.

A separate process using the original base implementation produced a terminal Run with a 300,000 ms definition. A new consumer process read the same outcome, immutable definition and budget with zero model calls; original Publication body/receipt/revisions/event were also compared where available. This is old-definition→new-reader compatibility, not support for old readers consuming new one-hour definitions. Deterministic exclusive-lock cases verify short-lock success, retained one-second failure, and unknown-schema refusal without changing database bytes.

Existing nullable-delta compatibility is retained. Phase branches, tags, historical receipts and prior qualification claims are unchanged. This patch does not import broader teaching-source changes.
