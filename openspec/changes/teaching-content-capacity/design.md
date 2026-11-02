# P0 owner-local capacity and compatibility

## Selected finite capacities

| Existing owner | Before | P0 | Reason |
| --- | --- | --- | --- |
| Runtime final / Publication body / report text | 64,000 JavaScript characters or 64,000 UTF-8 bytes, inconsistently | 256 KiB UTF-8 body | Accommodate long teaching explanations and non-ASCII text without silently trimming them. |
| Gateway serialized function arguments | 66,000 JavaScript characters | 2 MiB UTF-8 JSON | A 256 KiB body can require six serialized bytes per original byte; the remaining 512 KiB covers field syntax and bounded identities. |
| Gateway complete response / SSE wire | 256 KiB | 16 MiB | Cover argument double encoding, Unicode and ordinary SSE framing overhead separately from body capacity. Extreme wire expansion remains a finite transport resource failure. |
| Session Publication body/event JSON | 512,000 bytes | 6 × 256 KiB + 8 KiB | JSON escaping has a maximum sixfold expansion; envelope/receipt identities are bounded. Read and write use the same bound. |
| Session checkpoint JSON only | 3 MiB | 12 MiB | A long report argument in history plus final proposal, answer and terminal outcome can contain four body copies: 4 × 6 × 256 KiB = 6 MiB; original 3 MiB structural/history allowance plus 3 MiB headroom stays finite. |

These are constants at existing owners, not a new global admission engine. The generic JSON decoder remains 3 MiB: only the four actual checkpoint read paths and checkpoint writer use 12 MiB. Node-count/depth, definition, receipt-binding, ordinary-response, Artifact, source, manifest and hot-journal limits do not change; a larger checkpoint is not permission for an arbitrary whole Run. Schema validity, exact hashes, authorization, cancellation, complete stream termination and no replay of unknown effects remain unchanged. Provider output marked `length` stays incomplete; no partial tool argument is executed. Actual provider token limits and the original `maxInputBytes` default/maximum are not inferred from these byte budgets or enlarged.

The saved report includes original-source and calculation appendices. Its existing Artifact 1 MiB limit remains independently enforced; the bounded body is at most one quarter of that size. Source-record, revision, manifest and PDF limits are not raised in P0. The exact encoded report and immutable Artifact must be read back, not inferred from validation success.

A long report appears in the next model input. Tests that deliberately need more than the default input envelope select the already-supported `maxInputBytes` explicitly; P0 does not promise to fit every long transcript into an unchanged input window. A genuine input-capacity rejection must still occur before transport, preserve already saved reports/publications, and never fabricate completion. P1 will reduce eligible result residency rather than enlarge provider windows.

## Compatibility

Publication/Artifact schemas and content hash algorithms stay unchanged. New readers can validate old small bodies and existing receipts. Old readers are not promised to read new oversized bodies; document finish/read with the creating version before downgrade. No old database is migrated, rewritten or used for tests.

The report tool schema's `maxLength` changes, so `definitionsHash` changes. An old active Run must finish with its pinned original executable; the existing restore mismatch refuses to execute it under a new tool catalog. Do not silently recompute a stored hash, refresh a grant, reset a budget or claim transparent active-Run compatibility. Standalone immutable Artifact readback remains available independently of Host resume.

## Exact implementation ownership

- `publication.mjs`: complete UTF-8 body capacity, immutable content identity.
- `report.mjs` / `tools.mjs`: report body capacity and schema; report save semantics unchanged.
- `runtime.mjs`: consistent final-body acceptance, then original publication/terminal path.
- `gateway.mjs` / `stream.mjs`: parameter/wire capacities, without weakening protocol completion.
- `session.mjs`: coupled JSON encoder/decoder and checkpoint resource bounds.
- Existing tests plus `test/long-content.test.mjs`: offline production seams only.

No new dependency, background service, credential, network model call, global fallback loop, version tag or remote publication belongs to this writer.
