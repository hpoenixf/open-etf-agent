# v0.14 fixed-core parity snapshot

Dated 2026-11-02. This is a complete fixed teaching-core snapshot plus its scoped foundation changes, **not a narrow patch to the older maintenance/phase parent and not a release**. It uses one existing public parent; local recovery ancestry is excluded.

- Public parent: `038d980651143b06a3baa895a029f7510d43d77c`
- Actual execution source: `3ea0f5e67ec93922f538fc23ebc4c275bd92eaa0`
- Core tree before this added note: `e93d0dde2178f2ae0f1c23fb6fbbb3de81552bfa`

## Recorded evidence

- The actual selected Node suite passed **16/16**: CLI 3, consumer 6, projection 4 and new foundation combinations 3.
- The original wrapper incorrectly expected 17, exited **1** and retained **complete:false**. Independent static count reconciliation accepted 16; no test was deleted, invented or rerun to erase that wrapper result.
- Four identical foundation owners reuse explicitly bound v13 evidence; that evidence is not recounted as v14 execution.
- Representative **L: 1/1**, four Main requests. Revision-2 synthetic readonly Memory entered the actual wire; the selected library remained byte-identical and original report/Reader bytes matched.

No Memory writer, durable recovery or Publication bridge is added; current-revision visibility does not certify semantic adoption.

Representative safe-receipt SHA256: `7a6183af46208a796665e0f785a795a259fc5cb6247ab513700c1a0674b934b8`.

## Retained limits

Parity caps/profile are explicit harness selections, not product defaults or new spending authority. These scoped checks do not establish a full-suite/build result or complete version qualification. Representative outcomes have their own denominator; old failures, unknowns, tags and qualification records are not rewritten. Earlier receipts remain bound to their own source. Pending Specs and exact-full-checkpoint metadata capacity remain open; no retry, refund or unknown-effect replay follows from this snapshot.
