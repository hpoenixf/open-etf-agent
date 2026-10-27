# ADDED Requirements

## Requirement: Exact inputs and paired tools
Runtime MUST preserve user question verbatim. Only complete validated model proposals may dispatch. Call IDs MUST be unique per run and each result paired. Unknown tool, additional argument, invalid physical page, traversal material ID and model-specified output path MUST be rejected before protected effects.

### Scenario: Partial completion
Given a missing/length/unsupported finish reason, when normalized, then reject all proposed tools, even if their argument JSON parses.

## Requirement: Bounded execution
Runtime MUST validate positive finite round/tool/deadline limits, stop new dispatch after cancellation or timeout, and never automatically retry unknown writes. Rejection, failure, unknown effects, and logging failures MUST remain distinguishable.

### Scenario: Cancel during model call
When cancellation occurs before a late response arrives, then no late tool dispatch occurs and run terminates cancelled.

## Requirement: Source and deterministic calculation
read_page MUST resolve only fixed material IDs and 1-based pages; return name/version/page/exact text/SHA-256. calculate_change MUST accept finite numeric operands with matching explicit units, reject zero baseline, retain operands, and calculate current-minus-baseline, current/baseline and increase/baseline separately.

## Requirement: Actual immutable save
save_report MUST accept body and actually read source IDs, never host paths. Host adds source identities to Markdown and exact snapshots to manifest. Receipt MUST follow actual publication and identify hash/media type/file. Temporary/exclusive writes MUST not overwrite different existing content or follow symlinks. Partial failure MUST not claim file-set success. Existing body/receipt MUST survive independent log failure. Reopening a file is not recovering a run.

### Scenario: Reopen
After process exit, independent reading MUST reproduce report bytes/hash and source snapshots without another model call.

## Requirement: Shared loop, narrow protocol
Fixture and non-streaming Chat Completions adapters MUST feed the same Runtime contract. Text/function tools only. Explicit trusted endpoint/model/credentials/data/cost configuration is required for live; no credentials or network activity when blocked. No fixture result proves live or semantic quality.

## Requirement: Honest evaluation
All four fixed questions MUST remain in the denominator, including failures/not-run. Semantic status stays unreviewed; HTTP is not-applicable. Observation rows MUST describe actual executions with original date/revision/artifact, not planned outputs.
