# Controlled chart formula computation

The trusted numeric interpreter accepts a small subset of Python **syntax**,
not Python programs. It parses the text into syntax nodes and walks the allowed
nodes itself. It has no script loading, user-defined functions, indexing,
attribute reads, calls outside the functions here, shell, filesystem or network
operations. It is not a sandbox for general Python and does not use Docker.
The caller still must authorize and construct numeric inputs; this file does
not expose an Agent tool or provide that authority.

The fixed launcher reads one bounded UTF-8 JSON object on stdin. For example,
with synthetic observations:

```sh
printf '%s\n' '{"script":"change = growth(revenue)\nchange","inputs":{"revenue":[100,110,null,120]}}' |
  python3 -I -B src/owner-skills/financial-chart/controlled-chart-compute.py
```

Output: `{"value":[null,10.0,null,null]}`.

Supported:
- Up to eight immutable named assignments, followed by one result expression.
  Bindings have ASCII identifiers and cannot shadow inputs or function names.
- Numeric scalars, nonempty vectors, and `None` in a formula (`null` in JSON).
  Unary `+`/`-` and binary `+`/`-`/`*`/`/` apply elementwise, broadcasting a
  scalar against a vector. Vector lengths must match. Ordinary division by
  zero fails; any missing operand leaves a missing output.
- `sum(series)` and `avg(series)` ignore missing values but return missing when
  there is no known value.
- `pct(a, b)` returns `100 * a / b`; `growth(a, b)` returns `100 * (a - b) / b`.
  Missing or zero denominators yield missing. For a negative prior value, the
  standard signed denominator is used; explain this accounting choice before
  interpreting the result.
- `growth(series)` computes each point against the immediately preceding one,
  preserving a gap rather than skipping a missing baseline.
- `coalesce(a, b)` substitutes only at missing positions. Fill missing data with
  zero only when the source and accounting meaning permit that assumption.

Limits: 64 KiB input, 4,096 ASCII bytes of formula, 256 syntax nodes, 12 input
bindings, 180 points per vector, 6,000 interpreter steps, and numbers of at
most ±1 billion. Nested arrays, booleans, strings and non-finite values are
not numeric inputs. Failures return a fixed JSON error code without echoing
the script or submitted data.

The output is a calculation, not a chart, receipt, or proof that the source is
reliable. Feed the result into a validated chart dataset with the actual keys,
dates and units. Keep input sources, formula and missing-value assumptions in
the surrounding research record; do not cite an input quote as proof of a
calculated value it does not report.

中文：仅解释受限数值表达式，不执行任意 Python。只收授权数值，不接受文件、命令
或网址；图表仍须走统一数据校验，计算结果不自动升级为已核验数据。

In the owner runtime, enable `ETF_GUI_CHART_COMPUTE=1` alongside
`ETF_GUI_AGENT_FINANCIAL_CHART=1` only where the fixed trusted interpreter
is installed and readable. No separate user-facing tool appears. The Skill
may call its optional calculation step, then pass the numeric output to the
same renderer contract. The Node wrapper uses a fixed executable and script
path, isolated Python flags, a clean environment, at most two subprocesses,
a 1.25-second deadline, and bounded stdin/stdout. It never executes model
source as Python or exposes the Docker socket.
