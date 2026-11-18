# A17 local implementation evidence

Fixed source baseline: Open `c0411d751ea0a54356b1ee4bfe13007652d49531`.
Validation runtime: Node 26.11.1. No model/provider requests or paid execution.

## Red/green and affected owners

- Initial `research-materials.test.mjs`: RED, missing new module. First lifecycle
  implementation: 4/4 GREEN.
- Initial `research-materials-cli.test.mjs`: RED, unknown material command.
  CLI wiring plus lifecycle/task tests: 7/7 GREEN.
- Final focused new suites: 13/13 GREEN. Includes two independent writer
  processes, recovery from a missing sealed snapshot, integrity rejection,
  content interpretation identity, bounds and original task/source consumption.
- Original source suite before changes: 12/12 GREEN.
- Six affected suites with the repository's `--test-concurrency=1`: 41/41 GREEN
  before the final two focused PDF/limit cases were added.
- A parallel invocation of those affected files hit the existing schedule test's
  200 ms admission window (`SCHEDULE_CONFIRMATION_TOO_LATE`). Its failure is
  retained. Serial execution passed; no scheduling code/test was changed. This
  is not treated as a new A17 defect or silently removed from the record.

The full suite and build are separate gates, not inferred from focused tests.
Independent code review, exact-head CI and a fresh real-provider acceptance cohort
are not certified by this evidence. No version bump, remote commit or release.

## Independent review corrections

Independent review identified three publication-boundary problems, not covered
by the first focused set: cancellation was not forwarded to the seal link;
a reader could misclassify a legitimate concurrent new snapshot as corruption;
and process death after hardlink publication but before temporary-name removal
left a two-link file that ordinary reads correctly rejected but recovery could
not repair. These findings are retained rather than hidden by initial green tests.

The revised code forwards cancellation only through the pre-commit seal write,
checks the seal view before classifying a visible snapshot anomaly, and provides
strict explicit recovery for the publisher's exact UUID temporary sibling on the
same inode. Arbitrary hardlinks still fail closed and are not deleted.

Four new interleaving tests passed. Two execute the original registry function
body with controlled native I/O dependency seams. Two exercise real filesystem
links; one runs a real subprocess, kills it with SIGKILL immediately after the
native seal link, observes link count two, removes the original selected input,
and recovers the committed new version from its original prepared/source bytes.
This is one tested process-crash window, not all crash windows or power-loss proof.

An initial full-suite run returned 1500 passed / 4 skipped, but review fixes were
made while it was running. It is retained as diagnostic evidence only, not an
exact-source qualification for the revised candidate. At that stage the frozen-source
full-suite gate remained open; the final run below closes the local offline gate.

A final independent review found an additional cancellation yield in the existing
immutable publisher: cancellation during its last asynchronous directory check
was not rechecked before native link dispatch. A deterministic real-filesystem
test first failed with a missing AbortError; one cancellation recheck immediately
before link dispatch made it pass, with zero link invocations and no destination.
This is the sole shared-storage adaptation, necessary for the A17 commit protocol.
The independent reviewer re-ran the interleaving suite and closed all three
findings after this narrower-window correction. Initialization limitations remain
explicit; this is not release approval.

## Final frozen-source local verification

The final production and test files were frozen before this run and checked
against their recorded SHA-256 values afterward. Documentation records were
finalized after execution; no production or test bytes changed during the run.

- `npm test` (Node 26.11.1, repository serial-concurrency script): **1510 tests,
  1506 passed, 0 failed, 4 optional tests skipped**.
- `npm run build`: passed, syntax-checked native ESM copy.
- Seven directly affected suites: **49/49 passed**, including **19 new A17 tests**.
- Independent review closed the identified cancellation, concurrent-read and
  owned-hardlink recovery findings.
- No live model calls, no fresh ten-task model cohort, no exact-head remote CI
  result, and no stable-version/release claim.

Only A17 source lifecycle and its CLI were added. The existing storage owner has
one necessary cancellation recheck; Runtime, task schemas, knowledge algorithms,
model configuration and permission grants were not changed. Raw logs, generated
projects, dependency installations, caches and restricted lineage notes are not
part of the submitted candidate.
