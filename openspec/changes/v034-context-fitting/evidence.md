# v0.34 evidence

Fixed public baseline: `949206315b017f482d42cd635eafc78459a0fc2a`.
The isolated checkout starts from its exact tree. No private source or logs are
introduced as public ancestors. Package remains at the last released 0.33.0.

Initial test launch lacked the existing ipaddr.js dependency link; this was an
environment setup failure, not RED. After reusing the already validated pinned
dependencies, four new tests produced 2 pass / 2 fail: advisory reduction absent,
and Gateway-only capacity failure reported EXECUTION_FAILED after dispatch
entry/reservation instead of pre-reservation CONTEXT_CAPACITY_EXCEEDED.

The independent reviewer also reproduced the original issue using the real
Gateway encoder and synthetic fetch: fetch 0, model reservation 1. This is not a
provider timeout and does not establish a remote charge.

Initial focused validation on Node 26.11.1: 32/32. The final new A14 file
contains fourteen provider-free tests, all passing.
The real Host is reopened and rereads exact original source bytes. A paused
working-input is resumed with a smaller encoder envelope and fails with no model
reservation or Gateway call. Configuration changes preserve original task bytes.

During implementation, an accidentally removed hard-path fit return was caught
by three original regressions and restored before the focused pass. Test setup
also corrected an explicitly required Host owner callback and used a writable
restored Host for an actual read. No production assertions were weakened.

Full suite, build, independent final review and exact-head CI are recorded only
when completed. Real-model acceptance has not started. Two previous unknown
v0.33 requests and their billing remain unresolved; no budget reset is implied.

The first aggregate run exposed a missing timeline consumer adaptation for the
new context_fit event. The existing CSV/Child regression reproduced the failure;
the original timeline now admits this event and exposes only three numeric fields.
Its original fourteen tests pass, and a new observation test proves payload fields
are not exposed. The failure was not hidden by weakening the original assertion.

Gateway-only preflight deliberately does not activate an implicit 1 MiB raw limit.
A legal short-question fixture accumulates eighteen bounded opaque tool results
(over 1 MiB total), preserves them and succeeds under its synthetic encoder budget.
An initial test used an invalid oversized question and was corrected to obey the
existing question bound rather than changing production admission.

The first aggregate run completed 1522 tests: 1516 pass, 2 fail, 4 optional
compatibility skips. In addition to the timeline seam, a legacy teaching test
expected the Gateway to throw its input limit after entry. The corrected contract
rejects before Gateway entry/reservation: the updated test requires local capacity
code, two actual requests/two reservations and the unchanged saved report bytes.
The targeted teaching suite passes 4/4. Final frozen aggregate results follow.

Final frozen Node 26.11.1 aggregate: **1525 tests, 1521 pass, 0 fail,
4 pre-existing optional compatibility skips**, 336500 ms. Native ESM build and
docs consistency passed. Independent final review ran context/CSV/teaching
32/32. Exact-head remote CI remains pending at this source commit.

## Preparation follow-up

The unchanged Runtime commit 93d060f passed remote Verify #132 (1521 pass,
0 fail, 4 skip). The later provider-free preparation freezes ten synthetic
normal-content tasks separately from mechanical safety cases. It checks source,
question and Runtime hashes and tests all ten through original import/submit APIs
without work or provider calls. Route, cumulative budget and independent live
review still require the real-acceptance launch gate; no request was dispatched.
