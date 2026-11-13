# 六层模块状态

[English](module-status.md) · [README](../README.zh-CN.md#module-map)

审阅版本: **v0.30.0**. [固定代码基线](https://github.com/hpoenixf/open-etf-agent/tree/ba527fb502aebbe8bd601fd2115a4282cd10b94c) · [本版验证范围与限制](verification/v030-release.md).

实现、离线检查、真实任务、发布和部署是不同事实。下表不是逐模块验收通过清单；模块可参与多层。

## L1 · 任务输入与触发

### CLI · 有界公开实现

接收任务. **离线演示 / 显式提交**.  [十五分钟入门 Agent](https://hpoenixf.com/eff-agent-article/articles/agent-in-15-minutes) (overview) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/cli.mjs) · [范围导读](scheduled-tasks.zh-CN.md)

### Research Project · 有界公开实现

导入并提交研究. **自有资料与固定任务**.  [把自己的资料交给 Agent：从第一份报告到可恢复的研究项目](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-research-project-workshop) (workshop) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/research-project.mjs) · [范围导读](scheduled-tasks.zh-CN.md)

### Schedule · 有界公开实现

一次计划执行. **非周期常驻服务**.  [Agent 不必一直在线思考：我们怎样让研究在对话结束后按时继续？](https://hpoenixf.com/eff-agent-article/articles/agent-autonomous-scheduled-research) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/scheduled-tasks.mjs) · [范围导读](scheduled-tasks.zh-CN.md)

## L2 · 身份、会话与上下文

### Session · 有界公开实现

保留原 Run 身份. **身份、预算与截止不重置**.  [Agent 运行身份全景：从一次聊天到 Model Turn，系统到底在继续什么？](https://hpoenixf.com/eff-agent-article/articles/agent-task-session-run-worker-schedule) (overview) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/session.mjs) · [范围导读](project-context.zh-CN.md)

### Conversation · 有界公开实现

澄清与显式继续. **收到回复 ≠ 已采用**.  [“接着聊”不等于“接着执行”：Agent 对话接纳与任务接续的设计](https://hpoenixf.com/eff-agent-article/articles/agent-conversation-admission-task-continuation) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/conversation.mjs) · [范围导读](project-context.zh-CN.md)

### Temporal · 有界公开实现

固定任务时间. **时区锚点；非市场日历**.  [Agent 说“今天”时，到底是哪一天：任务时间、用户时间与市场交易日](https://hpoenixf.com/eff-agent-article/articles/agent-temporal-semantics-market-calendar) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/temporal.mjs) · [范围导读](project-context.zh-CN.md)

### Context · 有界公开实现

投影本轮材料. **原文不随窗口改写**.  [Agent 上下文治理全景·行动篇：从首轮输入到长期记忆，怎样真正落地](https://hpoenixf.com/eff-agent-article/articles/agent-context-governance-actions) (overview) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/context.mjs) · [范围导读](project-context.zh-CN.md)

### Compaction · 有界公开实现

压缩工作上下文. **摘要不代替原始证据**.  [上下文快满时，为什么不能直接把历史交给模型摘要？](https://hpoenixf.com/eff-agent-article/articles/agent-main-run-context-compaction) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/compaction.mjs) · [范围导读](project-context.zh-CN.md)

### Memory · 有界公开实现

明确保存与遗忘. **跨任务偏好单独授权**.  [Agent Memory 的完整生命周期：从记住偏好到安全遗忘](https://hpoenixf.com/eff-agent-article/articles/026-agent-memory-forget-durable-effects) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/memory.mjs) · [范围导读](project-context.zh-CN.md)

### Human Interaction · 有界公开实现

提问、收取与采用. **显式恢复；非通用审批**.  [Agent 问完用户之后：持久人机交互如何接回原研究](https://hpoenixf.com/eff-agent-article/articles/agent-durable-human-interaction-response-adoption) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/human-interaction.mjs) · [范围导读](project-context.zh-CN.md)

### Specialist Profile · 有界公开实现

冻结专家配置. **继承原任务边界**.  [自定义专家，不应该只是一个 Prompt 输入框](https://hpoenixf.com/eff-agent-article/articles/agent-custom-expert-from-prompt-to-recovery) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/specialist-profiles.mjs) · [范围导读](project-context.zh-CN.md)

### Skill · 有界公开实现

按任务加载方法. **方法说明不扩大工具权**.  [Skill 与普通 Prompt 有什么不同？从按需加载到脚本执行](https://hpoenixf.com/eff-agent-article/articles/agent-skill-from-markdown-to-callable-research) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/skills.mjs) · [范围导读](project-context.zh-CN.md)

## L3 · Agent 决策与运行

### Worker · 有界公开实现

接手续跑原任务. **仅支持的检查点**.  [Agent 深入：从一份报告到持续执行与专家协作](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v010-system-design) (open-walkthrough) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/worker.mjs) · [范围导读](child-lifecycle.zh-CN.md)

### Admission · 有界公开实现

接纳与容量排队. **公平等待，不放大并发**.  [模型返回了 HTTP 200，为什么下一次请求还得排队？Provider 容量准入的租约与未知占用](https://hpoenixf.com/eff-agent-article/articles/agent-provider-admission-capacity-lease) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/admission.mjs) · [范围导读](child-lifecycle.zh-CN.md)

### Gateway · 有界公开实现

编码与接收模型动作. **不完整响应不作动作**.  [Agent 供应商模块精讲：为什么统一接口之后，还需要共享准入](https://hpoenixf.com/eff-agent-article/articles/agent-provider-architecture-and-admission) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/gateway.mjs) · [范围导读](child-lifecycle.zh-CN.md)

### Runtime · 有界公开实现

推进同一工具循环. **未知派发不盲目重放**.  [投研 Agent 的关键不是多调用工具：从 Model、Harness 到会修正判断的 Loop](https://hpoenixf.com/eff-agent-article/articles/etf-agent-model-harness-research-loop) (overview) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/runtime.mjs) · [范围导读](child-lifecycle.zh-CN.md)

### Hooks · 有界公开实现

执行点扩展. **受原控制面约束**.  [从 Claude、Pi 到 Codex：我们如何在自己的 Agent Runtime 中实现多生态 Hook？](https://hpoenixf.com/eff-agent-article/articles/agent-multi-ecosystem-hook-execution) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/hooks.mjs) · [范围导读](child-lifecycle.zh-CN.md)

### Run Control · 有界公开实现

继续或停止的决策. **Host stop ≠ 用户取消**.  [当每个模块都能说“不”：Agent 的终结权、阶段预算与安全恢复](https://hpoenixf.com/eff-agent-article/articles/agent-veto-authority-and-run-termination) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/run-control.mjs) · [范围导读](child-lifecycle.zh-CN.md)

### Main → Child · v0.30.0 增强

委派、观察与取消. **原 Session 与 Root 预算**. 这是既有 Owner 的调用位置，不另算独立模块。 [Subagent 全景：独立上下文、专业协作与真实成果交接](https://hpoenixf.com/eff-agent-article/articles/agent-subagent-context-specialization) (overview) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-execution.mjs) · [范围导读](child-lifecycle.zh-CN.md)

### Child Lifecycle · v0.30.0 增强

独立子执行生命周期. **晚到结果隔离 / 冷恢复**.  [Subagent 全景：独立上下文、专业协作与真实成果交接](https://hpoenixf.com/eff-agent-article/articles/agent-subagent-context-specialization) (overview) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-execution.mjs) · [范围导读](child-lifecycle.zh-CN.md)

## L4 · 工具与领域能力

### Tool Host · 有界公开实现

核权再执行. **参数、路径与来源约束**.  [从工具调用到模型输入：把 Agent 的观测链路接起来](https://hpoenixf.com/eff-agent-article/articles/agent-tool-lifecycle-and-model-input) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/tools.mjs) · [范围导读](web-sources.zh-CN.md)

### MCP · 有界公开实现

连接外部工具. **接入不等于授予全权**.  [从接上 MCP 到真正用上工具：Agent 的接入链路怎样构建](https://hpoenixf.com/eff-agent-article/articles/mcp-host-from-discovery-to-consumption) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/mcp.mjs) · [范围导读](web-sources.zh-CN.md)

### Trusted Plugin · 有界公开实现

受信任本地扩展. **不是 JavaScript 沙箱**.  [Agent 扩展如何接入 Host：插件生命周期与运行时边界](https://hpoenixf.com/eff-agent-article/articles/020-agent-extension-host-smartphone) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/plugins.mjs) · [范围导读](web-sources.zh-CN.md)

### Web Acquisition · 有界公开实现

采集公开静态页. **无浏览器渲染与爬虫**.  [从“搜得到”到“读得下去”：我们怎样让 Agent 学会浏览网页](https://hpoenixf.com/eff-agent-article/articles/021-agent-web-research-from-search-to-deep-reading) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/web-acquisition.mjs) · [范围导读](web-sources.zh-CN.md)

### PDF · 有界公开实现

保留文件并提取文本. **无 OCR / 视觉表格解析**.  [从能读取到能研究：我们如何把 PDF 阅读升级为可追溯的多模态能力](https://hpoenixf.com/eff-agent-article/articles/024-agent-pdf-from-text-to-evidence) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/pdf-input.mjs) · [范围导读](web-sources.zh-CN.md)

### Result / ResultRef · 有界公开实现

留存原文与精确引用. **来源版本与选择不混同**.  [工具查到的数据，为什么不一定要给大模型看？](https://hpoenixf.com/eff-agent-article/articles/tool-results-outside-model-context) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/results.mjs) · [范围导读](web-sources.zh-CN.md)

### Retrieval · 有界公开实现

查找并回读来源. **检索命中 ≠ 已取得原文**.  [RAG 全链路：从文档入库到可引用回答](https://hpoenixf.com/eff-agent-article/articles/agent-knowledge-retrieval-end-to-end) (overview) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/retrieval.mjs) · [范围导读](web-sources.zh-CN.md)

### Knowledge · 有界公开实现

材料接入与来源核对. **语义质量另行看证据**.  [RAG 全链路：从文档入库到可引用回答](https://hpoenixf.com/eff-agent-article/articles/agent-knowledge-retrieval-end-to-end) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/knowledge.mjs) · [范围导读](web-sources.zh-CN.md)

### Calculation · 有界公开实现

选区到结果可复算. **非行情 / 交易服务**.  [Agent 深入：从一份报告到持续执行与专家协作](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v010-system-design) (open-walkthrough) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/calculation.mjs) · [范围导读](web-sources.zh-CN.md)

### Child Results · 有界公开实现

交回原文与派生意见. **建议不能冒充原证据**.  [多专家 Agent：怎么证明专家的结论真的被主 Agent 用到了？](https://hpoenixf.com/eff-agent-article/articles/agent-subagent-contribution-evidence) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-results.mjs) · [范围导读](web-sources.zh-CN.md)

## L5 · 结果发布与交付

### Main → Report · 有界公开实现

接回来源后保存报告. **完成宣称要有回执**. 这是既有 Owner 的调用位置，不另算独立模块。 [从第一份可回读报告开始：Open ETF Agent v0.1](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v01-first-readable-report) (open-walkthrough) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report.mjs) · [范围导读](report-review.zh-CN.md)

### Report · 有界公开实现

生成带来源的正文. **读得懂 ≠ 金融结论准确**.  [从第一份可回读报告开始：Open ETF Agent v0.1](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v01-first-readable-report) (open-walkthrough) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report.mjs) · [范围导读](report-review.zh-CN.md)

### Artifact / Revision · 有界公开实现

保存不可变版本. **文件存在 ≠ 正式发布**.  [报告已经生成，为什么还不能直接分享？](https://hpoenixf.com/eff-agent-article/articles/agent-artifact-version-access-sharing) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/artifacts.mjs) · [范围导读](report-review.zh-CN.md)

### Publication · 有界公开实现

接纳回答正文. **原版本与提交回执**.  [Agent 已经生成答案，为什么还需要一个独立的发布系统？](https://hpoenixf.com/eff-agent-article/articles/019-agent-answer-publication) (module-article) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/publication.mjs) · [范围导读](report-review.zh-CN.md)

### Report Review · 有界公开实现

对冻结正文提复核意见. **建议性复核，不作认证**.  [报告写完以后：让 Agent 查证、协作，再独立复核](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-report-review-workshop) (workshop) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report-review.mjs) · [范围导读](report-review.zh-CN.md)

## L6 · 用户界面

### Loopback Reader · 有界公开实现

回读报告和附件. **本机 HTTP；非完整 Web UI**.  [Agent 深入：从一份报告到持续执行与专家协作](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v010-system-design) (open-walkthrough) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/reader.mjs) · [范围导读](module-guide.zh-CN.md)

### CLI Readback · 有界公开实现

按身份观察原任务. **浏览器交互未宣称验收**. 这是既有 Owner 的调用位置，不另算独立模块。 [从第一份可回读报告开始：Open ETF Agent v0.1](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v01-first-readable-report) (open-walkthrough) · [固定源码](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/observe.mjs) · [范围导读](module-guide.zh-CN.md)

[全部历史版本](module-guide.zh-CN.md#versions) · [独立文章覆盖资格](articles-and-code.zh-CN.md)

维护：只修改 module-status.json，执行 npm run docs:sync。新版本先核范围与证据再更新 reviewedVersion，不能只改版本号。
