# Design and owner seams — draft

## Scope and inputs

One built-in `source-check@1` method, not configurable personal profiles. Method text and version/content hash are trusted code/binding; model text cannot select tools, endpoint, credentials, filesystem paths or grant. Initial data scope remains existing public synthetic atlas-a/atlas-b pages; arbitrary local/private input is not implied. The actual user question is bounded by existing Runtime limits; material scope is an operator-bound subset, not self-declared by a source or model.

Main may make one ordinary specialist tool call. Its arguments may supply a bounded local checking question, but effective documents/method/root authority come only from the trusted binding. Reject mixed batches containing this call plus other calls, second delegation, recursive delegation and forged scope. Include the original Main question plus local checking question in the Child handoff; do not copy Main's message list, private scratch work, unrelated results, credentials or Memory.

## Reuse existing owners

- `src/child.mjs`: still calls original run() with independent messages, read_page only, narrowed allowedDocuments, child task identity, root budget/cancellation. Preserve existing limit ceilings; no fresh deadline on resume. A bounded child timeout may be configured by trusted code only, at most remaining parent deadline; do not reuse the fixture's fixed 5s as unproven live adequacy or silently increase global limits.
- `src/durable-child.mjs`: deepen the existing bound adapter (or a small clearly named specialization in this module). Legacy durable_child remains fixture-only. New method binding accepts separate Main/Child Gateway instances, but **same exact gateway binding/route/model** as enforced by Session. Independent request/context does not require different providers/models. No relaxation of CHILD_SCOPE_MISMATCH or adapter-subset checks.
- `src/session.mjs`: existing v2 root/run/lease/fence and terminal outcome provide original result custody; do not add a table/schema. Child config taskId plus trusted adapter version/hash bind its method. Existing parent grant/rootLimits and deadline remain authoritative.
- `src/child-results.mjs`, `results.mjs`, `tools.mjs`: read original owned refs from the actual child receipt directory, verify original source bytes/scope, import through ordinary Host sourceResults. Never use a path/result identity supplied by model text. Summary stays derived; it is not registered as original source evidence.
- `src/gateway.mjs`: actual independent request serialization through createChatGateway; provider-free qualification injects a local transport and is labeled as such, not real live traffic. No second protocol or special mock response accepted as live proof.
- `src/runtime.mjs`: normal awaited tool call means Main issues no new model request while Child unresolved. Shared reservations remain original Owner's responsibility. Only targeted correctness fixes required by this seam are allowed, not a Runtime rewrite.

## Durable result, not an extra result store

Non-durable Child currently returns its summary in an object, which alone is insufficient for independent-process original handoff readback. Use the existing v2 Session terminal child outcome and original Host source refs. Handoff binds parent/root/run/task/call, method version/hash, status/code, derived summary, limitations, original refs and actual mode. Derive identity from Session and original receipt, never infer completion from prose.

Persist original child outcome once through the existing Runtime terminal checkpoint. Main consumes it as the original tool result, then its next encoded request must contain the same identity/summary plus usable, parseable original page content: validated sourceId/resultRef, document/version/page/hash and original text, not merely opaque refs. Final report sourceIds must be a subset of sources actually imported and verified by the original Host; derived summary cannot supply or replace an original citation. Main's output is produced from this actual input, not a fixed report string or a fabricated second result. For offline tests, varying the child reply must vary the observed Main input and corresponding synthetic output. Capture encoded requests, not only a callback return or console message.

A fresh-process read-only command/API uses explicit session/parent/child IDs to read the original settled outcome, source refs and Main report bytes; no new model call, duplicate delegation, regeneration or lifecycle replay. Prefer an existing read seam; a necessary thin read command is a consumer, not a new owner.

## Serial lifecycle and limits

One root → Main → at most one Child → settled handoff → Main resumes. Child's model/tool operations charge the same existing root counters, with its local limits no greater than the remaining admitted parent constraints. Parent delegation dispatch consumes its ordinary tool unit; Child operations are separately charged once under the same root, never new root allowance. Use a fixed per-parent specialist task identity plus a persistent Session child lookup to enforce one Child, including across crashes/new call IDs; a closure flag or child task ID derived solely from changing callId is insufficient. Existing Session supports multiple siblings generally; do not weaken unrelated profiles or rely on its generic sibling limit to enforce this module. Preserve and validate the original delegation call identity in the trusted handoff binding.

Source-checking methods do not grant arbitrary extensions, reports, child recursion, memory writes or sources. Main alone owns save_report/Publication. No new shared Admission is required because requests are serial; do not extrapolate this to concurrent provider-capacity guarantees.

Read authority after a successful claim, not from stale pre-claim inspect. Handoff verification rechecks current persisted child lifecycle plus snapshot.outcome.status/code/unknownEffects/partialEffects and exact original identity before consuming. A top-level status label alone is not proof of successful/settled effects; inconsistent terminal fields reject, unknown effects block Main continuation, and committed partial effects retain their original classification. A stale fence cannot publish or overwrite another driver's progress.

Cancellation follows existing admission ordering: if cancellation is committed before reservation, refuse new dispatch; if reservation already committed, that request is admitted in-flight and can still physically start before remote stop propagates. Do not promise instantaneous revocation or exactly-once remote effects. Root cancellation reaches the child; no next Main request while child termination/effects remain unknown.

## Partial failure and recovery boundaries

- Completed Child: original summary + valid refs may be consumed; semanticStatus remains unreviewed.
- Known terminal failure with fully settled effects: preserve independently committed sources and explicit failure/limitations. Main may use only validated original sources; no fabricated successful specialist conclusion. This is a successfully read failure outcome, not reclassification of Child as succeeded.
- Cancelled/unknown effects/unsettled Child: preserve inspectable known facts but do not silently continue as if settled, auto-retry, reroute or create replacement Child. Existing TOOL_OUTCOME_UNKNOWN/MODEL_OUTCOME_UNKNOWN remain visible.
- Previously valid Main body/artifacts survive a Child/attachment failure; no deletion or synthetic zero result.
- Parent interruption after child terminal but before parent consumption: reconcile original settled child by deterministic task identity, verify original binding/refs, and consume once. No second Child/model request.
- Active Child recovery is explicitly **not** newly qualified. Existing adapter's settled-only reconciliation remains; active/unknown returns unavailable. No new recovery engine or schema migration. Supported fresh-run and terminal-read profiles are stated separately.

## Model authorization gate

A runnable injected Gateway interface is not permission to use a key. Before external tests, root must establish public repository task scope, selected endpoint/model, permitted synthetic data, call/count/cost ceiling and no-overage policy, and remaining cumulative allowance. No credential contents enter source/docs/log receipts. Missing any required authorization leaves external calls unrun; no probing a new key to discover billing behavior. Reuse existing live configuration/transport gates only after review, never pass approval booleans merely to get a real request through. Test-only placeholder credentials and a guaranteed injected local transport are labeled provider-free.

## Dependencies and change budget

No new npm/service/vector/database dependency. Existing Node/SQLite/Gateway/Runtime suffice. Proposed code files: child.mjs, durable-child.mjs, child-results.mjs if needed, one thin specialist assembly/CLI consumer, focused tests/process fixture. tools/runtime changes only when concrete new boundary coverage requires them. No planned schema/permission relaxation, new Profile storage, shared Admission, generic multi-agent framework or production private-code copy.
