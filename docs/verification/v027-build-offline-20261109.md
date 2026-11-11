# v0.27 build and complete offline check (2026-11-09)

Executable source: `2e5388b4c88114fec2f09f264468a04fbd16c737`.
This is engineering validation, not the required ten-task real-provider gate.
The source package still says 0.26.0; no version/tag/main publication is implied.

The actual native-ESM build exited0. All 98 generated source/fixture files matched
their input bytes. The built `dist/src/research-cli.mjs --help` entry exited0.
Dist is untracked and is not uploaded as source or treated as a published package.

The complete serial offline test command executed on unchanged fixed inputs:
1220 tests, 1215 passed, 5 failed, no skips, exit1, about204 seconds. This original
result is retained. It was not rewritten as a green full-suite execution.

Independent review identified five stale fixture assumptions after the deliberate
Host projection change. Only test files were corrected, with no production edits:

- Answer-view restore now supplies the task's frozen Host projection/owner, while
  forged assessment, source basis, grant and scope still reject.
- A latest Knowledge multi-query group can now be projected to original-owner
  source references. The fixture validates original text/ref identity and a real
  published answer explicitly saying evidence needs rereading. No Report or report
  receipt is invented, and this is not complete-corpus review.
- New task admission no longer uses the legacy local16000-byte question gate.
  Legacy absent-policy rejection remains tested, and a true encoded request limit
  still refuses before provider dispatch. The original Session boundary remains.
- The Web large-page fixture checks the allowed source-reference progression,
  followed by the actual requested latest full-page capacity rejection. It checks
  the precise three-call boundary, not an unconstrained increase in dispatch.

The five affected tests then passed in one focused run. A final added Knowledge
publication-readback assertion passed in a separate single-test run. These checks
are separate evidence, not a second complete1220-test pass. Original failures,
intermediate correction attempts and logs remain local. All checks used synthetic
fixtures without provider credentials, paid model calls or production databases.

Real-provider acceptance of this changed execution/prompt policy remains pending.
Prior diagnostic batches, unknown Q02, failed T01 and subsequent T02 observations
retain their exact original sources and boundaries; they are not pooled into a
new fixed ten-task qualification result.

## Final fixed-source rerun

The corrected fixture commit `d2490f2b41785d0e611fb8d80efdc50886603c66`
has the same executable source as the commit above. A fresh complete offline run
finished with **1220/1220 passed, zero failed/skipped**, exit0, about207.8 seconds.
All 778 tracked input files matched the fixed commit before the run and remained
unchanged afterward. The actual build and built CLI smoke both exited0; all 98
generated files matched their source bytes. This is a new complete execution,
not a relabeling of the earlier five failures. No model calls were made.

See the separate live qualification record for real-provider evidence and its
remaining coverage boundaries. Offline success is not permission to publish.

## Versioned reader correction final offline validation

New host-results@2 adds disjoint source/derived reader schemas while preserving frozen @1 and absent-policy definitions. Five production files, one new reader test and two stale new-default assertions changed. Independent read-only review approved WIP. True old d249 binary created an @1 task checkpoint that the new binary resumed; new tasks freeze @2. Targeted suites passed 12/12, 7/7 and 13/13 with zero skips.

The first full run exited 1; a diagnostic TAP run recorded 1,223/1,225 passing, with only two stale @1 new-task assertions failing. These records remain failures. After correcting only those assertions, a fresh final full run passed 1,225/1,225, zero failures/skips, exit 0; build exit 0. No model calls. This does not establish real provider acceptance of the new schema; S01's actual @1 failure remains documented separately.
