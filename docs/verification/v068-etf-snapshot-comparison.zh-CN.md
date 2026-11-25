[English](v068-etf-snapshot-comparison.md) | **简体中文**

# v0.68.0 · ETF 快照对比与复算

用本地快照复算费率差、持仓与行业重叠以及同口径收益。

- [使用说明与可复现实例](../etf-snapshot-comparison.md)
- [实现 PR #42](https://github.com/hpoenixf/open-etf-agent/pull/42)，候选 SHA `4914e1259a978b8af6a3b4cea858c5ee7a84b078`，合入源码 SHA `0d46ab558e64328cc860319e8bc2b995ae5ea4e8`。
- Node 26.11.1 上通过 4 项定向测试。[GitHub 全套 CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/45537538107)。
- 无模型调用，GUI 和原有持久化格式保持不变。回滚时恢复上一个稳定安装即可。

此记录对应源码验证。GitHub Release、Stage 与正式部署各有独立回执。
