# Agent 工程实战书系

PDF 统一收录于 [技术站点书架](https://github.com/hpoenixf/eff-agent-article/blob/d0ce49d838b3b614f28ced8ad0673f404eb2a21e/public/downloads/agent-handbooks/README.md)，包括 [Agent 工程辞典](https://github.com/hpoenixf/eff-agent-article/blob/d0ce49d838b3b614f28ced8ad0673f404eb2a21e/public/downloads/agent-handbooks/agent-engineering-dictionary.pdf)。本仓库保留离线练习和工程文档。

**从搭建、查证，到恢复、交付和运营。** 四本独立的参考书，面向想把 Agent 做成长期可维护工程的开发者、架构师和产品工程团队。可以从头做，也可以按手头的问题跳到需要的卷。

| 分册 | 适合在什么时候翻开 | 能留下什么 |
| --- | --- | --- |
| [01 · 从零构建 Agent](https://github.com/hpoenixf/eff-agent-article/blob/d0ce49d838b3b614f28ced8ad0673f404eb2a21e/public/downloads/agent-handbooks/01-build-agent.pdf) | 别人交来一句模糊需求，你要判断该用普通流程、工具还是 Agent | 可验收的需求合同、上下文和权限地图、可复用 Skill、能在本地演练的工程起点 |
| [02 · 有证据的 Agent 研究](https://github.com/hpoenixf/eff-agent-article/blob/d0ce49d838b3b614f28ced8ad0673f404eb2a21e/public/downloads/agent-handbooks/02-evidence-research.pdf) | 文档、搜索结果、PDF 表格堆在桌上，团队需要的是能核对的结论 | 资料清单、原文定位、时点与数值复算、待核证据和研究报告 |
| [03 · 可恢复的 Agent 运行时](https://github.com/hpoenixf/eff-agent-article/blob/d0ce49d838b3b614f28ced8ad0673f404eb2a21e/public/downloads/agent-handbooks/03-durable-runtime.pdf) | 任务跨十分钟或一天，发生取消、并发、预算或外部动作失联时不能一律重跑 | 执行身份、状态与结算表、检查点、人机交接和运行手册 |
| [04 · 可信交付、评测与运营](https://github.com/hpoenixf/eff-agent-article/blob/d0ce49d838b3b614f28ced8ad0673f404eb2a21e/public/downloads/agent-handbooks/04-evaluation-and-operations.pdf) | Demo 已跑通，但不知道怎么打分、上线、回滚或证明改动有价值 | 交付回读证据、分层评测集、版本发布和排障清单 |

**每册均超过 100 页实质正文。** 卷一 111 页、卷二 117 页、卷三 113 页、卷四 127 页；这里不计封面、目录和附录。查找具体章节和跳转页码，请看[四册详细目录](CONTENTS.md)。

## 拿手上的问题来读

- **我要给团队做知识库。** 先看卷一的任务、身份和范围，再跳卷二的检索、版本和撤权。先把答案回到授权原文，再考虑是否需要向量库或复杂编排。
- **我要做网页、PDF 和表格调研。** 直接读卷二，从搜索线索、原文和同一时点开始；行业数值与适用条件分开记。
- **我要做跨轮任务、审批或定时工作。** 用卷三判断哪一段可以恢复、谁有权取消，哪些未知动作不能重放。
- **我要证明 Agent 变好了。** 用卷四定义任务集合、分项判分、独立校阅和上线门槛，不用一项平均分替代全部证据。
- **我想先动手再选架构。** 从[读者离线练习包](reader-kit/README.md)开始。它不调用外部模型，用四组可独立运行的案例练习工具准入、原文选择、任务结算和判分。固定项目练习另见书中 Open 项目 v0.48.0 的章节。

## 证据和使用边界

这些是原创教学书和合成案例。引用 [ETF Agent 工程手记](https://hpoenixf.com/eff-agent-article/) 和公开的一手资料来解释架构取舍，不是原有送审书稿的电子版。已发布、已合并未发布、模拟实验和未来设计分开标注；外部产品只在具体需求上作对照，不代表通过同口径性能测评。财经场景是证据和计算教学，不提供个性化投资建议。

所需的公开项目演练以 [v0.48.0](https://github.com/hpoenixf/open-etf-agent/releases/tag/v0.48.0) 为固定起点；先只跑离线模型替身和合成资料。首次安装项目依赖可能联网，不需要在这套读者练习中配置生产密钥。
