# Evidence
The test/requirement change precedes execution. Install only the existing exact official dependency closure from the project-local cache, offline with scripts disabled. Run the strengthened actual skill-mcp CLI assertion RED before deleting the unsupported phrase. Then run full v0.2 regression/build/demo and public Kit checks; record actual results. The old 49/49 observation applies only to the frozen earlier source and does not validate this patch.

## Observation Log
| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-26 RED | EV-M01 | 2.8 | node --test --test-concurrency=1 --test-name-pattern="skill-mcp uses ordinary" test/v02-cli.test.mjs | failed: actual report asserts an unacquired page-2 fact; 1/1 failed | docs/verification/v02-maintenance-observations.md | baseline 2e5c211 plus strengthened assertion | observed-run |
| 2026-10-26 GREEN | EV-M02 | 2.8 | npm test | passed: 49/49 after deleting only unsupported phrase; independent build and both demos also exit 0 | docs/verification/v02-maintenance-observations.md | inputs-sha256:c37be717033a00e5a5e477ba57e6a62fdef8fc0e1209d40fd44b7f8c40b1b7f1 | observed-run |
| 2026-10-26 CHECK | EV-M03 | 2.9 | node tooling/openspec-evidence-kit-db6ac2f/bin/spec-evidence.mjs lint --change v02-fixture-source-boundary --stage apply | passed: actual plan/apply after 49 tests and independent build/demos | docs/verification/v02-maintenance-observations.md | inputs-sha256:c37be717033a00e5a5e477ba57e6a62fdef8fc0e1209d40fd44b7f8c40b1b7f1 | observed-run |
