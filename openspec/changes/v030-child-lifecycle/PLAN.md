# v0.30: independently controlled Child lifecycle

Status: implementation candidate, not released or fully qualified.
Baseline: Open `64a8c5ffe7cb8b25945865715818af566f856005`.

## User outcome

Stop one admitted Child without cancelling its original parent or unrelated work. The original parent can consume a source-free cancellation observation, retain uncertainty and budget usage, then continue another permitted task. Restart must use the original cancelled identity rather than create a replacement execution.

## Contract

- `child cancel --project DIR --run PARENT --child CHILD` selects an exact direct Child. Existing `run cancel` remains whole-Root cancellation.
- Completed/failed/cancelled Children are immutable no-ops on repeated cancellation; wrong parent/Root is rejected.
- Session atomically persists cancellation and revokes the Child writer. The Runtime rechecks its original fence after checkpoint callbacks before another dispatch.
- Cancellation is not remote termination. Dispatched/uncertain work stays unknown and charged; no request refund, retry or source adoption follows cancellation.
- A cancelled handoff contains no answer or source, retains partial/unknown effect facts and is independently verifiable on cold readback.
- Root budget exhaustion still prevents subsequent model calls; parent cancellation still cancels all active Children.

## Completion work

- [x] Original Session cancellation, Runtime fence check, adapter control consumption, research CLI entry.
- [ ] Final independent code review and complete regression suite.
- [ ] Cold CLI, late-result, parent commit/consume recovery and shared-budget qualification finalized.
- [ ] Frozen real ten-workflow qualification using the independently authorized Open budget, with all failures/unknown retained.
- [ ] Bilingual usage, fixed-version evidence, approved version/lockfile change, CI and release decision.

## Deliberate boundary

This closes independently controlled lifecycle on the existing serial `delegate_child` path. It does not claim asynchronous model-visible spawn/inspect/cancel, parallel peers, broad partial-result delivery or complete private Child parity. Those broader execution surfaces require their own design and verification; an unknown cancelled Child is not silently transformed into success.
