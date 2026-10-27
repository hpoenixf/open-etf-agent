# Proposed staged assertions (not execution evidence)

All stages use one serial Node worker, bounded heap and command timeout, synthetic data and owned temporary files under the project's ignored test-output. No external provider, PG or persistent service. First scaffold assertions must actually reach behavior, not merely fail imports.

## Slice A: trusted packages

1. Two original packages contribute through one schema; default function-only path remains usable.
2. Invalid later package leaves no earlier contribution active and releases all staged resources once.
3. Duplicate tool or built-in collision is rejected before activation.
4. New package version affects a new binding only; prior Run binding remains stable.
5. Release failure is reported without fabricating rollback success or discarding other releases.
6. Model arguments cannot select an unknown package/path or grant additional tools.

## Slice B: durable store before Runtime integration

1. Fresh safe SQLite schema and reopen preserve original request/Grant/bindings/deadline.
2. Wrong schema/unsafe file path and credentials in binding fields are refused before execution.
3. Two owner claims cannot both mutate one live fence; expired takeover invalidates the old owner.
4. Reservation is durable before an injected failure; restart does not refund it or refresh deadline.
5. Cancellation/terminal status cannot be reversed by a late write.
6. No asynchronous external callback runs inside a DB transaction.

## Slice C: same Runtime in actually different processes

Use narrowly placed test fault checkpoints with a parent-owned child process, not a second loop or fake process-restart counter. Assert actual exit and new PID.

- Terminate after proposal sealed, before dispatch: original calls execute without a new model proposal.
- Terminate after result commit, before consumption: consume the exact original result once; no duplicate file write or model budget reset.
- Terminate after external dispatch without settlement: inspect reports unknown; resume does not redispatch automatically.
- Cancel while an owned invocation is pending: late result cannot revive or publish a new continuation.
- Lease expiry/takeover followed by a stale writer's commit: reject the stale fence.
- Child handoff committed before root consumption: bound child result is consumed without another child model call.
- Adopted note before interruption: restored next input uses its exact note/ref and original-source scope.
- Memory result before interruption: same one-use intent/entry revision, no writer lock stolen or write repeated.
- Saved report before interruption: original artifact/revision/bytes acknowledged, not regenerated.
- Unsupported old active-state version is refused while old immutable artifacts remain readable.

Each real failure and its minimal fix must be recorded with source pins. The phase remains a candidate if any advertised recovery profile is unqualified; plugin activation passing alone never closes recovery.
