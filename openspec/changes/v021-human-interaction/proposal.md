# v0.21: ordinary Human Interaction

## Status
Fixed implementation completed. Original796/796 offline tests and ten real tasks passed; see docs/verification/v021-release.md for exact evidence and semantic limits. Publication remains pending.

## Problem and responsibility
The original ordinary-response profile gives one exact question per root Run. A real local research task may need a follow-up after receiving the first answer. Creating a replacement Run loses the original grant, budget and recovery identity; treating a reply as new authority is unsafe. Merely adding a reply command does not solve this lifecycle.

This module owns ordinary request identity, associated response receipt and durable adoption into the original consumer. The original Session remains its transaction owner. Runtime dispatch/settlement, source identity, grants and root budgets do not move. A user can inspect an original question, answer it once, retry an identical submission, inspect whether it has actually been adopted, and continue the same Run across process exits.

## New contract and compatibility
- Explicit `interaction: {schemaVersion: "human-interaction@1", maxQuestions: 3}` in a response-enabled project selects new Session schema6 and ordinary-response adapter3. The public project initializer/update defaults an omitted maxQuestions to3 only inside an explicitly present interaction object. Supported range1–8.
- Existing projects omitting interaction keep schema3 and its original one-question behavior. Project configuration updates affect only future tasks. There is no automatic Session migration. A schema3-only reader must reject schema6.
- At most one unadopted question. Requests, replies and adoption facts remain immutable/associated; history is not reconstructed from final answers. Question count does not create model/tool budget.
- `receiveResponse` binds exact Run/question/response identities. Exact retries return the original receipt; changed bytes or reused identities fail. A first reply after cancellation, expiry or terminal settlement fails. An existing receipt is not erased merely because the Run later expires.
- Original fenced adoption and the paired tool result commit together. Waiting releases the worker lease, makes no provider call and does not extend the Run deadline. Explicit work resumes the original Run; no automatic polling worker is introduced.
- Local inbox/history are read-only projections with bounded pagination. They do not run models, grant permissions or establish delivery to another user.

## Deliberate exclusions
This is a local single-user blocking question module, not the full private service. It does not add non-blocking intervention, terminal-Run continuation, effect approval, permission expansion, business handoff, Child-targeted questions, Schedule+Response, or a remote authentication/UI service. Original guards for unsupported compositions remain. A response is untrusted content, not authorization for tools or Memory writes.

## Verification plan
Original Runtime/Session/Worker/public project entrypoints must prove sequential questions, same-Run receipt/adoption and report, cold restart, exact duplicate/conflict behavior, expiry/cancellation, original budget/fence and immutable history. Real process loss at the second answer's result-committed/result-consumed/model-reserved checkpoints must preserve pairs and unknown accounting. Retain original single-question suite and actual legacy-reader refusal evidence. Source tampering, grant or question mismatch and unsafe combinations fail closed.

Real qualification requires a separately frozen source and task plan on the shared account. No previous version's result is relabeled as this version. Natural tasks must not prescribe a tool sequence; mechanism checks must match the declared question lifecycle. Original failures and unknowns remain in their denominators.
