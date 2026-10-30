# v0.6 Runtime delivery qualification

This candidate uses no new provider requests. It tests what a reader actually receives: immutable artifact/revision identity, original-source fidelity, exact downloaded bytes and explicit partial effects. It is not a semantic answer-quality review or execution recovery implementation.

## Actual sequence

- Ten loadable-interface assertions first failed: six Artifact contracts and four reader contracts. Minimal native modules then passed all ten, including real loopback GET/HEAD and owned shutdown.
- Host integration produced three new failures and one already-working rejection case. Extracting one Report owner, adding ordinary `create_csv` dispatch and preserving typed partial Artifact effects led to fourteen related passes. The old Host rendering/publication body was removed rather than retained as a parallel engine.
- Eight inherited related tests exposed three compatibility/test-fixture issues. The old exact partial-effects assertion did not allow the newly preserved artifact/revision facts; it now still checks the original file paths and additionally requires both new effects. Two pinned-live tests correctly refused current v0.6 bytes under a v0.5 identity. They now use the small immutable original public v0.1 fixture closure with clearly injected Git identity and actual source-byte verification; no sibling checkout or extra Git worktree is needed.
- Three HTTP-evaluate assertions failed before implementation, then the seventeen related cases passed. Three separate CLI assertions failed before their entry points were implemented, then all three passed. Full regression reached 167 passes.
- A bounded CSV review found that total size was checked only after joining all rows. A sentinel getter produced a real one-case RED without allocating an enormous string. Incremental byte accounting now stops traversal as soon as the aggregate bound is crossed; eleven related cases passed. Independent cached installation/build then passed 168 tests at that intermediate input.
- Independent read-only review identified three more concrete gaps: unchanged source text/hash could conceal a changed manifest identity; a duplicated attachment record could count one download twice; and an explicit derived marker could be stripped when making a source snapshot. All three reproduced as RED. Complete intrinsic identity comparison, unique attachment-set plus metadata/bytes checks, and pre-projection derived rejection led to 24 related passes.
- The final independently installed input passed **171/171 tests**, build, eight demos and actual HTTP evaluation for all four original cases. The earlier 168 input remains archived locally rather than being relabelled as the final source.

## What was actually delivered and reread

Eight demos produced thirteen Runs and **eleven report receipts**. The first two explicit-Memory lifecycle Runs intentionally do not require reports; they are not counted as files. All eleven report hashes were independently checked after process exit. The structured change-table demo additionally produced its registered CSV attachment. Four-case evaluation retrieved each report and both original source windows over actual loopback HTTP, kept T1–T4 in the denominator and made zero model calls.

The reader binds only loopback, rejects foreign Host/Origin and write methods, accepts strict IDs rather than arbitrary paths, and sends HTML/SVG as attachments with restrictive headers. It is not an authenticated public hosting service. The structured CSV formula-leading-cell apostrophe is a declared display transform, not a silent change to original source text.

## Portable evidence

- [Actual command outcomes and original-log hashes](v06-observations.safe.json)
- [Exact source/test/package inventory matched against the independent input](v06-candidate-inputs.json)
- [Post-exit report/attachment receipts and four-case HTTP outcomes](v06-delivery-receipts.safe.json)
- [Original requirements, pre-test plan and observation ledger](../../openspec/changes/v06-artifact-reader/evidence.md)

Full logs, generated test databases (none used here), dependency caches and local provider credentials are not publication artifacts. Existing original live observations remain separate; this phase did not spend additional model calls. Project license selection, formal tags/releases, new-mechanism live coverage, background execution and cold recovery are not inferred from these results.
