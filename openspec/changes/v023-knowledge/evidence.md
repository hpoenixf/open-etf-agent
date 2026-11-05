# v0.23 Knowledge candidate evidence

Date: 2026-11-05. **Provider-free candidate only; not released or real-model qualified.** Published main and tag remain v0.22.0. No new model request was made while producing this evidence.

## Fixed source and actual checks

- Candidate commit: `c6973b1c73cbda83db7514f6b7afd1e8ecf78910`.
- Execution identity: `939a0cab717f5fbc2e600534b880f67a8dc3a2f6814c982867a0e3bc3ed76f61`, a SHA256 over the canonical path/byte-count/SHA256 inventory of 288 source, fixture, test, script and package-input files. Verified unchanged after execution.
- Actual Node.js: 26.11.1. Full single-worker Runtime suite: **956/956 passed**, zero skipped, approximately 165.2 seconds. Native ESM build passed.
- Independent source checkout, separate ordinary `node_modules`, exact locked dependency installation with lifecycle scripts disabled: **96 packages installed from the official npm registry**. Build, CLI help and the three new test files passed: **29/29**, approximately 18.3 seconds. An earlier offline-only cache attempt failed with `ENOTCACHED`; it was not counted as an installation pass. No dependency versions or lockfile content changed.
- Existing article/navigation checks: **75/75 passed**. This is compatibility of existing checks, not a new article mapping, article publication or live qualification.
- Independent contract review reran the three new test files, **29/29 passed**, with no remaining blocking finding in the reviewed scope.

The full-suite and independent-install checks are separate executions. The earlier exploratory 940-test run was not the final frozen verification and is not combined with it.

## Covered production seams

`test/knowledge.test.mjs`, `test/knowledge-project.test.mjs` and `test/encoded-context-budget.test.mjs` cover bounded retrieval, original Source/ResultRef registration, query metadata recovery, admitted document scope, both lexical languages, no evidence, count/body/encoding limits, cancellation and malformed inputs. The public application tests read actual saved reports and loopback Reader bytes, delete original input files after import, preserve older task manifests after same-name replacement/configuration update, and fail corrupt stored sources before dispatch.

Recovery tests actually exit a worker process after a cooperative checkpoint stop and continue in another process. They do not claim a new SIGKILL window. Terminal replay dispatches no model call. Composition checks exercise explicit Memory, CSV, Main-side Knowledge plus actual Child execution, and managed compaction.

The production Chat encoder/parser runs against an injected local transport, without network or real models. Its capacity regressions include 64000-byte pages, eight-page input, dense control characters, dense quotes/backslashes, repeated queries, cold continuation and exact final source readback. Oversized latest groups fail before another dispatch; oversized summary inputs use the observable `summary-input-capacity` fallback with zero summary reservation or dispatch. Provider token-window or semantic-quality equivalence is not inferred from byte checks.

## Findings retained and repaired

1. A valid 64000-byte page exceeded the original 32000-byte research context. The candidate now admits an explicit 1 MiB Knowledge context and bounds complete-page responses.
2. JSON escaping inside Chat tool content could exceed the transport limit even when the ordinary result and Context serialization fit. Query bounds now include the second escaping; Gateway supplies its original encoder's pure byte measurement, and Context uses it to project only older verified sources.
3. A first summary-capacity test never reached the summary path because earlier projection kept it below its trigger. That attempt was not accepted as fallback evidence. The corrected test actually exceeds the summary wire capacity while Main can continue, and the existing timeline reader now retains the new fallback status.

These findings were repaired before the fixed full-suite run. No live qualification outcomes were produced, replaced or relabeled.

## Remaining gates

A non-executable ten-task plan is prepared, but a valid shared-call budget must first be established. Historical reservations and unknown outcomes remain held; a new version cannot reset them. Then freeze the exact tasks, data, provider configuration, request/case deadlines and accounting, complete ten real tasks with at least nine successes and no known unresolved applicable Runtime defect, and independently review original outputs and safety evidence.

Only after those gates may version metadata, required lockfile-push confirmation, audited non-force publication, exact remote readback, CI, Release, bilingual README and article/site maintenance be completed. No public Release, new main commit, tag or site update is claimed here.
