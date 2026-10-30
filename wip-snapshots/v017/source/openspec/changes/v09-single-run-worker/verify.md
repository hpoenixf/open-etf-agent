# Verification

<!-- spec-evidence:generated@1 -->
Input digest: sha256:268ed6d9725e657a72b63597e9fd0e6e28f647edaa86f38495120621be9c7b0e

Generated view for v09-single-run-worker. No tests were executed by this command.
Semantic quality: unverified. Release: not-claimed. Observation labels are authored records, not execution authentication.

## Tasks

- [x] 9.1 Add original-contract-derived synthetic RED cases and shared Runtime admission without dispatch
- [x] 9.2 Adapt the same Runtime/Session to bounded independent Worker execution, non-user host stop and durable readback
- [x] 9.3 [check-only] Qualify actual separate processes, identity/fence/cancel/unknown boundaries, independent install/build and preserved regressions; freeze safe evidence

## Observations

| Task | Evidence | Date / phase | Command | Result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 9.1 | EV-901 | 2026-10-27 RED | node --test --test-concurrency=1 test/worker.test.mjs test/worker-cli.test.mjs | failed: 10/11 expected seam/behavior failures; one pre-existing cancel-after-commit invariant passed | docs/verification/v09-worker-red.safe.json | pre-implementation v08 with new tests | observed-run |
| 9.2 | EV-902 | 2026-10-27 RED | same exact serial 11-case command | failed: host-stop was treated as completion or fallback user cancellation; absent submit/work seams are recorded separately | docs/verification/v09-worker-red.safe.json | pre-implementation v08 with new tests | observed-run |
| 9.1 | EV-903 | 2026-10-27 GREEN | node --test --test-concurrency=1 test/worker.test.mjs test/worker-cli.test.mjs test/worker-process.test.mjs | passed: 16/16 including explicit admission, no-dispatch submit and independent CLI execution | docs/verification/v09-worker-green.safe.json | first focused source/test hashes | observed-run |
| 9.2 | EV-904 | 2026-10-27 GREEN | same exact serial 16-case command | passed: actual SIGTERM, two SIGKILL boundaries, competing processes/cancel and original absolute deadline; no live model | docs/verification/v09-worker-green.safe.json | first focused source/test hashes | observed-run |
| 9.3 | EV-905 | 2026-10-27 CHECK | node --test --test-concurrency=1 test/*.test.mjs | passed: 305/305, no skips/cancellations; all 19 Worker cases and existing regressions; frozen 124 inputs unchanged | docs/verification/v09-observations.safe.json | v09-candidate-inputs | observed-run |
| 9.3 | EV-906 | 2026-10-27 CHECK | offline locked npm ci then node scripts/build.mjs | passed: 95 unchanged dependencies, 61 independent non-test inputs and 55 exact built files; private and original MIT bytes retained | docs/verification/v09-independent-install.safe.json | v09-candidate-inputs | observed-run |
| 9.3 | EV-907 | 2026-10-27 CHECK | eight independent built session CLI commands plus actual read-only Artifact owner | passed: zero-dispatch submit, separate work, original definition/deadline, terminal no-op, one receipt; retained v0.6 933 bytes unchanged | docs/verification/v09-independent-delivery.safe.json | v09-candidate-inputs | observed-run |
| 9.3 | EV-908 | 2026-10-27 CHECK | original Kit lint plan/apply, frozen-input and public-only scan | passed: structural issues empty; 124 input hashes stable; package delta exactly three version fields; no selected sensitive-pattern hits | docs/verification/v09-scan.safe.json | v09-candidate-inputs | observed-run |
| 9.3 | EV-909 | 2026-10-27 CHECK | node --test --test-concurrency=1 test/*.test.mjs | passed: actual combined 309/309, zero failures/skips/cancellations; 124 frozen inputs and all 10 preserved maintenance paths unchanged | docs/verification/v09-combined-observations.safe.json | v09-combined-inputs | observed-run |
| 9.3 | EV-910 | 2026-10-27 CHECK | offline SHA-256 comparison of original and combined delivery inputs plus retained independent dist | passed: all 58 delivery inputs and 55 built src/fixture files identical; original install/eight CLI observations remain historical, not re-executed | docs/verification/v09-delivery-equivalence.safe.json | v09-combined-inputs | observed-run |

## Remaining Gates

Completion assessment and any live/release acceptance remain with the project owner.
