# v0.17 candidate: one local shared capacity group

Implements roadmap 1.7 from `engineering/open-v1-v2-plan-20261027/ROADMAP.md`, lines 317–347. This is local development only; no release or external-provider qualification is claimed.

Two local calling processes share one fixed route and one slot. A small durable queue admits one original Runtime model reservation at a time. The original Runtime's `claim.reserve` transaction remains the sole RootBudget debit owner. Its returned view supplies the exact model ordinal, Run, fence and input hash; Admission never reconstructs the ordinal from a later cumulative usage read and never debits or refunds a budget.

Admission owns a separate local SQLite file because original Session schemas are closed and verified exactly. This is one capacity truth, not a second budget truth. The two files do **not** form an atomic transaction: a crash after budget reservation but before admission may retain budget without a ticket; a committed ticket or dispatch is inspected by its original identity, never retried automatically. Dispatch occurs outside the capacity transaction. A database error never falls back to an uncoordinated Gateway.

States record queued, admitted, dispatched, completed, cancelled and unknown. These are capacity facts, not research-quality or billing claims. The original Gateway's branded complete finish can establish termination, including known remote cancellation. Local cancellation before dispatch cancels the queue entry without a request. Local cancellation after dispatch, a half-stream failure, process death or lost terminal evidence retains capacity. There is no TTL that frees unknown occupancy. Existing settled ticket reads reconcile a lost acknowledgement without a new call.

The wrapper supports the original durable main `gateway.next` entry. Unsupported compaction callbacks, Child entry and non-durable execution are rejected before reservation or their external callbacks. Ordinary tool plugins/extensions remain allowed. This does not govern arbitrary unwrapped code, plugin-owned external calls or all calls made by an account. No Routing, Failover, price catalogue, new billing platform, external database service, multi-group fairness or observability platform is added.

Run fence and current active reservation are checked at dispatch admission and settlement. No claim is made that checking a local fence can retract a request already sent to a remote system. Unknown or crashed tickets remain occupied, so a later Run claimant cannot exploit lease expiry to get a replacement call through this group.

The completion boundary is the original bounded two-process scenario, explicit original-ticket inspection, and necessary offline interruption/identity tests. Live/provider results and publication remain pending while paid calls and publishing are paused.
