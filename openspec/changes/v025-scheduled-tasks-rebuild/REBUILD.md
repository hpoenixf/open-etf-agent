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

## Intermediate implementation checkpoint

The first implementation slice adds the once-task API and CLI on the original
Project, Schedule, Session and Worker owners. Twelve focused offline tests pass
on this slice. This is a WIP safety checkpoint, not release qualification.

Independent seam review identified a materialization race: a competing wake can
materialize and interrupt a Run between the host eligibility observation and the
original worker entry. The first slice does not yet prove that this cannot cause
an automatic resume. An atomic fresh-materialization discriminator and regression
coverage are still required. Unknown/interrupted cold-wake tests, the complete
suite, independent final review and any new live qualification remain pending.
No model calls were made by this reconstruction checkpoint.

## Atomic freshness checkpoint

A behavior regression reproduced the first slice's unintended worker entry: an
already materialized ready Run dispatched once despite the new host's fresh-only
intent. The next slice adds an opt-in observation from the original Session SQL
transaction that inserts the Run and uses it before entering Worker. Legacy
materialization return values are unchanged.

The focused owner suite passed 31 tests. A later four-test run repeated three
cases and added atomic concurrent-materialization coverage; these counts must not
be added. It also preserves model-reserved usage across a cold wake with no new
dispatch, and leaves explicit unknown recovery to the original Worker. All tests
are synthetic and offline. Full-suite and independent final qualification are
still pending; no old live or offline result is inherited.

## Provider-free qualification checkpoint

Fixed source `1afb49ae75c6322cd95442a1868d1ec90f7164cf` passed a new complete
999/999 local suite and build. PR #2's original Verify workflow also passed
999/999 and build; its synthetic merge tree exactly equals the WIP source tree.
See `docs/verification/v025-rebuild-provider-free.safe.json` for exact bindings.
The added acceptance bridge and synthetic case plan are separate prospective
engineering preparation, not evidence of a live pass. No model has been called
by this reconstruction so far. The PR remains a draft, not a release approval.

## First real-attempt boundary

A separately frozen new ten-scenario campaign reached one durable request
reservation and dispatch intent, then local fetch rejected before any HTTP
response. No scenario completed; no answer or zero-cost receipt was available.
The unknown and whole allocation remain retained, without replay. This does not establish a
Runtime product failure or a passed acceptance run. Subsequent unauthenticated
HEAD controls showed that the engineering owner had omitted the platform's
existing networking/CA environment. Inheriting those unchanged values restored
public-site connectivity, not proof of the historical request's remote outcome.

A distinct nine-scenario supplement was prepared only for previously unrun
RB25-02 through RB25-10. Its launch tool was interrupted and no owner/batch or
dispatch record was observed. The original exact launch window expired; it was
not retried. No supplementary qualification or release is claimed. See
`docs/verification/v025-rebuild-first-live-attempt.safe.json`. Earlier sections
remain historical stage records, including their then-zero request counts.

## Reauthorized independent supplement

After explicit permission to restart the previously unrun nine scenarios, a new
independent batch completed RB25-02 through RB25-10. Independent review verified
9/9 scenario Runtime contracts, ten persisted reports and thirty complete Go
responses with cost zero, with no new unknown. The original failed scenario and
canceled launch remain unchanged. This does not turn the original cohort into
a passed ten-scenario result. Two model inference/range issues in 06 and 09 are
retained separately from Runtime behavior; content is not described as flawless.

C05 contained two distinct questions and bounded tasks before execution, so the
nine scenarios encompass ten model-bearing logical tasks. The predeclared aliases
and per-scenario persisted Run identities are mapped separately; whether that
mapping satisfies the release gate must be documented, not silently substituted
for the original nine-scenario score. No release qualification or publication is
claimed by this checkpoint. See
`docs/verification/v025-rebuild-supplement03.safe.json`.
