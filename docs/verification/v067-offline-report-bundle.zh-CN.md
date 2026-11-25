[English](v067-offline-report-bundle.md) | **简体中文**

# v0.67.0 · 离线研究交付包

导出已发布报告，保留公开引用定位，断网核验全部文件。

- [使用说明与可复现实例](../offline-report-bundle.md)
- [实现 PR #41](https://github.com/hpoenixf/open-etf-agent/pull/41)，候选 SHA `1a50857f5714fdc3ea96035520c31168a3bbe5d4`，合入源码 SHA `3e3fa36832f721957c811f111f87d1b50d2918f7`。
- Node 26.11.1 上通过 21 项定向测试。[GitHub 全套 CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/45536522893)。
- 打包验证又在禁用网络权限的 Node 子进程中验证了复制件与篡改样本。
- 无模型调用，GUI 和原有持久化格式保持不变。回滚时恢复上一个稳定安装即可。

此记录对应源码验证。GitHub Release、Stage 与正式部署各有独立回执。
