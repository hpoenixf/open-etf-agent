# v1.0.4: advanced chart profiles

[简体中文](v104-release.zh-CN.md)

The chart Skill adds guidance for matrix heatmaps, linked bar and line charts in the same unit, multiple lines, area charts, and explicitly supplied OHLC candles. The trusted prompt steers chart selection only when the chart tools are available. The frontend renders validated chart data; invalid or missing inputs do not suppress the answer.

[Fixed implementation and Stage evidence](https://github.com/hpoenixf/open-etf-agent/pull/58) · [Chart contract](../skills/financial-chart-user-data.md)

The Stage browser used synthetic inputs through the real model. It showed all five added profiles, verified keyboard interaction for the linked chart, and restored an area chart with a gap after reload. This verifies rendering and readback, not financial conclusions, a new fixed ten-task paid cohort, or a production deployment. The CLI remains the public evaluation entry point; the private workbench and deployment overlays are not part of this change.
