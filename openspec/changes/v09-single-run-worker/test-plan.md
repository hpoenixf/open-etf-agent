# v0.9 test plan

At the initial draft all cases were unexecuted. Each case uses independently authored synthetic input and a test-owned SQLite directory. Original private cases motivate the failure, but do not count as public passes. No network service, private database or real model is needed. Run the smallest RED first after scope approval and slot handoff; never reuse v0.8's 286 or expanded 298 as this version's result.

## 9.1 Admission and original identity

- Submit persists exactly one root with fixed request, grant/bindings, limits and absolute deadline; counters remain zero and no worker is alive after submit process exit.
- Same explicit ID and same definition cannot create a second Run; different definition at that ID fails closed. Lost submit output is resolved by selected original-ID read, not a new submission identity.
- Invalid profile, binding, parent selection or missing session fails before dispatch. Waiting before `work` reduces remaining deadline; it never resets time or root budget.

## 9.2 Actual process and failure boundaries

- Submit in process A, await its real exit, work in independently started process B, then read original Publication/Artifact in process C. Compare original Run/root and receipt bytes, not only exit codes.
- Two actual processes contend for the same Run; only one active execution fence dispatches. After a controlled owner exit/lease expiry, stale tokens cannot renew/checkpoint/debit/publish/finish.
- SIGTERM at a safe durable checkpoint stops process B without user cancellation or terminal success. Fresh process C resumes the same Run and original budget/deadline.
- SIGKILL after a reserved model request but before its result is durable: fresh process performs no repeated request, preserves debit and exposes original unknown outcome. Do not mock process death.
- SIGKILL after Publication commit but before state/terminal checkpoint: fresh process confirms the same revision/ordinal/receipt without another model call or duplicate answer.
- Explicit cancellation before work dispatches zero requests; during a cooperative pending request it stops late effects. Cancellation and host stop races preserve the durable original winner, not a guessed reason.
- A suspended preparation/late callback cannot dispatch after cancellation, deadline or lost fence. Use actual cancellable fixture promises; no false claim of private 750ms or arbitrary live-provider latency guarantees.
- Later report/terminal failure keeps independently committed body/old immutable Artifact readable. Process/stdout completion without a durable terminal fact is not reported as success.

## 9.3 Final qualification

After focused GREEN, run the needed whole public suite once on frozen inputs, serial and within the existing resource cap. Separately validate a fresh locked offline install/build and built submit/work/read commands. Check the original Evidence Kit using its actual supported commands; retain accurate pending/completed status. Do not fabricate `spec:close` or count structural lint as execution.

Freeze input hashes and safe receipts, audit all publication objects, then hand the packet to the sole remote publisher. Rebind article coverage only after a fixed public commit and actual case execution. Article and site status are separate; no browser, semantic model, formal Release or new live-call claim is allowed.

## Observed execution and added counterexamples — 2026-10-27

The initial 11-case RED, first 16-case GREEN and final 305-case suite are separate observations with distinct input hashes. The final suite includes all 19 Worker cases: 11 owner/Runtime, three actual CLI and five real-process scenarios. The extra three are not retrospectively counted in the first GREEN: unacknowledged model stop retains lease/reservation, an expired token cannot mutate during the Worker's newer fence, and later report failure leaves Publication independently readable. No separate RED was run for those three.

Process tests invoke actual independent Node processes and real signals against synthetic SQLite. Model proposals are authored fixtures, not real model calls. The remaining independent-install/build and structural Kit gates are recorded in evidence rather than inferred from this test list.

## Current-main combination — 2026-10-27

After CI/lineage maintenance, re-freeze the same 124-input set against current main without modifying Worker behavior or reducing targets. The actual combined whole suite passed 309/309; this is a new execution, not a relabeled 305. The four additional cases are the already-published coverage-maintenance regressions. Original build/CLI observations are retained only with exact unchanged delivery-input proof. After an actual fixed v0.9 commit exists, bind one explicit independent submit/work/read Worker target in the existing coverage contract, retain all 14 previous targets and all their historical since pins, then execute the resulting 15-target smoke and consistency checks. No future SHA or unexecuted target may be labeled verified.
