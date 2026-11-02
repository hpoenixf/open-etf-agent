# v0.16/v0.17 WIP foundation integration — provider-free only

This candidate carries the four existing-owner repairs from public main [`2ddd222`](https://github.com/hpoenixf/open-etf-agent/commit/2ddd22221c899f7bbbc3dc17d927810f5e381e03) into WIP [`008b19b`](https://github.com/hpoenixf/open-etf-agent/tree/008b19b6f762ae77e6b69d24f6757edeab97d15e). It is **not** a v0.16/v0.17 release, a live-provider qualification, or permission to retry unknown requests. The package version, historical tags, and original 488/507/556 qualifications are unchanged.

[Structured evidence](wip-foundation-integration-20261102.safe.json) · [Executed source/test/fixture/script hashes](wip-foundation-integration-20261102-inputs.sha256) · [Fixed public foundation contract](https://github.com/hpoenixf/open-etf-agent/blob/2ddd22221c899f7bbbc3dc17d927810f5e381e03/docs/verification/foundation-repair-20261102.md)

## What was integrated

- **Host/Runtime consumer admission:** validate the selected original/note reread tools before new execution, without widening grants. Protected defaults are resolved first; existing terminal readbacks retain their binding, Host, Publication and current-revocation checks.
- **Runtime/Session cancellation:** retain an uncommitted dispatched tool as unknown once; do not reclassify a committed result merely because an old dispatch pointer remains. Preserve WIP checkpoint-size and document-profile boundaries.
- **Runtime/Specialist settlement:** carry the additive optional `gatewayOutcome` fact from the original Gateway. Legacy records remain conservative; a settled failed Child is not made successful, and settlement is not billing evidence.
- **Compaction:** reject a mathematically impossible net saving before reserving a summary call. All original post-summary adoption checks remain.

The shared-admission Runtime still receives the **same reserve operation's returned view** and mints its original branded reservation. Failure restores the previous phase; no later cumulative budget read is substituted. Admission's owner, reservation brand and offline demo worker are unchanged. `compaction.mjs` and `specialist-child.mjs` match the fixed public foundation files byte-for-byte; Runtime, Session and Host retain the WIP-specific protected/admission integration.

## Fixed provider-free evidence

- Complete original test glob: **575/575**, **93 files**, no failures, skips or cancellations; Node **26.11.1**, one worker, 512 MiB heap, **80.28 seconds**. No timeout or orphan; owned leader waited.
- Existing native ESM build passed separately in **1.92 seconds**. All **76** source/fixture build outputs match their originals. This is syntax checking/copying, not a TypeScript typecheck.
- Source/test/script/fixture input digest: `f71db773b9a8ab9472414de8e7788b5abe7479bc401c30d80c0132ee48cf3022`; all **208** inputs were unchanged during execution. Three verification documents and the current-root status addendum were added afterward, without changing product or test bytes; the previous status text remains verbatim as historical evidence.
- Focused groups passed **63**, **10**, **39**, and **12** tests respectively. These overlap the full suite and are not added to 575.
- Independent frozen-source Standards and Spec review found **zero unresolved findings**. The reviewer checked baseline/delta bytes and actual output hashes without rerunning tests; this is not proof of absence of defects.

The first new composition run was **10/12**: two assertions incorrectly expected `gatewayOutcome` in the worker's deliberately narrow IPC `result` projection. They were corrected to inspect the original Session checkpoint. The production worker was not changed. The failed receipt/hash remains recorded; neither these failures nor older failed/unknown batches are erased.

## Boundaries retained

**v0.16 remains fixture-only.** Its original five tools, two synthetic documents, Report/Publication requirement, current dependency checks and mediated revocation remain. A new fixture test verifies default protected tools with context, exact terminal readback, and subsequent revocation denial. A separate injected-callback negative verifies that protected `live` mode is still rejected before any callback; it constructs no transport.

**v0.17 remains bounded shared admission.** Original tests cover local processes and loopback HTTP, queue cancellation/deadline, half-stream unknown, killed workers, stale fence and reservation identity. Added assertions compare original Session settlement facts with original capacity results. Unknown occupancy/debits are not refunded or released by this change; no automatic resend is introduced. A loopback adapter labelled `live` is not real-provider evidence.

No external provider requests, credential reads, original paid-ledger changes, main/pilot modifications, live entry implementation, tag or release were performed by this preparation. Historical `wip-snapshots/` objects are retained rather than replaced. Raw test logs, synthetic databases, dependencies, caches and build outputs are local-only and must not be published. Only separately authorized WIP backup is in scope; this evidence does not authorize paid continuation.
