# Design — 原调用的普通回复接缝（冻结合同）

## 1. 单一事实权威
沿现有 Session SQLite 事务，不新建 ResponseManager、消息队列或第二数据库。一个普通回复记录隶属原 rootId/runId/callId，问题身份由 Runtime 生成并持久绑定，不由回复文本选目标。CLI必须显式给出session/run/question/response ID；不以“当前会话”猜消费者。

首期每Run最多一个问题、一个被接纳的回复；超出有界拒绝，不开通用多轮工作流。question text 和 response text 各限制 UTF-8 8000 bytes，非空，禁止额外授权字段。固定schema、有界ID、hash与UTF-8检查。响应文本作为普通不可信数据保留；不承诺敏感信息分类器或自动脱敏。

事实分为：
- question：原调用身份、固定问题原文/hash、Run/root、创建时刻及原deadline、合同版本；
- received：稳定responseId、原文字节hash/原文、receivedAt、question身份；
- adopted：原消费者callId、采用receipt身份/hash、采用checkpoint的可核验绑定、adoptedAt；
- effect：仍只来自原Host/Artifact/Publication等Owner的实际回执，received/adopted不得制造effect成功。

不在普通日志输出问题/回复正文；显式本地question/response读取可以展示原文。历史保留不表示继续有效。

## 2. Runtime接缝：保留assistant-call/tool-result配对
新显式profile暴露一个原生 `ask_response` 工具，参数只有question文本；仅接受一个单独调用的proposal，和其他calls混批拒绝。它不是任意extension、hook或模型提供的授权。

在原proposal-sealed边界验证调用后，Session一次事务：核对当前lease/fence、Run/root仍active且未过deadline、tool预算；消费恰好一次tool单位、持久问题及原调用、checkpoint到精确 `awaiting-response` phase。该事务失败不声称问题已登记；提交后断线从原身份读回，不重扣预算。不是先落 `tool-dispatched` 再赌外部重放。

Run此时仍active。恢复时，claim成功后必须经该claim重新读取权威Run/checkpoint并完整校验，再决定分支；claim前inspect只用于准入预检，不能成为执行state。question/adoption事务均重读当前持久phase/proposal/cursor/call及已有question/receipt，要求与拟推进的原调用精确一致，拒绝旧snapshot回写。不能因取得新fence就把旧观察状态写回。

Runtime正常退出本次驱动并释放lease，不调用finish、不伪造failed/terminal，也不启动后台轮询。返回明确 `awaiting-response` 状态（驱动观察值，非第二持久生命周期），问题ID及deadline。计时继续；用户以原resume入口显式继续。无回复的resume读回同一等待状态，不请求模型、不重复工具预留。

回复入口只做receipt事务，无执行lease、不触发模型；事务重读原问题/Run/root/deadline，不修改run snapshot。当前执行lease存在不赋予CLI写checkpoint的能力。

有receipt的resume：原Run取得正常lease/fence；一个Session事务复核问题/receipt/hash/原调用、active/deadline并将adoption事实与 `result-committed` checkpoint同时落库。结果绑定原callId和原receipt，不添加任意新的user消息，不重扣tool预算。随后既有 `result-consumed` 配对路径推进cursor，再构建正常working input；下一model reservation照常消耗原root额度。

`tools.mjs` 的结果校验只接受从Session读回且身份完整的ordinary-response结果，不相信模型伪造kind/receipt。Runtime checkpoint验证对新phase、原proposal、usedIds、cursor及未完成配对加精确约束；不把任意phase或任意message角色放行。

## 3. 重启与unknown
- question事务前中断：没有已登记问题；按原已封存proposal继续。
- question事务后、yield回执前中断：新进程读同一问题，不产生新问题/新预算消费。
- receipt事务后客户端丢回执：同responseId与同目标/hash读回原receipt。
- adoption事务前中断：received但未adopted。
- adoption事务提交后消费前中断：按原result-committed恢复，读同一采用结果；不重采用、不拼接两份回复。
- 后续model-reserved中断仍是MODEL_OUTCOME_UNKNOWN，不因有回复自动重发；原工具unknown也不被此模块解决。

## 4. 重复、迟到、终态与取消
同responseId且相同目标/内容的重试只读回原receipt，哪怕此后Run终态或过期；不得再产生新采用。相同ID不同目标/内容为冲突；不同ID针对已有回复的问题为已回答冲突，不静默覆盖。首次提交晚于原deadline、已取消/终态、未知问题或错Run均拒绝，无新receipt。

receipt接纳后、采用前Run终态/取消/过期：保留receipt并读回 `received-not-adopted` 与安全原因，不复活Run、不自动Continue。取消/采用以同库事务顺序解释：取消先提交则不得采用；采用先提交可保留adopted事实，但采用不等于下一派发准入或effect成功。取消与原model/tool reservation的提交顺序是准入线性化点：取消先提交，则reservation必须拒绝且不得调用；reservation先提交，则该调用已admitted，随后取消按原stop/unknown处理。跨进程取消在reservation到gateway.next/实际调用之间可能尚未传至内存signal，不能承诺取消提交后绝无物理派发或瞬时撤销。已admitted调用不能自动重试、补成功或抹去预算/unknown。超时恢复只能按既有deadline规则结算，不能新建等待时限。

## 5. 权限、Memory、Temporal不变
回复中的“忽略限制”“记住”“延长时间”“执行交易”等只作为文本；不能生成trusted Memory intent、改变allowedTools/documents、grant、adapter binding、root budget或deadline。显式Memory仍由原working-input projection检查current revision；普通回复不作为Memory写入。本首期不组合Memory/Child/plugin的新profile；已有profile行为不变。

原taskTime锚点/时区仍固定；receivedAt/adoptedAt独立于任务时间，不取代task anchor。普通回复使用原context byte限制，过大上下文明确失败而非去掉原始限制。

## 6. 精确存储边界（精确版本边界）
源码目前 `SCHEMA_VERSION=2`，四个精确表：roots/runs/publication_versions/publication_events。不是早期“两表”。建议新ordinary-response profile采用精确v3结构，增加一个有界表（question/receipt/adoption同一行），不用额外DB或将正文混入普通日志。

默认旧profile继续新建/使用精确v2；显式ordinary-response新Session才创建v3。admission只接受枚举的完整DDL与对应版本，未知表/触发器/索引/任意schema继续拒绝。DDL通过后仍须以存储profile隔离语义validator：v2拒绝ordinary-response config/binding、awaiting-response phase、ordinary-response result及question/receipt/adoption事实；v3只接受显式ordinary-response新profile及其精确config/phase/result/facts组合。不得共享一个对v2也放行新phase/result的宽松validator。新profile与原call配对、身份/hash、事务状态必须一致；仅伪造schemaVersion或adapter名称不能获得支持；热journal修复必须先在隔离副本对同一精确profile完成校验，原防外部引用/有界I/O规则不变。

不做v2→v3原地迁移；旧活跃Run在原固定版本完成，不跨版resume。本版既有v2终态Artifact/Publication读回需回归；若保留v2执行兼容，必须限定原profile并独立验证，不能宣称历史活跃Run普遍可迁移。v3用旧版打开必须明确拒绝，旧库字节不变。若这两个精确profile的维护代价过高，先经设计评审收窄支持声明，不能用宽松schema匹配省事。

## 7. 已评审的设计决定
A. 已接受tool call/result接缝、一个问题、yield+原resume，不新增Gateway proposal类型。
B. 已接受精确v2/v3并存、ordinary-response仅新Session，不自动迁移；包含第6节语义validator隔离。
C. 已接受首期合成provider-free profile，CLI实际原回复文本可输入；只认证Runtime，不声称真实模型理解。
A/B/C 与三项独立审阅修订均已纳入冻结合同。具体 DDL、字段与接口见 [spec.md](spec.md)，实际验证见 [evidence.md](evidence.md)；实现与后续修改不得放宽上述事务与权限语义。
