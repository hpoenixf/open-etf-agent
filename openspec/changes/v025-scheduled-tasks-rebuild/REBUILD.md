# v0.25 rebuild: finite one-time scheduled tasks

This WIP starts from published v0.24.0, commit
`afbfb9865539c18c9358ac65c822f929aaa6e872`. It is a new implementation and
verification campaign. Earlier unpublished candidates and their test outcomes are
not used as proof that this candidate works.

## Single-module contract

Add a bounded, durable host for explicitly confirmed one-time tasks. Reuse the
existing Schedule occurrence, Project, Session, Runtime and Worker owners. A due
wake must materialize and continue the original Run identity; it must not create
another execution system or a second model-budget ledger.

The task record, confirmed occurrence, Run and delivered report remain distinct.
Duplicate wakes, restarts, cancellation, expired windows and uncertain effects
must preserve their original identities. Current task eligibility is checked at
the actual dispatch boundary, not only when a task was first listed.

The proposed user entry points cover confirmation, bounded listing/inspection,
one explicit due-task pass and cancellation. No background daemon, cron, recurring
schedule, notification, browser UI, Web acquisition or isolated Python module is
part of this version.

## Verification and delivery

1. Start with failing tests at the existing public execution seams.
2. Implement the smallest useful host and connect the original CLI and consumers.
3. Run focused counterexamples, existing regressions, a fixed-candidate full suite
   and build, then independent review. Retain failures and qualification limits.
4. Freeze any real-model campaign separately. Existing subscription authority,
   conservative reservations and unresolved historical calls remain binding.
   No model call or new allocation has occurred for this rebuild checkpoint.
5. Back up reviewed stages to this WIP branch promptly, verifying the remote ref,
   tree and changed file bytes. A WIP is not a release or a passed acceptance run.
6. Publish only after the applicable acceptance, CI and approval requirements.
   Remove this task's WIP branch only after its complete delivered content is
   verified recoverable from the published result.

This initial checkpoint contains the reconstruction plan only. It does not alter
package versions, dependencies or lockfiles. Product implementation, tests and
release qualification are pending.
