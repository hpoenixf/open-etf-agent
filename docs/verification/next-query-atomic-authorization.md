# Run query atomic-authorization decision

Decision: keep the Run-internal dynamic entry disabled for this increment. Save
executable characterization and a narrow original-owner integration design rather
than enable an ad hoc callback bridge. No production authorization code changed.

## Observed gap, not a false timeout/security claim

Two new tests dispatch through the original Session reservation, start an actual
standalone acquisition with a paused synthetic tokenizer, then either take over the
expired Session fence or cancel the Run. Releasing the tokenizer can still produce
a successful immutable acquisition. The original old claim correctly refuses its
result checkpoint (STALE_WRITER/RUN_CANCELLED); tool usage remains reserved once.
Thus an acquisition success is a data-completion fact, not a proof of current Run
authorization. Existing independent owners behaving correctly does not make their
composition atomic. A filesystem receipt is not authority to resume a cancelled Run.

Node 26.11.1: the two characterization cases plus eight original-owner and six
query-only reuse tests passed 16/16. These tests deliberately document a missing
integration guarantee; they do not claim a production defect was fixed or that
late backend work was remotely terminated. Previous protected-mode refusal, crash
unknown retention and stale-writer tests remain in the suite.

## Smallest candidate, reuse before framework

Prefer extending only the new profile's original Runtime dispatch checkpoint with
an owner-created immutable query-effect intent. The existing atomic tool reservation
must persist it before any backend operation. A separate generic effect framework,
new queue or second budget database is unnecessary for this candidate.

The intent must bind original root/run/grant, admitted catalog and allowed document
scope, model-manifest/page-evidence identities, profile version, exact effective
callId and canonical arguments. Derive the operation ID from those immutable facts,
not just text or callId. A reservation fact and operation ID are not permission to
retry a missing backend receipt. Once persisted tool-dispatched, a new writer can
only reconcile; it cannot start a replacement under a new ID.

An original Session method should validate the new-profile intent against the
persisted proposal/dispatch and active claim within its existing transaction. No
caller-provided boolean or independently acquired competing claim can substitute.
The token's historical dispatch identity and the current writer fence serve different
purposes: takeover must preserve the former while invalidating the old writer.
Current authorization and cancellation must be rechecked by the original owner
before Host source ingestion and paired checkpoint commit. An old process can leave
an orphan immutable receipt, but cannot commit it. A valid new writer may only
adopt a matching receipt when the original Run remains active and authorized.

The Host/Runtime API must provide this narrow capability to the new query adapter;
current generic callId/signal is insufficient. Expose no raw store/claim or general
checkpoint authority to backend code. The verifier reads frozen receipt evidence
only. Protected mode remains PROTECTED_TOOL_UNSUPPORTED until separately designed
with its original current-grant/dependency owner, not silently treated as legacy.

## Mandatory proof before implementation is enabled

- New-profile intent is derived from admitted facts; altered scope/model/query,
  wrong root/run/call and omitted intent are refused before process startup.
- Intent + existing tool reservation commit atomically; no second charge on resume.
- Crash after reservation but before acquisition claim remains unknown/no redispatch.
- Receipt after takeover cannot be committed by the old writer; cancellation never
  authorizes new-writer adoption. Active takeover can reconcile an exact receipt.
- Partial/forged receipts cannot become knowledge source results; original ResultRef
  ownership and current document authorization still gate ingestion.
- Legacy task/tool/checkpoint hashes and restore paths remain byte-compatible.
- Protected mode continues refusal without consuming a new tool reservation.

No user decision, credentials or new permission is blocking these offline proofs.
The blocker is a not-yet-implemented and independently reviewed owner capability,
not missing real model weights. Real dependencies/weights separately block semantic
backend qualification. Do not loosen either boundary to make the demo pass.
