# 升级已有安装

[English](upgrade-guide.md) | 简体中文

## v0.10：有意设置的执行协议边界

v0.10 使用 `tool-host@2`。持久化的 `tool-host@1` 快照会以 `UNSUPPORTED_HOST_SNAPSHOT_VERSION` 拒绝恢复；不提供自动迁移、缺失摘要兜底或旧工具重执行。这也包括通过 Runtime 重放已终结 Run 的尝试：旧 Run 已完成，不代表新版 Runtime 能恢复它的 Host。

保留输出通过独立的 Result、Artifact 与 Publication 读取接口访问。这些接口的可读性与恢复执行是两回事，也不构成改写或删除原始数据的许可。参见[原审阅契约](https://github.com/hpoenixf/open-etf-agent/blob/e442f600891be79625fc78751e2d9f39905920da/openspec/changes/result-reference-consumption/design.md)和[实现沿革](evolution/result-reference-consumption-lineage.md)。

## 操作者发布清单

这份清单是操作条件，并非已实现的全部署预检、自动排空或迁移命令。

1. 记录已安装版本与候选版本的代码、依赖锁，以及各自支持的存储数据和 Host 版本。替换已安装版本前，停止接收新任务。
2. 让活动 Run 在原 Runtime 上完成。若无法完成，隔离整套旧部署及其数据，不要把这些 Run 无感切换到新版 Runtime。保留对应的原代码、依赖、配置与备份。隔离只是保留恢复选择，不会覆盖原截止时间、未知效果或其他恢复限制。
3. 不要让新旧 Worker 共用同一活动 Session，不要改写快照版本标签，也不要用新 Run 冒充旧 Run 已恢复。保留原始备份与已提交输出；回退代码或配置时，不回退已提交效果。
4. 声称某条升级路径受支持前，使用隔离合成数据演练适用的升级与回退路径，包括原始输出的独立回读。不兼容或状态不明应阻止该升级，不能把拒绝改写成虚构的终结成功或失败。

[上云 go/no-go 清单](plan/v1-to-v2.zh-CN.md)继续保留这些要求。本说明不代表已部署上云，也不宣称具备无人值守滚动升级能力。

## 现有测试证明了什么

[兼容测试](../test/result-consumption-delivery.test.mjs)将当前合成 Host 快照的版本改成 `tool-host@1`，验证执行前拒绝、原 Session 与文件不变、独立 Artifact 回读，以及受支持的 `tool-host@2` 继续执行。两次检查间受控的版本变化也会在 claim 前被拒绝，但这不是原子的跨版本迁移保证。

该测试并非旧 Runtime 实际生成的快照。它没有完成真实旧版本恢复或所有历史输出格式的验收。Runtime 预检保护的是被选中的单个 Run，不会盘点所有已部署 Session，也不能证明操作者保留了可用的旧部署。
