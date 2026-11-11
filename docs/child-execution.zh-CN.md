[English](child-execution.md) | **简体中文**

# 有界 Child 执行

v0.22 提供有界 Child 执行，参见[分阶段验收与边界](verification/v022-release.zh-CN.md)。扩展沿用原 project/Runtime 路径，旧单次 `source_check` 保持不变。

## 它解决什么问题
研究项目可以预先准入多个不可变的只读方法。Main 选择一个方法、局部问题和已准入资料的窄子集，Child 在独立上下文中执行，返回派生摘要与经核对的原始来源引用。Main 可以接着完成另一个独立检查，再生成最终报告。

每次执行保留原父调用、Child Run、根授权、方法、来源范围、截止时间及根预算用量。失败 Child 仍占用一次执行名额。读取或重启任务不能把结果未知的派发变成新的尝试。

## 显式启用新合同
通过原项目初始化/更新 API 或 JSON CLI 配置启用。保留已有 Gateway、限制和数据授权，添加 `child` 能力及以下字段：

```js
import {CLAIM_COMPARISON_METHOD} from './src/child.mjs';

const childExecution = {
  schemaVersion: 'child-execution@1',
  maxChildren: 2,
  methods: [CLAIM_COMPARISON_METHOD]
};
```

`maxChildren` 与方法数均为 1–8。方法沿用带内容哈希的 `child-method@1` 描述。工具仍限于 `read_page` 和可选的 `read_result`；即使项目包含更多文档，每次 Child 也最多选择两个。模型不能传入新方法、工具授权或预算。`childExecution` 与旧 `childMethod` 互斥；省略新字段仍只有原来的单次 `source_check`。

新模型工具为 `delegate_child`，参数必须恰为 `methodId`、`question` 和 `documents`。Main 必须把它作为该轮唯一工具调用。在原次数限制内可依次检查多个子问题，但这不是并行后台执行。

`delegate_child` 的声明字段缺失或形状错误时，原 Child owner 可以证明这是 JSON 稳定、同轮单调用的派发前拒绝：不创建 Child，也不扣工具用量。原 Runtime 仍只允许整个 Run 共用最多一次纠错机会，由模型用新调用补齐参数，保留同一根预算和调用/结果配对。不会自动填写 `documents`，也不会默认使用全部资料。未知方法、未授权文档或范围、输入限额、hooks、受保护执行、部分效果和未知结果，不会获得这项参数纠错证明。冷恢复复验原持久拒绝；已经失败的任务不会重新打开。

项目更新只影响将来的任务。已提交任务保留自己的原配置和方法哈希。不做自动迁移，也不宣称旧项目读取器支持新合同。

## 检查与续跑

```sh
node src/research-cli.mjs child list --project research-projects/my-project --run my-task
node src/research-cli.mjs run work --project research-projects/my-project --run my-task
```

`child list` 只读，不调用模型，分别显示：

- 原 Child Run、父调用、方法、选定文档与实际截止时间。
- 实际执行状态和检查点，与模型请求的已知/未知结果分别记录。
- 原根预算用量和执行名额。`admissionBlocked` 说明为什么有剩余名额也不能执行。
- Main 交接的 `not-consumed`、`committed-not-consumed` 或 `consumed` 状态。
- 仅在已知终态结果可用时显示经核验的原来源与派生结果。

再次执行 `run work` 续跑同一任务。安全停止后，原父任务协调同一个 Child，沿用剩余截止时间与预算；进程崩溃后可能需要等其原租约到期。`model-reserved` 检查点无法证明请求没有执行，必须以 unknown 停止而不是重放。已结算 Child 只验证和回读，不再次运行。

Ctrl-C/SIGTERM 协作停止 Host；`run cancel` 取消原根任务及全部 Child。本版本没有独立取消单个 Child 的命令。

## 组合边界
Main 保留 Memory 写入和最终发布职责。已有 Main 侧 Memory、计算/CSV、任务时间和托管压缩路径，不会因此成为 Child 的工具授权。前一个 Child 的派生摘要或 Main 工具历史不会自动复制进后一个 Child。

Main 把 `create_csv.rows` 传成字符串而非数组时，原普通 Host 会在派发前拒绝。本版本允许这一确定、JSON 稳定的纯类型错误使用已有的一次纠错机会：模型必须用新的调用提交真正的二维字符串数组，Host 不解析字符串，也不据此创建文件。仍使用原根预算、轮数、截止时间、取消状态和调用身份。多工具同轮、hooks、受保护执行、未知结果、部分效果、其他 CSV 校验错误和文件 I/O 失败都不会得到这项新证明。升级不会重开已经失败的任务。

Response+Child、Schedule+Child、PDF+Child 和 trusted-plugin+Child 仍显式拒绝。不包含嵌套、并行/后台 Child、同级对话、终态续跑、动态 Profile 管理或独立 provider 路由，也不宣称与完整多用户或私有研究服务等价。

## 验证证据
[分阶段验收](verification/v022-release.zh-CN.md)、[设计](../openspec/changes/v022-child-execution/proposal.md)与[证据沿革](../openspec/changes/v022-child-execution/evidence.md)保留来源及执行阶段。接受口径为十题九个原机械成功，C06 原测量失败与独立成功补证同时保留，不是一次连续 10/10。免费测试、远端 CI 与实际发布分别核验。

## Child 摘要交付大小

新方法使用 `output: {}`，不再设置 Child 摘要专用字节上限。内置比较方法为版本 3。不会截断摘要，也不会将原来的 4000 改成另一个固定阈值。

旧 `child-method@1` 中的 `output.maxSummaryBytes` 仍按原合法值（1–16000）读回，作为不可变身份元数据保留，**不再限制交付**。旧任务的 descriptor、绑定与存储问句不被改写；为精确恢复，旧问句里已有的字节提示仍原样重建，但不代表当前 Host 执行该上限。新方法提示不再包含该字节上限。旧失败任务仍是失败，不会因升级自动重跑或变成成功。

这不取消 Runtime 最终回答容量、Gateway 请求容量、上下文、文档权限、调用次数、时间或费用边界。很长的完整 Child 回答仍可能触发独立上下文容量拒绝；本改动没有分页交付、自动续跑或自动截断功能。
