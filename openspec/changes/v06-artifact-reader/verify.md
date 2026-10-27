# Verification

<!-- spec-evidence:generated@1 -->
Input digest: sha256:0eaca05f8a7a2dfbd2ef5e8db8f99135e344d519b2d19638c48e2cdf75e1728f

Generated view for v06-artifact-reader. No tests were executed by this command.
Semantic quality: unverified. Release: not-claimed. Observation labels are authored records, not execution authentication.

## Tasks

- [x] 6.1 Implement immutable artifact records and report revisions with bounded safe readback
- [x] 6.2 Implement a loopback-only ID-addressed reader with download-only active formats
- [x] 6.3 Integrate one Report/Artifact owner and deterministic CSV attachment delivery
- [x] 6.4 Verify all four original cases through actual HTTP with a fixed denominator
- [x] 6.5 [check-only] Regress independent installation and demos, execute original Kit workflow and freeze evidence

## Observations

| Task | Evidence | Date / phase | Command | Result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6.1 | EV-601 | 2026-10-27 RED | six Artifact pretests | failed: 0/6 behavior contracts, loadable scaffold | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.2 | EV-601 | 2026-10-27 RED | four actual-reader pretests | failed: 0/4 behavior contracts, no import failure | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.1 | EV-602 | 2026-10-27 GREEN | same ten Artifact and reader cases | passed: 10/10 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.2 | EV-602 | 2026-10-27 GREEN | same ten Artifact and reader cases | passed: 10/10 including real loopback traffic and close | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.3 | EV-603 | 2026-10-27 RED | four Host integration pretests | failed: 3 new assertions; 1 existing rejection passed | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.3 | EV-604 | 2026-10-27 GREEN | Artifact reader and Host integration suite | passed: 14/14; one Report owner and typed partial effects | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.5 | EV-605 | 2026-10-27 CHECK | eight inherited related tests before fixture and effects adaptation | failed: 3/8; pinned old-version bytes correctly rejected and additional partial facts changed assertion shape | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.5 | EV-606 | 2026-10-27 CHECK | same eight inherited related tests | passed: 8/8 with exact original fixture and stronger partial-effect assertions | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.4 | EV-607 | 2026-10-27 RED | three HTTP evaluate pretests | failed: 0/3 before evaluator implementation | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.4 | EV-608 | 2026-10-27 GREEN | HTTP evaluate plus Artifact and Host cases | passed: 17/17 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.2 | EV-609 | 2026-10-27 RED | three independent CLI pretests | failed: reader entry absent behavior, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.3 | EV-609 | 2026-10-27 RED | three independent CLI pretests | failed: CSV demo entry absent behavior, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.4 | EV-609 | 2026-10-27 RED | three independent CLI pretests | failed: evaluator entry absent behavior, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.2 | EV-610 | 2026-10-27 GREEN | same three CLI cases | passed: 3/3; actual child reader terminated normally | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.3 | EV-610 | 2026-10-27 GREEN | same three CLI cases | passed: 3/3; actual CSV tool and attachment receipt | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.4 | EV-610 | 2026-10-27 GREEN | same three CLI cases | passed: 3/3; independent evaluator kept four-case denominator | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.5 | EV-611 | 2026-10-27 CHECK | full serial suite before aggregate bound fix | passed: 167/167 historical input | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.1 | EV-612 | 2026-10-27 RED | CSV aggregate bound sentinel assertion | failed: late cell visited after budget | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.1 | EV-613 | 2026-10-27 GREEN | Artifact and Host cases with incremental CSV bounds | passed: 11/11 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.5 | EV-614 | 2026-10-27 CHECK | independent cached ci build and tests before review fixes | passed: 168/168 at preserved historical input | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.1 | EV-615 | 2026-10-27 RED | reviewed derived-source negative | failed: derived marker stripped, total reviewer suite 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.4 | EV-615 | 2026-10-27 RED | reviewed source identity and duplicate attachment negatives | failed: both corrupt evidence cases accepted, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.1 | EV-616 | 2026-10-27 GREEN | all new Artifact reader evaluate CLI cases | passed: 24/24 including derived rejection | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.4 | EV-616 | 2026-10-27 GREEN | all new Artifact reader evaluate CLI cases | passed: 24/24 including full source identity and unique attachment metadata | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.5 | EV-617 | 2026-10-27 CHECK | independent final build and npm test; eight demos; HTTP evaluate | passed: 171/171; 8 demos; 11 report readbacks; T1-T4 all HTTP passed, zero provider calls | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 6.5 | EV-618 | 2026-10-27 CHECK | original Kit lint plan/apply, status, verify, verify --check | passed: all five commands exit0; 5/5 tasks; generated current view; no completion record or release claim | docs/verification/v06-observations.safe.json | v06-candidate-inputs | observed-run |

## Remaining Gates

Completion assessment and any live/release acceptance remain with the project owner.
