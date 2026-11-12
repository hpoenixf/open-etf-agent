[English](child-lifecycle.md) | **简体中文**

# 异步 Child 生命周期（0.30 候选）

这是开发候选，尚未发布，也未完成真实模型验收。原有 `child-execution@1` 的[串行 Child 契约](child-execution.zh-CN.md)保持支持。

## 用户价值

让一个范围明确、只读的检查独立进行，Main 可以继续自身工作，再读取原结果，或只取消这个 Child，不影响其他工作。最终报告与派生结论是否有用仍由 Main 负责。

沿用项目配置与 `child` 能力，显式启用：

```js
import {CLAIM_COMPARISON_METHOD} from './src/child.mjs';
const childExecution = {
  schemaVersion: 'child-execution@2',
  maxChildren: 2,
  maxConcurrent: 2,
  methods: [CLAIM_COMPARISON_METHOD]
};
```

`maxConcurrent` 为 1 至 `maxChildren` 的整数，后者上限仍为 8。它们由操作者设置，不是模型可以扩大的授权。已提交任务保留原始配置。

## 模型可见操作

每个操作必须单独占据一次工具响应，不能与其他调用混发。

- `spawn_child({methodId, question, documents})` 从固定方法与获准文档子集创建 Child，返回稳定引用，不是答案或证据。
- `inspect_child({childRunId, waitMs?})` 观察这个精确的直接 Child。等待值限 0–1000 毫秒；运行中或未知观察不收养来源。合格终态交付保留原来源身份与派生结果归属。
- `cancel_child({childRunId})` 取消 Child 而非 Root；重复取消终态 Child 不改变它。取消回执没有来源，不声称远端请求已终止。

Session 将每次观察绑定到原调用与 Child 定义并封存。历史的运行中观察不会因为 Child 后来完成而被改写。恢复复用原操作和原 Child，不另建一次重试。

## 停止、恢复与查看

```sh
node src/research-cli.mjs child list --project research-projects/my-project --run my-task
node src/research-cli.mjs child cancel --project research-projects/my-project --run my-task --child child-run-id
node src/research-cli.mjs run work --project research-projects/my-project --run my-task
```

Main 终结前在原截止时间内等待已接纳的 Child 收尾。Host 停止会中断本地 Worker 并保留恢复检查点，不等于取消 Root。不配合中断的提供方可能在本地 Worker 返回后仍处于未知状态；此时保留 `effectsStopped:false`，不能因为本地 Promise 完成就释放原租约。已分派的未知请求保留计账、不重放。`run cancel` 仍取消整个 Root。

Main 与所有 Child 竞争同一个原始 Root 预算。取消 Child 不退还已分派消耗、不增加执行名额、不延长截止时间，也不收养迟到答案。

## 验证边界

合成检查覆盖并发 Child、取消隔离、不可变观察、原来源投影、父终结等待、提交/消费检查点恢复、冷 CLI 与不配合中断的 Host 停止。全量回归与固定真实工作流验收是独立门槛。本候选不声称追平 private，不提供嵌套 Child、peer 消息、广泛部分结果流、独立提供方路由或新的 Response/Schedule/PDF/plugin 组合支持。


## Corrected-candidate qualification update

Separate candidate `2bfe816` now passed the frozen ten-workflow Runtime cohort, 89 zero-extra-cost requests and no new unknown. Earlier candidate statements above remain historical. [Qualification and semantic limits](verification/v030-release.md). This update does not itself assert tag/Release publication.
