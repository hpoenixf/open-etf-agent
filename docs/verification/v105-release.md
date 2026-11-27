# v1.0.5: from web links and PDF cells to calculated charts

[简体中文](v105-release.zh-CN.md)

The owner research workspace can follow a supported static HTML link to a native-text PDF, identify rows and columns on physical pages, and feed exact cell references to a bounded numeric chart calculation. Charts can cite the original physical source pages. The same workflow can publish cited text when there is no usable grid, without fabricating a chart. Source and date omissions remain explicit; saved text, charts, and sources still read back after the feature flags are disabled on the same runtime binary.

## Verification and limits

- On the fixed implementation, an isolated real Go cohort ran ten distinct tasks in two waves of five. All ten qualified and original body bytes matched from a new process (32 physical model requests; no unknowns in that cohort). The previous ten-task cohort preserved all outcomes and 32 requests, but did not qualify and is not pooled here. The gate examines Runtime and delivery, not writing or investment quality. [Qualification receipt](v105-runtime-qualification.safe.json) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/tree/b8e7f235915c89434a58a67bd98eeef0ed4f1118) · [Rollback integration test](https://github.com/hpoenixf/open-etf-agent/pull/68).
- A real HTML-to-Factsheet route read two distinct cells on physical page 2 and kept both original page links with a calculated chart. A no-grid case kept a cited original page 3 without a chart. Other cases exercised HTML, a computed chart with a missing base, dated line/column/pie/stacked charts, an invalid chart fallback and ordinary text. Browser verification separately checked the cited chart after reload on Stage.
- Public web access still respects robots and redirect restrictions. This is not arbitrary browser automation, OCR, general Python execution, or automatic reading of a bare PDF URL in the HTML reader. The formula accepts bounded numeric expressions, not arbitrary scripts. Private evaluation, production overlays, and hosted policies are not part of source verification.
