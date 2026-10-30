# v0.4.1 runtime repair

The patch preserves v0.4 ResultStore, ResultRef consumption, retrieval and native report APIs. No later Session, Publication, Memory or Artifact API is imported. Old tags and current main remain unchanged.

## Scope

Retain the previously qualified same-version bounded validation/correction and nullable stream compatibility repairs. The shared null-ID continuation fix preserves a nonempty established ID without granting a new ID. First/new-index null, conflicts and other invalid types remain rejected, with final normalization unchanged. Trusted diagnostics do not alter error or authorization semantics.

## Evidence is deliberately split

The original A cohort ran source `418ecd303a6e465ed48715126e300610f7aacc37` and passed **10/10**, with 34 Go-zero-cost provider requests. It included two retrieval/read/same-ResultRef read_result/report chains and independent native ResultStore and report byte checks. That source and result remain immutable.

The release product source is `9c6143f21401eb6c31b471eae693f45df1acedcf` (102 leaves). Its subsequent delta is the null-ID predicate and portable regression file. It passed two version-specific real Runtime seams: successful null-continuation read/save/report and conflicting-ID zero-dispatch rejection, alongside shared parser-family boundary evidence and the v0.6 real-response repair validation.

**No new B paid cohort was executed on this fixed source.** Per the sync-only policy, the earlier ten-task evidence is reused together with the targeted compatibility regression; it is not relabeled as ten tests of the new commit. No new full-suite run is claimed. Successful SSE is not proof that an actual response contained a null continuation. Historical compound protocol errors are not assigned this cause retroactively, and remaining unrelated gaps are not declared closed.

Release metadata changes only package/root-lock version and this note; tested product/test bytes and dependency graph are preserved. The original build passed on this metadata release candidate; source/fixture inputs and all generated dist source/fixture bytes were checked unchanged. This historical tree has no remote CI workflow; no remote CI pass is claimed.

The public commit will use original phase/v0.4 commit `ecf6cb45b4062586614e83aed917c92d704cb63b` as parent, not the newer main history.
