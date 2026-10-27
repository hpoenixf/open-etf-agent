# Evidence

## Pre-implementation plan — 2026-10-27
First use loadable interfaces for six Artifact assertions and four actual loopback Reader assertions. Observe behavior RED, not missing imports. Store cases: immutable reopen/revision, format validation, CSV escaping/formula handling, ID/path refusal, symlink/corrupt bytes, source/ref rejection. Reader cases: real GET/HEAD byte parity and close, hostile routes/Host/method, active-content download headers, revision-bound original source bytes. Fixtures are entirely synthetic, every service closes in finally, one serial worker, Node 512 MB and each command at most 120 seconds.

Then add Host migration/partial-effects and CSV attachment integration assertions before implementation, followed by four-case HTTP evaluate and independent install/build/test/demo. Preserve source and report truth; no provider calls, PG or external service. Actual observations are added only after terminal commands. v0.5's 147 tests are historical until the new source is regressed.

## Observation Log
| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-27 RED | EV-601 | 6.1 | six Artifact pretests | failed: 0/6 behavior contracts, loadable scaffold | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-601 | 6.2 | four actual-reader pretests | failed: 0/4 behavior contracts, no import failure | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-602 | 6.1 | same ten Artifact and reader cases | passed: 10/10 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-602 | 6.2 | same ten Artifact and reader cases | passed: 10/10 including real loopback traffic and close | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-603 | 6.3 | four Host integration pretests | failed: 3 new assertions; 1 existing rejection passed | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-604 | 6.3 | Artifact reader and Host integration suite | passed: 14/14; one Report owner and typed partial effects | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-605 | 6.5 | eight inherited related tests before fixture and effects adaptation | failed: 3/8; pinned old-version bytes correctly rejected and additional partial facts changed assertion shape | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-606 | 6.5 | same eight inherited related tests | passed: 8/8 with exact original fixture and stronger partial-effect assertions | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-607 | 6.4 | three HTTP evaluate pretests | failed: 0/3 before evaluator implementation | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-608 | 6.4 | HTTP evaluate plus Artifact and Host cases | passed: 17/17 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-609 | 6.2 | three independent CLI pretests | failed: reader entry absent behavior, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-609 | 6.3 | three independent CLI pretests | failed: CSV demo entry absent behavior, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-609 | 6.4 | three independent CLI pretests | failed: evaluator entry absent behavior, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-610 | 6.2 | same three CLI cases | passed: 3/3; actual child reader terminated normally | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-610 | 6.3 | same three CLI cases | passed: 3/3; actual CSV tool and attachment receipt | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-610 | 6.4 | same three CLI cases | passed: 3/3; independent evaluator kept four-case denominator | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-611 | 6.5 | full serial suite before aggregate bound fix | passed: 167/167 historical input | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-612 | 6.1 | CSV aggregate bound sentinel assertion | failed: late cell visited after budget | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-613 | 6.1 | Artifact and Host cases with incremental CSV bounds | passed: 11/11 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-614 | 6.5 | independent cached ci build and tests before review fixes | passed: 168/168 at preserved historical input | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-615 | 6.1 | reviewed derived-source negative | failed: derived marker stripped, total reviewer suite 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 RED | EV-615 | 6.4 | reviewed source identity and duplicate attachment negatives | failed: both corrupt evidence cases accepted, total 0/3 | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-616 | 6.1 | all new Artifact reader evaluate CLI cases | passed: 24/24 including derived rejection | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 GREEN | EV-616 | 6.4 | all new Artifact reader evaluate CLI cases | passed: 24/24 including full source identity and unique attachment metadata | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-617 | 6.5 | independent final build and npm test; eight demos; HTTP evaluate | passed: 171/171; 8 demos; 11 report readbacks; T1-T4 all HTTP passed, zero provider calls | docs/verification/v06-observations.md | v06-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-618 | 6.5 | original Kit lint plan/apply, status, verify, verify --check | passed: all five commands exit0; 5/5 tasks; generated current view; no completion record or release claim | docs/verification/v06-observations.safe.json | v06-candidate-inputs | observed-run |
