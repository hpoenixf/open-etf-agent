# Worker: proposed single-Run adaptation of an existing owner

Status: **draft, no v0.9 implementation or validation**. Reviewed on 2026-10-27 against the original ETF Agent ScheduledTaskWorker responsibilities and failure cases. Detailed private source pins and review remain outside the public repository. This is not verbatim private source disclosure or a full port.

The original worker claims a managed Task Root, observes lease and cancellation, invokes the existing Runtime/Recovery, then derives settlement from durable facts. Its coordination lease is distinct from the original Run's execution lease. Ordinary background delivery that continues the same generator after disconnect is a different mechanism; it does not establish independent Worker execution. Foreground short-question concurrency is separate and is not proposed here.

| Retain from the original module | Minimal public adaptation | Exclude |
| --- | --- | --- |
| Accepted work has original identity, limits and deadline. | Submit one explicit root Run through the existing Runtime's preparation and Session record; return a durable receipt without model dispatch. | Schedule definitions, calendar/condition triggers, Task and multi-Root planning. |
| Claim is fenced; an existing live executor cannot be replaced. | Existing Session Run lease is the only execution authority. An explicit Run selector removes the need for a queue or second Task coordination lease. | A new job table, generic queue, Worker manager or second state machine. |
| Worker re-enters the original executor. | A fresh CLI process invokes the same runtime.mjs recovery path with the saved binding/grant. | Copied model loop, new Gateway protocol or background execution engine. |
| Host shutdown is not user cancellation; late work cannot cross a fence. | Narrow Runtime lifecycle adaptation: non-user host stop preserves the original checkpoint; explicit Session cancellation remains authoritative. | Converting SIGTERM into user intent, automatic refund/retry of unknown effects. |
| Settlement follows durable Run/Publication facts, not stream end. | Selected-Run readback of existing Session, Publication and Artifact. | Task History, notification, global event stream or terminal success inferred from process exit. |

## Existing public gap and necessary support

At [v0.8](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1), Runtime's external abort path calls Session cancellation and its normal error path attempts terminal bookkeeping. Worker host shutdown cannot simply reuse that path. The draft calls for a bounded non-user interruption seam in the same Runtime, not a parallel executor. Admission must likewise share Runtime's validation/initial checkpoint rather than inventing a Worker-owned snapshot.

The original module has both Task coordination and Run execution because it coordinates scheduled Roots. This slice has no Task. Removing that layer is intentional; removing the Run fence, debit, deadline or unknown-effect authority is not allowed. A terminal unknown result may remain failed/unknown according to the existing Runtime; it must not be turned into success or permission to retry.

## Article mapping is explanatory, not a verified coverage claim

Primary existing article: [Agent autonomous scheduled research](https://hpoenixf.com/eff-agent-article/articles/agent-autonomous-scheduled-research), specifically its distinction among accepted work, finite Run and committed Publication, plus original identity across restart. Its Schedule, triggers, Task History and notices remain outside this slice. Related article: [asynchronous and time-bound delivery](https://hpoenixf.com/eff-agent-article/articles/agent-asynchronous-research-time-bound-delivery), for the background/concurrency boundary. Both were reviewed at public source `b6933089d87ef2ee0c946d2f088fc099c5b037aa`; their original implementation evidence is not evidence for v0.9.

After public qualification, consider a short natural example in the existing scheduled-research article, explicitly labeled the single-Run Worker slice. Do not create a synonymous article, overwrite diagrams, or mark the entire scheduling article verified merely because one worker case passes. No article change or English counterpart claim is made in this draft.

## Original scenario origins, newly authored public tests

Two claimants for one Run; stale fence mutation; host lease loss without user Stop; cancellation before dispatch; cancellation after committed body; and a fresh process after SIGKILL with an unknown request all inform the proposed synthetic cases. None has been executed as v0.9 qualification. Original multi-Task fairness and private timing numbers are deliberately not imported.

No new packages or downloaded bytes are proposed. Reuse the existing Node standard library, SQLite, Session and locked dependencies. Their existing licenses remain unchanged; no queue framework, daemon configuration or new credentials are needed. If an implementation finds a new dependency indispensable, record official source/license/size/necessity before adding it rather than silently expanding this decision.
