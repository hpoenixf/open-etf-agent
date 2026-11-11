# v0.27 compaction and Host projection repair

Base: `3ad7a279836957b31de99a92657d9494d62c04f0`, an unfinished WIP.
This is an offline Runtime repair, not a new real-provider cohort or a release.

## Reproduced failure

A valid Project enabled `report` and `compaction`, selected the existing
`host-results@3` policy, and used a 16 KiB input budget. The original Report owner
successfully saved the complete synthetic report. Runtime's Context then fitted
the next model input using the verified persisted-report text reference.
Compaction rebuilt its baseline with the older source-only Context policy and
threw `CONTEXT_CAPACITY_EXCEEDED` before the final turn. The persisted file did
not make the failed task successful. The new integration regression failed on
the fixed WIP, without any provider request.

This is a newly isolated composition defect. It is not evidence that the earlier
S03 or S04 failures had this exact cause. N03's Publication-only delivery and the
retained semantic errors are separate findings and are not regraded here.

## Minimal correction

Runtime passes its selected Host projection callbacks and original Gateway
encoded-byte measurement to the existing compaction owner. Compaction uses that
same Host policy for its baseline and all fallbacks. The summary-material
baseline retains its original raw-byte budget, so Main wire fitting does not
silently replace more summary source text with references. Minimum, candidate and reused
note views must satisfy both the existing raw-byte bound and encoded-request
bound; a smaller raw view is not automatically a smaller wire request.

There is no new projector, validator, execution owner, schema, limit or policy
version. With no Host callbacks, legacy projection behavior remains selected.
History, saved report text, operation receipts, source identity, root budgets and
deadlines are unchanged. Effectful report saves stay ineligible for summary
replacement. The original Host still verifies any report-argument projection,
and the latest requested `read_result` page remains intact. Failed or unusable
summaries fall back without persisting a new note.

## Verification

The unchanged WIP baseline ran 1,234 tests: 1,231 passed, zero failed and three
explicit old-binary checks skipped because their baseline paths were not set.
Those skips are retained as baseline evidence, not counted as passes.

The new regression file passed 4/4 after correction. It covers:

- A real Project/Runtime report save, pause before final dispatch and continuation
  in another Node process, preserving full report bytes and avoiding a second
  save or terminal replay.
- Derived-result projection with the latest requested Unicode page unchanged.
- Failed-summary fallback preserving verified report text references and receipts.
- An exact Chat-encoder case where a raw-byte-saving summary exceeds the encoded
  budget. A raw-only counterfactual accepts the same summary; the corrected path
  refuses it before note persistence.

The final focused set passed 74/74 on Node 26.11.1, with zero skips. It includes real
old-binary recovery using reader baseline `d2490f2b41785d0e611fb8d80efdc50886603c66`
and guidance baseline `a05693843abddf89f4396bbbb9feb7420828f387`, plus report
tampering, source/derived ownership, latest-page preservation, compaction
frontiers, unknown outcomes and original receipt checks. Independent review
found no blocking issue; its separate 4/4 smoke used Node 24.22.1 and is not
substituted for the supported-runtime validation.

The first full repair run passed 1,237/1,238, with no skips. Its one failure
exposed an overbroad first attempt: applying Main's encoded budget to the summary
material baseline changed a Knowledge capacity fallback from zero summary calls
to one. That attempt was corrected without editing the existing test. The final
focused set retains its original zero-reservation, zero-dispatch assertion and
also checks normal summary application. The failed full run remains failure
evidence rather than being relabeled as passing.

The lockfile and dependencies were not changed. A clean `npm ci --ignore-scripts
--no-audit --no-fund` installed the locked packages; an earlier offline-only
installation lacked one cached package and was not a successful install. Build
and built CLI help completed on Node 26.11.1.

The fresh final complete suite passed **1,238/1,238**, with zero failures,
cancellations or skips, exit 0, in 245.8 seconds. Both old-binary baseline paths
were enabled. All source, test and package input hashes were unchanged across
the execution. Build and built CLI smoke also passed after the final production
change. This is a new execution, not a relabeling of the preceding failure.

No paid model call, provider retry, source truncation, context enlargement,
historical result rewrite, main merge, tag or remote publication is part of this
repair. Successful offline tests do not establish semantic correctness or real
model-autonomous paging.
