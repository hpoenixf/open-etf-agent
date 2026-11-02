# Teaching defaults — small increment after long-content P0

The user explicitly asked for fewer unnecessary interruptions in teaching tasks. Change only defaults owned by the original Runtime/Gateway; no new configuration or admission layer.

| New-Run default | Before | After | Teaching purpose |
| --- | --- | --- | --- |
| Model rounds | 12 | 24 | Allow a moderate multi-step lesson/research sequence. |
| Tool dispatches | 12 | 64 | A valid 16-call batch should not exceed the default whole-Run allowance. |
| Runtime timeout | 30 seconds | 120 seconds | Several normal model/tool turns should not hit an unexpectedly short demonstration timeout. |
| `requireReport` | true | false | An ordinary complete answer does not require an unrelated saved file. Report tasks explicitly pass true. |
| Gateway application input bytes | 256 KiB | 1 MiB | Use the already-supported finite allowance so a bounded long report echo plus tool schemas can fit. |

The Gateway byte guard is not a model's token/context limit. No provider token capability is inferred or raised. Explicit `limits`, `maxInputBytes`, report requirement, parent root budget, deadline, cancellation and tool/source scope retain precedence. Existing report CLI entries still pass `requireReport: true`; specialized Child limits are unchanged. No incomplete stream, identity conflict, permission error or unknown side effect is converted into success.

Larger defaults permit more work and potentially greater resource usage if a user later enables a real provider. They do not call a provider, authorize extra spend, reset a ledger, resume stopped paid queues or enlarge any user's explicit total fee/request cap. This increment's tests are injected/provider-free.

Existing active durable Runs must finish with their creating/pinned executable or explicitly retain the original limits/configuration. New defaults cannot refresh a saved definition, grant, deadline or remaining root budget. Existing binding checks remain unchanged; no migration or transparent old-active compatibility is claimed. P0's changed report schema also retains its original Host catalog mismatch boundary.

Acceptance is four focused offline cases: a 13-turn/26-tool ordinary lesson and recorded defaults; a maximum bounded report through the new Gateway default; explicit report/small round/tool/root budgets still enforced; and an explicitly selected 256 KiB input guard rejecting the next dispatch while preserving a complete already saved report. No new RED or full-suite rerun is claimed for this small default-only increment.
