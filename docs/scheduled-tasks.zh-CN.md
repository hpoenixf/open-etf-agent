# 一次性计划任务

[English](scheduled-tasks.md) · [0.25.0 发布候选说明](verification/v025-release-candidate.zh-CN.md)

本模块为既有 Schedule、Project、Session 和 Worker 增加有界主机入口，不另建任务数据库或后台执行器。不可变任务定义保存在 `tasks/<id>.json`，引用原 schedule；确认、物化、取消和执行租约仍由原 Session 管理。

Project 必须启用 `report` 与 `schedule`，先导入明确选择的来源。schedule JSON 只含 `scheduleId`、`definitionRevision`、`scheduledInstant`、`timeZone`、`maxLatenessMs`。必须在明确的未来时间前确认；允许迟到窗口须小于 Project 超时。

```sh
node src/research-cli.mjs schedule confirm --project PROJECT --run report-once \
  --question QUESTION.txt --manifest MANIFEST_SHA256 --schedule ONCE.json \
  --confirm-once --approve-provider --approve-data --approve-cost
node src/research-cli.mjs schedule list --project PROJECT
node src/research-cli.mjs schedule inspect --project PROJECT --run report-once
node src/research-cli.mjs schedule run-due --project PROJECT --limit 16
node src/research-cli.mjs schedule cancel --project PROJECT --run report-once
```

确认、查询和取消不请求模型。真实执行沿用已确认的 provider/data/cost 授权、配置中的环境变量和原 Admission。CLI 不执行 fixture 项目；fixture 只用于程序化测试。

`run-due` 不是常驻服务，需要操作者明确调用。每轮最多检查 256 个持久任务定义，串行尝试 1–32 个合格任务，默认 16。它在异步准备后重新检查资格；最终仍以原 Runtime 原子物化与 Session claim 为准。只有实际插入 Run 的事务会返回主机请求的非持久 fresh 标志；竞争者不能借另一个主机已物化的 Run 自动续跑。旧物化接口默认返回保持不变。

过期任务为 `missed`，不创建替代 Run。已完成、取消或已物化任务不会被下一轮自动重派。中断或结果未知的原 Run 应先检查，再按权限通过既有 `run work` 显式处理；旧身份、预约和 unknown 不会因新 wake 清零。Ctrl-C 仅协作停止主机，不等同取消任务。

不提供 cron、周期任务、通知或自动外部调度安装。本版 Schedule 不支持与 Knowledge、Response、Child 组合。迟到窗口不是服务响应时延保证；第二任务合法错过窗口仍表示最终交付未完成，不能据此把正确拒绝记为 Runtime 缺陷。

离线测试使用真实本地 Project/Session/Worker 加合成 gateway，不等同真实模型验收。独立真实补充批的九场景、前瞻十逻辑任务及内容局限见候选说明；不补写原中断批结果。本文不表示已发布或最终 CI 已通过。
