# Evidence

## Planned sequence — 2026-10-27
Use the exact existing Node 26.11.1 executable, one serial test worker and heap 512 MiB. Work and synthetic SQLite files remain under the project/engineering workspace, never /tmp. No provider requests. Observe loadable behavior assertions failing before implementation, then the same assertions passing. Real child process kill/restart cases must retain OS PID and database identity; mock state or a saved file read is not a substitute. Preserve intermediate failures and repairs. Actual observation rows will be appended only after command completion.

## Observation Log
| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-27 RED | EV-701 | 7.1 | nine loadable Plugin assertions | failed: 0/9 before implementation; tightened RED retained | docs/verification/v07-plugins.safe.json | plugin-component-pins | observed-run |
| 2026-10-27 GREEN | EV-702 | 7.1 | Plugin cases plus reviewed release/schema assertions | passed: 13/13 including two ordinary Host package contributions | docs/verification/v07-plugins.safe.json | plugin-component-pins | observed-run |
| 2026-10-27 RED | EV-703 | 7.2 | seven loadable SQLite Session assertions | failed: 0/7, native SQLite probe separately passed | docs/verification/v07-session.safe.json | session-component-pins | observed-run |
| 2026-10-27 GREEN | EV-704 | 7.2 | Session cases plus orphan and parent-fence assertions | passed: 15/15 real SQLite transactions and independent connections | docs/verification/v07-session.safe.json | session-component-pins | observed-run |
| 2026-10-27 RED | EV-705 | 7.3 | four actual-process recovery pretests against inherited Runtime | failed: 0/4; checkpoint absent, one actual wait timeout | docs/verification/v07-observations.safe.json | inherited-runtime-with-host-preparation | observed-run |
| 2026-10-27 GREEN | EV-706 | 7.3 | same four recovery cases plus six original Runtime cases | passed: 10/10; same Run and different PID | docs/verification/v07-observations.safe.json | runtime-initial-green | observed-run |
| 2026-10-27 RED | EV-707 | 7.4 | seven operation-scoped Memory adapter assertions | failed: 0/7 before receipt and lock verification | docs/verification/v07-memory.safe.json | memory-component-pins | observed-run |
| 2026-10-27 GREEN | EV-708 | 7.4 | final Memory adapter and separate-process receipt assertions | passed: 8/8; no repeated one-use intent or stolen lock | docs/verification/v07-memory.safe.json | memory-component-pins | observed-run |
| 2026-10-27 RED | EV-709 | 7.5 | seven loadable independent session CLI assertions | failed: 0/7 before CLI implementation | docs/verification/v07-cli.safe.json | cli-component-pins | observed-run |
| 2026-10-27 GREEN | EV-710 | 7.5 | seven independent CLI assertions across five profiles | passed: 7/7; distinct start inspect resume processes | docs/verification/v07-cli.safe.json | cli-component-pins | observed-run |
| 2026-10-27 RED | EV-711 | 7.3 | six independent Runtime review assertions | failed: 5/6 accounting history outcome and cancelled-receipt assertions | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 2026-10-27 GREEN | EV-712 | 7.3 | same six review assertions | passed: 6/6 after bounded fixes | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 2026-10-27 RED | EV-713 | 7.3 | duplicate pending ID and rewound cursor assertions | failed: 2 new assertions; 6/8 overall | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 2026-10-27 GREEN | EV-714 | 7.3 | same eight review assertions | passed: 8/8 with exact group and cursor validation | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 2026-10-27 RED | EV-715 | 7.4 | self-consistent forged source and method history assertions | failed: 0/2; altered payload reached another Gateway despite valid originals | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 2026-10-27 GREEN | EV-716 | 7.4 | final ten review assertions | passed: 10/10; typed history bound to original facts before Gateway | docs/verification/v07-review.safe.json | review-component-pins | observed-run |
| 2026-10-27 CHECK | EV-717 | 7.5 | first full npm test | failed: 232/234; rejected unknown tool incorrectly revalidated as a binding | docs/verification/v07-observations.safe.json | first-full-suite | observed-run |
| 2026-10-27 CHECK | EV-718 | 7.3 | final npm test including twelve process recovery cases | passed: 249/249; actual kill new PID cancel deadline and unknown assertions | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-718 | 7.4 | final npm test including Child note Memory and report restart cases | passed: 249/249; exact adopted next-input hash and original committed effects | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-719 | 7.5 | two offline npm ci cache attempts | failed: ENOTCACHED; install not completed and build not run | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-720 | 7.5 | original locked official npm ci and independent build | passed: 95 packages; installation hooks disabled; unchanged dependency graph | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-721 | 7.5 | seventeen independent built-output demo inspect resume evaluate commands | passed: 5 durable profiles; 9 post-exit reports; HTTP 4/4 | docs/verification/v07-delivery-receipts.safe.json | v07-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-722 | 7.4 | read retained v0.6 artifact through current loopback reader | passed: 933 original bytes and published v0.6 identity match; no model call | docs/verification/v07-old-artifact.safe.json | v07-candidate-inputs | observed-run |
| 2026-10-27 CHECK | EV-723 | 7.6 | original Kit lint plan and apply; scoped publication scan; final input readback | passed: both Kit commands exit0 issues empty; no excluded files or sensitive patterns; executable inputs unchanged | docs/verification/v07-observations.safe.json | v07-candidate-inputs | observed-run |
