# Query-only page-vector reuse and owner boundaries

## Design implemented narrowly

`acquireKnowledgeVectors({reuseAcquisitionId,...})` creates a new plan@3 under the
existing exclusive acquisition owner. It only accepts a successfully verified
plan@2 parent with explicit backend weight identity and exactly matching project
source manifest, canonical provider, dimensions and model-manifest identity.
The parent must be in the same project; unknown parents, legacy unbound identity,
self references and reuse chains are rejected before encoding. The new operation
contains new query vectors only; it copies exact admitted page vectors without
passing document text to the backend or re-encoding pages. It does not merge prior
queries or modify prior receipts. Existing plan@1/@2 semantics remain available.

The child plan binds parent acquisition ID, plan digest and evidence digest.
Its typed receipt records only query encodings. Readback revalidates the original
parent and exact page-vector equality, then validates the child's query receipt.
Missing/corrupt parent evidence cannot be silently replaced or regenerated. A
previously admitted task remains self-contained in its frozen evidence, but a new
admission from a fork requires its preparation chain to remain verifiable.

## Authorization: implemented scope vs remaining Run integration

The preparation boundary now binds the complete imported source snapshot and
model provenance record. It does NOT assert that a matching manifest grants
permission in any Run, or replace current document revocation checks. Query-only
preparation is an explicit operator operation, not an enabled Runtime tool.

Before a Run tool may use it, the original owner must bind and check the complete
authorization tuple: Session/root/run identity, original grant and admitted allowed
documents, current revocation state, active writer fence, persisted effective call
ID/arguments, frozen source/model/page-vector identity and profile version. These
facts must come from the original Session/Host owners, not caller-supplied labels
or a boolean callback. The current extension execute context only passes callId
and signal; fabricating a second claim or using a stale read-only snapshot would
not supply atomic authority. That owner integration remains deliberately disabled.

Protected profile remains fail-closed. A direct real Session probe places the
synthetic dynamic name in its admitted allowedTools and proposal, then still gets
PROTECTED_TOOL_UNSUPPORTED with identical checkpoint and usage. No allowlist,
grant, protected source validation or security setting was weakened.

## Crash/fence/compatibility evidence

Node 26.11.1: 35/35 query-reuse, original-owner, legacy acquisition, typed acquisition
and prepared-task tests passed (6 + 8 + 9 + 8 + 4). The first three query-reuse
regressions failed against the old implementation, then passed after plan@3.
Tests cover document-free query encoding, immutable parent vectors, provider/model/
dimension/source mismatch, missing parent receipt, unknown parent, reuse chains,
cancellation and no redispatch. An actual child process is SIGKILLed after encoding
and evidence publication but before terminal linking: inspection remains unknown,
and the same acquisition ID cannot start again. This is a process-crash test,
not a power-loss/fsync or distributed filesystem proof.

An original Session takeover probe confirms the expired writer can neither reserve
again nor commit after the next fence; usage remains one. Earlier probes retain
unknown outcomes and cancellation, reject old-task binding changes and enforce
shared tool limits. They are owner contracts, not proof that a live embedding
process is automatically stopped by Session fencing. A future owner integration
must check its fence before Host ingestion and must never reuse late results to
revive an invalidated Run.

No new framework or budget ledger was introduced. Local logical tool accounting
still does not cover billable physical attempts. No real model, dependency download,
network service, paid call or remote write occurred. Real backend qualification,
atomic full Run authorization binding and protected-profile design remain gates;
there is no user permission blocker for further offline implementation work.
