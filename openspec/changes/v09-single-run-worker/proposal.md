# v0.9 proposal — one independently invoked Run Worker

Status: **scope accepted on 2026-10-27; implementation not yet qualified or published**.

## Accepted scope review — 2026-10-27 05:47 UTC

This bounded single-Run scope was accepted after proposal/design review: one Session execution authority, submission without dispatch, separately invoked work through the same Runtime, host stop distinct from user cancellation, and preserved unknown/fence boundaries. The original draft is retained in the development evidence; scope acceptance does not establish implementation or qualification. Proceed through necessary RED, implementation and actual verification, with zero new dependencies. A queue, second lease, service or new credentials would require renewed scope review. Stable main remains v0.8 until a separately qualified v0.9 is published by the sole publisher.

## Dated scope clarification — 2026-10-27

The CLI-first, one-module policy supersedes the earlier idea that Worker requires a new durable queue. That earlier v0.8 proposal and expanded WIP remain historical; they are not retroactively completed or reused as v0.9 evidence. v0.8 Publication is fixed at `2c096ce47be2161f97531170af07ef255872f8b1`, with stable main documentation/coverage at `3484c608dc0e7540b145b6484d9601a80f105171`.

Base this module on the original ScheduledTaskWorker claim/lease/cancel → same Runtime → durable settlement contract. Its private Task coordination layer is unnecessary for one explicitly selected public Run. Reuse existing Session execution lease/fence rather than create two job state machines. See [lineage](../../../docs/evolution/v09-worker-lineage.md).

## One minimal loop

1. A local CLI submission persists one explicit synthetic Run identity, immutable request/configuration/binding, root limits and deadline. It returns only after the original Session fact exists; it makes no model/tool request.
2. The submitting process exits. A separately invoked bounded Worker CLI selects that Run and drives the existing Runtime under its existing execution claim. No service, auto-start, scheduler or detached shell is installed.
3. Existing CLI inspect/Publication/Artifact reads recover the actual original result after the Worker exits. Process exit and progress output are not authoritative completion.

Only `durable-publication`, using the existing synthetic fixture, is the initial submission profile. This is real process/storage validation, not a real model or semantic evaluation. Other existing start/resume demos remain independent supported behavior and must not regress.

## Necessary support, not additional modules

- Runtime: shared admission/preparation and non-user host interruption boundary; retain the same execute/recovery path.
- Session: reuse original Run create/claim/renew/cancel/read/release, no queue/Task tables or generic event bus. Repeated explicit Run identity must not create replacement work.
- Existing CLI/demo assembly: explicit submit/work commands and readonly terminal observation, strict argument/profile/binding checks.

No change to original grant/budget/deadline at takeover, no automatic unknown retry, no stale writer settlement, no deletion of committed Publication or immutable Artifact.

## Exclusions and stop condition

No HTTP/SSE product surface, browser, global History, multi-Run queue, fairness/concurrency product, Schedule, notifications, parallel Child, public authentication or new packages. Same-generator background is not this Worker; foreground short questions while research runs are not implemented by this proposal.

Stop after the one input → independent process → durable readback loop and its identity/cancel/crash/unknown counterexamples pass, independent locked install/build works, existing regressions remain green and safe evidence is frozen. No real model requests are authorized by this draft.
