# Preparing financial-chart data with Python

Use Python outside the research runtime to clean, aggregate or recompute
numbers, then give the chart Skill the resulting data. The chart consumes
`{kind, asOf, unit, keys, series}` JSON, not a Python script, plotting package,
or generated SVG. This keeps the same chart profile and validation for
spreadsheet exports and computed values; it does not enable a runtime shell.

## CSV to chart data

Save your transformed table as UTF-8 CSV (UTF-8 BOM is also accepted). Use one
header row and select the category/date column, the value columns, a common
unit, and the actual as-of date explicitly. Example using synthetic revenue:

    printf '季度,营收\n二季度,184.5\n三季度,192.9\n' |
      python3 scripts/financial-chart-producer.py - \
        --kind financial-columns --as-of 2025-09-30 --unit 'CNY billion' \
        --key-column 季度 --value-column 营收

This produces one JSON object, by default. If you are feeding the current
owner composer instead of an API, add `--fenced` and paste the complete
`financial-chart-data` block with your request. This demonstrates the
existing operator-supplied path. The newer direct tool can receive the same
dataset; its separate evidence contract, when available, determines provenance.

Repeat `--value-column` to include multiple comparable series. For
candlesticks, choose the four columns in open/high/low/close order and specify
`--ohlc-label`; an entirely empty bar is missing. Empty cells otherwise become
JSON `null`, not zero. The producer rejects invalid dates, duplicate labels,
non-finite or out-of-range numbers, mismatched row shapes, partial OHLC
and unsupported unit/profile combinations. It preserves explicit units and
does not infer exchange rates, decimal scaling, period labels or denominators.
Quoted `"1,234.50"` and plain `1234.50` are accepted decimal forms.

For an existing research script, import the producer as a module from its
installed path (or copy it as `financial_chart_producer.py` and import
`prepare_dataset`). Use:

    dataset = prepare_dataset(
        kind="financial-columns", as_of="2025-09-30", unit="CNY billion",
        keys=["二季度", "三季度"],
        series=[{"label": "营收", "values": [184.5, 192.9]}],
    )

Use integers, finite Python floats, or `None` after performing your selected
calculations under consistent accounting and time-period definitions. Any
external data access or processing is your script's job, not this adapter's.
For traceability keep your own source URLs, filing page/table/cell, source
period and units, and formula or script revision. Cite those separately;
the producer never promotes numbers to filing-verified or provider-verified
solely because a script calculated them.

中文简述：脚本在本地清洗或计算后，输出与工具一致的 JSON。它不会执行模型提供的
脚本，也不会把计算结果自动标记为已核验；请保留原始出处与计算口径。

## Owner research tool

In enabled owner workspaces, the model can call `render_financial_chart`
with `{"dataset": <producer JSON>, "evidence": [...]}`. The evidence list is
optional; each entry has zero-based `series` and `key` indexes, the exact
same-run original `WEB:<manifestSha256>:<page>` or `PDF:<sourceRef>` reference,
and an exact retained passage in `quote`. The caller must not invent a quote
or a source reference. The standalone script never runs inside a live Agent.
Its output is model-arranged/unverified unless the runtime can check each
plotted value against retained evidence; page links alone are not verification.

Set `ETF_GUI_AGENT_FINANCIAL_CHART=1` in an owner live environment to enable
the automatic direct chart tool. Keep the existing provider, web/PDF access
and request approval boundaries. A malformed chart has no effect on the
written answer. Opened history reconstructs charts from committed tool results;
old turns are not reprocessed automatically.
