# Runtime limit and Session admission maintenance — 2026-11-02

Base: `e64f42aecb491e5f13ac1c3b26ca734597ef6ec0` on `maintenance/v0.6-nullable-delta-20261102`.

## Narrow change

The explicit caller-provided `timeoutMs` upper bound is now 3,600,000 ms. Defaults stay **12 rounds, 12 tools, 30,000 ms**. No request-timeout, sampling, model, tool grant, retry, or output-token defaults change. This legal ceiling is not a promise of private-Main execution-policy equivalence.

This version has no Session owner; no persistence or SQLite behavior is introduced.

## Verification boundary

Provider-free targeted tests: **3/3** for this maintenance source. Across v0.2–v0.9, 36 targeted cases passed in 6.469 seconds in serial Node 26.11.1 processes. These are not a full-suite, build, release, or new real-provider qualification.

Existing nullable-delta compatibility is retained. Phase branches, tags, historical receipts and prior qualification claims are unchanged. This patch does not import broader teaching-source changes.
