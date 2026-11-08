# 重建 v0.25：新十题 once Scheduled tasks 计划

**计划正文已冻结；仅离线计划，未执行、未预约，不是 exact GO。** 旧题正文已丢失，本文件定义新题，不恢复/重放旧题、不继承旧成绩。AUTHORITY-DRAFT 保持不变。

## 精简范围与原契约

10 个独立场景，全部 `report + schedule + task-time`；不加入 knowledge、response、child、插件、Memory 写入或隔离 Python。真实模型仅读取本 JSON 的合成材料，并通过原 `read_page`、`save_report` 保存报告。无需为了凑调用数增加工具。每题上限 8 或 10 次，合计 84；拟整体预算仍最多 108，剩余 24 不是探测、重试或自动调额许可。第 5 题两个真实任务各最多 5 次，场景合计 10；第 10 题停止前后共享最多 10 次，不能重置计数。

原 host API：`confirmScheduledTask(confirmOnce:true)`、`inspectScheduledTask`、`listScheduledTasks`、`cancelScheduledTask`、`runDueScheduledTasks`；后者仅 serial bounded sweep，不是守护进程，也不保证实时唤醒。`workResearchTask` 是第 10 题显式续行接缝。live 不允许 gateway override，必须使用原 createChatGateway 路径；测试控制经 resolveControls 传入既有 fetchImpl/onCheckpoint/hostSignal，不修改模型回答或替代产品调度。

确认必须先于 scheduledInstant；实际执行满足 `due <= now < due+maxLatenessMs`，lateness 小于 timeout。每题使用真实未来时间和串行窗口，不修改机器时钟，不把等待题写成已完成。精确 UTC 时间在新批实例化时保存；原 JSON 是模板，不是可直接执行的最终冻结 manifest。第 7 题需独立短过期窗口与后续幸存窗口。第 5 题列表按 task ID 排序，不声称时间优先队列。两任务同一事先冻结 due，保持 maxLatenessMs=60 秒、timeoutMs=180 秒，不人为放大服务超时。第一 sweep 返回后只保证 b 尚未 materialize/零请求；inspect 的 confirmed 不保证此刻仍在窗口内。第二 sweep 若窗口已过，原 missed 是合法调度/时延边界，不是 runtime 缺陷。保留实际时序，不无证据归因服务商；两份报告的最终交付仍记未完成，不自动合格。不得运行后延长窗口、换题或重试凑报告。

## 十题与报告

1. 到期一次执行。2. 提前 sweep 零派发后正常完成。3. 完成后重复/冷 wake 零派发。4. confirmed 冷打开后到期完成。5. limit=1 留住第二任务；仍在窗口时分别完成两个报告，否则如实保留第二任务合法 missed 和最终任务未完成。6. 已取消旁支零派发，幸存任务交报告。7. 已过期旁支 missed 零派发，幸存任务交报告。8. Asia/Shanghai 固定 task-time，与其余 UTC 场景分列；不要求两个时区必然不同日期。9. 原报告及 source 的冷 HTTP 字节回读。10. 安全 checkpoint 协作停止、冷 sweep 不续跑、原 explicit work 继续完成。

每题读取两个原合成页，保存真实 sourceId 引用报告。取消/过期旁支不伪造报告，其幸存主任务才承担报告交付；第 5 题需两份，整套预期 11 份原报告。来源文本、问题、预期事实和 host 观察在 CASES-DRAFT.safe.json；源名只是合成数据，不是指令。

## 安全停止接缝

第 10 题仅在原 `result-consumed` checkpoint，独立读取原 durable snapshot：cursor 已递增，须核 cursor≥1、原 run/fence、最后消息 role=tool，其 callId 与 `snapshot.proposal.calls[cursor-1].id` 匹配且该调用 name 为 `read_page`、结果 succeeded。callback.callId 指向下一条或 undefined，禁止据此识别刚消费工具。完整 provider 响应与票据均已落定且无在途模型请求后，一次性 abort hostSignal。绝不在 model-reserved、HTTP 在途或 unknown 状态故意切断。此接缝须先用原产品离线证明多调用 proposal（callback.callId 为下一条）及末条调用（callback.callId 为 undefined）两分支的持久化读取/匹配、票据落定顺序、原 owner 真实收口和 explicit work 可继续；不能仅凭代码阅读宣布可安全运行。若模型未读取 source 或没有安全 checkpoint，不临时换中断点，不强杀；本题记录未完成或未覆盖。若意外 unknown，保留并停止，不执行续行来重放。

## 三轴与证据

- Runtime 合同：模型未选择 read_page/save_report、未完成报告，属于模型选择/最终任务不完整，不能自动判 runtime 失败。仅在已接受证据、成功持久化回执对应字节丢失/变更或原调度身份/派发规则被违反时据 trace 判合同失败；没有报告时冷报告读回分支为未评估。RB25-01/05/06/10 的报告交付已移至 finalTaskAssertions，模型选择另列 modelExpectations。固定身份、零派发分支、原 lease/occurrence、bounded sweep、冷存储及字节一致性。沿用已定 runtime ≥9/10 门槛，不新增发布标准。每题 pass/fail/unassessed，未观测不当通过；provider 中断不是自动 runtime 缺陷。
- 模型语义：逐条核真实报告与引用页，保留误引、无依据加强、日期错误、缺项；不能因机械通过称内容全对，也不能把 runtime 未承诺的内容质量判为实现故障。
- 最终任务：报告是否实际持久化并 source-backed，必要观察是否完成。独立列出完成/不完整/语义不合格，不用 runtime 分数掩盖。

保存新 source manifest/产品闭包、确认 reference/hash、实际 scheduleRunId、每次 wake 的前后状态/请求计数、原 request/ticket/body 哈希及完整响应费用证据、报告 receipt/revision/artifact/source 字节、冷 HTTP 原 body hash、原 owner 终态。原 body 留授权私有证据，不默认发布。HTTP 使用 `startReader` 绑定127.0.0.1，取 `/artifacts/<reportId>`，不是 UI 文本或重新渲染结果。

本计划只读检查原模块及测试，精确输入 SHA 在 JSON。尚待 runner 实现、纯离线全十题控制验证、exact source/plan 独审与账户/服务/预算/窗口准入；不能据此调用模型。服务拒绝、限额、费用异常或 unknown 按原规则停，不换路、不自动重跑凑分。

## 冻结交接

本轮计划修订止于合法过期归因澄清，保持既定窗口及 84 次场景上限。后续 runner 实施和 exact 冻结由唯一 owner 负责；计划冻结不代表执行或独审 GO。
