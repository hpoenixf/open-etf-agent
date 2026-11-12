# v0.29: explicit research conversations

Status: implementation in progress, no release qualification yet.
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
