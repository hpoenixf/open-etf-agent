# Atomic query bridge: ingestion races and identity contract

Status: five new executable characterization tests, no production bridge enabled.
Combined Node 26.11.1 bridge/atomic-gap/owner/reuse suite passes 21/21.

## Race outcome established with actual Host and Session

The tests perform a successful current-claim read in the reconciliation callback,
then cancel, replace the writer, or advance past the deadline before Host source
registration. Host can persist a real ResultRef after that earlier check. The old
Session claim then refuses result-committed, usage remains one, and no paired tool
result enters the Run checkpoint. This deliberately distinguishes an orphan source
object from authorized model-visible evidence; it does not pretend filesystem
registration and SQLite commit form one transaction. Takeover is exercised while
the deadline is still valid, avoiding a confounded expiry explanation.

The original Runtime already awaits result-committed before its result consumption
path. A new bridge must keep that ordering and never deliver an adapter result to
messages/gateway directly. No precheck alone can close the race between await points.
Original owner revalidation at the actual commit is mandatory.

A separate expiry test finds `claim.read()` intentionally remains available past
the execution deadline while the lease is valid. It is useful inspection, not
permission to dispatch: reserve/checkpoint reject DEADLINE_EXPIRED without state
change. Consequently a bridge based only on `claim.read()` would be incorrect even
before considering async races. Do not change legacy read semantics to hide this.

## Concurrent recovery and stable operation identity

Two contenders cannot hold a live Session claim: the second gets LEASE_BUSY.
After release/reclaim, the fence increments but a test-only candidate operation
hash remains stable and the tool reservation stays one. Its identity uses original
root/run/grant, frozen catalog/document scope, fixed adapter/model/page-evidence
binding, and canonical effective call. Fence and lease are excluded from operation
identity; they gate the current writer rather than creating a new operation.
Changing run, root, grant, scope or query changes the hash. This pure test hash is
not exposed as a production capability and provides no independent authorization.

## Decision and narrow implementation requirements

Do not enable a generic extension with a read-check plus acquisition callback.
Extend only the new profile's original dispatch/reservation pathway, so the Session
owner validates deadline, current writer, original scope and persisted call at
reservation time and freezes the effect intent with the tool charge. A narrow
owner-issued capability may permit initial dispatch once; on recovery it permits
only inspection of that original operation. The backend must receive neither a
Session handle nor arbitrary checkpoint authority.

At Host ingestion/paired commit, the original owner must validate current fence,
active Run, deadline and exact receipt/intent binding again. Cancellation does not
permit a new writer to adopt late evidence. An authorized active takeover may
reconcile the same operation ID without recharging or starting a second backend.
An already persisted tool-dispatched intent with no receipt remains unknown.

Scope handling must remain profile-specific. The protected profile still rejects
dynamic tools with PROTECTED_TOOL_UNSUPPORTED; no allowlist or revocation checks
were relaxed. Existing immutable task and pure knowledge_query hashes stay intact.
The current passing tests justify the ordering contract, not yet implementation of
an owner-issued capability or a new persisted intent schema. Those require focused
migration/legacy-restore tests and independent review before activation.

No new user decision or permission is needed for the offline work. No model,
provider, download, service, remote write or new budget framework was used.
