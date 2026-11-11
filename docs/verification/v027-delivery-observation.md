# Delivery observation and semantic diagnosis, not a new cohort

The fixed `4bfa7f9d979a344e89e16ed5b15eaead195ac3e7` ten-task result remains unchanged: Runtime and Publication completed 10/10, persisted report artifact 9/10, with the original numerical threshold of 9/10. N03 still lacks the predeclared normal-report coverage. This supplement does not relabel it as a report success.

## Product contract

`publication-runtime.test.mjs` already tests `requireReport:true` with a committed Publication and no report receipt. `run-control.mjs` accepts either delivery. Publication owns a durable answer; a report owns a separate artifact, revision and source receipt. Project's `readResearchOutput` already distinguishes `published-answer`, `degraded-answer` and `report`. N03 is not a newly discovered Runtime failure, nor a transient chat reply.

The cohort observer only read `readResearchReport`, so its report-or-null field did not itself describe answer delivery. The additive `scripts/acceptance/research-delivery.mjs` uses the original read-only Project inspection/output APIs to record Runtime completion, verified Publication and report availability separately. It records byte fingerprints without copying answer/source bodies and does not call a model, amend a task, create a receipt, assess semantics or decide release eligibility. Publication integrity errors propagate; a verified Publication with an unavailable report is explicitly labelled `unavailable`, not `not-created`. `publicationCommitted` means durable Publication, not user notification. The two API reads are not an atomic snapshot of an active Run; terminal observations must be used for acceptance. A missing report and an unavailable report remain distinct.

Two deterministic integration cases, including UTF-8 fingerprint checks, missing-task errors and reversible synthetic artifact corruption, exercise active, Publication-only, report-present and repeated read-only observation. A zero-provider supplemental read of all ten actual retained tasks reproduced 10/10 Publication and 9/10 report artifacts. This is inspection of existing results, not another real cohort.

## Semantic boundary

Guidance is not a truth validator. In N05 the Main delegation itself characterized “不等于已生效” as a definite negative before the Child answered. A later Child review cannot be assumed independent of that framing. The current child contract already carries the original question as well as the local question; this is not evidence of a missing original-question transport field. No new prompt gate or unconditional Runtime report requirement was added.

Known semantic defects in N05/N07/N09/N10 and missing actual pagination/projection coverage remain. Publication delivery, source identity and tool completion do not establish valid inference. Any future explicit mandatory-file delivery contract should be separately versioned, frozen at admission and tested without changing historical terminal outcomes; no such new product contract is introduced here.
