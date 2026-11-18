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

## Remote verification and first real-model cohort — 2026-11-18

[GitHub Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/44267208305)
ran the merge tree for PR #8. Its tree matched execution commit
`f7d32e23e24b38717174ca8e581e4ea665eb1a7b`. The Runtime suite reported 1,506
passed, 4 optional skips and 0 failures. A clean local install, build, docs check
and the 19 A17 tests also passed on that commit.

The [frozen plan](../../../engineering/v033-a17-acceptance-20261118/PLAN.safe.json)
defines ten synthetic tasks and the pass criteria. All 422 execution inputs and
locked dependencies were hash-checked against the working files and the pinned
commit. The [qualification record](../../../engineering/v033-a17-acceptance-20261118/QUALIFICATION.safe.json)
retains nine attempted tasks and one unsent task. Eight completed the original
Runtime, delivered a report, and cited the exact expected source version and
page. The eight reports could be read in fresh CLI processes with zero model
requests. The execution operator compared each completed report and final answer
with the frozen synthetic source.

OpenCode Go returned 25 confirmed DeepSeek V4.1 Flash responses with 52,411
reported tokens and 0 USD additional cost on those responses. One other physical
request remains unknown, so the batch's total cost is unknown. Dispatch stopped
at that point. The acceptance gate remains open at 8/10 against a 9/10 minimum.

The acceptance runner submitted all ten tasks during preflight. The original
Runtime starts each persisted deadline at submission. Serial execution and the
canary review therefore consumed the later tasks' deadlines before work began.
A17-09 read the selected PDF page successfully. Its second request started with
1,680 ms left on the existing Run deadline, then the Run ended with `TIMEOUT`.
The original request ledger and Runtime ticket both preserve the uncertainty.
A17-10 was admitted during preflight and made zero provider requests.

For a prospective cohort, freeze the ten cases and prepare the registries
upfront. Admit each Run immediately before its own work so it receives the
configured time budget, completing any required post-admission material change
within that task. A fresh paid batch requires its own authorization. Preserve the
original timeout, unsent task and unresolved request in this record.
