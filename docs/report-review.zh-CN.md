# 显式报告复核

v0.28 在 v0.26 Web 原始材料与 v0.27 专家综合之后，增加独立的已出报告复核：冻结原报告及来源文本，显式发起一次模型复核，保留原答复与执行状态，支持冷读和取消。复核只有建议权，不修复、不发布，也不把模型意见变成原始证据。

**当前边界：整个请求 JSON 最多 48,000 UTF-8 字节，包含报告、来源和元数据。** 嵌套编码后的 question 还须不超过 60,000 字节，以符合原 Session definition 65,536 字节边界；复用 host-results@3、131,072 字节 context 与 Gateway 实际编码容量检查。超限直接拒绝，不截断。仅支持普通 Markdown Artifact revision；受保护文档必须拒绝，不能用文件路径绕过权限。附件只在准备时校验身份，不进行二进制或财务计算复核。Web 静态文本不代表视觉或动态页面检查。

```sh
node src/report-review-cli.mjs prepare --session output/review --source output/original-run --revision revision:sha256:HASH --request review-001
node src/report-review-cli.mjs run --session output/review --run review-review-001
node src/report-review-cli.mjs read --session output/review --run review-review-001
node src/report-review-cli.mjs cancel --session output/review --run review-review-001
```

prepare 读取并验证原 Artifact 后提交，不调用模型。默认 run 是零外部调用的合成生命周期演示，明确说明没有做语义复核；空 findings 不是质量通过。重复读取或执行终态不会再派发。取消不等于服务商已停止；unknown 原记录与额度不被自动释放或重试。

真实调用可通过 API 或 prepare/run 的 `--gateway-module` 接入原 Gateway、shared Admission 与既有预算 Owner。模块导出 gatewayBinding 和 createGateway({session, directory, runId})，工厂返回 {gateway, close}。它是可信、可执行的 Host 配置，不是沙箱，不能来自模型。read/cancel 不加载模块。shared Admission 只控制并发，不代替成本账本；调用方必须核验服务商、数据共享与总预算授权。完整合同参见 [英文文档](report-review.md)。

输出分别保留材料支持与实际引用对应关系、原文 UTF-16 坐标、来源摘录和未检查范围。机械校验只能证明字节与位置一致，不能证明结论正确。自洽 packet hash 不认证原发布者或原 Run。无效结果保留原答复但不放出有效 findings；failed、cancelled、unknown 不冒充完成。

已提供十题合成语义输入草案（seed），尚未冻结真实执行计划、Gateway配置、任务身份或预算reservation。R09把A/B写在同一文本中，未构造两份独立来源与精确引用映射，不能宣称覆盖引用对应关系；后续live harness必须补齐。离线脚本只验证真实 Runtime/Session/Gateway/Artifact 链路与结构。**真实模型语义验收未运行：完整累计预算账本不可用。** 不以脚本预期标签宣称模型复核有效，也不宣称等同私有系统的全部 Reviewer 能力。

## 跨版本原 Owner 回归

新增集成测试通过既有合成网络fixture驱动真实Web acquisition owner，实际完成robots/页面读取、提取与不可变来源入库，再选择持久化的v0.27专家profile。任务提交后删除当前profile，仍由已冻结版本执行真实Child、生成原来源报告，并将该Artifact revision交给Review。复核与冷读前后，原报告字节、任务字节、revision列表、来源manifest和Web请求数保持不变。这不再只靠手工Web provenance或旧specialist demo。

另一用例在独立进程注入Gateway结算未知并退出，随后分别用新CLI进程冷读、尝试重执行。unknown记录和原模型扣账保持一致，传入的Gateway工厂没有被调用。它验证的是注入故障后的持久化行为，不代表已观察真实服务商故障或远端取消。

这些网络传输与模型答复均为合成fixture；真实外网Web采集与真实模型语义复核仍未验证，不能因此越过live预算与准入门槛。
