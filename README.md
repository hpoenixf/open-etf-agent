# Open ETF Agent

> **历史方案 · Superseded（2026-10-27）**
>
> 下文保留最初的计划快照；其中 `planned` 与版本范围仅描述当时方案，不代表当前实现状态。当前代码见 [main README](https://github.com/hpoenixf/open-etf-agent/blob/main/README.md)，后续顺序以 [CLI 优先、一版一个模块的路线](https://github.com/hpoenixf/open-etf-agent/blob/main/docs/plan/v1-to-v2.md)为准（本次对照固定于 [`0cf4b99`](https://github.com/hpoenixf/open-etf-agent/tree/0cf4b99e77bb77aa2530734d011e7f37985d1897)）；已公开切片的引入版本与固定源码见[当前版本血缘 registry](https://github.com/hpoenixf/open-etf-agent/blob/0cf4b99e77bb77aa2530734d011e7f37985d1897/versions.json)，它不是正式 Release 清单。旧 v0.8 的 Web / SSE / Worker 捆绑方案已被取代：已公开的 v0.8 仅 Publication，Worker 与 Web 分期；本页不签发实现或验证资格。原计划正文与 `docs/plan/versions.json` 作为历史保留，未改写为已发布。

从一个极简 Agent 开始，通过独立可运行的版本，逐步构建可扩展、可恢复、可核对交付的研究系统。

> **当前状态：方案设计，尚无已发布的运行版本。** 下列路线是目标，不代表能力已经实现。运行分支和标签在相应实现通过验收后建立。

## 两个阶段，一条代码历史

v0.1—v0.6 形成基础研究闭环：读取资料、调用工具、组织上下文、保留引用、保存文件、观察与检查结果。v0.7—v1.0 增加持久执行、插件生命周期、后台运行、Web 交付和外部研究工具。先让小系统交付有效结果，再按真实需求扩大能力。

| 版本 | 主要增量 |
| --- | --- |
| v0.1 | Runtime、Gateway、Tool Host，带出处的 Markdown 报告与运行记录 |
| v0.2 | Skill 按需加载、stdio MCP、模型流式接收 |
| v0.3 | Hook、受限并行分工、单独验证的模型 Child |
| v0.4 | Context、词法 RAG、ResultRef 与原文回读 |
| v0.5 | 可回读的摘要压缩、显式 Memory 生命周期 |
| v0.6 | 报告阅读与下载、附件、observe/evaluate |
| v0.7 | 可信 Plugin、SQLite、Checkpoint/Recovery |
| v0.8 | Web Chat、Publication、SSE/History、后台 Worker |
| v0.9 | 有界 Web、真实 PDF 解析、隔离 Python、合成 ETF 研究案例 |
| v1.0 | 稳定公共接口、运行配置验收、完整能力声明 |

每期保留完整的 `phase/vX.Y` 分支，每次发布固定 `vX.Y.Z` 标签。各版本包含自己的源码、示例数据、锁文件和运行说明，不依赖上一分支或私人服务。模拟网关与真实模型共用执行链，但模拟结果不证明模型质量。

**[完整方案](docs/plan/README.md)** · [能力覆盖矩阵](docs/plan/05-coverage-matrix.md)

[基础研究路线](docs/plan/01-roadmap-foundations.md) · [工程扩展路线](docs/plan/02-roadmap-research.md) · [架构契约](docs/plan/03-architecture-contracts.md) · [分支发布](docs/plan/04-branches-releases.md) · [验证安全](docs/plan/06-verification-security.md) · [实施与文章](docs/plan/07-execution-writing.md)

## 项目边界

默认面向本机单用户，使用独立合成数据和只读研究能力。不承诺交易执行、多租户金融生产服务或任意第三方代码的安全运行。正式代码发布前明确 LICENSE、第三方许可和示例数据来源。

公开说明以本仓库实际接口、可运行示例和验收结果为准。尚未实现、只在模拟环境中验证或需要额外环境的能力，分别说明。
