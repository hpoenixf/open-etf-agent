[English](articles-and-code.md) | **简体中文**

[返回项目首页](../README.zh-CN.md#reading)

<a id="reading"></a>
# 文章与代码 · Read → inspect → run

下文命令均从仓库根目录运行。

这些文章讨论更广的 Agent 工程问题。右侧是本仓库可运行的**最小机制实验**，不是原文全部高级能力的开源实现；具体支持范围以对应快照为准。

**已登记覆盖契约（31 篇，不代表当前全目录）：** `verified` 只表示表中明确限定的最小 Runtime 切片，不是整篇文章实现、模型质量或生产认证；`无公开对应` 不借相邻机制认领；`draft` 尚未取得资格。表由 [唯一覆盖清单](verification/article-coverage.json)与 [版本血缘](../versions.json)生成：`since` 是该最小切片首次公开引入版本；`verifiedAt` 是当前实跑回执绑定的固定代码，不能用后者改写前者。`无公开对应` 不填虚构的引入版本。本表的 31 条登记仍保留；截至本次核对，[固定 book.mjs / modules](https://github.com/hpoenixf/eff-agent-article/blob/fc5b8c7147404a1ef17a7c8c1840e440abe8efb6/book.mjs) 实际已有 33 篇。另两篇 [跨 Run 会话压缩](https://github.com/hpoenixf/eff-agent-article/blob/fc5b8c7147404a1ef17a7c8c1840e440abe8efb6/articles/agent-conversation-history-compaction-source-boundaries.md)与[反馈事实](https://github.com/hpoenixf/eff-agent-article/blob/fc5b8c7147404a1ef17a7c8c1840e440abe8efb6/articles/agent-feedback-facts-not-automatic-learning.md)尚未映射，不计入 verified，也不借相邻机制补填 since 或 case。

<!-- article-coverage:start -->
| 文章 | since · 引入版本 | verifiedAt · 固定 commit + case | 状态 |
| --- | --- | --- | --- |
| [Entry：为什么入口越来越简单](https://hpoenixf.com/eff-agent-article/articles/022-agent-entry-from-intent-to-direct-research) | — | —<br>缺 Direct/Research 决策、授权目录呈现与普通追问 | 无公开对应 |
| [Web：从搜索到连续阅读](https://hpoenixf.com/eff-agent-article/articles/021-agent-web-research-from-search-to-deep-reading) | — | —<br>缺 HTTP 获取、连续阅读、页面状态和来源撤销 | 无公开对应 |
| [Agent 说“今天”时，到底是哪一天](https://hpoenixf.com/eff-agent-article/articles/agent-temporal-semantics-market-calendar) | — | —<br>缺可信时区、日历覆盖和行情 dataAsOf | 无公开对应 |
| [PDF：从文本到证据](https://hpoenixf.com/eff-agent-article/articles/024-agent-pdf-from-text-to-evidence) | [v0.11](https://github.com/hpoenixf/open-etf-agent/commit/5f42c33892d57ed05e8cd09cad48573e6901995b) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/pdf-cli.test.mjs` · 11.3 PDF CLI exits then a fresh process verifies page report and original binary<br>仅本地文本层 PDF：物理页、原文件与报告独立进程回读；不含 OCR、页图、版面、多模态或活跃解析恢复 | verified |
| [Subagent：从隔离到专业化协作](https://hpoenixf.com/eff-agent-article/articles/agent-subagent-context-specialization) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `--case fixture-child`<br>一层脚本 Child 共享预算并交回原始结果；非真实模型专家 | verified |
| [自定义专家，不应该只是一个 Prompt 输入框](https://hpoenixf.com/eff-agent-article/articles/agent-custom-expert-from-prompt-to-recovery) | — | —<br>缺专家 CRUD/版本冻结/目录权限/历史身份/恢复 | 无公开对应 |
| [Adaptive Research 与 Python](https://hpoenixf.com/eff-agent-article/articles/adaptive-research-python-workbench) | — | —<br>缺模型研究问题修订、任意获准 Python、数据工件接力 | 无公开对应 |
| [Python：从工具到计算工作台](https://hpoenixf.com/eff-agent-article/articles/agent-python-compute-workbench-evolution) | — | —<br>缺隔离执行/代码与输入身份/失败后工件保留 | 无公开对应 |
| [把个人持仓接入 Agent：我们怎样设计一个只读金融 MCP](https://hpoenixf.com/eff-agent-article/articles/portfolio-mcp-readonly-investment-data) | — | —<br>缺 portfolio-report、份额/现金/快照口径和方案计算 | 无公开对应 |
| [数据过期后的受控刷新](https://hpoenixf.com/eff-agent-article/articles/unavailable-is-correct) | — | —<br>缺刷新任务身份、scope/fingerprint 去重、来源拒绝与原子发布新证据 | 无公开对应 |
| [结果外置与完整性：模型到底读到了多少](https://hpoenixf.com/eff-agent-article/articles/tool-results-outside-model-context) | [v0.4](https://github.com/hpoenixf/open-etf-agent/commit/ecf6cb45b4062586614e83aed917c92d704cb63b) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `--case retrieve-reread`<br>词法候选→真实读页→精确原文回读；非完整原文覆盖平台 | verified |
| [Main 压缩：摘要不改写原始事实](https://hpoenixf.com/eff-agent-article/articles/agent-main-run-context-compaction) | [v0.5](https://github.com/hpoenixf/open-etf-agent/commit/05c0dd2dc550f4f7e5da034340ff5c3159768fcf) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `--case compact-and-reread`<br>派生便笺与原文分离、采用后回读；摘要质量未评 | verified |
| [Memory：从保存、召回到安全遗忘](https://hpoenixf.com/eff-agent-article/articles/026-agent-memory-forget-durable-effects) | [v0.5](https://github.com/hpoenixf/open-etf-agent/commit/05c0dd2dc550f4f7e5da034340ff5c3159768fcf) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `--case explicit-memory`<br>显式合成意图的保存/修订/忘记；非认证用户 Memory 服务 | verified |
| [RAG：文档撤权与历史回放](https://hpoenixf.com/eff-agent-article/articles/027-rag-revocation-publish-replay) | — | —<br>缺动态 ACL/撤权传播、发布资格与历史回放再授权 | 无公开对应 |
| [Provider：统一接口之后，为什么还需要共享准入](https://hpoenixf.com/eff-agent-article/articles/agent-provider-architecture-and-admission) | [v0.1](https://github.com/hpoenixf/open-etf-agent/commit/f9370b81beef84199293120ee23d245bb0129553) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/gateway.test.mjs` · 1.4 injected offline transport verifies request encoding and matched tool results<br>离线 transport 的 Gateway 编码与配对；无共享 Provider 准入 | verified |
| [模型返回 HTTP 200，为什么下一次还要排队](https://hpoenixf.com/eff-agent-article/articles/agent-provider-admission-capacity-lease) | — | —<br>缺跨进程队列、租约/隔离、远端 unknown/释放及 PG 控制库 | 无公开对应 |
| [Extension Host：从功能机到智能机](https://hpoenixf.com/eff-agent-article/articles/020-agent-extension-host-smartphone) | [v0.7](https://github.com/hpoenixf/open-etf-agent/commit/5f70dc0b4760ad70ef211f4823828ab2fee5c525) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/plugins.test.mjs` · 7.1 two trusted packages use the ordinary Host and acquired source/method owners<br>可信包接入同一 Host；不是隔离沙箱或完整多生态 Host | verified |
| [从接上 MCP 到真正用上工具：Agent 的接入链路怎样构建](https://hpoenixf.com/eff-agent-article/articles/mcp-host-from-discovery-to-consumption) | [v0.2](https://github.com/hpoenixf/open-etf-agent/commit/a79e89bf709d4a2245b5a8652882a591ba467519) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `--case skill-mcp`<br>真实 stdio 合成 MCP 发现、准入与取得；非金融数据服务 | verified |
| [Tool Surface：Agent 有工具，模型为什么看不到](https://hpoenixf.com/eff-agent-article/articles/agent-model-capability-presentation-tool-surface) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/cooperation-integration.test.mjs` · 3.4 fixture child shares root counters and advertises only allowed read tool<br>Child 只呈现获准读工具；非完整动态能力编排 | verified |
| [A35 内容信任：Prompt Injection 不只是恶意文本](https://hpoenixf.com/eff-agent-article/articles/agent-content-trust-prompt-injection) | [v0.4](https://github.com/hpoenixf/open-etf-agent/commit/ecf6cb45b4062586614e83aed917c92d704cb63b) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/context.test.mjs` · 4.2 projection never launders a lookalike or altered payload into an acquired ref<br>Context 拒绝伪造原文身份；非完整 A35 安全模块 | verified |
| [多生态 Hook：Claude、Pi 与 Codex](https://hpoenixf.com/eff-agent-article/articles/agent-multi-ecosystem-hook-execution) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/cooperation-integration.test.mjs` · 3.3 Host revalidates effective Hook arguments and preserves original call<br>同一 Host 复验 Hook 改参并保留原调用；无多生态转换层 | verified |
| [工具调用到模型输入的观测链](https://hpoenixf.com/eff-agent-article/articles/agent-tool-lifecycle-and-model-input) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `--case batch-read`<br>合成 worker 经现有 Runtime/Host 保存来源；非完整观测平台 | verified |
| [Run 预算与约束治理](https://hpoenixf.com/eff-agent-article/articles/agent-runtime-constraint-governance-v2) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/cooperation-integration.test.mjs` · 3.3 root budget refusal stops before a second model request<br>根预算拒绝阻止下一模型请求；非全部预算政策 | verified |
| [Agent 的请求数、Token 与 Credits 记账](https://hpoenixf.com/eff-agent-article/articles/agent-personal-credits-shadow-accounting) | — | —<br>缺账户/物理尝试身份、归因、价格目录与影子成本核算 | 无公开对应 |
| [Agent 收到控制指令后，为什么不能立刻执行](https://hpoenixf.com/eff-agent-article/articles/agent-control-events-durable-owner-adoption) | [v0.7](https://github.com/hpoenixf/open-etf-agent/commit/5f70dc0b4760ad70ef211f4823828ab2fee5c525) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/durable-runtime.test.mjs` · 7.3 cancel during pending model is durable and late proposal cannot dispatch<br>持久取消阻止迟到提案执行并跨进程保持；非完整控制事件系统 | verified |
| [定时研究：会话结束后继续](https://hpoenixf.com/eff-agent-article/articles/agent-autonomous-scheduled-research) | [v0.9](https://github.com/hpoenixf/open-etf-agent/commit/dad9c6e64f32c3d7579aea96613776b40917ec6d) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/worker-cli.test.mjs` · 9.1 submit exits before a separate work process drives and reads the original Run<br>显式 submit 与独立 work 进程沿原 Run 回读；无定时触发、Task 编排、通知或前台并发 | verified |
| [Langfuse：从 Trace 到可信观测](https://hpoenixf.com/eff-agent-article/articles/025-agent-langfuse-from-trace-to-trustworthy-observability) | — | —<br>缺 Langfuse exporter/span/session 归属与远端失败隔离 | 无公开对应 |
| [Publication：为什么需要独立发布系统](https://hpoenixf.com/eff-agent-article/articles/019-agent-answer-publication) | [v0.8](https://github.com/hpoenixf/open-etf-agent/commit/2c096ce47be2161f97531170af07ef255872f8b1) | [e1b8e4e](https://github.com/hpoenixf/open-etf-agent/commit/e1b8e4edde724548fab16d8ca4b205379bfa7f30) + `test/publication-cli.test.mjs` · 8.2 local CLI starts same Runtime and separately reads body, current event and immutable Artifact<br>同一 Runtime 提交正文并经独立 CLI 回读，与报告 Artifact 分离；不含 Web / SSE / Worker 或完整发布系统 | verified |
| [渐进式回答如何保持连贯](https://hpoenixf.com/eff-agent-article/articles/agent-progressive-answer-coherence) | — | —<br>缺 committed blocks/revision、前端渐进展示和历史一致性 | 无公开对应 |
| [异步研究：离开页面后怎样按时交付](https://hpoenixf.com/eff-agent-article/articles/agent-asynchronous-research-time-bound-delivery) | — | —<br>缺离开后持续任务、by/at 交付约定、通知和同 Run 恢复 | 无公开对应 |
| [Agent 问完用户之后：持久人机交互](https://hpoenixf.com/eff-agent-article/articles/agent-durable-human-interaction-response-adoption) | — | —<br>缺 request/response/adoption/effect 身份、Human Park/Continue 与认证用户回复 | 无公开对应 |
<!-- article-coverage:end -->

```sh
# 默认快速检查：真实 Git commit / 公开元数据 + 源码与既有实跑回执一致性；不重跑 case
node scripts/check-article-coverage.mjs
# 显式有界复跑：仅现有 CLI 和精确 node:test，去重；不允许 live 或任意 shell 命令
node scripts/check-article-coverage.mjs --smoke
# 清单修改后更新表；render 本身不给 verified 资格
node scripts/check-article-coverage.mjs --render
```

`since` 的历史 commit/tree/原文件 blob 也会核对；例如 MCP 始于 v0.2，Result/Context 始于 v0.4，Compaction 始于 v0.5，不能把相邻模块或后续验证提交写成首次引入。`verifiedAt` 固定提交是本次可复现的验证锚点；当前 `main` 的相关源码、fixtures、锁文件及原测试必须仍与 [冻结输入](verification/article-coverage-source.json)逐字节匹配。两者相同才复用同一实际执行；源码、case 或校验器变更会使 [回执](verification/article-coverage-receipts.json)失效，须重新冻结和实跑，不能只改链接维持绿灯。历史锚点不是“永远最新 main”的别名。`--check` 检查已有实跑证据，**不声称这台机器刚执行了 case**；没有本地 Git 对象时只尝试公共 GitHub 元数据，离线或失败不会假 pass。`--smoke` 需要 quickstart 的已安装依赖与 Node 范围，最多 16 个去重目标、每个 30 秒、总计 120 秒；仅原创合成数据，不继承模型凭据或任意 Node 预加载；子进程及嵌套 Node 使用固定 512 MiB heap，`TMPDIR` 指向本次自有输出目录，输出留在 `test-output/`，safe 回执只存身份与执行/产物摘要，不发布数据库或原始日志。

多篇文章若共用 target，则共享同一次最小机制执行证据，不增加实现数量。上述 Gateway 测试的离线 transport、脚本 Child 和 fixture MCP 都不是新真实模型调用。证据是可复核执行记录而非防伪签名；当前运行仍只有 Runtime 验收，`semanticStatus: unreviewed` 不变。

从零开始可先读 [v0.1：从第一份可回读报告开始](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v01-first-readable-report?lang=zh)（[完整英文版](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v01-first-readable-report?lang=en)）。更多内容见[文章阅读站](https://hpoenixf.com/eff-agent-article/)。

