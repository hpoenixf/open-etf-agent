**English** | [简体中文](v067-offline-report-bundle.zh-CN.md)

# v0.67.0 · Offline research report bundle

Copy a published report, keep public locations, and verify every file offline.

- [Usage and reproducible example](../offline-report-bundle.md)
- [Implementation PR #41](https://github.com/hpoenixf/open-etf-agent/pull/41) at candidate `1a50857f5714fdc3ea96035520c31168a3bbe5d4`, merged source `3e3fa36832f721957c811f111f87d1b50d2918f7`.
- Node 26.11.1 and 21 focused tests. [Full GitHub Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45536522893).
- Two synthetic source records are withheld in the mixed-source case. The surviving Web citation retains its original number and extraction chunk. The copied bundle verifies after removing the source project.
- Packaging checks also verified the copied bundle and its tampered variants with network access disabled for the verifier process.
- No model calls or changes to the GUI and stored formats. To roll back, restore the previous stable installation.

This records source verification. The GitHub Release, Stage and production have separate readbacks.
