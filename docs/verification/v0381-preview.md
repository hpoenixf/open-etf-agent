# v0.38.1 preview: opt-in Wind Fund tools in Research Project

[Wind tool guide](../wind-research.md) · [中文](#中文)

This experimental preview adds ten typed, read-only Wind Fund tool routes to the normal Research Project. The model can select a route for a question without the operator pre-selecting it. The account’s advertised, schema-compatible Wind MCP tools constrain actual availability; catalog discovery does not grant access. Unrestricted tool/argument forwarding, automatic Wind access and trading are not included. Credentials stay with the Worker; do not enable result use without authorization.

## What was verified

- On Node 26.11.1, the complete offline regression for behavior tree `744a90efbfd4651f68ab9e319d012017100b7e17` recorded **1,590 passed, 0 failed, 4 skipped**. Release metadata and documentation are separate from those tested runtime files. The module map’s fixed baseline links still point to the unchanged public v0.38.0 scope where appropriate.
- On the same behavior tree, one scripted-gateway Research Project canary made one actual Wind `search_funds` call and received 55 structured rows. A separate process opened the terminal run and published report again and matched its saved content digest. The report’s numbered citation was a local scope fixture, not original Wind source evidence. This check used **zero real model requests**.
- No real-model qualification of autonomous tool selection, all routes or report quality is claimed. The scripted gateway selected the Wind route; the live read does not prove that a model would select it or that other queries are entitled. No Wind rows, credentials or raw traces are distributed with this record.

The manual [v0.38.0 ETF daily-close CLI](v038-release.md) remains a separate, previously released operating path. This preview does not supersede its verification or certify a stable Wind research integration.

## 中文

v0.38.1 是实验性预览。研究项目显式开启后，模型可以自行选择十项参数结构化的 Wind 基金只读工具；真正可以调用哪些，要看账户目录、兼容的工具参数和具体数据权限。保留授权和数据边界，不提供任意 MCP 参数转发或交易操作。[使用说明](../wind-research.zh-CN.md)

Node 26.11.1 下，固定运行代码树 `744a90efbfd4651f68ab9e319d012017100b7e17` 全量离线回归 **1,590 通过、0 失败、4 跳过**。同一代码树另有一次脚本网关驱动的 Worker 调试：实际请求 Wind 的 `search_funds` 一次，返回 55 行结构化数据；另起进程回读已保存的报告，核对正文摘要一致。报告编号引用的是本地范围说明，而不是 Wind 原始材料。

这次真实取数由脚本网关选工具，**真实模型请求为 0**。不把它写成真实模型自主选工具、全工具实测或报告质量验收。本记录不分发原始数据、凭据或日志。
