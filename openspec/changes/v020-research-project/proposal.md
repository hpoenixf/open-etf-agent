# v0.20 Research project: reader-owned inputs and real tasks

Status: locally prepared implementation and layered-evidence candidate, not released. The user accepted additional B runtime9/10 plus independent forget proof; original strict gates and frozen scores remain unchanged, not an unconditional all-gates qualification claim.

## User outcome

A reader imports explicitly selected text, Markdown or PDF, asks their own research question, chooses supported capabilities, runs the configured real model, and inspects an original-source-backed report. They can stop a Host and resume the **same admitted Run**. Creating a replacement Run is not recovery.

The project application composes the existing Runtime, Session, Worker, Admission, Memory, Child, TaskTime, Response, Schedule, Publication and Artifact/Reader owners. It is not another execution engine. `research-project.mjs` owns project admission/configuration and `research-cli.mjs` is its thin command surface.

## Contract boundaries

- Source import accepts explicit ordinary files, never scans a directory. Original bytes, bounded UTF-8 physical pages and PDF parser snapshots are content-addressed and atomically published. Names/content are untrusted data. Recovery uses verified saved objects, not mutable original paths.
- Selecting a file or classifying a task is not an authorization grant. Live admission requires explicit provider, selected-data and cost approval. An API-key environment variable name may be recorded; its value is never saved in the project.
- A task retains its first project identity, source manifest, configuration, grant, Memory intent set and TaskTime. Project configuration revisions affect future admissions only. A repeated identical submission can complete interrupted admission without issuing a new grant; changed requests cannot replace the existing task.
- Child methods are trusted bounded descriptors. Existing method defaults remain unchanged; methods cannot acquire new authority, another root budget, write permissions or arbitrary recursion. The child uses its original Run identity and shared Admission group.
- Memory reads do not imply permission to write. Save/revise/forget require explicit, content-bound user intents and original revision checks. The application does not implement a full personal-memory lifecycle product.
- Trusted tool modules are explicitly approved Host code, not a sandbox. The selected entry is snapshotted and checked by content hash. Relative/bare entry imports are unsupported; explicitly trusted built-ins/absolute dependencies are not a certified dependency closure.
- Provider accounting context is observational metadata from the actual admitted reservation. It does not modify messages/tools or let a model choose its role. Live gateway replacement is rejected; the original configured Gateway is used.
- Unknown provider effects and reservations remain unknown. Cancellation, Host stop, waiting for a response, scheduled time and Run completion remain distinct states.

## Explicit combination boundaries

Supported combinations require each capability's original prerequisites. The matrix must not imply arbitrary pairwise compatibility. Response + Schedule, Schedule + Child, Response + Child, PDF snapshot + Child and trusted plugin + Child are rejected before model work in this version. The historical document-revocation demonstration is not generalized into a new dynamic-grant product. Python isolation, arbitrary MCP protocols, recurring background scheduling and multi-level Child execution are out of scope.

The reference principle from the private implementation is ownership of grants, original Run recovery, Child authority subsets, explicit Memory writes and exact Host-returned artifact references. Open does not copy an unverified private service architecture or claim private-equivalent maturity.

## Acceptance

Forty new natural-goal scenarios in four groups of ten cover own data/results, Memory/Child/tools, interruption/recovery/delivery, and time/Response/comprehensive tasks. Prompts do not prescribe a successful tool sequence. Evaluation checks answer facts, original citations, material omissions and uncertainty as well as mechanism evidence. Each batch needs at least nine passes, no known Runtime defect and all designated critical cases passing. Failed/unknown cases remain in the denominator. At most ten additional repair executions are allowed, recorded separately.

Each scenario has at most 24 aggregate physical requests across Main, Child, summaries, setup and resumed turns. The existing shared cumulative budget and unknown accounting remain binding; a scenario allowance never increases them. Freeze implementation, data, questions, checks, provider profile and budget checkpoint before real dispatch. No success claim may be made from a fixture model, offline tool reachability or the existence of a report alone.

## Subsequent user direction and bounded control amendment (2026-11-03)

The user clarified that isolated disputed semantic answers are observations, not a reason to change prompts or rerun a task. Runtime, effects, identity, accounting, mechanism and cold-read correctness remain hard gates. Repeated clear semantic patterns should be investigated separately; this does not certify financial or answer quality.

Run control is centralized within the existing Runtime; original Session, Result, Child, Admission and publication owners retain their authority. See `../../../docs/run-control.md` for the exact scoped pure/stateful reference correction, atomic mixed-Child-group rejection, cancellation/unknown handling and asynchronous notification boundaries. There is no new execution service or generic catch-and-retry policy.

New projects persist a 60-second summary observation window, configurable up to 120 seconds within the original Run and transport boundaries. Older task/project definitions are not silently migrated. A longer local wait never proves that a previously unknown remote call completed or was cancelled.

## Delivery amendment: separate evidence layers (2026-11-03)

After the original forty tasks and six independent repairs, the user explicitly authorized an additional complete B cohort of ten tasks. This adds at most 240 physical requests while keeping the shared 3000-request ceiling and remaining four repair slots. The additional cohort completed 9/10 Runs; its frozen mechanism score remains 8/10. The user accepted this runtime result plus independent provider-free original Host/API forget-exclusion proof. Original failures, unknowns and source attribution are preserved. This amendment does not replace samples, require a model to issue unnecessary search calls, certify semantic quality or authorize publication by itself.
