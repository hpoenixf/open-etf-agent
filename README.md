# Open ETF Agent

从一个极简 Native Agent Loop 开始，逐版本演进为可扩展、可恢复、可核对交付的研究 Agent。

> **当前状态：方案设计，尚无已发布运行版本。** 本仓库当前内容定义目标，不代表已经具备下面列出的能力。阶段分支、运行命令和发布标签将在相应实现通过验收后建立。

## 核心思路

每一期保留完整可运行代码，每一期增加有明确用途的成熟机制。读者既可以运行某个独立版本，也可以比较相邻版本，理解系统为何需要改变，以及哪些旧实现应该删除。

采用 `phase/vX.Y` 阶段分支与 `vX.Y.Z` 固定发布标签。默认示例使用独立合成数据与确定性模型替身，真实模型调用需显式配置。Lab 继续承担教材配套，本仓库不依赖 Lab、私有产品或私人书稿才能运行。

## 规划路线

| 版本 | 主要增量 |
| --- | --- |
| v0.1 | Runtime、Model Gateway、Tool Host：三个核心＋CLI |
| v0.2 | Skill 渐进加载、stdio MCP 真实往返 |
| v0.3 | 可信 Plugin、Tool 生命周期 Hook |
| v0.4 | ResultRef、Citation、词法 RAG、Context |
| v0.5 | SQLite、Checkpoint、冷恢复与 unknown 效果 |
| v0.6 | Publication、Artifact、SSE/History、Web Chat：完整 Web 六层主链 |
| v0.7 | 独立模型 Subagent、根预算、后台 Worker |
| v0.8 | 有来源的 Compaction、显式 Memory 与忘记 |
| v0.9 | 有界 Web、真实 PDF、隔离 Python、ETF 研究示例 |
| v1.0 | 稳定公共面、只读观测、评估与完整覆盖声明 |

**[阅读完整方案](docs/plan/README.md)** · [基础版本详情](docs/plan/01-roadmap-foundations.md) · [研究版本详情](docs/plan/02-roadmap-research.md)

[架构与契约](docs/plan/03-architecture-contracts.md) · [分支与发布](docs/plan/04-branches-releases.md) · [基础篇 26 章覆盖](docs/plan/05-coverage-matrix.md) · [验证与安全](docs/plan/06-verification-security.md) · [实施与文章](docs/plan/07-execution-writing.md)

## 范围

目标是本机单用户、CLI＋轻量 Web 的研究系统，不是多人金融 SaaS 或交易执行平台。金融案例使用明确标注的合成资料与确定性计算。研究工具的可选环境单列支持范围；默认演示不依赖模型密钥。

开源实现只采用成熟机制，并对新的实现重新验证。来源参考、教学代码、生产资格和模型语义质量分别说明；不把原项目或 Lab 的记录当成本仓库已经通过验收。

本次文档不复制私有书稿、源码、持仓或运行载荷，也不授予这些材料新的许可。正式代码发布前明确 LICENSE、第三方许可及 fixture 来源。
