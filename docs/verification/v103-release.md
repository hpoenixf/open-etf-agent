# v1.0.3: grounded bar and pie charts

[简体中文](v103-release.zh-CN.md)

The owner GUI can show bar and pie charts from explicit numeric data. The chart can use user-supplied values or verified source evidence; invalid or missing inputs do not replace the answer. An eligible public-page timeout can return an unavailable result without discarding the answer.

[Fixed implementation](https://github.com/hpoenixf/open-etf-agent/tree/372c6143dd3e8547c01b96276c7c21f8e5d469d2) · [Chart contract](../skills/financial-chart-user-data.md)

- The fixed implementation passed 1,826 offline tests with 0 failures and 6 skipped.
- The staging browser showed a column chart and a pie chart after the input-marker fix. The invalid-chart fallback was also checked. No claim is made for every chart family, chart inclusion in PNG exports, or an additional ten-question live-model cohort.
- This release does not include the private evaluation workbench or Stage database overlays.
