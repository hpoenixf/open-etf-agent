# Proposed next live cases: Runtime gaps, not answer scoring

This is a plan, not an execution record. No additional model request was made for these cases. The first five-version batch remains unchanged.

**2026-10-29 qualification amendment:** The Runtime-only paragraph and case table below retain the original 2026-10-27 plan; they are not sufficient release qualification under the [current live-task release gate](../live-validation.md#release-qualification). Rechecking earlier versions must pre-register representative normal cases, fixed inputs and repetitions, preserve every attempt/cost, and assess the normal end-to-end floor separately from abnormal Runtime handling. If a selected case requires the listed mechanism but it is not exercised, keep that coverage status and do not qualify the case as successful; tasks that do not require the mechanism need not invoke it. This dated clarification records no new execution and changes no historical receipt.

The project acceptance policy updated on 2026-10-27 selects Runtime correctness, not model prose quality. Do not tune the prompt, relax validation or repeat a response to obtain a preferred answer. Check actual dispatches, identities, budgets, effects and stored bytes; retain lawful refusal as such. If a model does not select a mechanism, mark it **not exercised**, not failed or passed.

| Stage | Small additional case | Observable Runtime assertions | Not claimed |
| --- | --- | --- | --- |
| v0.2 | One selected original Skill with the owned synthetic MCP document source | Actual Skill expansion; MCP initialize/discover/call; call-ID matching; source bytes/hash; finally-close and owned child exit | Model understanding of the Skill; arbitrary MCP servers |
| v0.3 | One bounded Child request with a deliberately narrower document scope | Shared root model/tool counters; child scope cannot grow; original/effective tool identity; finalization outcome; child process/resource cleanup | Broad planning quality or concurrency performance |
| v0.4 | One query selecting a specific allowed page, followed by explicit `read_result` | Candidates actually determine dispatch; no zero-hit invented source; immutable same-document version identity; post-exit indexed original bytes | Search relevance quality, execution recovery |
| v0.5 Memory | Exact trusted synthetic save/revise/forget grants, followed by next Gateway input | One-use intent receipt; revision/CAS and consumed/partial evidence; future input excludes forgotten typed content including hook copies; raw history preserved | A model deciding what deserves memory |
| v0.5 compaction | Deliberately small working-input budget with original reread | Actual summary model call charged to shared budget; byte savings against reference-only baseline; host-owned refs; note persistence/readback; timeout/stale fallback | Summary factual quality or long-term memory recovery |

Before execution, freeze each case's exact original version and adapter, establish a shared bounded ledger and explicit request allowance, and add fake-provider/owned-fixture assertions for its expected Runtime facts. Do not treat the remaining historical per-version T1 allowance as an instruction to spend it. Any new live batch should have an explicit selected scope and resource window; no automatic retries or endpoint/account changes.

The first v0.1 rejected calculation cannot be retrospectively diagnosed from missing arguments. A new fixture can check general rejection/dispatch invariants, but it cannot reconstruct or retroactively certify that original input. No rerun is proposed merely to make that first result green.
