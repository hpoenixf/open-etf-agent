# Trusted optional specialist execution limits — bounded extension

This candidate adds an explicit trusted-assembly `executionLimits`, not model arguments,
a profile registry or a permission. Absence preserves SOURCE_CHECK_LIMITS (4 rounds,
2 reads, 30000 ms), the original question bytes and original method binding bytes.
The optional value is a plain object with exactly maxRounds, maxTools and timeoutMs:
safe integer rounds 1–24, tools exactly 2, safe integer timeout 1–3600000 ms.
The adapter snapshots it; caller mutation cannot alter an admitted method.

An explicit value is included in the original sourceCheckBinding hash and the
question's executionBudget. The Child definition limits, readonly reader and
reconcile must agree with that same value. Wrong/omitted explicit binding, wrong
Child limits or deadline later than the parent is rejected. Model tool arguments
remain exactly {question}; documents, grant, route/model and Main-only Publication
are unchanged. New parity assembly may choose 24/2/3600000, with actual deadline
min(parent deadline, now + Child timeout). Old defaults do not change; no timeout
extends on terminal read/reconcile. No new active Child recovery is qualified.
HTTP120 and physical Child30/root57 controls belong to the reviewed harness and
are not implemented or claimed by this source extension.

Separately this candidate ports the bounded foundation repairs: unknown dispatch
custody with terminal inFlight deduplication, explicit working-input consumers,
exact summary-envelope lower bound before reservation, 1h configurable Runtime /
Session upper bound, nullable function deltas, and optional Gateway outcome.
Only the original Gateway WeakMap-brand recognized complete-body JSON non-success
settles an attempted request. A truncated SSE prefix or forged error code does
not. Legacy records without gatewayOutcome retain the original conservative
working/root-budget predicate; absence is never retroactively marked settled.
The original teaching caps, readonly owners, schema, defaults, parent authority,
Publication and all history remain unchanged. Cancellation preserves full unknown
identity; general byte-exact full-cap constant metadata closure is not promised.

Required local evidence: actual original Child chain/readonly/Publication/parent
cancel/budget tests; complete JSON vs prefix SSE vs forged-code failed Child;
strict optional limits and no privilege expansion; explicit-limit reconcile and
coldread; unchanged old producer -> new reader in separate PIDs, including legacy
success, known tool failure and unknown model. No provider qualification follows
from synthetic transport tests. Full suite/build are separate, unrun claims.
