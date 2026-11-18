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

## Original-read correction and targeted acceptance — 2026-11-19

The frozen ten-task cohort at `abf78f7d1ac21f8d61483bf699b562033352d8ab`
retains its independent **9/10**, including the original Q09 failure. Q09
submitted its valid, already acquired original `resultRef` with `selection`.
Selections are defined only for derived text pages. The Host rejected the
original read before dispatch, and the Runtime ended with `TOOL_REJECTED`
because this refusal had no eligible correction proof.

Corrected execution source
`9d7018df68ef3b9791ef93b1857cb0007f592165` retains the tool argument contract.
For the durable projected Host profile, the Host can bind a typed refusal to
the original call, acquired record, Run, grant and scope. The existing
single-correction budget requires the next proposal to reread that same ref
without selection. It offers no correction for an unauthorized ref or a
multi-call proposal. The original deadline and budgets govern continuation.
The process-death regression preserves an unknown model reservation without
replay.

### Real model evidence

The [fixed plan](../../../engineering/v034-a14-correction-20261119/PLAN.safe.json),
[request and outcome observations](../../../engineering/v034-a14-correction-20261119/OBSERVATIONS.safe.json),
and [independent review](../../../engineering/v034-a14-correction-20261119/REVIEW.safe.json)
bind the exact execution commit, source, cases, report bytes and request hashes.

- **Original Q09.** The unchanged question produced a source-cited report that
  reopened in a cold process after three successful same-ref reads. Its independent
  content review passed. The model used valid parameters on this run, leaving the
  actual correction path to the controlled case.
- **Controlled correction and projection.** The real model submitted one
  original read with an extra selection. The local pre-dispatch rejection used
  no tool slot. The model received the correction in request ordinal 4 and
  submitted a single valid same-ref read. Ordinal 5 carried an older result as a
  stored source reference while the latest two complete groups matched. After
  the model reread the same reference, ordinal 6 carried the byte-exact original
  result. Four such rereads after the first projection were observed. The original
  history, independently reopened ref and cold cited report matched. The report
  correctly preserved missing beta, the exact identifier and Boreal's corrected fee.
- Independent `gpt-6-luna` review passed both target reports and supported the
  correction and projection chronology from the joined sanitized trace. Raw
  provider bodies and Session databases remain local. The expected refusal and
  the controlled case add zero successes to the original denominator.

The new scope addresses a typed refusal for already acquired original data.
It leaves valid reads, source selection and report qualification unchanged.
That boundary, the original 9/10, and the fresh targeted closure are the basis
for retaining the ten-task cohort. Changes to broader Runtime behavior or to the
qualification scope require a fresh cohort.

### Engineering safety and accounting

Native ESM build, strict OpenSpec validation, docs checks and the complete suite
passed on the corrected execution source. Node 26.11.1 recorded **1,533 passed,
4 optional skips, 0 failures**. The focused suite passed 31 checks. The
[offline correction tests](../../../test/original-read-correction.test.mjs)
include exact refusal, reference substitution, correction exhaustion, grouped
calls, and three actual process-death boundaries. Those process-death and
negative cases ran offline.

The [Go preflight](../../../engineering/v034-a14-correction-20261119/PROVIDER-PREFLIGHT.safe.json)
was read-only. All 14 new inference requests resolved as `deepseek-v4.1-flash`
and reported Go billing with zero extra USD, with 121,723 reported tokens and
no new unknowns. The original 46 requests are retained separately. The preceding
local v0.31–v0.33 ledgers account for 240 other requests, 237 confirmed Go-zero
and 3 unknown, including both v0.33 unknowns. This record does not settle those
unknowns or represent the entire account history. No request was replayed and
Extra Usage remained off according to the user's confirmation.
