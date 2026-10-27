# v0.2 evolving observations — not a release

All data are synthetic. Commands use existing Node 26.11.1, 512 MB parent heap, serial tests and a 120-second outer bound. No provider calls or paid requests occur.

| ID | Actual observation | Identity |
| --- | --- | --- |
| EV-201 | Skill/SSE pre-implementation tests: 10/10 assertion failures, exit 1, about 118 ms; no import/discovery failures | input manifest SHA-256 5bb30527db28e86688cc7c97ef47c806cc0c83871dabb13ca9b4b1e61fc446f1 |
| EV-202 | First Skill/SSE implementation: 9 passed, 1 failed. Catalog incorrectly treated an ordinary root-level control file as a Skill directory, preventing the intended resource checks | test-output/v02/skills-stream-green-1.txt retained locally |
| EV-203 | After ignoring ordinary root-level files while still rejecting symlinks: 10/10 passed, exit 0, about 124 ms | input manifest SHA-256 b8d1ee7b791cf1a2df76da1a11026f81e1ac7ba3ccb2130a242a7486440a77b9 |
| EV-204 | MCP/extension pre-implementation tests: 8/8 assertion failures, exit 1, about 188 ms; actual-child assertion failed against the deliberate no-process stub, not a missing-module error | input manifest SHA-256 4f112f38e3a7868a33c4f49f39719697d5f87ebc4a7896cc8bb28efff0795cb8 |
| EV-205 | First real SDK 2.4.0 stdio/Host run: 7 passed, stdout-pollution assertion failed, 1 file cancelled by outer timeout; exit 124 at 120 seconds. Do not report this as a passing batch | input manifest SHA-256 6a66620487586c360f959f97a240f0c91aae2c81b9a42652e9dc39ff1cc85bc0 |

## SDK behavior and resource cleanup finding

The installed official v2.4.0 client ReadBuffer catches SyntaxError and continues, so arbitrary non-JSON stdout never reaches the adapter's onerror callback. The failure was `Missing expected rejection`, not an SDK startup/import failure. The negative test also lacked a finally-close for the unexpected successful session; a follow-up change closes that session even if the rejection assertion fails. The original timeout/failure is retained.

The v1.32.2 fixed public source at 3b73021a0a2272c0c04c3917bcdb03398b3ec63f instead directly propagates JSON parse errors. It is a currently maintained official line supporting the exact 2025-11-25 handshake selected for this stage. Selecting a dependency based on the required behavior, rather than its latest label, avoids custom protocol transport or private SDK internals. A dependency change still requires its own locked-source audit and real regression; this finding alone does not prove the replacement works.

## Dependency install observations

The first official-registry lock/install used exact client/server 2.4.0 and zod 4.6.7, resolved 14 packages, and kept `--ignore-scripts --no-audit --no-fund`. Installation succeeded. Published-manifest inspection found eventsource's prepare=build even though no hasInstallScript flag was present in the lock. It was not executed. Therefore the record says scripts disabled, not falsely that every package has no hook. Audit coverage is artifact origin/integrity/license/lifecycle metadata, not a full source security certification.

## Later actual checks

- EV-206: after matching the maintained official SDK 1.32.2 imports/API and ensuring negative-test cleanup, MCP/Host 8/8 passed, exit 0, about 1967 ms. Input inventory SHA-256 7d373148f644a8fcdb9aee2654fc855badb7c17f55fd2b2eb91a3f3397f220fa.
- EV-207: assembly pre-change RED: 0/3 passed, exit 1. The existing Gateway tried to parse SSE as one JSON value (actual protocol SyntaxError), CLI rejected skill-mcp, and build rejected nested fixture directories. Input inventory SHA-256 76ea9c493a0c5a32218fb250439017e8dfb4684d7b567fd7a2f65e3d4c0ede03.
- EV-208: after real assembly, targeted MCP/SSE/CLI checks 8/8 passed, exit 0, about 3486 ms; built default and skill-mcp copies ran. Input inventory SHA-256 65a9a8c33bc90dd26ee204577b848687aa3bbc2415dfb0d5d0644e612e9614e2.
- EV-209: a focused source-pairing test first failed (exit 1, Missing expected rejection): a source with a correct self-hash but a different page from the request was accepted. The adapter now compares actual documentId/page with request arguments; the subsequent full suite contains the passing rejection check.
- EV-210: full serial regression 45/45 passed, exit 0, about 5596 ms; no fixture process remained. Candidate input inventory SHA-256 299d2656e5631ca2fb149356efe794d116b23ab995274a572e9e399d892871bc.
- EV-211: independent cached `npm ci --offline --ignore-scripts --no-audit --no-fund`, `npm run build`, `npm test`, default four-case demo, and skill-mcp demo each exited 0. npm test 45/45 passed in about 5218 ms. Default denominator remained 4/4 completed; skill-mcp returned an actual closed child-process receipt. No fixture process remained. Expanded final code/data inventory SHA-256 bf42fa01c275f7d00e9e515670f16db3dd2493ef3e121d59b4a45cf76b1745f1 includes Skill resources and synthetic JSON files.

All installed packages were registry artifacts, with lifecycle scripts disabled. The final dependency graph has 95 installed package nodes, not the rejected v2 candidate's 14. Several published packages contain prepare scripts, including a git-config hook; none was executed. No security settings, credentials, provider calls or public releases were changed.

- EV-212: exact remote input-schema mismatch first produced a real missing-rejection assertion (exit 1). Sharing the narrow local READ_PAGE_SCHEMA and comparing the full advertised schema fixed it; targeted MCP/Host/tools 16/16 passed (exit 0, 2448 ms). This is schema agreement, not authorization of arbitrary remote tools.
- EV-213: additional active-call cancellation and pending-call timeout checks passed on first execution, not RED claims. MCP 9/9 passed (exit 0, 3361 ms); both cases assert the actual owned child PID returns ESRCH after close. Initialization cancellation and delayed incoming-stream cancellation are not covered by these particular checks.
- EV-214: final reviewed-source npm build, npm test, default demo and skill-mcp demo each exited 0; full suite 48/48 passed in about 6739 ms, no fixture process remained. Source/test/script/fixture/package inventory SHA-256 2c1625349e68d7344b693fd60d8852df7974c4585098696c59c2ad231b4b441e. Cached offline ci from EV-211 used the same dependency lock; this later source-only change did not reinstall dependencies.

- EV-215: first real Kit plan passed; apply refused all rows because the authored date/phase used an unsupported slash separator. Correcting the actual ledger format (not product results) made apply pass and status report 5/7; verify --check refused incomplete 2.6 and 2.7. Structural evidence is not semantic verification.
- EV-216: review added an active delayed-stream cancellation check; it passed on its first execution and is not represented as RED. The reader was cancelled and its lock released, with no proposal returned. Final full serial suite 49/49 passed (exit 0, 6749 ms), including built default and skill-mcp commands. Inventory SHA-256 3fff7f50fbc8c23b19ba2f5f1c918a1e389f8cc5b9cb10187891356bb46c03f7. Product source/dependency lock unchanged from EV-214; this inventory adds the one test. Initialization cancellation remains an explicit untested lifecycle boundary.

- EV-217: after recording the actual structural check as task 2.6, Kit apply/status again exited 0, status 6/7, completion not-recorded and release not-claimed. verify --check exited 1 refusing only unfinished 2.7. No completion.json or generated verify.md exists. Initialization cancellation is not claimed proven; existing owned-child call cancellation/timeout evidence is narrower.
