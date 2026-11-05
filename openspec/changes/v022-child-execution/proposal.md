# v0.22: bounded Child execution

Status: release preparation on the published v0.21 main lineage, using the accepted same-source staged v0.22 evidence. Final package CI and publication are separate gates. The earlier roadmap table assigning Knowledge to v0.22 is historical; the maintained relative order places Child execution after Human Interaction.

## User result
A local research task can divide a question into several narrow checks using explicitly admitted methods and source subsets. Each Child runs in its own original Runtime context, returns independently checked source bytes and a derived result, and remains inspectable after Main consumes it. A safe process stop continues the same Child rather than replacing the execution or renewing its budget.

## Ownership
- Project configuration binds the method collection and maximum execution count at original task admission. Updating the project affects future tasks only.
- Session owns original Run/parent/root/grant identity, leases, cancellation, deadlines and shared accounting. Its existing Run rows are the only persisted Child lifecycle facts.
- Runtime owns request reservation, dispatch, checkpoint, known/unknown settlement and finalization. The Child adapter does not dispatch provider requests or infer settlement from error text.
- Original Result/Source storage owns the source bytes. Main receives validated original references plus explicitly derived advice; Main retains publication and Memory write responsibility.
- Child execution interprets the admitted delegation and validates those original facts. Its history is a read-only projection, not a parallel job table.

## Explicit opt-in
`childExecution: {schemaVersion: "child-execution@1", maxChildren: 2, methods: [...]}` selects the new `delegate_child` tool in a child-enabled project. Maximum executions and number of methods are each 1–8. Methods use the existing immutable `child-method@1` descriptor, with bounded read_page/read_result tools, question/output sizes and per-execution limits. Method IDs are unique. The new configuration cannot be combined with the old childMethod field.

The model selects an admitted method ID, a local question and up to two document IDs from the admitted project catalog. A project may contain up to 64 documents; each Child receives only its selected source scope. It cannot change method text, limits, provider, credentials, tools or grant. Failed executions consume their slot. Method limits never grant new root budget.

Existing projects without childExecution retain the exact one-source_check contract. No schema migration, implicit upgrade or reinterpretation of old handoff facts is introduced.

## Recovery and failure
Each delegation binds its exact original call ID, method descriptor, question, source scope, root grant and actual execution deadline. Only one Child runs at a time; a delegation must be the sole tool call in its assistant response. Mixed groups use the existing atomic refusal/correction protocol.

A cooperative Host stop preserves both original checkpoints. On restart, the original parent tool reconciliation finds and re-enters that exact Child. Runtime resumes safe checkpoints; a model-reserved or unreconciled dispatched effect remains unknown and is never replayed. Deadlines, reservations and execution counts do not reset. A terminal Child is read and verified, not rerun. A known failed Child may return independently validated sources with an explicit failure; unknown Child results cannot be consumed as settled. Root cancellation reaches every child and blocks Main consumption.

`child list` reports original execution identity, phase, terminal status, known/unknown disposition and Main adoption separately. A result may be committed but not yet consumed. Inspection dispatches nothing and does not create missing state. Remaining slots are not permission to run when admissionBlocked is present.

The first real cohort exposed a Main-side usability gap: `create_csv.rows` was a JSON-encoded string, so the ordinary Host correctly rejected it before dispatch and the task terminated. The correction candidate preserves that rejection and uses the existing one-correction control policy only for a JSON-stable, exact `rows` argument whose value is not an array. A private builtin validation brand and cold revalidation bind the original call and refusal. The model may issue a new call under the original budget; no parser, coercion, artifact replay or second control owner is added. Other CSV errors, protected mode, hooks, ambiguous union arguments, unknown/partial work and dispatched failures remain outside this proof. Schema wording now explicitly distinguishes an array from an encoded string. Changed tool definitions belong to new tasks on the new source; old failed tasks and old cohort evidence are not rewritten or reopened.

## Deliberate simplification
This is bounded serial, one-level, read-only Child execution for the local single-user project. It is not the complete private service. Independent Child cancellation, parallel/background execution, peer dialogue, nested children, terminal continuation, dynamic profile management and routing are excluded. Existing Response+Child, Schedule+Child, PDF+Child and trusted-plugin+Child guards remain. Main-side Memory, calculation/CSV, temporal, compaction and publication may compose without granting those capabilities to Child.

## Evidence boundary
Provider-free tests must cover original public entrypoints, method/source isolation, actual source readback, failed/unknown results, count/root/deadline authority, mixed-group correction, cancellation, cold recovery at both Child and Main checkpoints, and legacy behavior. Fresh provider tasks, installation qualification, remote CI and publication are separate gates. Historical version evidence must not be relabeled as v0.22.
