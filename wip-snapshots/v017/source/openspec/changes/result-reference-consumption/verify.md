# Verification

<!-- spec-evidence:generated@1 -->
Input digest: sha256:f43a1e20c3bf4ca256bf00dddc230918546399799cf6627431f0952ade7f2896

Generated view for result-reference-consumption. No tests were executed by this command.
Semantic quality: unverified. Release: not-claimed. Observation labels are authored records, not execution authentication.

## Tasks

- [x] RC.1 Confirm scope/original-owner mapping; write synthetic selection/binding counterexamples and observe focused RED.
- [x] RC.2 Extend the existing Result/Host calculation/reference projections and one existing CLI demo; keep zero new packages and no second store/executor.
- [x] RC.3 Qualify actual next-Gateway encoding, original report/CSV readback and local failure boundaries; freeze regression/install/build evidence.
- [x] RC.4 [check-only] Publish only audited qualified leaves through the sole publisher; then bind README/coverage and minimally update the existing paired article if warranted.

## Observations

| Task | Evidence | Date / phase | Command | Result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC.1 | EV-RC-001 | 2026-10-27 RED | node --test --test-concurrency=1 test/result-consumption.test.mjs | failed: 7/8 before selection/binding implementation; unbound legacy arithmetic passed | docs/verification/result-consumption-observations.safe.json | source-red recorded test SHA | observed-run |
| RC.1 | EV-RC-002 | 2026-10-27 GREEN | node --test --test-concurrency=1 test/result-consumption.test.mjs | passed: 8/8 original source/window/binding cases | docs/verification/result-consumption-observations.safe.json | source-green recorded source/test SHA | observed-run |
| RC.2 | EV-RC-003 | 2026-10-27 RED | node --test --test-concurrency=1 test/result-consumption-delivery.test.mjs | failed: 4/4 before same-ref CSV/report and unavailable recovery adaptation | docs/verification/result-consumption-observations.safe.json | delivery-red recorded test SHA | observed-run |
| RC.2 | EV-RC-004 | 2026-10-27 GREEN | node --test --test-concurrency=1 test/result-consumption.test.mjs test/result-consumption-delivery.test.mjs test/result-consumption-cli.test.mjs | passed: first 18/18; not acceptance for subsequently found review counterexamples | docs/verification/result-consumption-observations.safe.json | source manifest 2de065f7 | observed-run |
| RC.2 | EV-RC-005 | 2026-10-27 RED | selected malformed-reference and recovered-call tests | failed: 3/3 actual counterexamples from independent review | docs/verification/result-consumption-observations.safe.json | review-red recorded source/test SHA | observed-run |
| RC.2 | EV-RC-006 | 2026-10-27 GREEN | original three-file related regression | passed: 21/21; later effective-name gate finding remained to fix | docs/verification/result-consumption-observations.safe.json | source manifest c72d3bab | observed-run |
| RC.2 | EV-RC-007 | 2026-10-27 RED | selected Hook alias-mode test | failed: effective binding name bypassed request digest validation | docs/verification/result-consumption-observations.safe.json | alias-red recorded source/test SHA | observed-run |
| RC.2 | EV-RC-008 | 2026-10-27 RED | selected Host protocol-boundary test | failed: v1 was not explicitly refused before implementing the reviewed v2 boundary | docs/verification/result-consumption-observations.safe.json | protocol-red recorded source/test SHA | observed-run |
| RC.2 | EV-RC-009 | 2026-10-27 RED | selected v2 Hook reconciliation test | failed: existing reconciliation success lacked the new request binding | docs/verification/result-consumption-observations.safe.json | reconcile-red recorded source/test SHA | observed-run |
| RC.2 | EV-RC-010 | 2026-10-27 GREEN | original three-file related regression | passed: 24/24, zero input drift; malformed refs, alias/strip, v1 refusal, v2 resume/reconcile and original bytes | docs/verification/result-consumption-observations.safe.json | final source manifest f03e1ead | observed-run |
| RC.3 | EV-RC-011 | 2026-10-27 RED | node --test --test-concurrency=1 test/result-consumption-delivery.test.mjs | failed: same actual 4-case delivery RED as EV-RC-003, not another execution | docs/verification/result-consumption-observations.safe.json | delivery-red recorded test SHA | observed-run |
| RC.3 | EV-RC-012 | 2026-10-27 GREEN | original three-file related regression | passed: same final 24-case run as EV-RC-010, not another execution | docs/verification/result-consumption-observations.safe.json | final source manifest f03e1ead | observed-run |
| RC.3 | EV-RC-013 | 2026-10-27 CHECK | node --test --test-concurrency=1 --test-reporter=tap test/*.test.mjs | passed: actual 333/333 in 40.932s, no skips/failures/cancellations, all frozen inputs unchanged | docs/verification/result-consumption-observations.safe.json | execution digest 4704f6d9 | observed-run |
| RC.3 | EV-RC-014 | 2026-10-27 CHECK | offline locked npm ci; build; built result-consumption CLI; separate readback process | passed: 95 original packages, 57 built files match, 1366-byte report and 743-byte CSV retain one original calculation/source identity | docs/verification/result-consumption-independent.safe.json | execution digest 4704f6d9 | observed-run |
| RC.4 | EV-RC-015 | 2026-10-27 CHECK | fixed-source smoke; actual GitHub ref/tree/body readback; exact-commit code/article/blog CI and canonical verifier | passed: 15 original targets executed once; source/main/README and 34 article leaves match; canonical CI verifies 85 edition bodies and two homepages | docs/verification/result-consumption-publication.safe.json | code ade806a18e0b89c07b929111ea30afbebad93279; article bbbbe900ee5dacbf4dfc4c95529a4f2d1cb23cde; blog a86f36d705d93b57617756e2791ab7af7fd72e5f | observed-run |

## Remaining Gates

Completion assessment and any live/release acceptance remain with the project owner.
