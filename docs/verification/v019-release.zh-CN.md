# v0.19 组合资格

[English](v019-release.md) · [完整组合矩阵](../composition.zh-CN.md) · [升级边界](../upgrade-guide.zh-CN.md)

## 状态与范围

文档列明的组合已完成实现及有界机制验证。不可变公开实现及证据快照见下文；正式发布状态与本资格记录分开。本版升级既有 Owner 的扩展性，不是生产基金研究服务，也不宣称所有模块任意组合。

自定义 catalog、原 Result/计算/CSV/报告、Memory 消费与显式一次性效果、Worker 恢复、可信 Skill/MCP/插件、Response/PDF、Child/Admission 及确认后的 Schedule 组合，继续遵守原身份、权限、共享预算、fence 与未知结果规则。以完整矩阵中的支持、前置条件和不支持项为准。

## 四批原记录，不是同一源码四十次全过

- A：旧执行源 c4037c0，10/10，31 次物理请求。
- B：同源 9/10，36 次请求。B03 原检查器错误要求仅一次 MCP 读取，而原允许范围和 Skill 方法支持两文档，仍保留失败；只继续原先未执行的七题，没有重派或重评分 B03。
- 原 C：9 成功、1 失败，48 次请求，**不合格**。C10 反复摘要后触及本地摘要角色上限，但原 Admission 已预约，未知票保留；本地拒绝不被伪造为额外物理请求。
- 修复 C：新执行源 6a52f20，10/10，44 次请求。持久、可校验的 frontier 复用笔记，Run 绑定的摘要次数在再次预约前检查。C10 以 Main 8 次、摘要 2 次完成，持久计数、原 Host 依赖、Publication 与独立冷读一致。

总计 40 个逻辑执行、159 次真实请求，观测到的提供方响应均为 Go 零额外余额费用。既有计费未知与保守预算预留未清零。[公开批次记录](v019-campaign.safe.json)、每批机械决定与执行输入清单分别保留源及失败。执行 Git hash 是来源标识，不表示这些本地对象已公开发布。

A/B 未配置托管摘要或 Schedule；独立审阅确认修复差异不改变其已覆盖合同，因此复用为原源回归证据，不改标成新源实跑。修复批验证发生变化的合同，不混选成功样本，也不用 38/40 替代逐批十次门槛。

## 免费验证和兼容边界

修复源全套观测 650/651。唯一失败是既有真实 kill 测试使用 150ms 壁钟租期，在首 checkpoint 前过期。现采用相邻恢复测试已有的受控租期时钟，仍实际 kill、另进程推进 fence，定点复验通过。完整失败保留，**不宣称最终树重新跑过全部 651 项**。构建及正常、未知、取消、晚到、恢复、篡改验证通过，生产租期与未知守卫未放宽。

实际旧 Session reader 以 INVALID_DEFINITION 拒绝新 gateway-history-compaction@2 定义；新 reader 只读打开成功，前后字节不变。这是显式版本拒绝，不是旧 Run 无缝迁移。

## 明确保留的缺口

Response+Schedule 需要组合持久等待协议，当前不支持。Atlas 历史撤权示例独立保留，不新增通用同 Run 动态授权产品。当前环境不实现或宣称验证 Python 隔离。MCP 接缝是可信有界读页协议，不是任意 MCP 工具。完整 Memory 生命周期、后台周期调度、金融数据适配、生产部署和金融语义准确性不在本版完成范围。

## 机器可读证据

- [Campaign and retained failures](v019-campaign.safe.json)
- [A decision](v019-a-decision.safe.json) · [B decision](v019-b-decision.safe.json) · [Original C decision](v019-c-original-decision.safe.json) · [Repair C decision](v019-c-repair-decision.safe.json)
- [Original evaluator outputs](v019-mechanical-results.safe.json)
- [Original execution inputs](v019-original-execution-inputs.safe.json) · [Repair execution inputs](v019-repair-execution-inputs.safe.json)
- [Provider-free and source-impact boundaries](v019-provider-free.safe.json)

## 固定公开源码与最终发布包

实现及证据快照为 [`9b6ae0adf1df7efd4fd138b8d2957103b8fd9132`](https://github.com/hpoenixf/open-etf-agent/tree/9b6ae0adf1df7efd4fd138b8d2957103b8fd9132)，tree 为 `13739de4e3062df5674710e5a1709dbf28a07f9f`。其中 80 项执行输入摘要与修复执行清单一致；A/B 仍保留原执行来源及单独审查的未受影响合同范围。公开快照包含安全证据，不包含私有执行器状态或本地 Git 祖先。

`versions.json` 记录此固定源码快照。`v0.19.0` tag 与 GitHub Release 必须指向随后完成的最终 metadata 包，并以该包原 CI 通过为前提。metadata 不改变执行输入。实际发布状态以 [GitHub Releases](https://github.com/hpoenixf/open-etf-agent/releases) 和 tag 所指提交的检查为准；本记录本身不证明 Release 或 CI 已完成。
