# In-Run query effects: original-owner feasibility checks

Status: offline owner-contract tests and design, not an implemented dynamic
embedding tool. No Runtime, Session, Host, task schema, or budget schema changed.

## Reuse demonstrated

A new query effect should be a distinct versioned tool/profile, NOT an online call
added to synchronous `knowledge_query` or its replay verifier. Existing Runtime
`onDispatch` already calls fenced Session `reserve('tool', checkpoint)` before the
handler. It atomically increments shared root usage and saves tool-dispatched state.
Host already supports `recoveryVersion`, read-only `reconcile`, and `verifyResult`.
Runtime invokes reconcile for tool-dispatched recovery rather than execute.

Six synthetic probes exercise those actual owners:
- A completed synthetic receipt survives worker interruption; reconciliation runs
  once, execute is not repeated, root tool usage stays one, terminal replay is inert.
- Missing receipt yields TOOL_OUTCOME_UNKNOWN, retains usage/unknown effect and
  never re-executes. A missing acquisition claim must not be interpreted as permission
  to redispatch: the tool reservation already proves an effect may have begun.
- User cancellation remains terminal, not permission to reconcile or retry.
- Changing the admitted adapter version is refused before another callback.
- Shared tool exhaustion rejects a second action before execute.
- Session rejects reservation kind `embedding`; failed reservation changes no state.

Node 26.11.1: 18/18 owner-contract + prepared-task + typed-acquisition tests passed
(6 + 4 + 8). The synthetic receipt uses a test file, not a crash-durable production
implementation. This is not a power-loss, cross-process fence, real-model or semantic
qualification. Initial harness failures were corrected (missing fixture catalog and
Runtime vs Worker outcome shape), not misrepresented as production regressions.

## Narrow candidate implementation, not yet enabled

For the authorized local-only backend, reuse the original tool allowance to bound
one logical query effect per dispatch. Do not call it paid physical-request accounting.
A single effect may perform tokenization and encoding separately. Bind a new tool
profile to: immutable admitted source manifest, exact page-vector/model/tokenizer
identity, document grants, limits and acquisition protocol. Derive operation identity
from runId + callId + canonical effective arguments + fixed profile, never query text
alone; same text under another Run/grant is not shared authorization.

Execution would create one exclusively claimed acquisition under that identity.
The existing typed acquisition owner handles backend wait, abort and immutable
receipts; the original Host owns ResultRef ingestion. On restart, reconcile only
inspects the exact existing operation and source/model binding. A complete receipt
can reconstruct the pure query and original source pages. Missing, partial or unknown
receipts yield unknown, never a new process. Verification recomputes only from the
recorded vector evidence, never a backend. Completed tool results must remain
verifiable after startup using frozen effect records without changing old snapshots.

## Remaining implementation gates

1. Define and test the new profile's admission binding, complete-grant source check,
   cross-run/call operation IDs and immutable receipt verification before enabling it.
2. Preserve old synchronous query/tool hashes and legacy task restore behavior.
3. Page-vector reuse must bind source digest, model manifest and actual dimensions;
   do not silently import another collection's vectors or re-encode all pages under
   an uncounted backend loop. Query-only prepared receipt semantics are not yet built.
4. Test real crash points around reserve/claim/response/receipt/Host ingestion,
   fence takeover, and cancellation before and after durable commit.
5. Any future billable backend needs an explicit shared physical-attempt allowance
   in the original owners. Neither tool count nor local process callbacks supply it.

No user decision or new permission is currently needed for these offline gates.
Real weights/dependencies remain absent, blocking real-backend qualification, not
further design tests. Adding a generic effect framework or a second billing ledger
would not resolve these gaps and is deliberately avoided. No downloads, providers,
network bypass, paid requests or remote publication occurred in this step.
