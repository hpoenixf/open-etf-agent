[English](v022-release.md) | **简体中文**

# v0.22 有界 Child 执行：验收与边界

本版保留已测试的串行、单层、只读 Child 实现。Main 从已准入方法与窄来源范围中选择检查，执行继续由原 Runtime、Session、grant、deadline 和预算负责。claim-comparison 方法先保留条件、时态与模态，再判断矛盾；Child 输入和 CSV 类型纠错沿用原有一次纠错额度。

## 十题结果的准确口径

用户接受**同一源码、事先批准的分阶段验收：10 个场景中 9 个通过原机械检查，第 6 个保留原失败并附独立成功补证**。这不是一次连续 10/10 通过。[原结果摘要](v022-real-ten.safe.json)与[执行文件等价清单](v022-execution-inputs.safe.json)固定证据。

- 第一阶段 C01–C05 通过；C06 的应用 Run 已完成，但 HTTP 测量读取器失败；按原停止规则 C07–C10 未执行。
- 第二阶段只执行 C07–C10，源码、fixture 和原题定义不变，四题通过。第一阶段原状态不改。
- 新增 81 次真实模型请求均有原 Go 零费用守卫回执与已完成的原准入票，无新增 unknown。历史 unknown 保留占用，不改成免费、失败或已恢复。未保留完整 provider 响应正文，不能声称事后逐字节复核了该正文。
- 独立原来源与报告审查支持十题核心结论，C01、C02、C05、C10 仍有旁支措辞瑕疵；不是完美语义评分，也不是金融研究资格。

## C06 原测量失败保留

应用已交付一份 rows CSV 和报告；另一个要求来源绑定的可选计算导出正确返回 `available:false` / `UNBOUND_CALCULATION`。测量读取器误把 unavailable 结果当作 artifact 回执，报 `HTTP_CSV_ACK_IDENTITY` 后停止。

修正后的测量适配器识别该 unavailable 分支并验证原 Owner，不放宽产品绑定，也不忽略任意缺失 artifact。独立补证读回原报告 6,244 字节、CSV 424 字节、确切哈希与实际 HTTP 交付，并核实十项适用 Child/机制检查。没有再次调用模型，也不把 C06 改成原批成功。

## 免费验证与历史

已测试源码在 Node.js 26.11.1 下通过单 worker 全套 **927/927** 和原生 ESM build。此前 925/926 的失败保留：hot-journal 测试 fixture 可能在计划 SIGKILL 前失去不可达 SQLite 连接。fixture 现保持连接存活，并新增强制 GC 回归；未因此修改生产 Session 行为。更早停止批次与条件/模态误判仍是历史失败，不计为本次成功。

最终发布包免费检查、确切提交、远端 CI 与 GitHub Release 分别核验。执行清单允许字节比对，不公开私人源码路径、数据库、原始报告、日志或凭据。

## 范围

支持原 Main 侧 Memory、计算/CSV、明确任务时间、受控压缩、有界 Child 失败与同 Child 安全暂停恢复。Child 工具仍只读。并行/后台、嵌套、peer messaging、独立 Child 取消、Response+Child、Schedule+Child、PDF+Child 和可信插件+Child 均不支持。已派发 unknown 不自动重放。

[用法](../child-execution.zh-CN.md) · [设计](../../openspec/changes/v022-child-execution/proposal.md) · [历史证据](../../openspec/changes/v022-child-execution/evidence.md)

## 配套交付语义

[Publication-first answers](../answer-view.md) 说明本版已测试的配套适配：原 Publication 可保留带明确降级引用评估的原答案，不伪造 Report 回执；可选 Memory 缺失与明确 Child 容量耗尽可作为局部结果继续，权限、未知副作用与预算边界不变。[最终包免费检查回执](v022-provider-free.safe.json)。文章维护测试另修正为读取其声明的历史 Git 源码，保留旧失败及固定历史哈希，不改变产品代码。

## 固定公开源码

[fed2c5f886200d4c04281c6293d5eb1ee7c2eab9](https://github.com/hpoenixf/open-etf-agent/tree/fed2c5f886200d4c04281c6293d5eb1ee7c2eab9), tree `b42e1b0dfa2d1c8a21248e654255d91524f11ba2`. 281 个执行文件与原测试输入逐字节一致；唯一文章维护测试修复同时保留原哈希和新哈希。生产源码、fixture 与 Runtime 测试未变。依赖版本未变，package/lock 仅根项目版本升为 0.22.0。后续元数据提交和发布标签不代表重新执行真实任务。
