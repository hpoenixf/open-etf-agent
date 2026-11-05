[English](provider-capacity.md) | **简体中文**

# 项目修订之间的供应商容量

这是**尚未发布的 v0.24 候选**，在冻结的 v0.23 候选之外独立开发。离线检查不能证明任一版本的真实模型资格或发布完成。[提案](../openspec/changes/v024-provider-capacity/proposal.md)记录了范围边界。

[原 Admission](shared-admission.md)拥有持久队列和一个本地物理请求槽。本次增量防止普通项目只因改变模型、流式选项、供应商显示名或凭据环境变量别名，就为同一 endpoint 意外新建另一个槽。它不另造预算、模型路由或供应商注册中心。

## 沿用普通项目流程

按既有[项目配置与 CLI](research-project.md)，在**新的空项目目录**初始化。输入配置仍使用 `research-project@1`，没有新增容量选项。生成的项目记录为 `research-project-record@2`，每个准入任务为 `research-task@2`，并保存原始派生 Admission 绑定。

使用已检查的预期配置哈希执行 `project update`，变化只影响后续任务。已经准入的任务保留原模型、endpoint、grant、限制和来源快照；容量 Owner 也固定，不会随新配置改路由。

只读检查一个任务，不发模型请求：

```sh
node src/research-cli.mjs capacity inspect --project DIR --run RUN_ID
```

对应 API 为 `inspectResearchCapacity({projectDir, runId})`。输出 policy、group ID、单项目范围、容量 1，以及该 Run 的原请求票据，不枚举另一个项目。若预算已预留但 Admission 尚未记录，某个模型序号可能对应 null 票据；null 不代表退款或重试许可。检查不会创建缺失存储或结算未知请求。

## 哪些修订共用容量

- 在同一新格式项目中，规范化后相同的 HTTPS endpoint 共用一个原 SQLite Admission Owner，不因模型、stream、供应商显示名或 API key 环境变量别名改变而拆组。
- URL 解析统一主机名和默认端口。新格式拒绝原始 query/fragment 分隔符，包括单独的 `?` 或 `#`；URL 属性为空不代表分隔符不存在。不同路径及非默认端口仍独立。不推断 DNS 别名、不同供应商 URL 或账户总容量相同。原 Gateway 仍要求其支持的 `/chat/completions` endpoint 形式；身份规范化不会把不支持的 URL 变成可执行目标。
- Fixture 任务使用独立的项目内合成容量域，不与 live endpoint 混合，也不证明供应商行为。
- 不同项目目录相互独立，即使 endpoint 相同。这不是分布式或账户级限流。

凭据别名变化时保守共用容量，并不表示新凭据或收件人已经获准使用。原供应商、数据和费用授权仍须满足。

## 只有原证据能释放槽位

Run A 的原 Runtime reservation、owner/fence 和输入哈希始终绑定原票据；Run B 在同一 FIFO 等待。已经派发的票据只能由原 Gateway 支持的完整终态证据结算。传输未知、进程死亡或派发后的本地取消，都会在修订和冷启动后继续占用容量。没有 unknown TTL、退款、自动重试，也不把本地超时说成远端副作用已经结束。

Main、实际 Child 和受管 summary 继续使用各自 Runtime 收据及同一绑定 Admission Owner。Project 元数据只负责定位；预算与 grant 仍归 Runtime/Session，Report/Publication/Reader 仍负责交付输出。

## 状态缺失时保守拒绝

项目初始化或显式的新 endpoint 修订只创建一次 Owner。创建前，先将独立的不可变 Project 登记持久化。登记只保存定位/身份策略，不记录请求状态、容量计数或计费。普通 submit/work 仅打开已有 Owner。

登记、目录或数据库缺失时，普通执行报 `PROJECT_CAPACITY_OWNER_MISSING`，不会创建空替代库。绑定异常或外来数据库同样拒绝。若原项目或配置修订中曾使用某 endpoint，即使登记和目录都缺失，也不能静默重新初始化。新域检查最多读取 1024 条修订项，超限拒绝扩展，不丢弃历史。

初始化跨多个文件，不是原子多文件事务。若在持久登记后、可用 Owner 完成前中断，会留下被阻塞的不完整初始化；不会自动回滚或回收。应沿明确获准的恢复流程还原并核验原状态。本候选不提供修复/迁移命令，不能删除旧记录来制造容量。

## 旧项目保持原合同

已有 `research-project-record@1` / `research-task@1` 项目保留原完整 gateway 哈希目录和票据。新版可检查并按历史固定 route 合同处理其已有任务，不为这些旧项目宣称新的 endpoint 范围保证。

新版 `project update` 若改变旧项目 gateway，会报 `PROJECT_LEGACY_CAPACITY_REVISION_UNSUPPORTED`；非 gateway 配置修订仍支持。没有自动收编、合并、升级或搬库；在非空目录初始化也不是升级。旧标准 Project 入口会在派发前拒绝新记录格式，但不宣称控制任意直接 Admission 调用者或任意旧进程。

新建独立项目不证明旧请求结束，也不能退还共享预算或授权重做未知工作。旧 unknown 仍属于原计账与恢复责任。

## 验证边界

离线检查使用真实 Project API、原 Chat 编解码和注入的合成传输，启动实际独立 worker 进程，检查原 SQLite 票据及冷读结果；覆盖修订争用、排队取消、unknown/dispatched 保留、缺失 Owner 拒绝和兼容边界。另用实际旧源码进程检查新格式拒绝及旧记录原样读回。

这些只是本地机制检查。真实供应商任务、报告语义评审、真实供应商并发、安装、最终全量/build 和发布分别保留证据，不将离线结果升级成真实模型得分。
