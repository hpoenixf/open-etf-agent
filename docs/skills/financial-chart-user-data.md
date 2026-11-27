# Financial chart skill: owner-provided financial comparisons

Select **金融图表** in the owner composer, or provide explicit labeled values
when a chart would help. The tool receives no renderer options or
arbitrary markup. The runtime recognizes the current operator's explicit percentage pairs or typed
data block and gives the model immutable Run-bound references; the model calls
`read_supplied_chart_data` and `build_financial_chart`, then writes normal prose.
If the data is malformed or the chart is inappropriate, the answer still works.
Unparsed prose, earlier turns, web excerpts, and attached documents are not
promoted to verified chart numbers.

## Plain-message example

> 请用我提供的数据作两张图。①柱状图：基金甲 8%、基金乙 3%、基金丙 5%；②饼图：科技 50%、金融 30%、消费 20%。不联网。

Each category and percentage must be explicitly paired. The tool returns a
separate selection for each requested chart; the percentages and displayed
category names come from the current message. Inputs without dates are
displayed as such. This path doesn't infer unnamed categories, mix units,
import prior messages, or assign an as-of date. The fenced data block below is
still supported for richer units and chart types.

## Supported structures

| Type | Use | Typical financial question |
| --- | --- | --- |
| `financial-share` | One percentage denominator; remainder shown explicitly | How concentrated are the disclosed constituents? |
| `financial-trend` | ISO-date observations, with gaps kept as gaps | How did revenue or margin evolve across quarters? |
| `financial-columns` | Grouped same-unit categories or periods | Compare this quarter vs. the prior-year quarter by business. |
| `financial-stacked` | Additive contributions on a shared scale, signed values diverge around zero | Which businesses explain a change in consolidated earnings? |
| `financial-multi-line` | Two to four aligned, comparable ISO-date series | How did two strategies' cumulative returns compare over the same dates? |
| `financial-area` | One dated series with a meaningful zero; fill stops at missing data | Which weeks recorded net inflows vs. outflows? |
| `financial-combo` | Exactly two comparable series; first is bar, second is line, with one shared unit and axis | How did actual same-currency revenue compare to its target? |
| `financial-heatmap` | A 2–12 row by 2–12 column matrix of comparable values; rows are `series`, columns are `keys` | Which market and month combinations had high or low returns? |

The data block is a single JSON object. `asOf` is an ISO date, and `unit` is
one of the allowed labels (CNY, HKD, USD, explicit currency million/billion, %, x or count, as appropriate).
Use the actual unit without implicit scaling, consistent currencies and
identical bases (e.g. all GAAP). Null is missing, not zero. Never stack
non-additive ratios or totals with their components. Do not use a pie if
segments overlap or totals include undisclosed denominator differences.
For a time series, encode the fiscal period-end dates, not publication times.
The graphic and companion table explicitly label operator input as not
independently verified. The existing Wind close-only pathway and underlying
OHLC renderer are unchanged; a closing-price source is not an OHLC source.

```financial-chart-data
{"kind":"financial-stacked","asOf":"2026-09-30","unit":"USD million","keys":["FY Q2","FY Q3"],"series":[{"label":"Compute","values":[820,990]},{"label":"Network","values":[210,260]},{"label":"Eliminations","values":[-16,-20]}]}
```

This is synthetic data, not a company extract. Patterns were informed by
[NVIDIA's quarterly results slides](https://investor.nvidia.com/files/doc_financials/2027/Q327/NVDA-F3Q27-Quarterly-Presentation.pdf)
for compared fiscal quarters,
[Tencent's annual report](https://static.www.tencent.com/uploads/2026/04/09/62d786fcf3d3c8cb7e54791ee95439ac.pdf)
for segment views, and
[Alibaba's fiscal 2026 Form 20-F](https://data.alibabagroup.com/ecms-files/1514386754/5448240a-cb3c-4903-89e9-6013ab725fe4/2026%20SEC%20Form%2020-F.pdf)
for diligence on segment measurement: gross segment subtotals and
inter-segment elimination are not interchangeable with consolidated revenue.
Do not stack a subtotal and its constituent segments on the same axis.

## Advanced chart inputs

Use the explicit headed data block for advanced types. Set `kind` to the desired
profile. A combination chart does not accept arbitrary marks or dual axes.
Use one consistent unit and one meaningful definition across its two series.
For a heatmap, compare like with like (for example monthly total returns);
for mixed metrics, first provide legitimately normalized scores and their
meaning. Neutral/missing cells remain missing, not zero. Heatmap color uses a
symmetric scale around zero when values cross zero; otherwise it uses a
single sequential scale. The table and cell titles preserve the exact values.
Multi-line curves and area fills stop at gaps and never extrapolate.

```financial-chart-data
{"kind":"financial-heatmap","asOf":"2026-09-30","unit":"%","keys":["7 月","8 月","9 月"],"series":[{"label":"市场甲","values":[-2,0.5,null]},{"label":"市场乙","values":[1.2,-0.8,2]}]}
```

## Sourcing boundary

This version does not automatically turn public webpages or uploaded PDF
tables into charts. For an attached PDF with a confirmed table, the existing
`read_pdf_cell` still returns positioned cell values through the existing PDF tool. An adapter could add chart sourcing by accepting only immutable
same-Run `result:sha256:…` refs for table cells that the PDF runtime has
already approved. Verify original file, physical page, table/row/column,
row label, header and explicit unit; parse only exact numeric cell forms and
compare like-for-like periods. On mismatch or insufficient evidence, keep
the written answer and do not infer missing values. Linked public PDFs
currently offer a physical-page text tool, not this confirmed cell binding.
