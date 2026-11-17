# Typed acquisition integration: offline candidate

`acquireKnowledgeVectors({backend,...})` selects a new `knowledge-acquisition-plan@2`.
Legacy `embed` continues to produce and recover plan@1 without rewriting old
snapshots. Passing both protocols is rejected. Backend capability bindings and the
model token limit are captured before asynchronous source loading. This remains an
experimental preparation operation, not a live Runtime tool or enabled transport.

Document and query inputs retain their roles and identities. The existing typed
protocol preflights all inputs and rejects oversized or unaccounted/truncated
encoding. Successful ordered role/token/vector receipts are published immutably as
`encoding.json` before evidence and successful terminal. The terminal binds its
receipt digest; readback checks the plan binding, expected roles/IDs, input digests,
token limits, and equality with admitted evidence vectors. Inspection never loads
or invokes a backend. Missing/corrupt receipts cannot become recovered success.

The acquisition owner's bounded wait covers tokenization and encoding,
not merely the final encode callback. It is NOT a strict timeout for the entire
acquire operation: initial filesystem preparation and durable writes can wait
longer. After complete response validation, a final synchronous cancellation check
starts a non-cancellable commit phase and detaches the backend timer/cancellation
forwarder. Abort during encoding/evidence/terminal publication does not retract a
validated result or roll back published files; successful durable commit still
returns success. Write failure retains the existing incomplete/no-replay handling.
There are no backend calls in this phase. Before that boundary,
timeout/cancellation leaves an unknown
operation when the backend invocation has begun, does not refund physical costs,
and does not prove remote termination. After a tokenizer returns late, the typed
protocol checks cancellation before encoding; no late response can publish success.
One typed adapter invocation can contain many callback operations. Its counter is
NOT a provider request ledger, a global budget, or proof of one physical request.
Validation failures after invocation are conservatively unknown if no complete
response was observed. No retry is added.

Node 26.11.1 evidence: four new tests failed before implementation; the integrated
suite plus unchanged protocol/acquisition/hybrid/project/vector suites passed 49/49.
After adding explicit typed child-process cold readback and missing-receipt/no-replay
coverage, focused tests passed 21/21 (5 typed + 7 protocol + 9 legacy acquisition).
Review found cancellation during receipt publication was not explicitly bounded.
New commit-boundary RED/GREEN tests inject abort and a delay beyond the backend
timeout during receipt linking, and abort immediately before commit. The former
now explicitly completes durability without aborting the finished backend signal;
the latter writes no typed receipt and cannot recover success.
The full 49 result predates the fifth typed test. Synthetic backends only. No model
weights, dependency install, online service, network request, paid call or release.

Remaining gates: independent review, actual model/tokenizer identity qualification,
real-backend exact-token compatibility, shared physical-attempt budget where needed,
and a separately authorized real semantic-validation cohort. Input/token digests
and callback receipts establish consistency, not cryptographic provider attestation.
