# v0.25.0 候选：一次性计划任务

[English](v025-release-candidate.md) · [模块与命令](../scheduled-tasks.zh-CN.md)

**仅候选准备，不表示已发布或最终 CI 通过。** 发布者按既定 Runtime-only 门作最终声明；模型研究质量独立披露，不在此新增质量硬门。

新增 confirm/list/inspect/run-due/cancel，沿用原 Project、Schedule、Session、Worker 和 Admission。原子 fresh 观察防止竞争 wake 自动续跑其他主机已物化的 Run。不包含 cron、周期、通知、新执行器，也不支持 Schedule 与 Knowledge、Response、Child 组合。

## 固定来源与真实观察

实测核心为 `1afb49ae75c6322cd95442a1868d1ec90f7164cf`。候选从 WIP `d5714402` 的完整 tree `e7caceb0652c350539494f92454a2538f57bb7ec` 导出；产品 src 与 scripts 字节不变；一叶测试 checkpoint fixture 修正见下文。版本字段和文档是候选增量，不冒称新提交已完成真实测评。

[独立补充回执](v025-rebuild-supplement03.safe.json)记录九个固定场景 RB25-02–10，Runtime 合同观察为 9/9；按事前问题和别名映射到十个正常承载模型调用的逻辑任务：02、03、04，05 的两个独立任务，06、07 的幸存任务，以及 08、09、10。此映射不是事后从成功报告挑选。

十份报告实际保存并按字节读回，30 个完整原响应和原生采纳；全部 `usage.cost=0`、`billing_source=go`，未新增 unknown。30 个原 body 的两个 estimated 字段均省略；sink 归一化 `estimated=false` 不表示服务商原文显式返回该值。

旧失败、unknown、取消的整段预约完整保留。本批整段 108 中未使用的 78 不退回。不能把九场景写成十场景，不能把独立补充拼成原中断十题批通过，也没有重放 01；原九场景分数不改。owner exit0/登记组读回不证明所有逃逸子孙已停止或远端已结算。

## 内容质量独立保留

十个逻辑任务中八份内容质量确认可接受，06 和 09 虽核心事实及来源对应正确，仍有原模型问题：

- **RB25-06：** 将 20 与 50 可推导的数字差异当作未知，把缺少显式否定误作无法比较。
- **RB25-09：** 将 UTF-8 标签类别支持的原声明收窄为两个例子，对其他标签称未知。

两项都不是 Runtime 改写；不能称十篇内容全对。材料全部合成，不代表真实基金研究能力或投资建议。最终 CI、正式资格声明、README 生成和发布由发布者分别完成。

## 后续 CI 失败与测试 fixture 修正

WIP `d5714402` 的 CI 构建通过，但测试为 997/999；`durable-correction` 的两个进程死亡测试预期 SIGKILL，实际信号为 null，失败未被改写。原 fixture 仅有 150ms 租约：一次受控暂停超过租约的合成诊断复现 STALE_WRITER 后自然退出，证明可行机制，**不证明 CI 实际根因**。候选只把 `test/fixtures/correction-child.mjs` 的 IPC 发出后 checkpoint 等待改为最多四秒的同步等待，使父进程能在原五秒边界内实施真实 SIGKILL。未改产品 Runtime/Session、租约、原测试期限或断言。修正后的原 `durable-correction` 整文件四例均通过（824ms）；没有把旧 999 全套说成此次修正后的全套，也没有用重跑掩盖失败。
