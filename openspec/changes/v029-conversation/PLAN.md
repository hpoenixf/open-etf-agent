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

Implemented in the expanded candidate:
- Ordinary messages, persisted clarification and explicit Continue have distinct identities and routes. Received clarification is not adopted until original work consumes it. Open adopts in the same Run rather than copying private's new-Run interaction structure.
- Continue binds parent identity, original root goal, task definition, original manifest and verified published output. New grants permit only narrowed capabilities/tools/limits. Published text without Artifact remains readable and is explicitly unverified historical context.
- Same-Run safe-checkpoint resume retains the original budget/deadline and never replays unknown work.
- Safe interrupted active roots can now transfer through an atomic Session owner receipt: freeze parent, fence old execution and bind one unique target Run. Unknown/partial effects, active children, live ownership and pending clarification cannot bypass their owner. Generic failed/cancelled tasks remain ineligible.
- Durable request and prepared handoff intents precede parent freezing. Cold retry preserves the original identity while checking current permissions; competing submissions cannot freeze a losing parent.
- Explicit revocation is persisted by Session and blocks future execution while preserving output and unknown accounting. Configuration edits alone are future-only, not an instantaneous kill switch. Already dispatched remote operations are not recalled.
- Trusted-package tasks cannot use explicit Continue/handoff because this candidate lacks an effect ledger proving cross-Run deduplication. Ordinary new user intent is unaffected. Published prose is not proof that external writes are safe to repeat.
- Optional control-fact storage is created atomically only on a successful control operation. Fixed v0.28 reader bytes were checked: old binary reads prior sessions but refuses newly controlled sessions with UNSUPPORTED_SESSION_SCHEMA; new read-only code verifies receipts.

Qualification and remaining boundaries:
- Final frozen-source regression: 1322 passed, 4 existing compatibility skips, zero failures; build passed. Fresh real Owner cohort is separate from prior ten-task evidence and is recorded in its own qualification receipt.
- Independent review identified and drove fixes for crash/config-change recovery, competing parent submissions, pending-question bypass and unproven plugin side effects.
- Owner handoff is an Open-native safety contract, not a claim that private's terminal owner-loss/disconnect Main lineage was ported. The parent checkpoint digest binds a transaction, not full recoverable historical checkpoint bytes.
- Full private historical-result lineage and restricted tool-result projection are not implemented. Only original goal/source binding and published historical output transfer; raw intermediate tool results do not.
- Keep this PR Draft. Expanded scope requires review before merge/release; prior v0.28 or narrower v0.29 evidence does not qualify this candidate.

## Next version, separate module
Proposed v0.30: A07 Child execution lifecycle depth, not part of v0.29. Assess independent cancellation/failure isolation/result recovery, bounded parallel/background execution and parent wait/wake under shared Root budget. Qualify PDF/Knowledge/Interaction/trusted-tool combinations explicitly. Peer/nested/independent-provider gaps must remain visible; do not publish a smaller slice as a complete module merely to ship.
