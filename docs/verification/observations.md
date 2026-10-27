# Sanitized execution observations

These are authored summaries of actual local runs, not raw process logs, not Evidence Kit authentication, not a generated verification view, and not a release certificate. All inputs are synthetic. The raw outputs remain local under ignored test-output/. No credential, private implementation or user data is included here.

Environment: existing Node v26.11.1, Linux, maximum Node heap 512 MB, timeout 60 seconds per command. No installed third-party dependency or real provider request. All commands below are run from the project root.

| Evidence | Actual command | Actual outcome | Input inventory SHA-256 |
| --- | --- | --- | --- |
| EV-01 | node --test test/tools.test.mjs test/runtime.test.mjs test/gateway.test.mjs | RED: exit 1, 14 discovered / 0 passed / 14 failed. 13 assertion failures; 1 absent pairing value TypeError. No discovery/import error. About 141 ms. | 1414aedf60b6eca3f7180c0c61e5b93bd234ea108000f9f6e7b3c776f28d363a |
| EV-02 | node --test test/tools.test.mjs test/runtime.test.mjs test/gateway.test.mjs | GREEN: exit 0, 14/14 passed, including tightened pairing assertion. About 197 ms. | 3c35639b1c949476d1e49c044ba11d0aca8a205ec13ea895cf0ea907e91c981a |
| EV-03 | node --test test/cli.test.mjs | RED: exit 1, 0/4 passed; all four assertion failures against deliberately non-implementing but executable CLI/build scaffolds. About 351 ms. | b55b10a528e576bfbab7448bc9080a85575de3fd7c306131220ce730927cbd76 |
| EV-04 | node --test test/cli.test.mjs | GREEN: exit 0, 4/4 passed. Built copy ran; four report files reopened after process exit; blocked live and argument rejection checked. About 923 ms. | fc0e0c5715ab8bc6e9b743df55fcfebbfd057b64f7496cda9a41fd54d17709bf |
| EV-05 | node --test test/review.test.mjs | RED: exit 1, 0/3 passed. Known partial effects lost, unsafe ancestor creates child before refusal, and final round count zero all reproduced. About 105 ms. | 7bd1292fe885e2a03249326c8e527618fa4f66bedb6d783fc3f9e34c4f4e55f0 |

## Final offline candidate

Input inventory SHA-256: 9e04696c9b6c3a3096f888017025fc4265bceeba850caea37fc48081f290ce14. It covers package/lock, source, tests, build script and fixtures; documentation edits after execution do not change these code inputs.

- EV-06: `node --test test/review.test.mjs`, exit 0, 3/3 passed, about 103 ms. All three EV-05 defects corrected.
- EV-07: `node --test test/*.test.mjs`, exit 0, 23/23 passed, about 1009 ms. Includes supplemental synthetic report/page/condition/numeric and injected offline transport assertions.
- EV-08: `npm ci --offline --ignore-scripts --no-audit --no-fund`, exit 0; no external dependencies, unchanged lockfile.
- EV-09: `npm run build`, exit 0; native ESM syntax-check and staging only.
- EV-10: `npm test`, exit 0, 23/23 passed, about 1060 ms.
- EV-11: `npm run demo -- --case document-compare --output test-output/independent-demo`, exit 0; T1/T2/T3/T4 each completed, denominator 4, real files and receipts. All remain semanticStatus unreviewed; HTTP not-applicable.

These commands used the existing official Node/npm distribution with project-local npm cache, offline mode, 512 MB heap and 60-second per-command limits. An existing unknown http-proxy npm environment warning occurred; settings were not changed. package-lock hash remained 02185ea8572c9a596ec34a003a8c12788791ac8eaa1e0f8ea682a72021c39ead.

The initial offline candidate below predated actual Kit integration. The later [Kit integration record](kit-integration.md) records real structural CLI checks; real live round trip, semantic assessment, license approval and public release still remain unverified or blocked. No completion.json or generated verify.md is claimed. All ledger artifact cells now refer to this portable engineering summary. [Original-artifact provenance hashes](evidence-provenance.json), [actual synthetic demo receipts](demo-receipts.json), and [final candidate input inventory](candidate-inputs.sha256) accompany it. Original full logs remain unchanged and ignored locally; no raw logs or absolute run paths are included in these portable artifacts. This packaging is not a new product test run or Kit validation.
