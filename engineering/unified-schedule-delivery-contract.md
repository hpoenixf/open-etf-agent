# Unified scheduled-task delivery
Engineering checkpoint; not deployed. Covers one Scheduler owner. Private UI source and deployment configuration are not part of this checkpoint.

User-visible boundary:
- Sidebar opens one task list for scheduled research and the existing daily push. Creating from conversation drafts intent; the task is not persisted or executed until the user confirms the final schedule.
- Create/edit allow a one-shot UTC instant or relative delay and an explicit recurring rule with time zone. Relative delays anchor to the confirmation instant, not the conversation start. Expose next fire, active/paused status and a compact execution history.
- Email is off unless enabled on the confirmed task. The display of a draft, a failed run or an unresolved send is not permission to deliver email. Conversation delivery and email are observable separately.

Execution boundary:
- Keep the existing Runtime run identity, including its definition revision. It is not the Scheduler deduplication key. The Scheduler owns a separate stable logical-slot identity inside its account/project scope. Selection and claims must use the same identity across retries and prospective edits.
- Existing daily schedules use one canonical local day per task, not the exact local time as the identity. With a time-of-day edit, an already consumed day is not reopened. Recurrences with more than one slot per day require distinct logical occurrences; do not reuse the daily identity format for them.
- Read and reconcile the original slot receipt before attempting new execution. Freeze the admitted definition revision, body/reference and delivery identity. A post-claim edit affects subsequent eligible future slots only; it cannot mutate the frozen Run or replay past, claimed or unknown slots.
- Keep daily and ordinary schedule definitions in the same registry, but do not enable duplicate old/new runners during cutover. Import or replace only explicitly confirmed active definitions; absence of a definition is not authorization to recreate one. Leave old history intact unless an explicitly scoped migration says otherwise.

Pre-release acceptance:
1. Model-free PostgreSQL test: first claimant commits one synthetic slot but loses its acknowledgment. Race a second claimant/reconciler against a definition edit. Both readers resolve the one original Run/report/notice identity and only a later future slot binds the new revision. Cover same-day edits, account boundaries and process restart.
2. Stage browser: create and edit through the conversation confirmation and management list; exercise once and recurring, pause/resume, daily entry and explicit email choice. Check that an unconfirmed draft has no durable effects and an off-by-default email sends nothing.
3. Stage scheduler: run a fixed short future-only test, verify a single claim/run/notice in the ledger, then restore the test owner's state without enabling or touching any production deliveries.

First implementation slice: the draft codec recognizes explicit minute/hour/day
delay or interval requests in Chinese and English. It has no store, runner, or
delivery effect. Final confirmation resolves a relative start against the server's
confirmation instant; an elapsed repeat interval is not a calendar day rule.
Legacy daily civil-time scheduling keeps its existing owner. Before connecting this
draft to the UI, persist the confirmation idempotently with the resolved schedule
and route all admitted schedule kinds through the single management surface.
