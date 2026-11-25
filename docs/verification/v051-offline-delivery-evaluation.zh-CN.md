[English](v051-offline-delivery-evaluation.md) | **简体中文**

# v0.51.0 · CLI 离线交付测评

本版新增一个公开 CLI 模块。用四个内置合成用例，在本机环回 HTTP 真实回读正文、修订身份、原始来源片段和对应附件，保存既有测评读取器可导入的结果。独立元数据文件逐题关联 Runtime、交付凭据与本地时间线。观察日志缺失或无效，不会把已经验证的正文回读变成失败。

```sh
npm run -s eval -- run
npm run -s eval -- run --case T4
```

[运行、复读与比较](../evaluation-cli.md)。

## 已验证范围

- [实现 PR #38](https://github.com/hpoenixf/open-etf-agent/pull/38) 落入固定源码 [`599c512e5220a7d474ad1a021faa87897157ff36`](https://github.com/hpoenixf/open-etf-agent/commit/599c512e5220a7d474ad1a021faa87897157ff36)（tree `27575a0daf93a18b7dbe8560c10f69e2be4de7bc`）。该源码在 Node 26.11.1 的 [GitHub 全量 Runtime Verify](https://github.com/hpoenixf/open-etf-agent/actions/runs/45526404077) 通过；不能替代对后来打包提交的检查。
- 本地 Node 26.11.1 验收：**4/4** 正文 HTTP 回读、**4/4** 对应本地时间线关联。指定 T4 时其余三条为 `not-run`；同时核验旧命令回读、刻意篡改凭据、缺失/截断/畸形/串运行日志及基线回归报告。[结构化 CLI 回执](v051-offline-delivery-evaluation.safe.json) 记录范围与计数。
- **模型调用 0 次。** 本次只是交付与本地观测验证，不代表金融回答质量、模型或提供商验收。CLI 不外发元数据、不配置远端观测，不改 GUI、真实模型入口或部署。

代码谱系固定模块所在的源码。GitHub Tag、Release 和服务部署是独立事实，此记录不据此宣称已经发布或部署。
