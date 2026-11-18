# v0.33.0: A17 material lifecycle

Execution source: `f7d32e23e24b38717174ca8e581e4ea665eb1a7b`.
Reviewed evidence head: `3780459384355e19a71d76c3b13342e978876407`.
Release packaging changes version metadata and navigation, not execution code.

A17 owns project-local material IDs, content/interpretation versions, explicit
selection, replacement, removal and recovery. Source parsing and Runtime task
admission remain with their existing owners. Removal is not revocation of
already admitted snapshots. Ambiguous incomplete initialization fails closed;
recovery is not a universal crash or power-loss guarantee. No new model calls
were dispatched for release packaging.

## Evidence and limits

- Provider-free: 1,506 passed, four optional historical-binary skips, zero failures.
  The skipped compatibility paths were exercised separately (13/13). A17 has
  19 new tests. [Final reviewed CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/44276466944) passed.
- [First cohort](../../engineering/v033-a17-acceptance-20261118/QUALIFICATION.safe.json):
  8/10, one timeout and one unsent task. Early admission consumed later task
  deadlines; this is consistent with the original fixed-deadline Runtime contract.
- [Prospective cohort](../../engineering/v033-a17-acceptance-20261118/PROSPECTIVE-QUALIFICATION.safe.json):
  ten attempted, nine completed. Operator source review is 9/10, not independent
  content acceptance. Raw substring checking remains 8/10: `Edition A` matched
  the heading `Edition and Exported Rows`; the reported selected-page facts were
  Edition B and 300 exported rows. Original mismatches remain in the record.
- The other prospective task returned HTTP 502. No retry was used. This is an
  HTTP failure observation, not proof identifying the provider/proxy root cause.
- Across both batches: 54 physical requests, 52 confirmed responses reporting
  zero additional USD, two unresolved billing outcomes. Total cost is unknown.
  Publishing does not settle these unknowns or reset request accounting.

The declaration-only release checker accepts the prospective 9/10 record; it
does not authenticate provider receipts. Independent Runtime review found no
reproducible release-blocking issue in the inspected scope. This is not a
guarantee of defect-free operation, financial accuracy or production suitability.
The user approved publication with the stated limits.

[Detailed design and evidence](../../openspec/changes/v033-research-material-assets/evidence.md)

## Release-package CI timing correction

The first metadata candidate CI [44278711943](https://github.com/hpoenixf/open-etf-agent/actions/runs/44278711943)
reported 1,505 passed, one failed and four skipped. The unchanged typed acquisition
test expected an unknown outcome after a 30 ms wall-clock timeout, without first
ensuring that its tokenizer had started. The owner timer already covers durable
attempt publication. An injected delay at that real filesystem boundary reproduced
a pre-dispatch timeout: zero tokenizer calls, `failed`, zero adapter invocations,
no response and no automatic replay. After dispatch, the corresponding controlled
timeout correctly records `unknown` and retains the late-work publication fence.

The test now advances the same owner timeout only after observing tokenizer entry,
and separately checks timeout before dispatch. It does not accept both states for
one path, increase the timeout, alter production code or retry model requests.
The original CI failure remains linked rather than being rewritten as a pass.
