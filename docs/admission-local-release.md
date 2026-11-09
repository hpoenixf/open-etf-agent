# Manual local release of an unknown Admission slot

This operator policy releases local capacity only. It is not evidence that the
provider stopped, the business result is known, or billing has settled. Original
`requests.state = unknown`, Session outcomes, consumed Root budget and external
allocation ledgers remain unchanged. No retry, refund, automatic expiry, new model
request or replay is performed. Old readers continue to count that unknown as
occupied; new Admission acquisition excludes it only after a durable release event.

Inspect the exact Project Run with `capacity inspect --project DIR --run ID`.
Its ticket now includes a `ticketSha256` computed solely over the original request
row plus routeId, not the mutable release projection. Prepare explicit JSON:

```json
{
  "operationId": "operator-release-unique-id",
  "identity": {
    "routeId": "EXACT_ROUTE", "ticketId": "EXACT_TICKET",
    "reservationId": "EXACT_RESERVATION", "rootId": "EXACT_ROOT",
    "runId": "EXACT_RUN", "modelOrdinal": 1,
    "inputHash": "EXACT_HASH", "owner": "EXACT_ORIGINAL_OWNER", "fence": 1
  },
  "expectedTicketSha256": "EXACT_INSPECTED_HASH",
  "reason": "Authorized operator reason and local owner stop evidence locator"
}
```

Then use `capacity release-unknown --project DIR --run ID --release FILE
--preserve-unknown --no-replay --no-refund`. The corresponding operator API is
`releaseResearchUnknownCapacity`. It resolves the original task's route and Session,
not a caller-supplied stopped boolean. A writable original Session instance holds
its transaction while the Admission owner checks and appends the event in its own
SQLite transaction. Acquire uses that same Admission transaction boundary. Equal
operation/intent replay returns the same event; another operation or body conflicts.

The first version supports only an original Root Main request: Root and Run must
be terminal, every Run under that Root must have no active status, owner or lease,
the fence/round/working-message hash must match, and the current Root model debit
must equal that ticket's ordinal. Child/summary and subsequently advanced ordinal
cases are conservatively unsupported. Plain JSON inspection objects and read-only
Session handles cannot stand in for Session authority. Operator-supplied JSON is
only an expected identity, never the authoritative original ticket.

This policy does not discover escaped processes or prove remote termination. The
operator must separately verify the actual local owner is stopped before invoking
it. Explicit acknowledgement records the policy choice, not a factual assertion
that remote work is terminated. There is no model-visible release tool.

The patch's initial source base is released v0.25.0. Pending v0.26 tasks using new
context or document schema require a separately reviewed integration with their
original compatible Project/Session implementation; the v0.25 test cannot prove
that an older reader accepts those task definitions. Do not edit frozen task JSON
or remove schema fields to force compatibility.

Integrity and API boundary: every occupied-slot calculation, inspection and replay
validates the stored appendix against the exact original ticket and intent hash.
A malformed, mismatched or dangling appendix fails closed before new dispatch.
The low-level `createSharedAdmission().releaseUnknown` API is for trusted Host
integration: its real-Session brand prevents plain-object attestations but alone
is not a cryptographic proof of the Session database's Project lineage. Use the
Project API/CLI, which resolves the immutable task's registered route and exact
Session directory; do not substitute an arbitrary independently constructed
Session with matching identifiers. Coordinated rewriting of all database authority
is outside this local integrity contract.

## Two-hour terminal maintenance: first stage

`capacity maintain --project DIR --run ID` (API
`maintainResearchUnknownCapacity`) applies the standing policy to eligible
terminal unknown Main tickets of that original task. It is not another manual
confirmation: its event explicitly says `two-hour-local-release@1`. The invariant
acknowledgements describe the standing no-replay/no-refund/retain-unknown policy,
not a newly clicked operator approval.

The immutable original `createdAt` is enqueue time and includes queue waiting.
Only elapsed time **strictly greater than 7,200,000 ms** qualifies. Equality is not
due; updates and heartbeats do not move the origin. The event retains both dueAt
and actual observedAt. Invalid/future creation time is blocked. Original manual
events remain unchanged. A root with an active Child or other unsupported state
is reported blocked, never silently freed. No provider/billing history is reset.

This stage is an explicit lazy maintenance command, not a daemon or an active
request timer. It does not yet install Project-work entry/exit hooks, persist an
active-request stop intent, cancel a still-running Gateway or force lease
revocation. Those paths require separate implementation and verification. Without
a caller invoking maintenance, no promise of exactly-two-hour execution is made.

### First-party design references

- [AWS SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html): local visibility/possession is distinct from completion; its redelivery semantics are **not** copied into model request replay.
- [Temporal activity failure detection](https://docs.temporal.io/encyclopedia/detecting-activity-failures): heartbeat/timeout/cancellation mechanisms require an executing owner; an abort signal alone is not a stop receipt.
- [Azure Service Bus locks and settlement](https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement): releasing a lock does not establish business settlement.
- [etcd concurrency API](https://etcd.io/docs/v3.6/dev-guide/api_concurrency_reference_v3/): identity/revision checks belong in the mutation transaction; they cannot recall remote computation.
- [AWS idempotent API guidance](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/): an idempotent local release operation does not establish provider-side request idempotency.

These are supporting principles, not guarantees that this library implements those
services or that any provider request has been cancelled.
