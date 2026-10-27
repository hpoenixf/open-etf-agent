# 从 v0.8 到 v2.0：CLI 优先，一次做好一个模块

> **状态：planned。** 以下是可裁剪的候选顺序，不是已实现清单、发布日期或正式 Release 承诺。实际覆盖以 README 现状表及其引用的统一能力清单为准，本页不另维护一份覆盖表。

## 方向：从已有实践提炼，先完成最小闭环

Open ETF Agent 延续 ETF Agent 已形成的模块职责、实现经验与文章动因：先找原模块和合同，再提取可以独立运行的最小能力。不是另写一套同名系统，再给它配上一篇文章。

- **一个功能版本，一个主模块。** 可以接通既有消费者，但不借“集成”再增加一组 Owner。Owner 指负责该事实的模块，不意味着新服务或 Manager。
- **CLI 优先，API 按消费者需要增加。** 先用真实文件和独立进程完成闭环，再增加必要 HTTP/SSE 读取适配。浏览器界面不作前置条件，单独取得资格；API 通过不等于界面通过。
- **先复用，后加依赖。** 优先现有代码、Node 标准能力、SQLite 和已采用的 SDK。通用底座可用成熟轻量开源替代；具体选择时核对官方 API、许可证和维护状况，不为小需求引入整套平台。
- **只简化部署，不删核心合同。** 身份、授权、预算、来源、局部失败和未知结果不能随之丢失。模型负责语义判断，Runtime 负责合法执行与真实效果。

[原路线][original-roadmap]中的 Publication、Web、PDF、隔离 Python、合成 ETF、后台执行，应按模块独立完成和验收；可以继续使用 0.10、0.11 等版本，不为一个编号打包交付。既有或已规划的 Decimal、单位、币种、数据截止日与 CSV，不重复算作 1.x 新功能。

## 2026-10-27 调整：先走完当前单模块闭环

已交付的 [v0.8 固定代码][v08] 只包含 Publication：稳定块/投递序号、显式修订 CAS、原回执与 CLI 读取。没有顺带交付 Worker 或 Web。后续路线继续到 2.0，但每一步都先审原 Owner 与失败合同，再写 Spec、实现和必要验证；下列命令意图不是当前可运行命令。

| 候选阶段 | 唯一主模块与最小 CLI 交付 | 明确不含 |
| --- | --- | --- |
| **0.9** | **单 Run Worker。** 提交一个有界合成任务，提交进程退出，另一进程以原 Session lease/fence 驱动同一 Runtime；CLI 读回原结果。 | 不建 Task/队列状态机、Scheduler、常驻服务；同 generator 的 background 不是独立 Worker，也不声称前台短问并发。 |
| **0.10** | **只读交付适配。** 显式选定 Run，读取原 Publication/Artifact；需要网络消费者时再加最小 loopback HTTP。 | 不加执行写接口、全局 History、前端或通用事件总线；SSE 只有实际消费者与重放合同明确时才纳入。 |
| **后续单独一期** | **PDF 输入。** CLI 读一份许可明确的本地合成 PDF，原页/选区能被现有证据引用并回读。 | 不带 OCR 平台、爬虫或 Web。 |
| **后续单独一期** | **受控 Python 计算。** CLI 让一个已限定输入的计算得到可回读结果，真实隔离/超时/停止边界单独验收。 | 不把普通子进程称为沙箱，不增权限或为它引入整个平台；环境不具备就延期。 |
| **可选，后置** | **Web 读取界面。** 只消费已合格接口；有真实浏览器条件时再单独验收。 | 不成为 CLI 的 1.0/2.0 前置门；既有未验 WIP 不自动晋级。 |

0.11、0.12 等编号在各自范围确认时再定，不为填满版本号强塞模块。合成 ETF 继续作为已有工具链的示例输入；只有出现独立 Owner 合同才另立一期，不为重复展示再造模块。v0.9 当前仅有 [Spec 草稿](../../openspec/changes/v09-single-run-worker/proposal.md)，不是已实现能力。

## 1.x → 2.0 候选顺序

| 阶段 | 唯一模块与最小可跑结果 | 本期不做 |
| --- | --- | --- |
| **1.0** | **资格里程碑，无新增模块。** 已声明配置能独立安装；CLI/API 创建研究，读回报告和文件。 | 不赶齐全部候选，不建复杂兼容层。 |
| **1.1** | **结果消费与引用接入。** 一份合成计算结果进入下一次实际模型请求；报告数字、原输入与 CSV 可以相互核对。 | 不重做 Decimal/公式库，不加金融 Reviewer。 |
| **1.2** | **时间解释。** 给定任务锚点和可信时区，跨午夜、夏令时与重启后，原任务日期不漂移；当前时间和数据时点另列。 | 不加 Scheduler，不猜市场交易日，不抓取全市场日历。 |
| **1.3** | **Memory 按需召回。** 查询显式库，只将当前获准 revision 送入模型；更正、遗忘后旧命中不能复活，临时模式不访问跨会话 Memory。 | 不重做保存/遗忘，不自动学习，不加向量服务或普通 TTL 淘汰显式约束。 |
| **1.4** | **持久普通回复。** 一个问题经 CLI/API 接收原始回复；重启、重复提交后，原非终态 Run 在合法时限内留下实际采用回执。 | 不加浏览器待办、通用审批、独立 Correction 或长时间 Human Park。 |
| **1.5** | **单个串行专业 Child。** 一个内置资料核对专长，拥有独立上下文和模型请求，交回原结果供 Main 回读与综合。 | 不加个人 Profile 产品、并行专家、递归网络或 Reviewer。 |
| **1.6** | **小库撤权 RAG。** 少量本地文档可检索；生成后撤权时，首次发布、历史 API 与附件读取都检查当前资格。 | 不治理 Memory，不加企业 ACL/向量平台，不承诺收回已送达字节。 |
| **1.7** | **固定路线共享 Admission。** 两个本机进程竞争一个容量组；完整结束、取消和远端未知占用分别可解释。 | 不含 Routing、Failover、多组策略、计费或观测平台。 |
| **1.8** | **一次性 Schedule。** 显式确认一个时点，重启后沿同一触发身份创建原 Run，报告可读回。 | 不加周期/条件监控、刷新、通知或第二套后台执行器。 |
| **2.0** | **所选模块的稳定里程碑，无新增模块。** 安装、停用、必要升级和产物读回与支持声明一致。 | 不为 2.0 赶齐上表，不自动宣称生产就绪。 |

顺序按依赖成本排列：先复用本地底座，再做持久交互，最后考虑跨进程协调与调度；不要求逐项实现。

**关键依赖保持少：** 1.5 复用 1.1 的结果身份，首期 Main 等 Child 结算后再发模型请求，不以前置共享 Admission 为条件；1.6 需要既有 Publication；1.8 需要时间解释、受管执行入口及相应容量资格。某前置不存在，就延期该模块，不在同版补建整个平台。

## 1.1 先做什么，做到哪里就停

用一个原创合成 ETF 费用或暴露比较作为输入，复用已有确定性计算器：

1. **保留来路：** 原 ResultRef、实际选区、计算输入与派生结果关联起来，不另建金融账本。
2. **证明消费：** 检查下一次真实 Gateway 输入带着同一结果、单位、截止日与限制，而不只检查工具说“计算成功”。
3. **完成交付：** 报告中的结构化数字引用和 CSV 指向同一结果；进程退出后经 HTTP 读回原字节。

验证尾部关键行遗漏、混币种/不同截止日、分母未知三个反例。坏附件不抹掉独立合法正文；确定性数值核对不认证自由文字的投资论证。

**成功链与关键反例跑通即停。** 如果隔离 Python 尚未独立合格，就先用已有 JavaScript 计算路径，不让本版本再承担一个工作台。

## 模块与文章：沿同一条设计来源演进

下列文章解释原模块为什么形成。公开提炼保留其核心合同，删去本期不需要的配置与平台依赖；不把原系统的验证记录当成本仓库资格。

| 原模块 | 提炼时保留什么 | 对应文章 |
| --- | --- | --- |
| Publication | 稳定块与投递位不随修订改变；提交后失败不抹正文。 | [正文发布的提交边界][publication] |
| ScheduledTaskWorker 的单 Run 切片 | claim / lease / cancel → 同一 Runtime → 原持久事实结算；不照搬 Schedule/Task 平台。 | [定时研究中的有限 Run 与恢复][schedule]；[background 与并发的区别][async-delivery] |
| Result / Reference | 原结果、选区、派生与实际消费分开；来源可回读。 | [计算结果如何进入报告][result] |
| Temporal | 原任务时间不被恢复时的“现在”覆盖。 | [Agent 说“今天”时，到底是哪一天][time] |
| Memory | 命中不等于当前有效或已经采用；更正/遗忘具有持续效果。 | [Memory 的完整生命周期][memory] |
| Human Interaction | 接收回复、原消费者采用、业务效果是不同事实。 | [持久人机交互][human] |
| Child | 共享执行底座和根约束，但不共享一团上下文。 | [从隔离到专业化协作][child] |
| Knowledge / RAG | 检索时允许，不代表首次发布及以后读取仍允许。 | [文档撤权与历史回放][rag] |
| Provider Admission | Run 预算与 Provider 容量分开；HTTP 200 不证明远端已结束。 | [容量准入的租约与未知占用][admission] |
| Schedule | 已确认定义、触发机会、Run 与报告各留真实身份。 | [定时研究：会话结束后继续][schedule] |

RAG先用小规模词法检索；Admission和Schedule复用既有存储与执行入口。**库可以提供解析、索引、事务或唤醒，却不能替代来源资格、授权、unknown 和幂等合同。**

每期完成后，在原文章相关论点旁补一个固定代码版本、一条可跑案例和一个失败反例，保留历史背景与未覆盖范围。目标是文章中的机制能够由公开代码解释和复现，不是全文功能对齐。

## 风险、裁剪与验收

**最大风险是把共享准入做成控制平台。** 1.7 只允许一个容量组、两个调用进程和有界队列；未知占用保留原身份，不自动释放、重试或换路。没有真实竞争需求，就整期延后。后续是否加入 Provider 目录、Failover、个人 Profile、Human Park、受控刷新或外部观测出口，分别评估，不捆进已有版本。

RAG的难点是撤权与披露提交顺序，不是先搭向量库。先用真实连接、进程和 HTTP/SSE 字节验证；必要时拒绝整个受保护候选，不增加语义分类器来签发权限。

每个模块完成前，只回答四个问题：

- 输入是否经过真实运行入口，结果能否从 CLI/API 取得？
- 最终消费者是否采用原身份与限制，而非只生成了一个中间对象？
- 取消、重复、重启、局部失败和 unknown 是否在本期范围内可解释？
- 旧的重复入口是否移除，独立合法成果是否仍能读取？

验收聚焦 **Runtime 正确性**；语义状态可保持 `unreviewed`，不另设模型评分门。宣称真实独立模型路径时，仍须有该路径的实际调用证据，不能以 scripted fixture 代替。

历史支持保持窄：固定快照独立可跑、已交付产物可读、必要相邻数据升级保留原备份；失败或未知状态不破坏旧库。旧活跃 Run 默认不跨版恢复。不扩展多租户、交易执行、不可信插件安装、集群容灾或普遍 exactly-once。

原始规划及边界见[原路线][original-roadmap]与[能力矩阵][original-matrix]；不从版本号反推完成状态。

[result]: https://hpoenixf.com/eff-agent-article/articles/financial-agent-python-result-consumption
[publication]: https://hpoenixf.com/eff-agent-article/articles/019-agent-answer-publication
[async-delivery]: https://hpoenixf.com/eff-agent-article/articles/agent-asynchronous-research-time-bound-delivery
[v08]: https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1
[time]: https://hpoenixf.com/eff-agent-article/articles/agent-temporal-semantics-market-calendar
[memory]: https://hpoenixf.com/eff-agent-article/articles/026-agent-memory-forget-durable-effects
[human]: https://hpoenixf.com/eff-agent-article/articles/agent-durable-human-interaction-response-adoption
[child]: https://hpoenixf.com/eff-agent-article/articles/agent-subagent-context-specialization
[rag]: https://hpoenixf.com/eff-agent-article/articles/027-rag-revocation-publish-replay
[admission]: https://hpoenixf.com/eff-agent-article/articles/agent-provider-admission-capacity-lease
[schedule]: https://hpoenixf.com/eff-agent-article/articles/agent-autonomous-scheduled-research
[original-roadmap]: https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/02-roadmap-research.md
[original-matrix]: https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/05-coverage-matrix.md

