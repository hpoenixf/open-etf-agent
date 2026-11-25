[English](v069-skill-author-preflight.md) | **简体中文**

# v0.69.0 · Skill 开发与预检

校验、预览 Skill，并运行合成测试样例。

- [使用说明与可复现实例](../skill-author-preflight.md)
- [实现 PR #44](https://github.com/hpoenixf/open-etf-agent/pull/44)，候选 SHA `9ba582177fabe413278e91b07b55317c6a9d802b`，合入源码 SHA `1e9f4d300b6dbef5df5ea2262891020acb4bb193`。
- Node 26.11.1 上通过 8 项定向测试。[GitHub 全套 CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/45538632742)。
- 无模型调用，GUI 和原有持久化格式保持不变。回滚时恢复上一个稳定安装即可。

此记录对应源码验证。GitHub Release、Stage 与正式部署各有独立回执。
