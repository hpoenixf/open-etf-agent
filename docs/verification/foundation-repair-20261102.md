# Foundation repair — 2026-11-02

This is a bounded repair of the existing Runtime chain after public baseline [`34124cef`](https://github.com/hpoenixf/open-etf-agent/tree/34124cefc6df289e08518173789210b45a716451) (`v0.15.2`). It adds no new module, model route or evaluation platform. The tag, package version and historical qualification records are unchanged. **Provider-free regression evidence is not a new live qualification or a model-quality score.**

[Structured execution receipt](foundation-repair-20261102.safe.json) · [Executed source inputs](foundation-repair-20261102-inputs.sha256)

## What failed, and where the repair belongs

| Boundary | Reproduced failure | Minimal owner repair |
| --- | --- | --- |
| Working input → selected tools | Context can emit an exact original reference without selected `read_result`; compaction can emit a note without selected `read_note`. The actual next Host call was rejected. | Host validates selection before new/active Runtime execution, plugin activation, Run creation or model reservation. `contextBytes` requires `read_result`; compaction requires both reread tools. It never widens the grant. |
| Cancellation → durable facts | A pending tool returned as unknown locally, but cancellation persisted a terminal checkpoint with an empty unknown-effects list. | Runtime owns one phase-aware cancellation projection; Session invokes it in its original transaction. An uncommitted `tool-dispatched` identity is retained once. `result-committed` is not reclassified just because an old dispatch pointer remains. |
| Gateway failure → Child handoff | A completely received JSON `length` failure left one valid original source, but the presence of a working-input cache was mistaken for an unknown model outcome. | Runtime preserves original Gateway settlement evidence; Specialist consumes that fact, not the cache shape or an arbitrary error code. A failed Child stays failed while its independently validated source can be handed back to Main. |
| Compaction → root reservation | Even the shortest valid summary plus its provenance envelope could not reduce bytes, yet a summary model unit was reserved and its callback invoked. | Compaction constructs its exact candidate envelope with the one-byte lower bound before reservation. Only mathematically impossible net savings are skipped. Passing the bound still requires all original post-summary checks. |

These changes implement the existing [exact-reference reread contract](../../openspec/changes/v04-results-context/specs/research/spec.md), [compaction adoption constraint](../../openspec/changes/v05-notes-memory/specs/working-input/spec.md), [cancellation/unknown preservation](../../openspec/changes/v09-single-run-worker/design.md), and [known versus unknown Child failures](../../openspec/changes/serial-specialist-child/design.md). The summary precheck is an efficiency improvement; the former post-call fallback already rejected a non-saving summary correctly.

## Execution admission is not historical readback

A new or active profile missing a required consumer fails with `WORKING_INPUT_TOOL_UNAVAILABLE`; callers must explicitly choose a compatible grant/profile. The repair does not silently add permissions or invent a fallback consumer. Narrow profiles without context projection or compaction are unchanged.

An already terminal Run constructs no new model input. Its original config, bindings, checkpoint and stored result identities are still verified, but it is not subjected to a new execution requirement. An actual baseline Runtime produced a successful terminal with `allowedTools: ['read_page']` and `contextBytes: 4000`; after closing and reopening SQLite, the repaired Runtime returned the identical outcome with zero new Gateway calls and unchanged model/tool usage `1/0`. A different requested config remains rejected.

## Additive checkpoint contract and legacy behavior

`gatewayOutcome` is an optional persisted checkpoint/outcome fact, with closed values `settled` and `unknown`. This **is a data-contract change**, not a claim of zero schema impact. It needs no SQLite table/version migration. The shared codec rejects invalid values and completed-with-unknown, and the terminal outcome copy must match the checkpoint. It does not rewrite source identities or historical records.

New records distinguish settlement at the original Gateway boundary. Only the existing Gateway's branded diagnostic for a recognized non-success finish with `hashScope: complete-body`, and no winning cancellation, establishes the repaired known-failure path. An arbitrary Error with the same code is insufficient. The current SSE parser may throw before consuming the complete stream; that path remains unknown even if a supplied fixture contains a later `[DONE]`. No retry is added.

Legacy records lacking the field retain the exact prior Specialist predicate: historical accepted success/tool-failure handoffs remain readable; historical working-input uncertainty remains conservative. No round-count inference or backfilled settlement is introduced. Actual old producers were exercised for successful Child, committed-source tool rejection and unknown model failure; new readers preserved the original handoff/error and stored facts in all three cases. An old Runtime reader also read a new terminal outcome without replay. Portable repository tests clearly distinguish legacy-shaped fixtures from these actual old-code upgrade probes.

`settled` means neither successful answer, known billing nor permission to retry. Cancellation retains original debits and fences continuation. Unknown effects and costs are not changed to zero.

## Verification and retained failure history

- Working-input/compaction RED: two intended regressions failed against the old implementation; positive consumer and unchanged-profile controls passed. An earlier positive fixture that did not actually force projection was corrected before that comparison.
- Failure-boundary RED: three real cancellation/committed-result/JSON-handoff mismatches were observed. A fourth initial SSE expectation was incorrect: a non-success prefix was not complete-body settlement. That history is retained, and the final SSE test is a conservative negative control.
- Final focused suites: **17/17** working-input/compaction tests and **52/52** original Session/Runtime/Child/Gateway tests. These overlap the full suite and are not added to its count.
- Complete original command family: **514/514**, no failures, skips or cancellations; Node **26.11.1**, one test worker, approximately **60.33 seconds**. The existing native ESM build passed separately; it is syntax checking/copying, not a TypeScript typecheck.
- Independent two-axis review of frozen code/tests: no outstanding Standards or Spec findings. Review discovered and closed minimum-checkpoint cancellation, legacy failed-Child and terminal narrow-profile compatibility gaps before the full run.

All new reproductions use synthetic local content, injected Gateway/transport callbacks and original production owners. SQLite cancellation and upgrade tests close/reopen the real store. The full existing suite also exercises its own subprocesses and loopback HTTP. No real provider calls or fresh paid qualification were performed. New close/reopen probes are not evidence of a process-crash recovery run. Local execution summaries and hashes are engineering evidence, not a tamper-proof attestation; raw logs, databases and credentials are not published.

## Decision boundary

The reproduced four-item repair is ready for bounded evaluation preparation, not an assurance of zero wasted calls or general architectural perfection. A future real-model batch must freeze its own source, route, tasks, budget and ledger, inspect the actual delivered body and original readbacks, and stop on unexpected dispatch/accounting/recovery behavior. Existing failed/unknown history remains intact; no historical batch is reset or reclassified. This repair itself does not authorize dispatch.
