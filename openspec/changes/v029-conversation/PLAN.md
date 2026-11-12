# v0.29: explicit research conversations

Status: expanded A02 alignment implementation in progress. Earlier ten-task evidence applies only to PR #5 at 2f54f2c, not to the expanded candidate. Merge/release paused.
Base: Open main 1fe7eeaea8a696469ece8d924f69295ab80e7387 (v0.28 plus PR #4).

The independent A02 Conversation owner admits user messages and links follow-up tasks. It does not replace Project, Session, Artifact, Review, budget or cancellation owners. Prior planning did not assign 0.29; this is a new selection under the user's instruction to implement the next coherent module.

## User loop
Create a conversation inside an existing research project; submit an initial message with explicit source manifest; execute through the original Worker; inspect and read its original report; submit a follow-up selecting one completed parent report and optionally a completed advisory Review of exactly that revision; execute and read the new report without modifying the old one. Branches are explicit parent pointers, never implicit 'latest'.

## Contracts
- Conversation belongs to one exact projectId; IDs bounded, no paths chosen by model.
- Message IDs are idempotency keys. Same input reopens original task; changed input with same ID rejects. No automatic replay of unknown work.
- Admission has a durable frozen intent before original task submission. Interrupted admission is inspectable; retry can finish admission but never dispatches. Original task identity derived from conversation+message prevents collisions.
- Parent report is verified via original Artifact owner and frozen by identity and bytes. Previous prose and Review findings are untrusted context, not facts, authority, source replacement, tool instructions or permissions. No automatic history accumulation.
- No source or capability expansion: caller must select source manifest; original Project validates provider/data/cost approval and creates the task. Existing tasks retain frozen config.
- Whole contextual question must fit explicit 16000-byte Conversation bound; refuse rather than silently truncate. Caller may explicitly select a shorter parent excerpt, whose exact offsets are recorded. Nonselected source text is not copied from prior task.
- Review may only be included if completed and matches selected original report revision/hash. Review remains advisory. Protected Artifact roots remain subject to original reader refusal.
- Read, cancel, execute all delegate to existing owners. No daemon, web UI, automatic continuation, implicit publication or new provider route.

## Verification
Counterexamples: duplicate concurrent submit, changed message collision, foreign project, invalid parent/cycle, active/unknown parent, stale Review, excerpt drift, overbound prompt, unsafe paths, provider approval absent, cancelled and unknown task replay, interrupted admission, cold process readback. Follow-up uses original source retrieval and saved report; old bytes remain readable. Full regression and an independent review precede release qualification. Real Gateway tasks are counted separately from fixtures; answer quality does not gate runtime release. Do not reuse v0.28 qualification.


## Updated alignment scope (2026-11-12)
Private contract baseline: etf-agent 8b9e870a. Application conversation-store.ts and research-runtime/research-continuation.ts distinguish ordinary messages, persisted clarification, and explicit Continue. One version owns one complete module; no unrelated Child or history-compaction expansion.

Implemented locally after the initial PR:
- Exact persisted question inspection/listing and idempotent replies routed through the original Open Interaction owner. Received is not adopted; work remains explicit.
- Explicit completed-parent continuation separate from report history. Freeze parent identity, original user text/hash, original task definition, source manifest, report revision and bytes. Require unchanged project configuration/manifest and fresh live approval; allocate a new Run/grant, never reopen the parent.
- Reject active/failed/cancelled/unknown parents for new-Run continuation. Same-Run work/recovery retains original deadline and budget.

Still required before expanded qualification:
- Map parent eligibility to actual recoverable interruption semantics. Private supports narrowly proven owner-loss/disconnect; Open does not currently expose equivalent durable reasons. Do not broaden failed/cancelled or mask unknown effects.
- Clarification lifecycle differs: Open adopts in the same Run; private has a new-Run interaction continuation path. Prove complete user workflow and explicitly document this structural difference.
- Current config is checked at work/resume entry; Continue permits only capability/tool subsets and lowered limits with identical remaining config. This is not atomic in-flight revocation. Operators cancel and settle original work before reconfiguring, or leave it frozen; do not claim an instantaneous config kill switch.
- Published answers without a report artifact now remain readable and may be frozen as explicitly unverified historical context; no manufactured report revision or citation certification.
- Same-Run safe-checkpoint resume is exposed separately and tested without first-call replay. Private owner-loss/disconnect new-Run continuation has no equivalent Open durable stop reason: never invent that qualification.
- Independent review, final full regression and a fresh real cohort that exercises all three routes remain required. Prior ten tasks are not expanded-module qualification.

## Next version, separate module
Proposed v0.30: A07 Child execution lifecycle depth, not part of v0.29. Assess independent cancellation/failure isolation/result recovery, bounded parallel/background execution and parent wait/wake under shared Root budget. Qualify PDF/Knowledge/Interaction/trusted-tool combinations explicitly. Peer/nested/independent-provider gaps must remain visible; do not publish a smaller slice as a complete module merely to ship.
