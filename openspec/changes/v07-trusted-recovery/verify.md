# Verification

<!-- spec-evidence:generated@1 -->
Input digest: sha256:b41d5c683aa0aa107e939efcd1acc9cea64147d81f407a2741359808df367806

Generated view for v07-trusted-recovery. No tests were executed by this command.
Semantic quality: unverified. Release: not-claimed. Observation labels are authored records, not execution authentication.

## Tasks

- [x] 7.1 Implement trusted package identity, staged atomic contributions and deterministic release
- [x] 7.2 Implement real SQLite immutable Run, shared reservations, claim lease fence and monotonic cancel
- [x] 7.3 Connect sealed proposal, dispatch, commit and consume checkpoints to the existing Runtime
- [x] 7.4 Verify versioned Host, Child, working-input, Memory and Artifact recovery in new processes
- [x] 7.5 Expose inspect resume cancel and qualify the standalone offline candidate with safe evidence
- [x] 7.6 [check-only] Execute original Evidence Kit, review current code and freeze safe publication inputs

## Observations

| Task | Evidence | Date / phase | Command | Result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7.1 | EV-701 | 2026-10-27 RED | nine loadable Plugin assertions | failed: 0/9 before implementation; tightened RED retained | docs/verification/v07-plugins.safe.json | plugin-component-pins | observed-run |
| 7.1 | EV-702 | 2026-10-27 GREEN | Plugin cases plus reviewed release/schema assertions | passed: 13/13 including two ordinary Host package contributions | docs/verification/v07-plugins.safe.json | plugin-component-pins | observed-run |
| 7.2 | EV-703 | 2026-10-27 RED | seven loadable SQLite Session assertions | failed: 0/7, native SQLite probe separately passed | docs/verification/v07-session.safe.json | session-component-pins | observed-run |
| 7.2 | EV-704 | 2026-10-27 GREEN | Session cases plus orphan and parent-fence assertions | passed: 15/15 real SQLite transactions and independent connections | docs/verification/v07-session.safe.json | session-component-pins | observed-run |
| 7.3 | EV-705 | 2026-10-27 RED | four actual-process recovery pretests against inherited Runtime | failed: 0/4; checkpoint absent, one actual wait timeout | docs/verification/v07-observations.safe.json | inherited-runtime-with-host-preparation | observed-run |
| 7.3 | EV-706 | 2026-10-27 GREEN | same four recovery cases plus six original Runtime cases | passed: 10/10; same Run and different PID | docs/verification/v07-observations.safe.json | runtime-initial-green | observed-run |
| 7.4 | EV-707 | 2026-10-27 RED | seven operation-scoped Memory adapter assertions | failed: 0/7 before receipt and lock verification | docs/verification/v07-memory.safe.json | memory-component-pins | observed-run |
| 7.4 | EV-708 | 2026-10-27 GREEN | final Memory adapter and separate-process receipt assertions | passed: 8/8; no repeated one-use intent or stolen lock | docs/verification/v07-memory.safe.json | memory-component-pins | observed-run |
| 7.5 | EV-709 | 2026-10-27 RED | seven loadable independent session CLI assertions | failed: 0/7 before CLI implementation | docs/verification/v07-cli.safe.json | cli-component-pins | observed-run |
| 7.5 | EV-710 | 2026-10-27 GREEN | seven independent CLI assertions across five profiles | passed: 7/7; distinct start inspect resume processes | docs/verification/v07-cli.safe.json | cli-component-pins | observed-run |
| 7.3 | EV-711 | 2026-10-27 RED | six independent Runtime review assertions | failed: 5/6 accounting history outcome and cancelled-receipt assertions | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 7.3 | EV-712 | 2026-10-27 GREEN | same six review assertions | passed: 6/6 after bounded fixes | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 7.3 | EV-713 | 2026-10-27 RED | duplicate pending ID and rewound cursor assertions | failed: 2 new assertions; 6/8 overall | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 7.3 | EV-714 | 2026-10-27 GREEN | same eight review assertions | passed: 8/8 with exact group and cursor validation | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 7.4 | EV-715 | 2026-10-27 RED | self-consistent forged source and method history assertions | failed: 0/2; altered payload reached another Gateway despite valid originals | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 7.4 | EV-716 | 2026-10-27 GREEN | final ten review assertions | passed: 10/10; typed history bound to original facts before Gateway | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 7.5 | EV-717 | 2026-10-27 CHECK | first full npm test | failed: 232/234; rejected unknown tool incorrectly revalidated as a binding | docs/verification/v07-observations.safe.json | first-full-suite | observed-run |
| 7.3 | EV-718 | 2026-10-27 CHECK | final npm test including twelve process recovery cases | passed: 249/249; actual kill new PID cancel deadline and unknown assertions | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 7.4 | EV-718 | 2026-10-27 CHECK | final npm test including Child note Memory and report restart cases | passed: 249/249; exact adopted next-input hash and original committed effects | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 7.5 | EV-719 | 2026-10-27 CHECK | two offline npm ci cache attempts | failed: ENOTCACHED; install not completed and build not run | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 7.5 | EV-720 | 2026-10-27 CHECK | original locked official npm ci and independent build | passed: 95 packages; installation hooks disabled; unchanged dependency graph | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 7.5 | EV-721 | 2026-10-27 CHECK | seventeen independent built-output demo inspect resume evaluate commands | passed: 5 durable profiles; 9 post-exit reports; HTTP 4/4 | docs/verification/v07-delivery-receipts.safe.json | v07-candidate-inputs | observed-run |
| 7.4 | EV-722 | 2026-10-27 CHECK | read retained v0.6 artifact through current loopback reader | passed: 933 original bytes and published v0.6 identity match; no model call | docs/verification/v07-old-artifact.safe.json | v07-candidate-inputs | observed-run |
| 7.6 | EV-723 | 2026-10-27 CHECK | original Kit lint plan and apply; scoped publication scan; final input readback | passed: both Kit commands exit0 issues empty; no excluded files or sensitive patterns; executable inputs unchanged | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |

## Remaining Gates

Completion assessment and any live/release acceptance remain with the project owner.
