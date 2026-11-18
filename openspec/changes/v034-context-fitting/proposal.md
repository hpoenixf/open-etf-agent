# v0.34 A14: context projection and fitting

Baseline: released Open `949206315b017f482d42cd635eafc78459a0fc2a`.
The provisional roadmap shifted because v0.32 completed Knowledge and v0.33
implemented A17. A14 is next; A28 summarization is not part of this version.

## Bounded public contract

Keep original messages, roles, question, and complete settled call groups.
An optional frozen `contextWorkingSetBytes` (1..1048576) is an advisory target
for older successful explicit `read_result` payloads, not a second hard limit.
Keep the newest two call groups intact during this advisory pass. Only
original Host-confirmed reversible projections qualify, and only if smaller.
Failed, unbound, opaque and effect receipts remain intact; an unreachable soft
target does not reject a request that fits its hard envelopes. No new access.

Before *every* physical model reservation, including restored working-input,
check raw messages (when configured) and the actual Gateway encoder with the
actual selected tools. Local capacity failure spends no request reservation.
Byte measurements are not tokens. Optional observations contain bounded numeric
counts only and cannot affect execution. Absent policy does not enable the soft target. The hard pre-reservation check
intentionally fixes the prior observable reservation behavior.

Private A14 provides the behavioral reference for older explicit-read working
sets, group integrity, exact transport fitting and non-authoritative observation.
This is an independently written public subset, not private source extraction.
Do not add history trimming, model summaries, provider capacity, memory or UI.

No model calls, publication, quality/parity or release qualification are claimed.
