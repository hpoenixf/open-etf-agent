# v0.3 actual observations — evolving, not released

- EV-301: fixed proposal/spec/test plan preceded execution. Native Hook/root-budget/batch stubs loaded; 9/9 behavioral assertions failed, exit 1. Pre-run inventory SHA-256 65bc4ae8dde23e10cfad3b9b05fb6a176791b1ac4771dbdf7878e21c55aff4f0. No import/discovery failure.
- EV-302: implemented narrow immutable Hook inputs, bounded callback waits, synchronous resource claims and paired bounded workers. The same 9/9 passed, exit 0, about 200 ms.
- EV-303: integration stubs and unchanged Host/Runtime produced 6/6 behavioral assertion failures, exit 1, about 146 ms: Hook effective validation/observer reporting, batch-source registration, shared root request budget and read-only child constraints were absent.
- EV-304: Host/Runtime integration and one-level fixture child brought combined targeted tests to 15/15 passed, exit 0, about 300 ms. This is not a full regression or CLI pass. No actual provider or independent model trace was used.

At 19:37 UTC verification paused for the shared environment's separately coordinated work. New CLI tests and cooperation assembly written after EV-304 are not yet executed. Do not infer GREEN from their existence. Original raw logs remain ignored locally; their portable hashes are preserved separately.

- EV-305: after the coordinated validation pause, the three CLI tests plus root-identity and alias-effect tests actually failed 5/5, exit 1. CLI/observe were unsupported, root identity absent, and a successful aliased save lacked the actual file_saved event.
- EV-306: first implementation passed 19/20 targeted tests, exit 1: trusted alias configuration alone intentionally did not rename calls, and batch demo had forgotten to register its explicit before callback. The actual call was rejected before dispatch; this was not a successful batch.
- EV-307: adding the explicit callback brought all 20 targeted v0.3 tests to pass, exit 0, about 791 ms. Runtime now records the validated effective dispatch name and separately preserves the original proposal; rootId joins metadata across one-level child runs. CLI runs both batch-read and fixture-child, and model-child remains blocked. The readonly metadata view omits prompt and argument fields. Full inherited regression and independent final build are not yet checked at this stage.

EV-305's literal test selector was `--test-name-pattern='3.5|root identity|exact save alias'`; the ledger abbreviates it to avoid introducing table delimiters.

- EV-308: the new release-observer test first failed 1/1, exit 1, because the callback saw the pre-finalization log. Moving it after Runtime final-record/close attempts made integration 9/9 pass (exit 0, 121 ms). This does not claim CLI-owned external processes have closed, or that a failed log close succeeded. Release hook errors remain returned rather than persisted retroactively.
- EV-309: first full regression passed 69/70, exit 1. An unchanged v0.1 partial-effects exact-shape assertion exposed a redundant originalName added even without an alias. The assertion was retained: the implementation now adds originalName only when the effective name differs.
- EV-310: full serial regression then passed 70/70 (exit 0, about 8992 ms), with no fixture process remaining.
- EV-311: independent npm build and npm test exited 0 (70/70 tests, about 8382 ms); document-compare, skill-mcp, batch-read and fixture-child demos each exited 0. Default denominator remains four; all semantics remain unreviewed. Source/test/script/fixture/package inventory SHA-256 311a7f7972cc5719f003b48dec5be525ae4f91318358ad058588921cab9d9c22. No fixture process remained. The v0.3 offline script-disabled install previously succeeded with the same 95-package dependency closure and lock content; only the root package version changed from v0.2.

- EV-312: actual pinned public Evidence Kit plan/apply/status each exited 0, status 5/7; verify --check exited 1 refusing unfinished 3.6/3.7. These are structural checks only and did not run product tests or validate semantics.

- EV-313: after recording the observed structural check, actual Kit apply/status again exited 0; status 6/7, completion not-recorded, release not-claimed. verify --check exited 1 refusing only 3.7. No completion.json or generated verification closure was written.

- EV-314: final static review found that raw provider usage could contain nested prompt/source fields, while observe forwarded the entire usage object. A new negative fixture also covered nested name/callIds/cost. It failed 1/1 (exit 1, about 103 ms), establishing actual output leakage in the metadata projection rather than merely a speculative concern.
- EV-315: output-only typed projection now retains known identity/event fields, safe finite durations, three explicit nonnegative safe-integer token counts and finite nonnegative numeric cost (otherwise null). Original logs are unchanged. Both observe tests passed (exit 0, about 173 ms). This is not a general semantic privacy guarantee for valid metadata strings. The full suite has not rerun after this source change; prior 70/70 evidence remains historical, and final candidate freeze/check task 3.6 is reopened pending that regression.

## Pending static source-evidence finding (not yet an executed RED)
The skill-mcp scripted report mentions offline-editing conditions after reading only A/B page 1, while that condition occurs on page 2. Independent static review confirmed the sentence is true of the entire synthetic document but unsupported by this Run's acquired pages. The existing CLI test is strengthened to require page-1 sources and reject that unacquired claim; execution and the minimal wording correction await the next permitted MCP window. Do not call semanticStatus unreviewed a waiver for this known evidence mismatch. Task 3.5 is reopened until the actual check/fix occurs.

- EV-316: the strengthened existing skill-mcp test actually failed 1/1 (exit 1, about 512 ms) on saved report bytes containing the unacquired page-2 editing condition. The two acquired snapshots were page 1.
- EV-317: removing only the unsupported editing phrase (not expanding reads) yielded final npm build/test success: 71/71 serial tests, exit 0, about 9190 ms. All four independent demos exited 0, no fixture process remained. Current input inventory SHA-256 1409cc6aa63d4cc751e6ce113bfdf130077ccffea4a2a21f580b31993765b9ab. This supersedes the earlier candidate for current-source checks while preserving all earlier failures/results. Source-qualified fixture wording is still not a live model semantic evaluation.

- EV-318: after both review fixes and final 71 tests, actual Kit plan/apply again exited 0 with no issues. The final structural check is associated with input inventory 1409cc6aa63d4cc751e6ce113bfdf130077ccffea4a2a21f580b31993765b9ab, not the earlier 70-test source.

- EV-319: final current-source Kit apply/status exited 0, completed 6/7; verify --check exited 1 refusing only 3.7. Independent static review findings (effective effect identity, release timing, metadata projection, acquired-page wording) are addressed; product tests remain mechanism evidence, not live/semantic/release approval.
