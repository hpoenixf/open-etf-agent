---
name: financial-chart
description: Use verified typed financial evidence to request a chart for the current run.
---
# Financial chart

Use the host's `build_financial_chart` tool only when a chart is helpful and the
same Run has eligible typed evidence receipts. Submit only the chart kind and
exact receipt IDs. Return any explanatory answer separately. Never emit a chart
JSON/HTML block or invent a numeric receipt, label, unit, source, or as-of date.
Do not relabel exchange close as NAV. Unsupported or missing data is not zero.

Supported types: NAV line, comparable returns/expense or holdings bar, holdings
pie with separately labeled remainder, and candlestick from actual same-basis
OHLC. Close-only data cannot produce a candlestick. An incomplete disclosure
cannot be presented as a whole.
