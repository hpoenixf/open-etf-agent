# Open ETF Agent

从一份能打开、能核对出处的报告开始，按可独立运行的版本演进为轻量研究 Agent。

> **当前只有方案，没有已发布的运行版本。** 路线修订 R2 以作者提供的《从零构建 Agent Harness · 入门篇》209 页、21 章 PDF 为教材基准；不再使用此前误选的 26 章完整稿。

## 两段路线，同一条代码历史

v0.1—v0.6 先覆盖入门篇的主要实践：读取、工具循环、方法、分工、上下文、引用、文件、观测与测评。v0.7—v1.0 再完成此前讨论的工程扩展：插件生命周期、恢复、后台、Web Chat、版本化发布与真实研究工具。后半段不是本书入门练习的前置要求。

| 版本 | 本期主题 |
| --- | --- |
| v0.1 | 极简循环＋实际保存的 Markdown 报告、够用出处、运行记录 |
| v0.2 | Skill 按需加载、stdio MCP 服务与客户端 |
| v0.3 | Hook、受限并行分工；独立模型 Child 单列验证 |
| v0.4 | Context、关键词 RAG、原文外置与精确回读 |
| v0.5 | 可回读的摘要压缩、显式 Memory 保存/修订/忘记 |
| v0.6 | 报告阅读与下载、附件、observe/evaluate：入门主线完成 |
| v0.7 | 工程扩展：可信 Plugin、SQLite、Checkpoint/Recovery |
| v0.8 | 工程扩展：Web Chat、Publication、SSE/History、后台 Worker |
| v0.9 | 研究扩展：有界 Web、真实 PDF、隔离 Python、ETF 案例 |
| v1.0 | 稳定公共面、各运行配置验收、覆盖声明与版本文章 |

每期保留 `phase/vX.Y` 分支，每次发布固定 `vX.Y.Z` 标签。各版本包含自己的源码、数据、锁文件和运行说明，不需要先安装上一版，也不依赖私有项目。模拟网关与真实模型共用执行链；前者不证明模型质量。

**[完整方案](docs/plan/README.md)** · [本次纠偏依据](docs/plan/08-beginner-source-review.md) · [21 章覆盖矩阵](docs/plan/05-coverage-matrix.md)

[入门阶段详情](docs/plan/01-roadmap-foundations.md) · [工程阶段详情](docs/plan/02-roadmap-research.md) · [架构契约](docs/plan/03-architecture-contracts.md) · [分支发布](docs/plan/04-branches-releases.md) · [验证安全](docs/plan/06-verification-security.md) · [实施与文章](docs/plan/07-execution-writing.md)

Lab 仍是书中唯一配套代码入口；本仓库是独立的工程演进实现，不替换 Lab，不重新发布书稿。默认本机单用户、合成只读数据，不承诺交易执行或多租户金融生产服务。正式代码发布前确定 LICENSE、依赖许可和资料来源。
