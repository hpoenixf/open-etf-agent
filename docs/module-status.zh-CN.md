# 六层模块状态

[English](module-status.md) · [README](../README.zh-CN.md#module-map)

审阅版本: **v0.30.0**. [固定代码基线](https://github.com/hpoenixf/open-etf-agent/tree/46f7d95bbce20757a884b54cea41f8ebbf6d2540) · [本版验证范围与限制](verification/v030-release.md).

实现、离线检查、真实任务、发布和部署是不同事实。下表不是逐模块验收通过清单；模块可参与多层。

## L1 · 任务输入与触发

**CLI · Research Project · Schedule**

项目提交、一次计划执行与显式继续. 本地单用户；非周期调度或常驻后台服务.

[使用与边界](scheduled-tasks.zh-CN.md) · [research-cli.mjs](../src/research-cli.mjs) · [scheduled-tasks.mjs](../src/scheduled-tasks.mjs) · [conversation-cli.mjs](../src/conversation-cli.mjs) · [temporal.mjs](../src/temporal.mjs) · [research-project.mjs](../src/research-project.mjs)

## L2 · 身份、会话与上下文

**Session · Context · Memory · Skill · Conversation**

原任务身份、资料窗口与显式记忆. 记忆不是原始证据；不扩展授权.

[使用与边界](project-context.zh-CN.md) · [session.mjs](../src/session.mjs) · [context.mjs](../src/context.mjs) · [memory.mjs](../src/memory.mjs) · [skills.mjs](../src/skills.mjs) · [compaction.mjs](../src/compaction.mjs) · [conversation.mjs](../src/conversation.mjs) · [human-interaction.mjs](../src/human-interaction.mjs)

## L3 · Agent 决策与运行

**Runtime · Gateway · Worker · Child · Admission**

接续、共享预算、子任务独立取消. 运行完成 ≠ 答案准确；未知请求保留.

[使用与边界](child-lifecycle.zh-CN.md) · [runtime.mjs](../src/runtime.mjs) · [gateway.mjs](../src/gateway.mjs) · [worker.mjs](../src/worker.mjs) · [child-execution.mjs](../src/child-execution.mjs) · [hooks.mjs](../src/hooks.mjs) · [admission.mjs](../src/admission.mjs) · [specialist-profiles.mjs](../src/specialist-profiles.mjs)

## L4 · 工具与领域能力

**Tools · MCP · Plugin · Result · Knowledge · Web / PDF**

原文读取、来源回读、受限计算. 静态网页 / PDF文本；非实时金融数据.

[使用与边界](web-sources.zh-CN.md) · [tools.mjs](../src/tools.mjs) · [mcp.mjs](../src/mcp.mjs) · [results.mjs](../src/results.mjs) · [web-acquisition.mjs](../src/web-acquisition.mjs) · [pdf-input.mjs](../src/pdf-input.mjs) · [calculation.mjs](../src/calculation.mjs) · [plugins.mjs](../src/plugins.mjs) · [retrieval.mjs](../src/retrieval.mjs) · [knowledge.mjs](../src/knowledge.mjs)

## L5 · 结果发布与交付

**Report · Artifact · Publication · Review**

不可变版本、正文接纳与复核建议. 保存、发布、质量结论分别核验.

[使用与边界](report-review.zh-CN.md) · [report.mjs](../src/report.mjs) · [artifacts.mjs](../src/artifacts.mjs) · [publication.mjs](../src/publication.mjs) · [report-review.mjs](../src/report-review.mjs)

## L6 · 用户界面

**CLI · Loopback Reader**

命令行操作、本机报告与附件回读. 不是完整 Web 工作台；无浏览器验收声明.

[使用与边界](module-guide.zh-CN.md) · [cli.mjs](../src/cli.mjs) · [reader.mjs](../src/reader.mjs) · [reader-cli.mjs](../src/reader-cli.mjs)

[全部历史版本](module-guide.zh-CN.md#versions) · [独立文章覆盖资格](articles-and-code.zh-CN.md)

维护：只修改 module-status.json，执行 npm run docs:sync。新版本先核范围与证据再更新 reviewedVersion，不能只改版本号。
