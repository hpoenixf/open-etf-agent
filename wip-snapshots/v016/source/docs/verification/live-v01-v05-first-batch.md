# Five frozen versions, one real synthetic question each

**Acceptance policy update — 2026-10-27:** the project acceptance scope is Runtime correctness, not model-output semantics. Historical prose observations below remain intact but are not Runtime failures or closure blockers. We assess faithful parameters/sources, lawful execution or rejection, budgets, effects and real file receipts. Unexercised mechanisms remain unverified.

The first batch used the original v0.1–v0.5 Runtime/Gateway commits, not five copies of the latest implementation. An external, separately hashed adapter added bounded local configuration, honest client/session headers, request/output limits and one shared durable cost ledger. Baseline Git source blobs were checked before imports. No requests were retried.

| Version | Requests | Runtime / file result | Narrow manual T1 review |
| --- | ---: | --- | --- |
| v0.1 | 2 | TOOL_REJECTED; no report | Not assessable. The original logger did not retain the rejected calculation arguments or precise validator error. |
| v0.2 | 3 | Completed; report hash independently matched | Formats, separate 120/300 row caps and shared online requirement supported. |
| v0.3 | 4 | Completed; report hash independently matched | **Model prose observation (not a Runtime failure):** falsely describes 120 rows as both versions' cap. The Runtime execution and save chain completed; this does not certify factual prose. |
| v0.4 | 3 | Completed; report hash independently matched | Correctly distinguishes caps and preserves online requirement. |
| v0.5 | 4 | Completed; report hash independently matched | Distinct caps and online requirement supported; describes the existence of caps as shared, not equal numeric caps. |

The [machine-readable matrix](live-v01-v05-first-batch.safe.json) preserves exact source pins, adapter hashes, receipt hashes, tool outcomes and billing observations. These narrow human checks do not replace a scored or independent semantic evaluation; the underlying run semantic status remains `unreviewed`.

All 16 responses were HTTP 200 with `billing_source=go` and observed `usage.cost=0`. This is real authenticated subscription usage, **not evidence of positive cash debits**. Provider `list_cost`, allowance consumption and extra cash cost are distinct. The conservative CNY 1600 reservation remains held; the explicit operator ceiling was not exceeded and its numeric value is retained locally; reservation is not money spent. No balance switching, recharge or account/privacy changes were performed.

## What this batch actually exercised

Every version acquired both synthetic page-one sources through `read_page`. v0.2–v0.5 saved real reports; v0.3 and v0.5 also dispatched valid numeric calculations. v0.1's calculation proposal was rejected before dispatch. v0.4/v0.5 used immutable source records and included stable ResultRefs in saved provenance.

This batch did **not** exercise Skill expansion, MCP transport, SSE, Child execution, query-driven retrieval, `read_result`, Memory writes/forgetting or compaction. In particular, the v0.5 T1 report is not live evidence of Memory or summary quality. Future mechanism-specific cases should target these gaps rather than inflate request counts or retry an unsuccessful answer until it looks good.

## Evidence boundaries

Only original synthetic fixture data was sent. The ignored owner-only credential file, authorization headers, raw response bodies and local absolute paths are absent from this portable summary. Original local run logs and all failed results remain preserved. The v0.1 pre-trace adapter inventory was recorded after execution without intervening source edits; later runs separately hash the diagnostic adapter. The safe proposal trace reports schema/shape facts, not arbitrary model text, keys or headers.

Current provider semantics were checked against the official [Go guide](https://opencode.ai/v2/docs/console/go/) and [inference cost documentation](https://opencode.ai/v2/docs/console/api/inference#cost). No inference that HTTP success, subscription usage or report existence alone means task success is warranted.

For v0.1, the recorded terminal rejection and lack of dispatch are consistent with fail-closed behavior. The exact input was not retained, so the correctness of that particular input-validation decision is retrospectively unverifiable. This is neither a fabricated green result nor proof of a Runtime bug. We do not adjust the prompt or repeat calls to improve prose.
