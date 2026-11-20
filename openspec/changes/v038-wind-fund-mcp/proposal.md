# Open 0.38 candidate: opt-in Wind Fund MCP daily close

## Contract

Open MUST keep its existing research, provider and synthetic MCP defaults unchanged. A deliberate operator action MAY fetch one series of daily unadjusted exchange closes through the official fixed Fund MCP endpoint. The adapter accepts a single six-digit .SH or .SZ code and two inclusive ISO calendar dates (maximum 31 days). It sends the documented get_fund_kline call with daily wire period 10 with no adjustment (2) and suspension excluded (0). It exposes no vendor tool choice or endpoint selection to a model.

Only a bounded, positive, finite, uniquely dated TIME/MATCH table can yield a result. Response identity is checked if a recognized Wind-code column exists; otherwise output says request-only. Do not fabricate zero values for no data or fill missing dates. Identify the result as exchange close, not fund NAV or total return.

The CLI reads credentials from the calling environment only. Neither the module nor the CLI forwards the result to a model, creates credentials, stores raw vendor data, retries, or claims sublicensing rights. Report sanitized auth/transport/business/data failure classes. When operation cancellation or the overall deadline aborts, do not issue another vendor request.

## Verification plan

- [x] Validate the actual SDK's JSON and SSE call envelopes using injected fixtures, with a synthetic token and no external traffic.
- [x] Exercise malformed inputs, auth/entitlement/rate-limit error, nested vendor errors, missing/incorrect identity, malformed rows, response budget, deadline and cancellation.
- [x] Verify the bounded, explicitly authorized live Wind path. Three distinct ETF/date-window queries passed; all were request-bound only, with no recognized returned code column. See [verification](../../../docs/verification/v038-release.md).

Automatic model routing and multi-provider fallback are out of scope.
