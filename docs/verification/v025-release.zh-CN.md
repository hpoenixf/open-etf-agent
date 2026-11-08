# v0.25：一次性计划任务

[English](v025-release.md) · [命令](../scheduled-tasks.zh-CN.md) · [详细证据](v025-release-candidate.zh-CN.md)

## Runtime 资格，不是十份完美答案

独立补充批包含**九个事前场景中的十个正常逻辑任务**。RB25-05 是两个不同问题；RB25-06/07 的取消和过期兄弟任务是安全控制，不计为正常任务。十个原任务均在原期限内完成，保留报告原字节、原 Admission、响应和原生 proposal 采纳。既有冻结门要求 Runtime 至少 9/10，本次观察为 **10/10**；原场景结果仍为 **9/9**。没有改写旧失败或 unknown，也未拼接不同批次。

[十任务声明](v025-runtime-release-decision.safe.json)绑定[固定执行输入](v025-execution-inputs.safe.json)。声明检查器只验证字段，不验证底层证据或授予发布权限；独立读回另已核实 30 份完整原 body/采纳与十份报告。每任务三次请求，原 body 均为 `usage.cost=0`、`billing_source=go`；两个 estimated 字段均省略，不能说提供方显式返回 false。本批没有新增 unknown；旧 unknown、被取消启动与所有整段预算占位保留，未用预约不退款。

**内容质量单列：八个确定通过，保留两处模型问题。** RB25-06 因没有显式否定句，将 20 与 50 可推得的差异说成未知；RB25-09 将已陈述的 UTF-8 标签支持缩窄为个别例子。两处均存在于模型原文，不是 Runtime 改写。本次使用合成材料，不代表真实基金研究或投资建议。

本执行清单摘要在运行后生成，用于绑定保留的原冻结输入，不声称这个摘要事前存在。十份报告均核对文件原字节；只有 RB25-09 另有冷启动 HTTP 读回。

## 固定实现与发布边界

真实执行使用 [1afb49ae](https://github.com/hpoenixf/open-etf-agent/tree/1afb49ae75c6322cd95442a1868d1ec90f7164cf) 产品核心，本地全套 999/999 与构建通过，之后有记录的 WIP CI 也通过同套检查。最终包保留产品执行源码字节；测试除下文单列的一叶 fixture 修正外保持不变，另有 package/lock 项目版本及文档增量。最终包验证、远端 CI、main/标签/Release 和文章/站点发布是独立步骤；这份证据页本身不是发布回执。

CLI 复用原 Project/Schedule/Session/Worker/Admission，只做显式 once 确认、查看、取消及有限到期扫描。原子 fresh materialization 防止竞争唤醒隐式续跑别人的 Run，未知工作继续占位。不包含常驻服务、cron、周期任务、通知、新任务数据库或 Schedule+Knowledge/Response/Child 支持。

## 后续 CI 失败与测试 fixture 修正

WIP `d5714402` 的 CI 构建通过，但测试为 997/999；`durable-correction` 的两个进程死亡测试预期 SIGKILL，实际信号为 null，失败未被改写。原 fixture 仅有 150ms 租约：一次受控暂停超过租约的合成诊断复现 STALE_WRITER 后自然退出，证明可行机制，**不证明 CI 实际根因**。候选只把 `test/fixtures/correction-child.mjs` 的 IPC 发出后 checkpoint 等待改为最多四秒的同步等待，使父进程能在原五秒边界内实施真实 SIGKILL。未改产品 Runtime/Session、租约、原测试期限或断言。修正后的原 `durable-correction` 整文件四例均通过（824ms）；没有把旧 999 全套说成此次修正后的全套，也没有用重跑掩盖失败。
