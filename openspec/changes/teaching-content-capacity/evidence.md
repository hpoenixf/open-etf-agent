# P0 evidence — 2026-10-30

Scope: finite long-text, serialization and wire capacities only. Public base `34124cefc6df289e08518173789210b45a716451`; source tree `f286d2eb710af74724ba9dedf689cbb8ff20f96f`. Node 26.11.1, existing locked dependencies, 512 MiB heap, serial provider-free tests. No external network, HTTP server, model invocation, paid validation or release action.

## RED provenance

The initial unchanged-production run exercised four new tests. Quoted report parameters reached the old protocol-capacity rejection; fragmented SSE reached the old wire limit. The two Publication tests instead failed fixture setup because the declared gateway mode did not match the injected production adapter. Those two failures are **not** behavior RED.

Only the two fixture-blocked cases were rerun after correcting the test binding. Long Chinese text then reached `INVALID_PUBLICATION`; the fully escaped response failed during the old bounded response path (`EXECUTION_FAILED` at Runtime, which did not preserve that Gateway error as a typed code). This is not claimed as a Session-capacity RED. All original results and input identities were retained; production files were unchanged for these runs.

## Targeted qualification

The first P0 run selected ten affected test files: long-content, gateway, stream, stream-null-continuation, tool-fragment-id, publication, publication-runtime, runtime, tools and artifacts. Actual result: **63 passed / 65 total**, 2.84 seconds. The two failures were again test integration, now after successful body commit/terminal: the existing `readOnly` Session facade exposes inspection, not Publication confirmation.

The fixture was corrected to use the original Publication read API, as the existing session CLI does. It requests no execution claim or mutation; database bytes are hashed before/after. Only those two tests were rerun: **2 passed / 2**, 0.87 seconds. Production source did not change between these runs. This is 63 retained successes plus two corrected readback successes, **not** a second 65-test full rerun.

Observed success boundaries:
- Exact 66,000-byte Chinese body reaches Publication and terminal, then reopens unchanged.
- A 63,000-quote report passes escaped function arguments, saves complete immutable report bytes and finishes; a different process confirms the Artifact hash.
- 4,000 valid SSE frames exceed the old wire allowance but retain complete text, finish and DONE semantics.
- A 262,144-byte control-character final survives actual JSON expansion, three repeated checkpoint body fields, terminal persistence and different-process Publication receipt/hash readback. Database bytes are unchanged by readback.
- An exact 256 KiB UTF-8 Chinese report plus final body saves and publishes intact through the actual injected Chat Gateway and Session.
- Oversized arguments, incomplete finish, malformed/forged IDs, foreign receipt/scope, cancellation, budget and immutable Artifact protections remain covered by the selected regressions.

Measured synthetic worst-escape case: Publication body JSON **1,572,889 bytes**, event JSON **1,573,241 bytes**, terminal checkpoint **4,720,269 bytes**, completed status, one model-budget reservation and zero tool reservations. A model-budget reservation here is an injected offline adapter call, not a provider request.

Every launched test process reached terminal state with its owned group stopped and leader waited; no timeout, cleanup signal or residual child was recorded. No whole-repository suite, live provider, semantic quality or old active-Run migration is claimed.

## Remaining boundary

The large-report positive case explicitly selects the previously supported 1 MiB input-byte allowance. P0 does not change the old 256 KiB default input guard, provider token limits or any account-wide ledger. That local default can still reject a large report echo plus tool schema before the next dispatch. The separately authorized teaching-default increment will address the default; an explicit small input allowance must continue to win and preserve already saved artifacts without inventing a successful terminal result.
