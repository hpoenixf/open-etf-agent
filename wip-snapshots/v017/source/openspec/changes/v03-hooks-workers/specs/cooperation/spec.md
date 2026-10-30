# Observable contracts

## Hooks
- Explicit ordered arrays: before dispatch, after result returned, failure observed, Runtime finalization observation. Inputs are copied and deeply frozen. Callbacks receive narrow records, never Host/Runtime capability objects.
- Before hooks can return only declared argument-field patches or an exact trusted alias; preserve original/effective call in result/log and rerun ordinary binding validation and allowlist checks before dispatch. ID cannot change. Undeclared keys and arbitrary renamed tools reject without dispatch.
- Hook timeout is bounded. Before error rejects; after/failure/release observation errors are recorded and cannot rewrite a successful tool receipt or run result. Callback cancellation is cooperative, not an OS sandbox; no automatic callback retry.
- after means handler result returned, not generally durable. Only a successful save receipt establishes actual saved files. Timeline metadata must not make stronger persistence claims.

## Shared root budget and batch workers
- Model requests and tool dispatches consume separately bounded root counters. Claim happens synchronously before dispatch; refusal does not consume or execute. No per-child counter can multiply the root allowance.
- Batch accepts unique bounded taskIds, explicit allowed document/page tasks and concurrency 1–2. Results remain paired by taskId/input order despite reverse completion. Return successes and explicit failures/missing results; no fabricated source for failed tasks.
- Root cancellation prevents new dispatch and reaches ongoing cooperative work. Main imports only validated original sources through the ordinary Host, then performs the report effect.
- Metadata timeline relates root/run/task/call identities, duration and returned usage; unknown cost/usage remain null. Observation does not mutate original facts.

## One-level model child candidate
- Reuse run(), independent local message list and handoff with original question/common dimensions. Narrow explicit material/tool subset; no save_report, child recursion or arbitrary extensions.
- The same root budget and cancellation signal cover child requests/dispatches. Main synthesizes final report; child summaries are derived observations, not original sources or semantic proof.
- Offline fixture-child is clearly named as such. --live remains blocked; no independent-model success claim until authorized actual Gateway traces and semantic review exist.

## Compatibility and exit
Default four-case and skill-mcp examples remain executable with hooks/cooperation absent. Independent npm install/build/test/demo from this branch is required. Hook/batch/child checks are distinct. Current live, semantic, license and publication gates remain incomplete; no formal release or completion.json.

## Read-only metadata view
--observe accepts an explicitly selected safe local run directory and reads only its bounded run.jsonl file. It returns allowed metadata fields, never prompt text/tool arguments/source text, and never invokes a model or reruns tools. Missing usage/cost remain null. It is not a replay, checkpoint or publication UI.

Release callbacks run after the Runtime has attempted its final log record and log close, and see final status/code/logErrors. This does not assert all external resources are released: CLI-owned MCP closes later, and log close may fail. Release observation errors are returned as hookErrors, not retrospectively claimed durable in the already finalized log.

The metadata view projects types as well as top-level names: known identity/event fields only; usage exposes only prompt_tokens, completion_tokens and total_tokens when nonnegative safe integers; invalid or missing cost is null. Nested provider payloads and invalid typed metadata are omitted. It does not rewrite original logs or promise semantic anonymization of valid metadata.
