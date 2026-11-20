# v0.38.0 · Opt-in Wind Fund MCP

One operator-only CLI queries daily, unadjusted exchange closes for a single ETF using a caller-supplied Wind authorization. It is not fund NAV or total return. Default research and model dispatch do not include Wind. No vendor response is persisted or sent to a model by this path.

- **Live data integration:** the fixed adapter successfully normalized three explicitly authorized Fund MCP queries covering the two exchanges, yielding 12 valid date/close rows. Each response lacked a recognized instrument-code column; all results were classified as request-only, not independently identity-confirmed. The wire request explicitly requested daily, unadjusted prices and excluded suspended observations; the response did not independently attest those settings. No raw values were retained or published. The earlier authenticated probe that produced no validated rows is separate and not counted in the three.
- **Unchanged model path:** no new model cohort was run. The [v0.37 fixed 10/10 result](v037-release.md) remains evidence for the unchanged existing workflow only. The qualification fixture/input set, existing Runtime and Gateway source, acceptance scripts, model path, and dependency graph are unchanged; the added Wind modules are not imported by those paths. This is not a fresh v0.38 model score and the three Wind calls do not count as model tasks.
- **Provider-free:** on Node 26.11.1, 22 focused checks passed on the behavior tree, including the Wind mock/guard tests and historical object checks in a full Git clone. CI and GitHub publication are checked on the final release source.

[Fixed Wind implementation](https://github.com/hpoenixf/open-etf-agent/commit/533b9e7609bda3df5b2d7cfc65dd902d553a772f) · [Operator guide](../wind-fund-mcp.md) · [中文用法](../wind-fund-mcp.zh-CN.md)

## 中文

本版只增加显式的 Wind 基金取数入口，不进入默认研究流程。三次真实查询覆盖沪深两市，读回 12 条有效日收盘记录；供应商回包没有独立代码列，只能证明请求绑定了完整标的代码。请求指定日频、未复权并排除停牌，不把成交价当净值或总收益。首轮失败记录保留。本版不重跑未改变的模型路径，0.37 已有的 10/10 仍只用于说明那条原有路径，不冒充 0.38 的新模型测试。
