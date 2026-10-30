# v0.17 WIP: two callers, one local slot

This candidate is not a released version. It adds a small capacity owner around the existing durable Runtime and Gateway, not a new model client or budget ledger.

With Node 26 and the project's installed dependencies:

```sh
node src/admission-demo.mjs normal
node src/admission-demo.mjs unknown
```

Both commands start two local Node processes and a synthetic HTTP server bound to `127.0.0.1`. They never read provider credentials or call a model service. The original Gateway parser still consumes the HTTP response; its `live` adapter mode does **not** turn this fixture into live-provider evidence.

`normal` prints A occupying the slot, B queued, then B dispatching only after A's original Gateway completes. `unknown` cuts an HTTP 200 event stream before its terminal evidence: A remains unknown, B times out without another HTTP request. Each command prints a `receipt.safe.json` path and retains its synthetic state under a new `output/admission-demo/` directory. These databases/run artifacts are local evidence, not files to commit or upload.

## Use with the original Runtime

```js
const admission = await createSharedAdmission({
  directory: './capacity', routeId: 'our-fixed-route'
});
let managed;
const gateway = {
  mode: originalGateway.mode,
  admission: 'shared-admission@1',
  next: input => managed.next(input)
};
try {
  const result = await run({
  question, gateway, requireReport: false,
  durable: {
    store: session, grantId, bindings,
    onClaim({ runId }) {
      managed = admission.wrap(originalGateway, { session, runId });
    }
  }
});
} finally {
  // Keep the owner open until the run settles, including failure paths.
  admission.close();
}
```

Imports come from `src/admission.mjs`, `src/runtime.mjs`, `src/session.mjs` and the original `src/gateway.mjs`. `session`, `originalGateway`, `bindings` and `grantId` retain their existing contracts. The complete runnable offline wiring is in `src/admission-demo-worker.mjs`.

Every participating process must use the **same capacity directory and actual fixed endpoint**. `routeId` is a trusted configuration label, not automatic endpoint discovery or an account-wide quota. The module governs only calls through its wrapper. Ordinary local tools/extensions remain usable; arbitrary plugin-owned external calls and unwrapped clients are not covered. This first managed entry rejects non-durable runs, independent compaction callbacks and Child entry before their unsupported path executes.

## Four facts, not one combined status

- **Budget:** only the original `claim.reserve` transaction debits RootBudget. Admission takes its exact returned receipt, not a later mutable total. Waiting, cancellation and unknown do not refund it.
- **Capacity:** one slot is held by admitted, dispatched or unknown work. A bounded queue (default 8) waits. Queue deadlines expire only work not dispatched; dispatched/unknown never expires automatically.
- **Termination:** an original successful Gateway return or its branded complete-body terminal failure can release capacity. A local abort after dispatch, partial stream or killed worker cannot prove remote termination.
- **Quality/cost:** a released slot is not a successful research answer, a verified bill or permission to retry. No price or zero-cost claim is inferred.

## Recovery and acknowledgement loss

`admission.snapshot()` lists safe capacity facts. `inspect(ticketId)` and `inspectReservation({ rootId, modelOrdinal })` read the **original** ticket. A duplicate valid Runtime reservation raises `ADMISSION_ALREADY_RECORDED` with that ticket ID; it neither issues another Gateway request nor debits again. A settled ticket can therefore be read after its acknowledgement is lost.

A dispatched worker that dies leaves its slot occupied. Unknown remains occupied even after the original Session lease expires. There is no force-release or automatic retry API in this candidate. Missing external termination evidence requires explicit investigation; replacing the directory, changing the group label or creating a fresh request is not reconciliation.

Session and Admission use separate SQLite files. They are not an atomic cross-file transaction: a crash after reservation can consume budget without creating a capacity ticket. Fence/active-state checks reject stale state observed before dispatch, but are not an atomic remote revocation barrier. HTTP runs outside short database transactions; a database error never falls back to unrestricted dispatch.

## Qualification boundary

The initial targeted run had 2 passes and 8 failures caused by fixture submission setup. After correcting fixtures (not weakening production contracts), all ten targeted cases have passing **batched** evidence, including real local processes, half-stream HTTP, process termination, stale fence, queue cancellation/deadline and same-receipt duplication. This is not a claim of one final integrated 10/10 run. Final integration with current main, full offline suite/build and external-provider qualification remain separately tracked. Paid calls and formal publishing are paused.
