# Wind 基金 MCP：手动查询日收盘价（0.38 候选）

这是独立的手动入口，不改变默认研究流程或原有合成 MCP 演示。只有在你向当前进程配置自己已获授权的 Wind 凭据、并显式执行命令后，才会访问 Wind。把凭据放在本地密钥管理器或环境变量 WIND_API_KEY 中，不要写入命令参数、仓库、提示词或共享日志。

```bash
npm run wind:fund -- --help
# 仅在你已获准发起 Wind 请求时执行：
npm run wind:fund -- 588200.SH 2026-06-01 2026-06-05
```

一次只查一个交易所合格代码，起止日期均包含在内，最多 31 个自然日。输出只保留日期、未复权收盘价和数据口径；asOf 是最新一条观测日期，不是取数时间。**场内成交收盘价不是基金净值，也不是复权或分红再投资后的收益。** 请求排除停牌数据，不补齐缺失交易日、不把无数据当成零。如果响应没有可核对的基金代码列，identityConfirmation 会明确标为 request-only，不宣称独立确认了产品身份。

命令不把 Wind 数据自动发给模型，不落研究历史，不返回供应商原始响应，不自动重试或切换供应商。后续使用和保存需遵守你的 Wind 授权。首轮云端探测打通了已认证的 MCP 请求，但没有得到通过校验的数据行。修正解析后，云电脑用真实授权分别查询沪深两市三个 ETF 日期窗口，均读到通过校验的日线数据。三次回包均没有可识别的独立代码列，因此标记为 request-only；这验证的是直接取数链路，不是默认研究流程或独立标的核验。

解析支持日期、紧凑日期和带显式时区的 ISO 时间戳，保留 Wind 报告的交易日，不换算成 UTC 日期。若返回了标的代码，交易所后缀也必须匹配；六位数字相同不代表同一标的。

参见[基金工具契约](https://github.com/Wind-Alice/AliceMarket/blob/ab8fa4cfc7904fa28d2a7297cd293d192eda3b5e/skills/wind-mcp-skill/references/fund.md)、[参数编码规则](https://github.com/Wind-Alice/AliceMarket/blob/ab8fa4cfc7904fa28d2a7297cd293d192eda3b5e/skills/wind-mcp-skill/scripts/call-rules.json)和[官方示例客户端](https://github.com/Wind-Alice/AliceMarket/blob/ab8fa4cfc7904fa28d2a7297cd293d192eda3b5e/skills/wind-mcp-skill/scripts/cli.mjs)。

维护者可在宿主函数显式传入 onResponseShape 回调。它只报告有限的结构计数、白名单字段名与格式类别，不传出供应商字段值或凭据，不改变原校验结果，也不追加请求。
