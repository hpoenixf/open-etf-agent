# Real-task gate correction · 2026-11-02

The current user rule is **ten real tasks per version, at least nine successes (9/10)**. The prior five-task/four-success release interpretation was incorrect and is superseded. Original measurements remain unchanged.

[Authoritative policy](../live-validation.md#release-qualification) · [Current decision summary](release-gate-20261102.safe.json) · [Publisher workflow](../release-workflow.md)

| Scope | Retained observation | Current decision |
| --- | --- | --- |
| v0.17 final local source | Five real synthetic tasks completed; original delivery and separate offline safety retained | Incomplete: five tasks cannot satisfy ten. Inventory reuse before freezing only missing tasks; no formal release yet |
| v0.18 final local source | Five real synthetic API tasks completed; original Schedule/Worker/readback retained | Incomplete under the same gate; no formal release yet |
| v0.16 document-revocation profile | Explicit fixture-only profile and independently verified delivery | Real-provider qualification unsupported for this profile; do not remove guards, invent calls or exempt the whole version automatically |
| Earlier versions | Original ten-task records already exist; fixed-source/ledger inventory is in progress | Reuse valid matching ten-task >=9/10 records; no wholesale remeasurement, replaced failures or rewritten old tags |

Historical 5/5 remains a true observation, but a derived `releaseQualificationPassed` based on the superseded five-task rule is **not a current publication decision**. Consult the dated decision and mechanical gate, not an old boolean alone.

Backfill is an explicit dated prospective amendment: previous outcomes were already known; missing task identities are fixed before dispatch; every failure, timeout and unknown stays in the final ten. It is not a claim that ten were originally pre-registered. Metadata-only commits do not invalidate matched execution evidence. Review actual executable inputs, provider/method/limits and affected contracts first. Tasks and physical requests are counted separately, with all requests and unknown charges preserved in the shared ledger. This correction schedules no calls or fees.

中文：每版10次真实端到端任务，至少9次通过。先查原十次记录，已有有效证据不要重测。原五次结果保留但不代表新门槛通过；补缺先冻结计划，不替换失败，不删未知分母。fixture-only profile不得拆保护伪造真实验收，也不是整版自动豁免。
