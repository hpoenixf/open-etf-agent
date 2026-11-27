---
name: financial-chart
description: Prepare a typed numeric chart from comparable data and retained sources.
---
# Financial Chart Skill · protocol v1

Use this method when the user asks to visualize data or when a chart materially
helps explain a comparison, change over time, or composition. Read and check
data before charting. Prefer two to four distinct graphics. If no period is specified, look for the latest available issuer report and check its date against the task date. If you can only confirm older results, say that plainly before plotting.

Pass one fixed numeric dataset per chart to the internal rendering script:

    {"dataset":{"kind":"financial-columns","asOf":"2025-09-30","unit":"CNY million","keys":["Q2","Q3"],"series":[{"label":"Revenue","values":[108,120]}]}}

Data can come from an original read, attachment data already available to this
turn, the user, or a calculation. Do not invent missing values: use null.
Values align with keys; all series in one chart use the same scale and unit.
Draw money and percentages separately. An unknown value or unusable chart
must not block the ordinary answer.

| kind | data contract |
|---|---|
| financial-columns | Comparable category or period labels; up to four series |
| financial-share | One percentage series; do not normalize incomplete data to 100 |
| financial-stacked | Comparable groups with same-unit components |
| financial-trend | One series, strictly ascending YYYY-MM-DD keys |
| financial-multi-line | Two to four same-unit series, ascending YYYY-MM-DD keys |
| financial-area | One series, ascending YYYY-MM-DD keys |
| financial-combo | Exactly two same-unit series: bars first, line second |
| financial-heatmap | Ordered categories and comparable, same-unit rows |
| financial-ohlc | Dates and true open/high/low/close objects; no inferred OHLC |

Use CNY million (百万元人民币), CNY 100 million (亿元人民币), %, or the matching
unit; never send preformatted strings as plotted values. Use a real reporting
as-of date, not today's date by default. The script accepts common chart
names and unit aliases; prefer the canonical schema above.

Where available, pass exact retained references in `evidence`, such as
`["WEB:<manifestSha256>:<page>"]` or a PDF reference. For per-point proof:

    {"series":0,"key":0,"ref":"WEB:<manifestSha256>:<page>","quote":"<exact original passage>"}

Indexes are zero-based. A source link does not prove each value. Keep unverified
values marked, never invent citations, and use the same format for Python output.

Call the internal script before publishing; do not output Mermaid or generic
code fences in place of graphics. If the script reports a specific data error,
correct it once or deliver the supported prose without that chart. Layout,
colors, axis ticks, and hover are renderer defaults, not model parameters.
