[English](v070-self-host-diagnostics.md) | **简体中文**

# v0.70.0 · 自部署故障诊断

分别检查依赖、运行版本、配置、目录权限与本地服务。

- [使用说明与可复现实例](../self-host-diagnostics.md)
- [实现 PR #43](https://github.com/hpoenixf/open-etf-agent/pull/43)，候选 SHA `5f6b5244fec1acdd30470ec0518906910edbbcc9`，合入源码 SHA `7b7e3a586c8bae962359654247680a2fe3db3e54`。
- Node 26.11.1 上通过 6 项定向测试。[GitHub 全套 CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/45538212719)。
- 无模型调用，GUI 和原有持久化格式保持不变。回滚时恢复上一个稳定安装即可。

此记录对应源码验证。GitHub Release、Stage 与正式部署各有独立回执。
