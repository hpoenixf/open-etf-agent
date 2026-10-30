# v0.15.2: established tool-call ID continuation

This patch retains an already established nonempty tool-call ID when a later SSE fragment for the same index carries `id: null`. It does not create an ID, replace it, or skip final proposal validation. First-fragment null, null on a new index, conflicting string IDs, and other non-string IDs remain rejected. Existing empty-ID replacement behavior is unchanged.

A real v0.6 qualification run supplied trusted closed-field evidence of null after an existing ID. Its original 9/10 outcome remains unchanged. Earlier compound ID errors cannot retrospectively be assigned this cause. DeepSeek documentation describes IDs in the first fragment but does not explicitly promise nullable IDs; this is a narrowly bounded compatibility repair, not a claim that arbitrary provider responses are valid.

The current public-main baseline includes the independently published fund-rebalance demo. This patch preserves it and all existing owners other than the single Stream predicate. The v0.15.1 tag is not moved.

## Verification status

The v0.6 reference repair has a genuine failing Runtime regression, eight passing boundary tests after the repair, and 25 passing portable/original regressions. Those are reference evidence, not tests of this integration. On the current-main integration, 45 targeted tests passed and the original build passed. A new independent ten-task real-model batch then passed 10/10 (32 subscription Go responses at zero reported cost), including the original source-check Child with Main Publication, ten terminal resumes without new provider calls, and ten fresh Reader byte checks. No earlier live result was counted.

The executed source was `30a375ae400f18e6fd2dfb006e5dded3567c48fb`. The release adds only this factual documentation update to those tested code, tests and package bytes. The earlier full-suite result is historical; this narrow patch did not rerun or claim a new full-suite pass. Synthetic null-fragment regressions establish the repaired boundary; successful live SSE does not by itself prove a nullable continuation occurred in that batch.

Historical failed and unknown attempts are retained in the private qualification ledger. No replacement samples or automatic retries were used. This release does not claim that every historical compound streaming-ID error had the same cause, nor does it requalify older tags.
