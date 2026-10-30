# Evidence

## Fixed pre-implementation plan
First loadable-interface RED plan: 14 cases (6 library, 3 Memory projection, 5 compaction). Boundaries include persisted one-use library-scoped intent, revision/identity mismatch, search containers, reference-only byte baseline and post-persistence stale/cancel. The cases cover: actual Memory receipt/readback, explicit intent denial, revision conflicts, single-writer exclusion, forget recall exclusion and projected argument/note text removal; net-saving derived summary, failure/no-saving/stale fallback and shared root accounting. Missing import/discovery is not behavioral RED. Then integrate real Host/Runtime/Gateway capture, original-source reread and independent CLI modes in separate pre-change assertions.

Use serial existing Node 26.11.1, 512 MB parent heap, at most 120 seconds per authorized command. No live/service/database requests or new dependency. All actual commands/results are recorded only after terminal execution. v0.4's 96 tests are historical, not v0.5 validation. Local Memory examples use original synthetic content and explicit selected library paths, never private data.

No v0.5 execution has occurred at creation of this plan.

## Observation Log
| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-26 RED | EV-501 | 5.1 | native library pretests, single worker | failed: all 6 Memory assertions, total suite 0/14 | docs/verification/v05-observations.md | inputs-f09d833b9c831066 | observed-run |
| 2026-10-26 RED | EV-501 | 5.2 | native future-input projection pretests | failed: all 3 projection assertions, total suite 0/14 | docs/verification/v05-observations.md | inputs-f09d833b9c831066 | observed-run |
| 2026-10-26 RED | EV-501 | 5.3 | native compaction pretests | failed: all 5 compaction assertions, total suite 0/14 | docs/verification/v05-observations.md | inputs-f09d833b9c831066 | observed-run |
| 2026-10-26 GREEN | EV-502 | 5.1 | same 14-case serial native suite | passed: 14/14 isolated interfaces | docs/verification/v05-observations.md | inputs-d0b61852990b21e9 | observed-run |
| 2026-10-26 GREEN | EV-502 | 5.2 | same 14-case serial native suite | passed: 14/14 isolated interfaces | docs/verification/v05-observations.md | inputs-d0b61852990b21e9 | observed-run |
| 2026-10-26 GREEN | EV-502 | 5.3 | same 14-case serial native suite | passed: 14/14 isolated interfaces | docs/verification/v05-observations.md | inputs-d0b61852990b21e9 | observed-run |
| 2026-10-26 RED | EV-503 | 5.1 | native reviewer lock-write failure assertion | failed: owned partial lock remained, suite 0/2 | docs/verification/v05-observations.md | inputs-d0b61852990b21e9 | observed-run |
| 2026-10-26 RED | EV-503 | 5.3 | native reviewer pending summary assertion | failed: watchdog expired, suite 0/2 | docs/verification/v05-observations.md | inputs-d0b61852990b21e9 | observed-run |
| 2026-10-26 GREEN | EV-504 | 5.1 | 16 native cases with two reviewer boundaries | passed: 16/16, owned-lock cleanup included | docs/verification/v05-observations.md | post-review-local-inputs | observed-run |
| 2026-10-26 GREEN | EV-504 | 5.3 | 16 native cases with two reviewer boundaries | passed: 16/16, deadline and cancellation included | docs/verification/v05-observations.md | post-review-local-inputs | observed-run |
| 2026-10-26 RED | EV-505 | 5.4 | four native integration assertions | failed: 0/4 before Host/Runtime note and Memory wiring | docs/verification/v05-observations.md | unfrozen-local-integration | observed-run |
| 2026-10-26 GREEN | EV-506 | 5.4 | same four integration assertions | passed: 4/4 actual Gateway/persistence boundaries | docs/verification/v05-observations.md | unfrozen-local-integration | observed-run |
| 2026-10-26 RED | EV-507 | 5.4 | Runtime note adoption and reread | failed: expected completed Run lacked adopted-note wiring | docs/verification/v05-observations.md | unfrozen-local-integration | observed-run |
| 2026-10-26 RED | EV-508 | 5.4 | related 33-case suite | failed: 32/33, note descriptors treated as raw source payloads | docs/verification/v05-observations.md | unfrozen-local-integration | observed-run |
| 2026-10-26 RED | EV-509 | 5.4 | narrower original-document scope assertion | failed: derived note reread bypassed scope | docs/verification/v05-observations.md | unfrozen-local-integration | observed-run |
| 2026-10-26 GREEN | EV-510 | 5.4 | related 34-case suite | passed: 34/34 | docs/verification/v05-observations.md | unfrozen-local-integration | observed-run |
| 2026-10-26 RED | EV-511 | 5.5 | three CLI acceptance cases | failed: 0/3 before new cases | docs/verification/v05-observations.md | unfrozen-local-cli | observed-run |
| 2026-10-26 GREEN | EV-512 | 5.5 | same three CLI cases | passed: 3/3 | docs/verification/v05-observations.md | unfrozen-local-cli | observed-run |
| 2026-10-26 RED | EV-513 | 5.2 | final reviewer four boundary assertions | failed: Hook metadata retained forgotten text, total 0/4 | docs/verification/v05-observations.md | unfrozen-local-review | observed-run |
| 2026-10-26 RED | EV-513 | 5.4 | final reviewer four boundary assertions | failed: Runtime lost Memory partial effect, total 0/4 | docs/verification/v05-observations.md | unfrozen-local-review | observed-run |
| 2026-10-26 RED | EV-513 | 5.5 | final reviewer four boundary assertions | failed: observe rejected working_note, total 0/4 | docs/verification/v05-observations.md | unfrozen-local-review | observed-run |
| 2026-10-26 GREEN | EV-514 | 5.2 | related 15-case reviewer regression | passed: 15/15 | docs/verification/v05-observations.md | inputs-35e26cb8a36a8d3e | observed-run |
| 2026-10-26 GREEN | EV-514 | 5.4 | related 15-case reviewer regression | passed: 15/15 | docs/verification/v05-observations.md | inputs-35e26cb8a36a8d3e | observed-run |
| 2026-10-26 GREEN | EV-514 | 5.5 | related 15-case reviewer regression | passed: 15/15 | docs/verification/v05-observations.md | inputs-35e26cb8a36a8d3e | observed-run |
| 2026-10-26 GREEN | EV-515 | 5.5 | full serial npm test | passed: 124/124 | docs/verification/v05-observations.md | inputs-35e26cb8a36a8d3e | observed-run |
| 2026-10-26 GREEN | EV-516 | 5.5 | independent offline ci build test and seven demos | passed: all stages exit 0, 124/124 and ten report hash readbacks | docs/verification/v05-observations.md | inputs-35e26cb8a36a8d3e | observed-run |
| 2026-10-26 CHECK | EV-517 | 5.6 | actual pinned Kit plan apply status and verify check | passed: structural lint/status; verify correctly refused open 5.6/5.7 before this evidence update | docs/verification/v05-observations.md | d8b5554130fc3d333d0e181edf92a51e9030f20c | observed-run |
| 2026-10-26 CHECK | EV-518 | 5.6 | actual Kit apply status verify check after recording evidence | passed: apply/status 6/7; verify correctly refused only open 5.7 | docs/verification/v05-observations.md | documentation-only-after-d8b5554 | observed-run |
