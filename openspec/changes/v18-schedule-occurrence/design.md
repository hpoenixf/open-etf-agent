# v0.18: one confirmed instant, one original Run

Status: accepted implementation scope by root on 2026-11-02; not implemented/qualified/released by this document. Prior roadmap v1.8 `planned_candidate` is historical design input, not a previously approved v0.18 Spec. Base: local WIP d3babfecc2d31278f3cee4e61720a1f74be38741, tree f003a0b6d8f9f81d5e20148a778ac157d081d249, 483 leaves. Existing N paid result belongs to that baseline, not this extension.

## Three interface designs

1. Sidecar schedule database plus scheduler/executor: reject. Two commits cannot atomically establish occurrence→Run; a second lease/retry loop would compete with Session/Worker/Admission.
2. Export a prepared Run DTO for a controller to reconstruct: reject. This exposes Runtime checkpoint/definition internals and creates a second admission owner.
3. **Selected: original Runtime submit preparation + Session-internal synchronous materialization.** Runtime prepares the same immutable definition/checkpoint; Session owns confirmed schedule facts and inserts the original root/Run plus the occurrence link in one short transaction. Existing `workRun` alone executes. No async callback is accepted inside a transaction and no second executor/lease is introduced.

## Initial surface and boundaries

Explicit `schedule-occurrence@1` Session profile, schema 5, **new databases only**. Existing schema 2/3/4 are never upgraded or migrated on opening. Old Session openers reject schema 5 before writable recovery. New code retains old profile behavior. This is an explicit capability/schema extension, not transparent compatibility.

One local trusted confirmation binds one immutable definition revision, one UTC instant, one explicit IANA time zone, a bounded lateness window, exact original grant/bindings/tools/documents/resources, and the initial Runtime checkpoint. No model tool can confirm, change, cancel, or grant a schedule. The trusted API retains original Gateway fixture/test/live modes; this is not a new live authorization. Only the thin CLI is fixture-only. Initial runnable CLI assembly is fixture-only, using public synthetic atlas-a/atlas-b, read_page/save_report, existing report+Publication. Child, Memory, PDF, protected documents, ordinary response, plugins, hooks, extensions and workingInput are rejected. Time becoming due never expands authority.

The CLI exposes explicit confirm, wake/resume, inspect and cancel/revoke operations. **There is no background service and no promise to wake a machine.** Restart recovery means invoke wake again against the same confirmed reference. Existing Worker and optional original Admission wrap are reused, not reimplemented. No new provider route, credential, billing, cron parser, recurrence/date engine or notification channel.

## Identity and time

A confirmation includes `scheduleId`, integer `definitionRevision`, exact `scheduledInstant` (existing Temporal UTC syntax), `timeZone`, and positive integer `maxLatenessMs` strictly below the explicitly selected task timeout (no separate five-minute cap). Its reference includes a canonical SHA256 over the full confirmed envelope. Run ID derives from the tuple (scheduleId, definitionRevision, scheduledInstant), while the separate confirmationHash binds the full envelope; identity alone is insufficient: every wake validates the full reference/hash against persisted confirmation.

A schedule ID is single-use in this smallest version. Exact confirmation retry returns the same fact. A different revision/body/instant under that ID is rejected, not selected as a new “latest”. To revise: explicitly cancel the old confirmation, then confirm a new schedule ID/revision. This deliberate limitation avoids hidden replacement or accidental old occurrence execution. The original confirmation remains readable.

Confirmation must precede the instant. The selected deadline is fixed at confirmation as `scheduledInstant + timeoutMs`; TaskTime anchor is the scheduled instant with the confirmed zone. The due window is `[scheduledInstant, scheduledInstant + maxLatenessMs)`, and lateness must be shorter than timeout. Before due: not-due, no Run. At/after window end: persist missed, no Run. Late-but-allowed execution receives only the remaining fixed deadline, not a fresh timeout. Once materialized, repeats return the same Run even after the window, never refresh anchor/deadline/budget.

## Facts, schema and owner seam

Two new STRICT tables in the original Session DB:
- immutable schedule definition: schedule ID, canonical confirmed envelope including revision/instant/zone/lateness and exact original Run definition/initial checkpoint; digest, confirmation timestamp;
- occurrence: same schedule ID, immutable reference, state (`confirmed`, `materialized`, `missed`, `cancelled`, `revoked`), nullable unique original Run ID, decision timestamp.

`materialized` is only a durable link, **not** a shadow executing/completed status. Current execution outcome is always projected from original Session Run. A materialized occurrence keeps its link when authority is withdrawn; original root cancellation is the execution authority. No replacement Run is permitted.

Extract original Session `create` SQL body into a private synchronous helper. Normal `create` remains its original transactional wrapper for schemas 2–4; schema5 rejects ordinary create so it cannot bypass confirmation/time admission. Schedule materialization validates current confirmation/reference/time/state, calls that same insertion helper, and records the unique link within one `BEGIN IMMEDIATE`/commit. Any definition/codec/uniqueness/write failure rolls back both facts. Async directory creation remains outside SQL; a crash can leave an unused owned empty directory, but never an admitted Run without a link or a model/tool call before commit. No claim of filesystem-wide atomicity.

Cancellation/revocation is linearized in the same DB. Before materialization: mark no-longer-authorized, no Run. If materialization won first: invoke the original `cancelRoot` owner in the same transaction, keep full unknown facts and spent budgets, retain the original Run link and any committed Publication/report. Host stop is not user cancellation; no claim that cancellation stops an already dispatched remote effect. ACK loss is not settlement.

New schema admission validates exact tables, bounded envelope/hash/reference, state/link consistency, root-only Run identity and exact original definition. Read-only APIs never recover or write; original hot-journal rules remain. Original Artifact Reader serves immutable unprotected report bytes; original Session Publication API serves its body/receipt. No new HTTP publication body protocol.

## Minimal intended write set

- `src/schedule.mjs` new: bounded metadata/reference/confirmed-envelope contract; no executor or storage.
- `src/session.mjs`: explicit schema5/table admission; private shared root/Run insertion; confirm/materialize/inspect/cancel schedule facts and readonly exposure.
- `src/runtime.mjs`: reuse existing submit preparation for confirmation/wake and exact original definition binding; reject unsupported combinations before work.
- `src/schedule-demo.mjs` new thin synthetic assembly: original Runtime/Worker + fixed public fixture, no execution state machine. Kept separate because existing durable-demo hashes its own source into legacy bindings.
- `src/session-cli.mjs`: narrow explicit commands routing to that assembly and readonly inspection.
- OpenSpec proposal/design/spec + focused tests/fixtures. Existing Worker, Admission, Gateway, Reader, durable-demo and Publication owners remain byte-identical.

## Counterexample / free validation matrix

1. Exact confirmation ACK-loss retry; changed revision/instant/zone/grant/tools/budget/hash rejects; a guessed deterministic Run ID cannot adopt another Run.
2. Two ordinary processes wake the same reference: exactly one root/Run/link, zero duplicate model reservation; no second execution lease.
3. ACK lost immediately after materialization, restart then wake: same Run/directory/deadline/TaskTime/budget; ordinary Worker resumes or reads terminal.
4. Before due, exactly due, just before and exactly at exclusive window end; missed persists with zero Run and zero model/tool calls; no catch-up retry.
5. Cancel/revoke before wake and materialize-first race: serialized outcomes, no unmapped active root; in-flight cancellation uses original unknown preservation/no refund.
6. Changed revision cannot resurrect cancelled/missed confirmation; new explicit ID is a separate user authorization, not auto retry.
7. Inject SQL/codec/Run collision failure inside materialization: both Run and mapping roll back, original confirmation survives; no provider calls.
8. Original submit/work safe proposal recovery, stale fence, unknown refusal and Admission brand/unknown occupancy are reused, not weakened. Synthetic normal wrapped work verifies the original brand path.
9. Complete synthetic report/Publication then different-PID readonly reopen and Artifact Reader GET/HEAD exact original bytes; cancellation never fabricates a report or erases committed facts.
10. Old v2/v3/v4 byte/inventory snapshots unchanged after rejected schema5 opt-in; old opener rejects new5 with bytes/inventory unchanged. New5 malformed hash/orphan/link/unknown schema refuses before writable recovery.
11. Unsupported Child/Memory/PDF/protected/ordinary/plugins/hooks/workingInput and arbitrary non-public recipe reject before model/tool dispatch.
12. No full suite/build/paid credit implied. Bounded focused source window will be requested after static freeze; existing large near-cap and admission/Publication evidence may be reused only at exact unchanged owner hashes.
