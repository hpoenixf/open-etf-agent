# A20 continuation acquisition prototype: offline evidence

Baseline Open v0.31 `14be5d2fb29a537b75fcc36ac40774608e1393d8`.
Not a release receipt. No actual embedding provider, model download, network request
or paid model run occurred. Node 24.22.1 diagnostic run, not declared Node 26 release qualification.

The preparation-port tests and existing hybrid/project tests passed 38/38:

```
node --test test/knowledge-acquisition.test.mjs test/knowledge-project.test.mjs test/knowledge-vectors.test.mjs test/knowledge-hybrid-project.test.mjs
```

Coverage includes exclusive same-ID acquisition, unknown-response retention,
invalid vector rejection, source-bound hybrid consumption, separate-process
readback without callback redispatch, pre-admission cancellation, in-flight
cancellation, corrupted evidence, missing terminal, provider key-order invariance,
noncooperative timeout with ignored late completion, and attempt-record accounting.
The existing tests include model-free production encoding/bounds and restoration
of old omitted-cap tasks after a new-project cap change. Synthetic vectors and
scripted gateways are not real semantic/provider validation.

Review fixes: sync both acquisition-directory parent entries before dispatch;
canonicalize provider metadata before persistence; bound the local callback wait
and prevent late response publication; check invocation/response accounting and
original attempt binding during readback. These are not a simulated power-loss
proof or a globally shared billing ledger. See the proposal for unimplemented
backend, shared budget, original effect-owner and dynamic-query integration.

No changes to old normalization defaults, schemas or task definitions. The result
cap change materializes eight only for newly created Knowledge projects; explicit
lower caps and historical omitted four remain, with source-byte bounds unchanged.
