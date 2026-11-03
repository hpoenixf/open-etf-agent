# 组合契约（v0.19 候选）

本页记录候选 API 的真实边界；[资格记录](verification/v019-release.zh-CN.md)分别列明固定真实批次、免费验证及尚未发布状态。CLI 中的固定场景仍是明确的示例，不能凭示例成功宣称任意模块排列均已支持。

## 输入归 Host，执行归原 Owner

通过 `run`/`submitRun` 的 `documentCatalog` 提供有界文档，不必修改 fixture。`document-catalog@1` 包含目录 ID 和各文档的 ID、名称、版本及页面文本。原 Source 校验并冻结全部内容，选中文档决定工具 schema；持久配置绑定整个目录摘要。恢复时更换页面必须拒绝，不能悄悄改用新文档。

继续使用原 Session、Worker、RootBudget、Result、Artifact、Publication 和 Reader。工具结果不是权限，普通回答不能新增工具。Child 只继承父 Run 已授权范围及共享预算；已派发但未知的操作不得重放或退款。

## 可组合接缝与前置条件

- 自定义文档、Result、计算、CSV/报告：使用原始已获取引用。结构化比较表仍须满足原数据契约，不伪造金融数据适配器。
- Worker、Memory 与 Context：绑定原只读 Memory 库和 working input；本版不新增完整记忆生命周期或自动写权限。
- Memory 写效果：沿原持久适配器和一次性明确 intent；回答、检索文本均不能创建授权。
- 可信插件/Hook 与 Worker：提交只检查描述和源码身份，原 Run 配置通过后才激活。终态读回不重新激活；可信代码不等于沙箱。
- Skill/MCP：`prepareSkillMcpExtensions` 接受显式目录和可信连接器，`connectTrustedMcp` 接受 Host 提供的 SDK transport。本接口支持有界 read_page 协议，不代表任意 MCP 工具或新的网络/进程权限。
- Child、自定义来源与 Admission：使用版本化 source-check 绑定、实际 Child Run、同 Session/root/容量组；保留单层 Child、父 fence 和原 root ordinal，不得把父票当 Child 票。
- 受管压缩与 Admission：持久 `workingInput.compaction.mode = 'gateway'`，仍需原 note/reread 工具和预算。摘要使用同 Gateway、独立封存消息及 root ordinal；摘要未知时停止 Main，不自动释放占用或继续派发。
- 普通 Response、Worker 与 Publication：schema3 Session 配合显式 ordinary-response version2；沿原问题、response ID、期限及 adoption fence。旧 version1 保持 fixture-only。
- PDF、Worker 与 Publication：先 `preparePdfSnapshot`，初次和恢复均提供 `pdfInput: {snapshot}`。Host 必须保留原 PDF 字节和解析页面，只有摘要不能恢复；不声称 OCR 或不可信代码隔离。
- Schedule、自定义来源、只读 Memory、PDF、可信插件与受管摘要：原 schema5 Session 加 `schedule-composition@1`。明确确认、时间和 wake，仍交原 Worker，不产生后台 cron 服务。
- TaskTime：沿原明确时间锚和时区契约，运行时钟不能替换来源数据日期。

这是契约清单。离线测试、真实模型成绩和发布状态分别核验。

## 尚未支持与历史兼容

Response schema3 和 Schedule schema5 是不同持久协议，目前没有合并其等待/调度生命周期。Schedule 新适配器通过原确认 definition/Worker 绑定 prepared PDF、可信插件和 gateway 受管压缩；直接未绑定 Hook 与任意 inline extension 仍拒绝，只读 Memory 显式准入。普通 Response 仍需不同持久等待协议，不能静默忽略。这些是明确的组合缺口，不宣称已经完全自由排列。

Child 仍为单层，不是嵌套 Worker；受保护文档、普通 Response 及 Child 独立发布根保留原限制。旧 `document-revocation@1`/schema4 Atlas 演示继续可复现并单独保留。新通用路径保持原 Run grant/目录和内容身份，不新造动态同 Run ACL 检查；新 Run 独立准入，也不删除旧演示自身的撤权检查。

旧 Host/adapter 不隐式迁移，新合同使用显式版本。旧 Reader 可以拒绝无法解释的新合同，历史不可变产物保留原含义。旧 path 型 PDF 仍不支持持久恢复；新快照在准入前用原解析器处理一次，恢复读取原字节/页面，不重新读取路径。未知工具效果仍不重放。

## 验收与费用

真实计划必须冻结源码、输入、机制预期和预算。v0.19 最多100场景，包含失败、超时、未知及修复重测，这是上限而非凑数目标。Main、Child、摘要的每次物理调用继续使用共享总额度。不能换掉失败样本改善分母；权限、预算等拒绝优先免费验证；场景额度不授权额外计费。

## 有界的托管摘要复用

托管压缩采用显式的 `gateway-history-compaction@2` 定义。`maxSummaryRounds` 随原 Run 绑定，允许 1–24 的整数，默认 6。每次尝试摘要都消耗原 RootBudget 预约，失败、取消和未知结果不退还。达到本地上限后不再预约摘要，使用已核验投影或原有界上下文回退；主任务仍须自行给出最终回答。

持久化的 `compaction-frontier@1` 指向不可变派生笔记及其原始消息前缀。复用时核对笔记内容地址、被覆盖的原调用组、来源身份和当前 Memory 依赖。重复读取同一证据本身不会触发新的付费摘要。新增尾部及有副作用的调用组保持原样，笔记不成为原始证据或授权。依赖改变后旧笔记不能继续复用。

新的持久定义有意区别于早期实验性 `gateway-history-compaction@1`。不静默迁移已有 Run，不把旧源的资格当作新实现的资格；旧读者会拒绝新的定义字段。此前中断、未知票据及测评结果继续作为历史证据保留，不变成可重新使用的容量。

## 可运行的原合同检查

```sh
node --test test/document-catalog.test.mjs test/worker-composition.test.mjs test/response-composition.test.mjs test/pdf-composition.test.mjs
node --test test/admission-composition.test.mjs test/additional-compositions.test.mjs test/managed-compaction-frontier.test.mjs
```

这些命令使用合成数据与本地协议/进程，不调用付费模型；完整真实测评的固定输入与结果另见资格记录。Response+Schedule、任意MCP协议、Python隔离和生产金融数据接入均不由这些检查证明。
