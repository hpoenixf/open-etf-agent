# Hosted Runtime PostgreSQL cutover
Engineering candidate for v1.0.9. This is not a deployment receipt. The
v1.0.8 daily Watch and Digest scheduler cutover is a separate part of the plan.

## Scope
- Replace hosted Session and Admission storage together. Keep Session the
  owner of Run checkpoints, writer fences, shared root debits, and Publication
  versions. Keep the Admission ticket ledger authoritative for provider
  attempts, capacity, reserved/dispatched/unknown states, and local release.
- Use PostgreSQL with explicit environment/workspace separation. No fallback
  or dual writes to SQLite for the hosted profile. Offline CLI examples retain
  their existing local store; Memory serialization is a different concern.
- Inventory effective hosted process binds, not just imports or database files.
  Check optional Accounts, Feedback, Reminders, and observability stores
  separately before claiming **hosted SQLite-free**. Replace or explicitly
  disable any in-use SQLite path within the approved runtime scope. Do not
  change authentication providers simply because a local class exists.
- Do not import old history by default. That is not permission to drop active
  work, reset a provider budget, recycle a dispatched ticket, or delete
  unrelated state. Quiesce each old writer and reconcile unresolved requests
  before admitting work against the new store. Preserve existing recovery and
  accounting evidence outside the new online path as needed.

## Invariants before integration
- Acquire Session/root ownership before Admission route/ticket ownership in
  operations that require both. Use PostgreSQL transaction locks on stable
  rows or equivalent constraints; replacing SQL syntax alone is insufficient.
- A stale writer cannot reserve a unit, advance a checkpoint, settle a Run, or
  replace published output. Check compare-and-set results inside the relevant
  store transaction and use immutable binding fields when reconciling a retry.
- A durable local stop and a capacity release are different receipts. Either
  leaves remote result and billing unknown; neither allows a new dispatch,
  refunds a debit, or completes the remote operation.
- After PostgreSQL commit but before an acknowledgement, read the original
  immutable receipt. Do not recreate a Run, Ticket, or Publication revision.
  Never automatically retry across the provider dispatch boundary.

## Qualification
1. Run competing root/child callers and provider-capacity contenders using
   independent database connections, with a barrier and a single last unit.
   Assert one winning reservation and one provider dispatch for the same slot.
2. Force an expired-owner recovery race and stop/release acknowledgement loss.
   Assert stale-fence refusal, exactly one durable stop and compatible release,
   unknown remote/billing states, and no new debit or external replay.
3. Inject lost acknowledgement after Publication is committed. Reopen with
   a fresh process and connection; require the exact original body digest and
   revision, no extra Publication, and no new model request.
4. Stage only: restart candidate with PostgreSQL-only mode and an empty
   writable workspace. Exercise relevant hosted routes and inspect actual
   database connections/files during work, not only at idle. Test unavailable
   PostgreSQL: hosted readiness must fail without creating a SQLite file.
5. Roll out only after Stage passes. Record fixed source, running version,
   previous launcher, guards, and readback; before rollback reconcile new
   PostgreSQL work instead of silently falling through to the retired store.

Public baseline cases: test/session.test.mjs, test/admission-lost-owner.test.mjs,
test/admission-release.test.mjs, and
test/run-control-publication-caller-ack.test.mjs.
