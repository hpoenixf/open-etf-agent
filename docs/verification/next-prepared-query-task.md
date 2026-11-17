# Prepared-query admission seam: offline Runtime compatibility

Continuation of the local-process WIP; not a new release or full in-Run dynamic
retrieval. `submitPreparedKnowledgeTask` consumes an already completed acquisition
and sends only its verified frozen vector evidence through original
`submitResearchTask`. It never starts a backend or acquires a budget reservation.
Explicit requiredQueries must be covered exactly by SHA256, and the acquisition's
source-manifest identity must equal the requested task manifest. Missing/unknown
preparation is rejected. Caller-supplied callbacks or replacement vector evidence
cannot be injected through this seam. Task inputs are copied before asynchronous
inspection; original admission continues to own task conflicts and binding hashes.

## Supported use

1. Explicitly prepare arbitrary selected queries with the acquisition owner.
2. Inspect completed evidence, then admit a new task through this helper with its
   acquisitionId and requiredQueries. The original task API, authorization and
   project configuration checks still apply.
3. Run/recover through the existing Runtime. No acquisition/model process is needed
   for subsequent consumption or restoration of that frozen task.

A newly prepared query requires a new task snapshot. It cannot mutate an admitted
Run's index, evidence digest, tool identity or previous query result. A model asking
an unprepared query during the Run retains the existing truthful lexical fallback;
this helper does not pretend that a new vector was acquired dynamically.

## Why direct Runtime callback replacement is unsafe

`createKnowledgeTool` and `verifyKnowledgeResult` share the original pure query
implementation. Result verification/recovery recomputes that query. Adding a model
process inside it would redispatch an effect during replay and alter task identity.
Existing Session root reservations are for model/tool work, not a dedicated physical
embedding allowance. No alternate budget or recovery owner was introduced here.
In-Run arbitrary-query vectors still require a versioned effect receipt and original
Session/Runtime reservation ownership, interruption/unknown accounting and admission
hash design. Page-vector reuse/caching is also not implemented by this helper.

## Evidence and remaining gates

The new test file initially failed without the module. Its final four tests pass.
Node 26.11.1 combined preparation/process/protocol/acquisition and original hybrid
Runtime regression: 37/37. Tests admit two separately prepared arbitrary queries,
prove the old binding unchanged, reject conflicting task IDs/uncovered queries/
wrong manifests/unfinished acquisitions/callback injection, consume a real Runtime
knowledge result, interrupt after result consumption, remove the preparation store,
and resume successfully in a fresh process using only frozen task/source evidence.
The backend vectors and model gateway are synthetic: Runtime compatibility is not
semantic quality or a real embedding/model qualification.

Real torch/transformers/sentence_transformers and fixed audited weights remain
unavailable in the checked environment. No dependency/weight download, online
service or paid call was attempted in this step. Missing dependencies and model
qualification are prerequisites, not a newly observed permission denial. No claim
of complete dynamic retrieval, release readiness or Private parity is made.
