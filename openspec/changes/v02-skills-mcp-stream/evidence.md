# Evidence

## Baseline and planned checks
v0.1 source baseline remains offline-verified at 1a787437c2a900c8a9fe27048e81aa86b703305b; this is inherited history, not v0.2 execution. No v0.2 check has run at this document's creation.

First inspect registry artifacts and a script-disabled lockfile, without executing external installation scripts. Then write executable interface stubs and test Skill/SSE behavior RED before implementation. For MCP, inspect the installed official SDK API then observe real fixture-process contracts RED. Differentiate failure to import from actual behavioral assertions. All test commands bounded to 120 seconds/512 MB, serial; fixture child gets 256 MB and no network/port/credentials.

Expected checks: catalog versus loaded body; malformed header; resource traversal/symlink/size; complete fragmented Unicode and multi-call SSE; EOF/DONE/finish/argument/size/cancellation refusal; real child handshake/list/call/close; paginated discovery/duplicate/unauthorized names; schema and content-block rejection; old and new cases through the same Host; failed child leaves no process; source/receipt/bytes readback. Shared source and budget behavior must be observed, not inferred from a module count.

The rows below record actual later executions. Provider/fee/data authorization, project license and formal publication remain separate gates. Evidence Kit plan/apply/check outputs will be recorded after actual invocation.

## Observation Log

| Date / phase | Evidence ID | Task | Command | Actual result | Artifact | Revision | Origin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-26 RED | EV-201 | 2.1 | `node --test test/skills.test.mjs test/stream.test.mjs` | failed: 10 behavioral assertions before implementation | docs/verification/v02-observations.md | inputs 5bb30527 (full hash in artifact) | observed-run |
| 2026-10-26 RED | EV-201 | 2.2 | `node --test test/skills.test.mjs test/stream.test.mjs` | failed: 10 behavioral assertions before implementation | docs/verification/v02-observations.md | inputs 5bb30527 (full hash in artifact) | observed-run |
| 2026-10-26 GREEN | EV-203 | 2.1 | `node --test test/skills.test.mjs test/stream.test.mjs` | passed: 10 tests after ordinary-file catalog fix | docs/verification/v02-observations.md | inputs b8d1ee7b (full hash in artifact) | observed-run |
| 2026-10-26 GREEN | EV-203 | 2.2 | `node --test test/skills.test.mjs test/stream.test.mjs` | passed: 10 tests with bounded complete stream assembly | docs/verification/v02-observations.md | inputs b8d1ee7b (full hash in artifact) | observed-run |
| 2026-10-26 RED | EV-204 | 2.3 | `node --test test/mcp.test.mjs test/extensions.test.mjs` | failed: 8 behavioral assertions against stubs | docs/verification/v02-observations.md | inputs 4f112f38 (full hash in artifact) | observed-run |
| 2026-10-26 RED | EV-204 | 2.4 | `node --test test/mcp.test.mjs test/extensions.test.mjs` | failed: 8 behavioral assertions against stubs | docs/verification/v02-observations.md | inputs 4f112f38 (full hash in artifact) | observed-run |
| 2026-10-26 GREEN | EV-206 | 2.3 | `node --test test/mcp.test.mjs test/extensions.test.mjs` | passed: 8 tests using actual official stdio child | docs/verification/v02-observations.md | inputs 7d373148 (full hash in artifact) | observed-run |
| 2026-10-26 GREEN | EV-206 | 2.4 | `node --test test/mcp.test.mjs test/extensions.test.mjs` | passed: 8 tests through shared Host and Runtime | docs/verification/v02-observations.md | inputs 7d373148 (full hash in artifact) | observed-run |
| 2026-10-26 RED | EV-207 | 2.5 | `node --test test/stream-gateway.test.mjs test/v02-cli.test.mjs` | failed: SSE parser CLI case and nested build assertions | docs/verification/v02-observations.md | inputs 76ea9c49 (full hash in artifact) | observed-run |
| 2026-10-26 GREEN | EV-208 | 2.5 | `node --test test/mcp.test.mjs test/stream-gateway.test.mjs test/v02-cli.test.mjs` | passed: 8 tests including built commands | docs/verification/v02-observations.md | inputs 65a9a8c3 (full hash in artifact) | observed-run |
| 2026-10-26 CHECK | EV-215 | 2.6 | node tooling/openspec-evidence-kit-db6ac2f/bin/spec-evidence.mjs lint --change v02-skills-mcp-stream --stage apply | passed: actual lint after date-format correction; status 5/7; verify refused unfinished gates | docs/verification/v02-observations.md | reviewed-inputs 3fff7f50 (full hash in artifact) | observed-run |
