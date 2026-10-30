# v0.6.1 runtime repair

This patch stays on the original v0.6 Artifact/Reader API. It does not import newer Session, Publication, Worker or specialist APIs, and does not change the historical `v0.6.0-dev.0` tag.

## Repairs

- Preserve established same-index SSE tool IDs when later fragments carry `id: null`. First/new-index null, conflicting strings and other malformed IDs remain rejected; final proposal validation is unchanged.
- Retain authoritative effect receipts during history compaction. Only trusted, explicitly eligible read history can be summarized; unknown or effect-bearing groups remain intact.
- Preserve the previously tested v0.6 compatibility, bounded validation/correction and typed context-capacity handling, including Artifact effects and trusted protocol diagnostics.

## Exact verification boundary

The executed source is `fcff08b5610eb63598b85cfdd3e9c966c9fe6711` (184 source leaves). This release changes only package/root-lock version metadata and this note after that execution; code and tests remain byte-identical. The dependency graph is unchanged.

- The null-continuation failure was first reproduced offline against the pre-fix source. Eight focused boundary cases then passed, followed by 25 targeted portable/original regressions. No new full-suite run is claimed.
- The original build passed on the release candidate with unchanged source and fixture bytes; the generated `dist` source/fixture files were byte-checked. This historical version has no remote CI workflow, so no remote-CI pass is claimed.
- A fresh independent ten-task B cohort passed **10/10**, including two original CSV/Report attachment paths, three SSE tasks, and ten fresh read-only Artifact/Reader byte checks. It used 32 Go-zero-cost physical requests. No replacement samples or automatic retries were used.
- The previous A cohort remains **9/10** on its original pre-fix source. Historical failures and unknown attempts are not deleted or reassigned.

These are runtime safety, source/receipt, mechanism and byte-integrity checks, not a semantic answer-quality score. Passing SSE tasks does not prove that a null continuation occurred in those particular responses. The observed v0.6 null-continuation class is fixed; other historical compound protocol failures are not retrospectively assigned that cause. This patch does not claim real-model qualification for other version tags.

Publication uses a new commit whose parent is the original remote v0.6 commit `7480b656b18192e6d6b44aab65255b970d58e6f8`, preserving its public history. The current main branch and historical tags remain untouched.
