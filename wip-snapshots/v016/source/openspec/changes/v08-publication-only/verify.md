# Verification

<!-- spec-evidence:generated@1 -->
Input digest: sha256:d0a3500d73443188bad692b71b9e95235e0cfa560a71a1e96384537927bdfc9b

Generated view for v08-publication-only. No tests were executed by this command.
Semantic quality: unverified. Release: not-claimed. Observation labels are authored records, not execution authentication.

## Tasks

- [x] 8.1 Adapt original Publication identity, revision/CAS, receipt and delivery-slot contracts to the existing public Session
- [x] 8.2 Integrate independent version-bound Publication commit/readback with the same Runtime and local CLI
- [x] 8.3 [check-only] Qualify the extracted module, independent process/install delivery, existing Artifact reads and structural evidence

## Observations

| Task | Evidence | Date / phase | Command | Result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 8.1 | EV-801 | 2026-10-27 RED | node --test --test-concurrency=1 test/publication.test.mjs test/publication-runtime.test.mjs | failed: 12 Publication assertions among 19 failures; loadable absent/mismatched original-owner seams | docs/verification/v08-publication-red.safe.json | pre-implementation-source-and-test-hashes | observed-run |
| 8.2 | EV-802 | 2026-10-27 RED | same exact serial 19-case command | failed: 7 Runtime assertions among 19 failures; no committed receipt/binding/postcommit seam | docs/verification/v08-publication-red.safe.json | pre-implementation-source-and-test-hashes | observed-run |
| 8.1 | EV-803 | 2026-10-27 GREEN | node --test --test-concurrency=1 test/publication.test.mjs test/publication-runtime.test.mjs test/publication-cli.test.mjs | passed: 23/23; 13 owner cases include true SQLite rollback and original receipt/CAS/binding boundaries | docs/verification/v08-publication-green.safe.json | focused-source-and-test-hashes | observed-run |
| 8.2 | EV-804 | 2026-10-27 GREEN | same exact serial 23-case command | passed: 7 Runtime and 3 CLI cases; actual process kill after commit before checkpoint resumes one original revision with no new model invocation | docs/verification/v08-publication-green.safe.json | focused-source-and-test-hashes | observed-run |
| 8.3 | EV-805 | 2026-10-27 CHECK | node --test --test-concurrency=1 test/*.test.mjs | passed: 286/286 no skips/cancellations, including existing Runtime/Session/Artifact and coverage-checker regressions; 119 frozen input hashes unchanged | docs/verification/v08-observations.safe.json | v08-candidate-inputs | observed-run |
| 8.3 | EV-806 | 2026-10-27 CHECK | offline locked npm ci then native build and five built CLI commands | passed: 95 unchanged dependency entries, five different process IDs, original receipt retained, current 764-byte and retained v0.6 933-byte Artifact readback | docs/verification/v08-independent-delivery.safe.json | v08-candidate-inputs | observed-run |
| 8.3 | EV-807 | 2026-10-27 CHECK | original Kit lint plan/apply and public-only scan plus built/source hash check | passed: Kit issues empty; no selected sensitive patterns; original MIT bytes preserved; 119 qualified inputs unchanged | docs/verification/v08-publication-scan.safe.json | v08-candidate-inputs | observed-run |
| 8.3 | EV-808 | 2026-10-27 CHECK | version-only JSON comparison, independent offline npm ci and native build, built-file hash check | passed: 2 metadata leaves only; 117 other inputs and 95 dependency entries identical; 54 built hashes match; original 286 and five-process delivery were not rerun | docs/verification/v08-metadata-promotion.safe.json | v08-publication-inputs | observed-run |

## Remaining Gates

Completion assessment and any live/release acceptance remain with the project owner.
