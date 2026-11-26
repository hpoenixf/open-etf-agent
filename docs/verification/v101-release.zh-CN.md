# v1.0.1 验证范围

[English](v101-release.md)

[固定运行代码](https://github.com/hpoenixf/open-etf-agent/tree/5c042b7930cf03871ac7000ebb91c6cc98916795) · [同一 Git 内容树的 Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45737482166)。打包元数据与运行代码基线分开核对。

- 研究 CLI 可以明确指定投研 Skill，也可以选择 `--skill auto`，两者都不绑定研究深度。深度模式另有因果机制和反向证据指引。
- 来源后端保留符合条件的网页和 PDF 链接及 PDF 原始物理页码，不重写已保存的正文。不满足条件的引用仍标为未核实。
- 固定运行代码在 OpenCode Go 上通过 10/10 例真实 CLI 任务：沿用同源码 2 例，事先冻结再补跑 8 例。十例均能原样重开正文，共记录 30 次模型响应。研究材料为合成样本。
- Node 26.11.1 的独立离线检查 99 项通过，无失败或跳过；同一代码树的完整 Verify 记录 1,810 项通过、0 失败、6 项跳过。
- 不据此声称相对质量提升、外站 PDF 下载已通过、浏览器 GUI 已验收或已部署到托管环境。
