# Single-Run Worker design draft

## One authority, no Task shadow state

The worker is a bounded driver of one explicitly selected original root Run. Existing Session owns Run identity, immutable definition, status, root budget, checkpoint and execution lease/fence. Runtime owns dispatch and recovery. Publication and Artifact continue to own their independent committed outputs. Worker owns only its process lifetime and observation result, never a second durable job status.

The original ScheduledTaskWorker's Task-level coordination lease is intentionally absent: there is no public Task, Schedule or multi-Root workflow to coordinate. Two workers use the same Session claim; only the live fence can mutate. A claimed callback or convenience API may be introduced only if the existing Runtime remains sole claimant/driver; no already-claimed alternate execute loop.

## Admission and selected execution

Proposed CLI shape (not current commands): `session submit --session DIR --run ID --case durable-publication`, then in a fresh process `session work --session DIR --run ID`. Retain existing inspect/cancel/publication commands. Explicit ID gives a lost-output caller an original read target; it is not a new credential or account identity.

Submission uses a shared Runtime preparation function for input/config/binding validation and the initial checkpoint. It persists via Session and returns the original Run ID only after commit. No model/tool dispatch, plugin activation, worker claim or timer remains after submit. Reusing an occupied ID never overwrites the Run or creates another ID: exact same immutable admission may return the original fact; a different definition fails closed. Do not add a separate deduplication table or silently choose a new Run on conflict.

`work` reads the original definition and selects the fixed synthetic profile. Unknown/mismatched bindings or a non-root selection fail before dispatch. Root limits and absolute deadline were fixed at submission, not worker startup. No extra authority is manufactured from a CLI flag. Expired or cancelled work starts no provider request. Existing terminal work is read/confirmed, not executed again. A live owner is refused rather than replaced.

## Stop reasons must remain different

| Observation | Permitted action | Forbidden inference |
| --- | --- | --- |
| Explicit `cancel` committed to original Session | Stop new dispatch; keep committed outputs; retain original cancellation/unknown effects. | Transport close alone is user intent. |
| Worker SIGINT/SIGTERM / host stop | Halt its dispatch and release only the lease it still owns after owned work has stopped; preserve last authoritative checkpoint. | Finish original Run as cancelled/completed just because host is stopping. |
| Lease renewal fails / fence is stale | Stop local execution; attempt no stale checkpoint, budget debit, publication or terminal write. | Renewal failure proves expiry, permits refund, or permits a replacement Run. |
| Model/tool was reserved or dispatched with no authoritative result | Preserve original debit/checkpoint and fail closed through the same recovery path; report unknown distinctly. | Reissue the request, claim success, erase unknown, or start a fresh Run. |
| Runtime returns / output stream ends | Read durable original status and receipt; report unresolved facts as unresolved. | stdout, emitted final text or process exit is a durable commit. |

The existing v0.8 Runtime external signal is a user-cancel path. Introduce a narrowly named host interruption input without changing existing caller cancellation semantics. It may skip normal terminal bookkeeping only for that non-user interruption; real explicit cancel/deadline/failure still follows original owner rules. At safe checkpoints, resumption continues the same Run. During an uncertain effect, it retains the reservation and existing unknown-outcome boundary; it does not promise transparent continuation.

Abort acknowledgement and stale fencing are not proof that a remote effect stopped. For the initial cooperative synthetic profile, owned resources must stop before releasing a still-current lease. If a resource cannot confirm stopping within the bounded process lifetime, do not claim release/completion safety; retain the durable reservation/lease-expiry boundary and report the limitation. No distributed exactly-once guarantee is proposed.

## Durable readback and local scope

Worker's final summary derives from `Session.inspect` and original Publication/Artifact receipts; do not duplicate terminal fields in a job table. Publication remains readable after later failure, interruption or explicit cancellation. A terminal Run with an unknown outcome remains its original failed/unknown result, not a success or implicit retry authorization. Reading is not a claim.

One selected Run, one local SQLite file, no network listener and no additional configuration are sufficient. This is local grant isolation, not multi-user authentication. Built output must support the same bounded commands with zero new dependencies. Existing old Artifact readback remains a separate regression; no old active database migration is added.

## Review gate

The lifecycle seam and original-contract adaptation are the main review risks. Confirm explicit submission identity, same Runtime and one lease before writing code. If the implementation needs a queue, second Task state machine, dynamic configuration, external service or private source copying, stop that expansion and return to scope review rather than treating it as necessary boilerplate.
