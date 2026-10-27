<p align="center">
  <img src="docs/assets/open-etf-agent-hero.svg" alt="Open ETF Agent — Build small. Keep evidence. 从第一份报告，逐步演进到可回读的原文与显式 Memory。" width="1200" />
</p>

<p align="center"><strong>从第一份能打开、能核对来源的报告开始，逐版构建研究 Agent。</strong></p>
<p align="center">
  <a href="#quickstart">快速运行</a> ·
  <a href="#versions">版本演进</a> ·
  <a href="#live-evidence">真实调用记录</a> ·
  <a href="#live-entry">受限 live 入口</a> ·
  <a href="#architecture">架构职责</a> ·
  <a href="#reading">文章与代码</a> ·
  <a href="#roadmap">后续路线</a> ·
  <a href="#english">English</a>
</p>

## Open ETF Agent

一个以成熟机制为基础、通过可运行版本逐步演进的 Agent 项目。先做好读取、工具往返和带出处的文件交付，再按需要加入 Skill、MCP、受限分工、上下文管理与 Memory。每期保留独立代码和验证记录，方便运行、对照，也方便看清一次能力增加究竟改变了什么。

目前的入门案例是**原创合成文档比较**，并非真实基金分析。v0.7 另有小型原创合成 ETF Plugin，仍不是实时基金数据或真实基金分析；完整 ETF 研究工具在后续路线中。本项目不提供交易执行或投资建议。

> **从哪里开始？** 直接克隆 `main`，无需切换阶段分支：默认提供最新已验证稳定的开发代码 **v0.9**，本期仅增加单 Run Worker：提交进程退出后，另一进程沿原 Session 租约驱动同一 Runtime。九个固定阶段保留在 `phase/v0.1`—`phase/v0.9`；当前实现对应 [v0.9 固定快照 `dad9c6e`](https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d)；此前 [v0.8 Publication 快照 `2c096ce`](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1)、 [v0.7 固定快照 `5f70dc0`](https://github.com/hpoenixf/open-etf-agent/tree/5f70dc0b4760ad70ef211f4823828ab2fee5c525) 与 [v0.6 固定快照 `7480b65`](https://github.com/hpoenixf/open-etf-agent/tree/7480b656b18192e6d6b44aab65255b970d58e6f8) 不被改写。这里的“稳定”指下文 **provider-free Runtime 回归与交付验证**，**不等于正式 Release、模型能力认证、live 恢复认证或生产就绪**。项目原创代码采用 [MIT 许可证](LICENSE)，第三方组件保留各自许可。

> **想看真实模型调用，而不只是 fixture？** 先看 [v0.1–v0.5 的 16 次真实 HTTP 调用记录](#live-evidence)，再看 [独立受限 live runner 的入口与授权条件](#live-entry)。这些是历史证据，不是 v0.9 live 恢复资格。

### 在这里可以看到什么

- **一次真实的文件交付：** 报告、来源版本、原文快照、文件哈希和保存回执，而不只有一段“已完成”的回答。
- **一条逐步增加能力的执行链：** 新机制接回既有 Runtime / Tool Host，不另造一条只供演示的执行流程。
- **可核对的验证边界：** 保留失败、修复和未验证项，区分程序机制通过、模型判断正确与正式发布。

<a id="quickstart"></a>
## 快速运行 · Quickstart

需要 **Node.js 26.8.1–26.x** 与 npm。默认示例不需要模型密钥；安装依赖可能访问 npm，安装后的示例离线运行。

Node 下限按实际 API 使用范围放宽到 26.8.1。当前维护与 v0.9 的本地验证由 Node 26.11.1 执行；26.8.1 全绿是使用者提供的 v0.6 观察，未在本执行环境重跑，不冒充 v0.9 的最低版本实测。详见 [v0.6 文件系统包装异常修复与验证](docs/verification/v06-errno-maintenance.md)与 [v0.7 工具链证据](docs/verification/v07-observations.md)。

```sh
# 默认 main 已包含最新已验证稳定代码，无需切换阶段分支
git clone https://github.com/hpoenixf/open-etf-agent.git
cd open-etf-agent

npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
```

`build` 检查并复制原生 ESM 与示例资料，不是 TypeScript 类型检查。默认比较保留四题完整分母；每次 Run 在 `runs/` 下产生独立目录，包含 `report.md`、`manifest.json` 和 `run.jsonl`。CLI 输出实际运行目录；观察某次运行可使用 `node src/cli.mjs --observe runs/<run-id>`，将占位符换成实际 ID。

**交付长什么样？** 以下保留 [v0.5 合成示例回执](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-demo-receipts.json)中 T1 的历史字段节选，不是新的运行结果。v0.6 在此基础上新增不可变 Artifact / Revision ID 与附件身份；完整记录见 [v0.6 交付回读](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-delivery-receipts.safe.json)。

```json
{
  "caseId": "T1",
  "status": "completed",
  "semanticStatus": "unreviewed",
  "receipt": {
    "path": "report.md",
    "bytes": 933,
    "mediaType": "text/markdown; charset=utf-8"
  }
}
```

`completed` 说明这次执行完成；`semanticStatus: unreviewed` 仍保留答案语义待复核。完整回执还包括文件哈希与实际原文引用，测试会在进程退出后重新读取文件。

<details>
<summary><strong>继续体验另外七类示例</strong></summary>

```sh
# 结构化 CSV 附件，绑定实际报告修订
npm run demo -- --case artifact-table

# 按需读取方法，再通过真实 stdio fixture 进程取得资料
npm run demo -- --case skill-mcp

# 固定读取 worker 与一层脚本 Child：两种机制分别演示
npm run demo -- --case batch-read
npm run demo -- --case fixture-child

# 改变查询，观察候选驱动的实际读页与精确回读
npm run demo -- --case retrieve-reread --query "offline editing"
npm run demo -- --case retrieve-reread --query "Markdown"

# 派生笔记与原文分开保存；压缩后仍可回读
npm run demo -- --case compact-and-reread

# 显式选择独立的合成 Memory 库，演示保存、修订、忘记
npm run demo -- --case explicit-memory --memory-library runs/selected-synthetic-library
```

Memory 示例使用合成的操作意图，不会保存真实用户的永久偏好。`fixture-child` 不是独立真实模型推理；在当前默认 CLI 中，`--live` 与 `--case model-child` 会明确拒绝，而不是悄悄转为模拟成功。

所有参数及边界见 [v0.6 运行说明](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/README.md)。

</details>

### v0.6：阅读、下载与实际 HTTP 验证

```sh
mkdir -p runs
node src/cli.mjs --case document-compare --output runs > runs/comparison.json
npm run evaluate -- --input runs/comparison.json

# 将 run-YOUR_ID 换成 comparison.json 内实际生成的一个 Run 目录
npm run serve -- --run runs/run-YOUR_ID
```

`serve` 会打印 `http://127.0.0.1:PORT`，按 Ctrl-C 结束。它只读取选定 Run 已登记的报告、原文窗口与附件，刷新和下载不调用模型。读取基于严格 ID 而非任意路径；HTML/SVG 仅供下载，不在阅读页执行。不要把这个仅限 loopback 的服务当作带认证的公网产品。

`evaluate` 自行启动并关闭短时本地 reader，保留 T1–T4 完整分母，通过真实 HTTP 核对报告、完整原文身份/字节及附件唯一性/字节。它不评价答案文采，也不能恢复未完成的 Run。需要复现固定阶段时，可单独检出 [`7480b65`](https://github.com/hpoenixf/open-etf-agent/tree/7480b656b18192e6d6b44aab65255b970d58e6f8)；默认入口仍是 `main`。

### v0.7：可信贡献与同一 Run 的恢复

以下是沿用 v0.7 的入口；范围以代码与 [v0.7 契约和证据](openspec/changes/v07-trusted-recovery/evidence.md)为准。它在现有 Runtime 上增加可选检查点，不另建一套恢复执行循环。

```sh
npm run session -- start --session runs/durable-example --case durable-report
# 将 run-YOUR_ID 换成 start 实际输出的 Run ID
npm run session -- inspect --session runs/durable-example --run run-YOUR_ID
npm run session -- resume --session runs/durable-example --run run-YOUR_ID
npm run session -- cancel --session runs/durable-example --run run-YOUR_ID

# 实际终止子进程、等待退出，再以不同 PID 恢复的独立测试
node --test --test-concurrency=1 test/durable-runtime.test.mjs
```

另有 `trusted-plugins`、`durable-child`、`durable-compaction`、`durable-memory` 四个原创 fixture profile；每个示例使用独立 session 目录。Memory 的合成意图是一次性的，重新 `start` 不是新授权。终态 `resume` 只回读既有结果与文件，不能单凭这条命令声称发生了中断恢复。

- **延续原有边界：** 原问题、Grant、provider/protocol/model 与 package bindings、绝对截止时间和已消费的共享预算不重置。已封存提案不重发模型请求，已提交结果不重做工具操作；已分派但没有持久结果的工作保持 unknown。
- **由原 owner 核验：** 完成的 Child handoff 可按身份取回；已采用便笺保留实际下一输入的身份；Memory 校验原意图和原修订，不偷旧 writer lock；报告按原 Artifact / Revision 和实际字节回读，不重新生成。
- **不扩大承诺：** SQLite lease/fence 约束 DB 写入，不能撤销或约束任意外部副作用；文件和数据库不是一个事务。遗留或未知文件需检查，不盲目重放或自动删除。未知 active schema 拒绝，旧不可变产物仍可独立阅读。
- **可信不等于隔离：** Plugin 是操作员显式导入的本地 JavaScript，具有进程权限，**不是沙箱**。整组贡献先校验，激活失败逆序释放已登记资源；所选模块 hash 不冒充整个依赖闭包或闭包变量的证明。显式函数配置仍保留，模型不能安装包或扩权。

CLI 只恢复其固定合成 profile，不会把真实 provider 偷换成 fixture；**没有新增 v0.7 真实模型请求，也没有 v0.7 live 恢复合格结论**。Web Chat、后台 Worker、多租户和一般外部 exactly-once 不在 v0.7 阶段范围。

### v0.8：一个答案块的提交与回读

v0.8 只做 Publication。正文与文件报告分别有自己的回执；正文已提交，后续 Run 失败也不会抹掉它。显式替换通过修订号 CAS 校验，块身份与展示位置保持不变，相同正文还要核对原绑定才能复用原回执。

```sh
node dist/src/session-cli.mjs start --session runs/publication-demo --case durable-publication
# 将 run-YOUR_ID 换成 start 实际输出的 Run ID
node dist/src/session-cli.mjs publication --session runs/publication-demo --run run-YOUR_ID
node dist/src/session-cli.mjs publication-event --session runs/publication-demo --run run-YOUR_ID
node dist/src/session-cli.mjs publication-revisions --session runs/publication-demo --run run-YOUR_ID
```

这是使用合成回复的真实本地 SQLite/进程闭环，不调用模型。仅支持一个根 Run 的正文块及选定修订读取；不包含后台 Worker、Web Chat、SSE、全局 History 或多租户。行为与反例见 [Publication 谱系和边界](docs/evolution/v08-publication-lineage.md)及[实测记录](docs/verification/v08-observations.md)。

### v0.9：提交退出后，由另一进程继续原 Run

本期只增加单 Run Worker，复用原 Session 的唯一 lease/fence 和同一个 Runtime，不另建 Task、队列或常驻调度服务。

```sh
node dist/src/session-cli.mjs submit --session runs/worker-demo --run original-example --case durable-publication
# submit 已退出；下面 work 是另一个进程
node dist/src/session-cli.mjs work --session runs/worker-demo --run original-example
node dist/src/session-cli.mjs publication --session runs/worker-demo --run original-example
```

`submit` 只持久化原身份、请求、绑定、预算与截止时间，不调用模型/工具；`work` 才执行该合成 profile。示例的 30 秒截止时间从提交开始，不在接棒时重置。终态再次 `work` 只回读原事实，不重新研究；再次体验应选择新的测试目录和明确 Run ID。

Worker 的 SIGTERM / 宿主停止不等于用户取消。已封存工作可沿原身份继续；已分派但结果不明的请求不自动重发，已提交正文也不因后续 Run 失败消失。SQLite、独立进程和 SIGTERM/SIGKILL 边界有真实合成测试，模型动作仍是脚本，不是真实模型判断。范围不含 Schedule、通知、前台问答并发或 Web。见 [Worker 谱系](docs/evolution/v09-worker-lineage.md)、[实际进程用例](test/worker-process.test.mjs)及[本版记录](docs/verification/v09-observations.md)。

<a id="versions"></a>
## 版本演进 · Nine fixed stages

九个阶段链接均指向固定提交，保留当时的代码、锁文件、示例与证据。表中的测试数是**各快照已记录的离线回归**，不是成熟度评分，也不是 CI 或模型能力徽章。

| 阶段 | 这一步解决什么 | 新增可见机制 | 记录的离线回归 |
| --- | --- | --- | ---: |
| [v0.1 · 第一份报告](https://github.com/hpoenixf/open-etf-agent/tree/f9370b81beef84199293120ee23d245bb0129553) | 让“完成”对应实际文件 | Runtime、Gateway、Tool Host、来源与保存回执 | 23 |
| [v0.2 · 方法与工具](https://github.com/hpoenixf/open-etf-agent/tree/a79e89bf709d4a2245b5a8652882a591ba467519) | 外部能力沿同一工具链进入 | 显式 Skill、真实 stdio MCP、完整 SSE 接收 | 49 |
| [v0.3 · 受限分工](https://github.com/hpoenixf/open-etf-agent/tree/5d57314826447f024d878674b98057742b4ce4cd) | 并行工作仍共享边界与预算 | Hook、固定 worker、一层 fixture-child、只读观察 | 71 |
| [v0.4 · 原文可离开窗口](https://github.com/hpoenixf/open-etf-agent/tree/ecf6cb45b4062586614e83aed917c92d704cb63b) | 缩小输入，仍能找回原版本 | ResultStore、Context、词法检索、ResultRef 精确回读 | 96 |
| [v0.5 · 笔记与显式记忆](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf) | 分清原文、派生笔记和未来偏好 | Compaction、Memory 保存/修订/忘记 | 124 |
| [v0.6 · 交付与阅读](https://github.com/hpoenixf/open-etf-agent/tree/7480b656b18192e6d6b44aab65255b970d58e6f8) | 已保存结果能按身份打开、下载并核对 | Artifact / Revision、CSV 附件、loopback Reader、HTTP evaluate | 171 |
| [v0.7 · 可信贡献与恢复](https://github.com/hpoenixf/open-etf-agent/tree/5f70dc0b4760ad70ef211f4823828ab2fee5c525) | 不把包加载或文件重开冒充同一 Run 的恢复 | Trusted Plugin、SQLite、lease/fence、封存提案与结果消费检查点 | [249](docs/verification/v07-observations.md) |
| [v0.8 · 正文独立提交](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1) | 不把运行终态或文件报告当作正文提交 | 单块 Publication、稳定身份与展示位置、修订 CAS、原回执回读 | [全量机读回执](docs/verification/v08-observations.safe.json) · [原执行输出提炼](docs/verification/v08-full-suite-extract.safe.json) |
| [v0.9 · 单 Run Worker](https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d) | 提交进程退出，不等于原工作丢失或取消 | 独立 submit/work、同 Runtime 与原 lease/fence、持久终态回读 | [309 项组合实跑](docs/verification/v09-combined-observations.safe.json) · [历史交付等价核对](docs/verification/v09-delivery-equivalence.safe.json) |

**v0.2 的维护入口：** 原始阶段保留历史；[独立维护快照 `a10d4f1`](https://github.com/hpoenixf/open-etf-agent/tree/a10d4f1bd1ecc39224272156221fe29792b64094)修正了报告中涉及未读取页面的措辞。若专门体验 v0.2，请使用 `maintenance/v0.2-source-boundary`，不要把旧快照当作已修复版本。

<a id="architecture"></a>
## 架构职责 · Keep the boundaries visible

```text
用户问题 → Runtime ⇄ Gateway
             │         下一次请求由 Context 组织
             ▼
          Tool Host → 读取 / 计算 / 保存
             │
             ├─ ResultStore：取得的原文、版本与精确引用
             ├─ Working notes：有来源依据的派生笔记
             └─ Report / Artifact：不可变修订、附件、引用与保存回执
                           └─ Loopback Reader / evaluate：实际 HTTP 字节回读

显式 Memory 库 → 经授权的保存 / 修订 / 忘记 → 后续输入
```

| 职责 | 负责 | 不替谁做决定 |
| --- | --- | --- |
| **Runtime / Gateway** | 有限模型–工具循环、请求编码、完整响应接收 | 不用片段 JSON 或网络 EOF 冒充完整工具调用 |
| **Tool Host** | 绑定工具、校验参数与权限、执行并返回回执 | 不接受模型指定任意宿主文件路径 |
| **ResultStore / Context** | 保存不可变原文；为下一请求组织有界工作视图 | 工作视图不改写原始来源；检索命中不冒充已读原文 |
| **Compaction / Memory** | 派生工作笔记；显式库与写入意图；排除已忘记内容的后续输入 | 摘要不升级为原文，临时要求不自动成为长期偏好 |
| **Trusted Plugin（v0.7）** | 显式贡献、身份绑定、原子激活与逆序资源释放 | 不充当沙箱，不由模型安装或扩权 |
| **Publication（v0.8）** | 原 Session 事务中的独立正文、修订与当前交付位置 | 不替代 Artifact、不因 Run 失败删除已提交正文、不引入第二执行器 |
| **单 Run Worker（v0.9）** | 在另一进程驱动一个显式原 Run，并读取权威终态 | 不复制 Session 的 lease/fence，不将宿主停止当用户取消，不建队列或 Scheduler |
| **SQLite / Checkpoint（v0.7）** | 在原 Runtime 边界持久化请求、预算、提案、结果与消费位置 | 不建立第二条执行链，不重试 unknown，不承诺外部 exactly-once |

从当前 [源码目录](src)进入；设计动因与真实失败见[演进证据索引](docs/evolution/evidence-index.md)。

## 验证到哪里，声明到哪里

先看 [v0.1–v0.9 验证证据索引](docs/verification/README.md)：按阶段进入 observations、receipts、provenance 与 qualification，历史证据不被新测试数字覆盖。

当前 main 保留 [v0.6 窄范围维护修复](docs/verification/v06-errno-maintenance.md)：包装后的真实文件已存在异常仍能进入原有身份/字节核对，未知错误、取消与 null/undefined 原因不被吞掉。维护版本在 Node 26.11.1 完整回归 184/184；不借此改写固定阶段的历史证据，也不冒称模型质量通过。

v0.7 最终冻结输入在 Node 26.11.1 **249/249** 通过，包含 12 个真实进程中断/取消/跨重启期限场景及独立恢复反例；另有独立锁定安装/构建、5 个 durable profile、9 份退出后报告回执、T1–T4 **HTTP 4/4** 与保留的 v0.6 产物回读。原 Evidence Kit 记录 **6/6、provider-free completion**，不把结构检查当作测试执行认证。组件 RED/GREEN、失败与修复、精确输入及执行范围见 [v0.7 实测记录](docs/verification/v07-observations.md)、[冻结输入](docs/verification/v07-candidate-inputs.json)和 [交付回读](docs/verification/v07-delivery-receipts.safe.json)。本阶段新增真实模型调用为 **0**。

v0.8 在同一 Runtime 上完成 **286/286** provider-free 全量检查及独立安装、构建和跨进程 CLI 回读；正文提交后故障、真实进程中断、旧回执确认分别有用例。随后仅将两份包元数据的版本字段提升到 0.8.0：117 个行为/测试输入与 95 项锁定依赖不变，补做独立安装/构建与版本检查，未把这一步冒称重新跑过 286 项。原始机读记录的 [`fullSuite` 字段](docs/verification/v08-observations.safe.json)已包含命令、退出码、耗时和286个case计数；[保留输出的结构化提炼](docs/verification/v08-full-suite-extract.safe.json)另外核对原输出，不冒充新执行。两个精确输入摘要及证据归属见 [v0.8 记录](docs/verification/v08-observations.md)。没有新增模型调用。

v0.9 的原 Worker 组合先留下 305/305 历史记录；合入既有 CI/版本血缘维护后，对新的 124 输入组合实际重跑 **309/309**，零跳过、取消或失败。19 个 Worker 用例的实现与测试字节未改；变更的是既有覆盖校验器及其单测。原独立安装/八进程 CLI 记录保留，通过 58 个交付输入与 55 个既有构建文件逐字相同的证据衔接，不冒称再次安装运行。见[组合机读回执](docs/verification/v09-combined-observations.safe.json)、[冻结输入](docs/verification/v09-combined-inputs.json)和[交付等价边界](docs/verification/v09-delivery-equivalence.safe.json)。本期仍为 Runtime 验收，新增真实模型调用为 0。

| 已有证据 | 仍需分别验证 / 当前不支持 |
| --- | --- |
| v0.6 记录了独立安装后的 171/171 测试、构建、八类示例、11 份报告退出后回读与 T1–T4 HTTP 验证 | 不据此宣称真实模型理解、选择资料或摘要质量已通过；v0.6 没有新增真实模型调用 |
| 真实 fixture 子进程、MCP 协议往返、文件保存与退出后回读 | fixture 进程不是任意第三方代码沙箱；初始化阶段 MCP 取消仍未专门验证 |
| 原文与派生笔记分离，Memory 有显式写入意图和忘记后的未来输入边界 | 忘记不自动抹去历史报告；普通文件重开不是恢复证明，v0.7 恢复须看独立真实进程测试 |
| 本机单用户、受限路径、明确的失败与部分效果 | 不承诺生产金融服务、多租户、交易、后台调度或通用向量平台 |

<a id="live-evidence"></a>
### 真实调用记录：16 次 HTTP，不是 16 次能力认证

[v0.1–v0.5 首批真实调用记录（固定提交 `d075068`）](https://github.com/hpoenixf/open-etf-agent/blob/d075068ac99a6c798d012c46bff4fe0c33eb9979/docs/verification/live-v01-v05-first-batch.md)使用各版原 Runtime / Gateway，每版一个原创合成问题，共 **16 次经认证的真实 HTTP 调用，16 个 HTTP 200 响应**。v0.1 留下真实拒绝且没有报告；v0.2–v0.5 的报告实际回读并核对 hash。HTTP 200、报告存在或订阅调用成功，都不单独等于任务成功。

**模型质量仍未评审，底层 `semanticStatus` 仍为 `unreviewed`。** 历史的小范围人工措辞观察保留，但不是完整、独立的语义评测。验收目标是 Runtime 正确性；未触达的 Skill、MCP、Child、Memory、Compaction 等机制仍未取得该批次 live 覆盖，更不是 v0.7 SQLite / 恢复的 live 资格。

<a id="live-entry"></a>
### 受限 live 入口：与演示 CLI 明确分开

默认 `npm run demo -- --live` 会拒绝；这不表示项目从未做过真实调用，也不能通过把参数改成另一个 fixture 绕过限制。另有独立的 `scripts/live-validate.mjs` runner，入口见 [固定版受限验证说明](https://github.com/hpoenixf/open-etf-agent/blob/d075068ac99a6c798d012c46bff4fe0c33eb9979/docs/live-validation.md)与 [当前说明](docs/live-validation.md)。

这个 runner 要求读者**自己的 provider、合成数据和费用授权**，显式选择固定版本、私有配置与跨版本共用的预算 ledger；未知结果会阻止继续，不自动重试，也不继承其他操作者的预算或凭据。上方 quickstart / demo / session 命令仍是离线示例。本次 v0.9 没有新增模型请求，不把这份历史记录改称当前版本的 live 认证。

## 许可证 · License

项目原创代码与随附原创文档采用 [MIT](LICENSE)，Copyright © 2026 Huang Pengfei。第三方依赖、随附 Evidence Kit 及其 NOTICE 保留原许可证与归属；本许可不覆盖项目之外的私有源码、书稿或外部内容。`private: true` 仅防止意外发布 npm 包，不限制 MIT 授予的使用权。

[v0.7 Spec / 恢复证据](openspec/changes/v07-trusted-recovery/evidence.md) · [v0.6 验证记录](docs/verification/v06-observations.md) · [v0.6 原始 Spec / RED-GREEN 证据](openspec/changes/v06-artifact-reader/evidence.md) · [v0.6 固定来源清单](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-candidate-inputs.json)

阶段证据与交付清单保留验收时冻结输入的历史身份，文档中的 candidate / prepared-only 是发布前记录，不是当前远端状态。发布保留了原 main 的 MIT LICENSE 字节（与候选仅换行不同）并整合本首页；这些清单不声称两项文档覆盖后的哈希仍相同。所有冻结的可执行文件、测试、fixtures 与锁文件保持原样，原有首页视觉资源与维护记录也保留。

[v0.5 失败与修复记录](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-observations.md) · [产物来源与哈希](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-evidence-provenance.json) · [SDK 选择与兼容边界](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/dependencies/sdk-selection.md)

<a id="reading"></a>
## 文章与代码 · Read → inspect → run

这些文章讨论更广的 Agent 工程问题。右侧是本仓库可运行的**最小机制实验**，不是原文全部高级能力的开源实现；具体支持范围以对应快照为准。

**覆盖契约（31 篇模块文章）：** `verified` 只表示表中明确限定的最小 Runtime 切片，不是整篇文章实现、模型质量或生产认证；`无公开对应` 不借相邻机制认领；`draft` 尚未取得资格。表由 [唯一覆盖清单](docs/verification/article-coverage.json)与 [版本血缘](versions.json)生成：`since` 是该最小切片首次公开引入版本；`verifiedAt` 是当前实跑回执绑定的固定代码，不能用后者改写前者。`无公开对应` 不填虚构的引入版本。文章目录固定来自 [book.mjs / modules](https://github.com/hpoenixf/eff-agent-article/blob/fb7c776874e71d689212c6fc3c4f0efde598fa81/book.mjs)。

<!-- article-coverage:start -->
| 文章 | since · 引入版本 | verifiedAt · 固定 commit + case | 状态 |
| --- | --- | --- | --- |
| [Entry：为什么入口越来越简单](https://hpoenixf.com/eff-agent-article/articles/022-agent-entry-from-intent-to-direct-research) | — | —<br>缺 Direct/Research 决策、授权目录呈现与普通追问 | 无公开对应 |
| [Web：从搜索到连续阅读](https://hpoenixf.com/eff-agent-article/articles/021-agent-web-research-from-search-to-deep-reading) | — | —<br>缺 HTTP 获取、连续阅读、页面状态和来源撤销 | 无公开对应 |
| [Agent 说“今天”时，到底是哪一天](https://hpoenixf.com/eff-agent-article/articles/agent-temporal-semantics-market-calendar) | — | —<br>缺可信时区、日历覆盖和行情 dataAsOf | 无公开对应 |
| [PDF：从文本到证据](https://hpoenixf.com/eff-agent-article/articles/024-agent-pdf-from-text-to-evidence) | — | —<br>缺 PDF 文本/页图/版面定位/多模态读取 | 无公开对应 |
| [Subagent：从隔离到专业化协作](https://hpoenixf.com/eff-agent-article/articles/agent-subagent-context-specialization) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `--case fixture-child`<br>一层脚本 Child 共享预算并交回原始结果；非真实模型专家 | verified |
| [自定义专家，不应该只是一个 Prompt 输入框](https://hpoenixf.com/eff-agent-article/articles/agent-custom-expert-from-prompt-to-recovery) | — | —<br>缺专家 CRUD/版本冻结/目录权限/历史身份/恢复 | 无公开对应 |
| [Adaptive Research 与 Python](https://hpoenixf.com/eff-agent-article/articles/adaptive-research-python-workbench) | — | —<br>缺模型研究问题修订、任意获准 Python、数据工件接力 | 无公开对应 |
| [Python：从工具到计算工作台](https://hpoenixf.com/eff-agent-article/articles/agent-python-compute-workbench-evolution) | — | —<br>缺隔离执行/代码与输入身份/失败后工件保留 | 无公开对应 |
| [把个人持仓接入 Agent：我们怎样设计一个只读金融 MCP](https://hpoenixf.com/eff-agent-article/articles/portfolio-mcp-readonly-investment-data) | — | —<br>缺 portfolio-report、份额/现金/快照口径和方案计算 | 无公开对应 |
| [数据过期后的受控刷新](https://hpoenixf.com/eff-agent-article/articles/unavailable-is-correct) | — | —<br>缺刷新任务身份、scope/fingerprint 去重、来源拒绝与原子发布新证据 | 无公开对应 |
| [结果外置与完整性：模型到底读到了多少](https://hpoenixf.com/eff-agent-article/articles/tool-results-outside-model-context) | [v0.4](https://github.com/hpoenixf/open-etf-agent/commit/ecf6cb45b4062586614e83aed917c92d704cb63b) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `--case retrieve-reread`<br>词法候选→真实读页→精确原文回读；非完整原文覆盖平台 | verified |
| [Main 压缩：摘要不改写原始事实](https://hpoenixf.com/eff-agent-article/articles/agent-main-run-context-compaction) | [v0.5](https://github.com/hpoenixf/open-etf-agent/commit/05c0dd2dc550f4f7e5da034340ff5c3159768fcf) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `--case compact-and-reread`<br>派生便笺与原文分离、采用后回读；摘要质量未评 | verified |
| [Memory：从保存、召回到安全遗忘](https://hpoenixf.com/eff-agent-article/articles/026-agent-memory-forget-durable-effects) | [v0.5](https://github.com/hpoenixf/open-etf-agent/commit/05c0dd2dc550f4f7e5da034340ff5c3159768fcf) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `--case explicit-memory`<br>显式合成意图的保存/修订/忘记；非认证用户 Memory 服务 | verified |
| [RAG：文档撤权与历史回放](https://hpoenixf.com/eff-agent-article/articles/027-rag-revocation-publish-replay) | — | —<br>缺动态 ACL/撤权传播、发布资格与历史回放再授权 | 无公开对应 |
| [Provider：统一接口之后，为什么还需要共享准入](https://hpoenixf.com/eff-agent-article/articles/agent-provider-architecture-and-admission) | [v0.1](https://github.com/hpoenixf/open-etf-agent/commit/f9370b81beef84199293120ee23d245bb0129553) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/gateway.test.mjs` · 1.4 injected offline transport verifies request encoding and matched tool results<br>离线 transport 的 Gateway 编码与配对；无共享 Provider 准入 | verified |
| [模型返回 HTTP 200，为什么下一次还要排队](https://hpoenixf.com/eff-agent-article/articles/agent-provider-admission-capacity-lease) | — | —<br>缺跨进程队列、租约/隔离、远端 unknown/释放及 PG 控制库 | 无公开对应 |
| [Extension Host：从功能机到智能机](https://hpoenixf.com/eff-agent-article/articles/020-agent-extension-host-smartphone) | [v0.7](https://github.com/hpoenixf/open-etf-agent/commit/5f70dc0b4760ad70ef211f4823828ab2fee5c525) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/plugins.test.mjs` · 7.1 two trusted packages use the ordinary Host and acquired source/method owners<br>可信包接入同一 Host；不是隔离沙箱或完整多生态 Host | verified |
| [从接上 MCP 到真正用上工具：Agent 的接入链路怎样构建](https://hpoenixf.com/eff-agent-article/articles/mcp-host-from-discovery-to-consumption) | [v0.2](https://github.com/hpoenixf/open-etf-agent/commit/a79e89bf709d4a2245b5a8652882a591ba467519) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `--case skill-mcp`<br>真实 stdio 合成 MCP 发现、准入与取得；非金融数据服务 | verified |
| [Tool Surface：Agent 有工具，模型为什么看不到](https://hpoenixf.com/eff-agent-article/articles/agent-model-capability-presentation-tool-surface) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/cooperation-integration.test.mjs` · 3.4 fixture child shares root counters and advertises only allowed read tool<br>Child 只呈现获准读工具；非完整动态能力编排 | verified |
| [A35 内容信任：Prompt Injection 不只是恶意文本](https://hpoenixf.com/eff-agent-article/articles/agent-content-trust-prompt-injection) | [v0.4](https://github.com/hpoenixf/open-etf-agent/commit/ecf6cb45b4062586614e83aed917c92d704cb63b) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/context.test.mjs` · 4.2 projection never launders a lookalike or altered payload into an acquired ref<br>Context 拒绝伪造原文身份；非完整 A35 安全模块 | verified |
| [多生态 Hook：Claude、Pi 与 Codex](https://hpoenixf.com/eff-agent-article/articles/agent-multi-ecosystem-hook-execution) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/cooperation-integration.test.mjs` · 3.3 Host revalidates effective Hook arguments and preserves original call<br>同一 Host 复验 Hook 改参并保留原调用；无多生态转换层 | verified |
| [工具调用到模型输入的观测链](https://hpoenixf.com/eff-agent-article/articles/agent-tool-lifecycle-and-model-input) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `--case batch-read`<br>合成 worker 经现有 Runtime/Host 保存来源；非完整观测平台 | verified |
| [Run 预算与约束治理](https://hpoenixf.com/eff-agent-article/articles/agent-runtime-constraint-governance-v2) | [v0.3](https://github.com/hpoenixf/open-etf-agent/commit/5d57314826447f024d878674b98057742b4ce4cd) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/cooperation-integration.test.mjs` · 3.3 root budget refusal stops before a second model request<br>根预算拒绝阻止下一模型请求；非全部预算政策 | verified |
| [Agent 的请求数、Token 与 Credits 记账](https://hpoenixf.com/eff-agent-article/articles/agent-personal-credits-shadow-accounting) | — | —<br>缺账户/物理尝试身份、归因、价格目录与影子成本核算 | 无公开对应 |
| [Agent 收到控制指令后，为什么不能立刻执行](https://hpoenixf.com/eff-agent-article/articles/agent-control-events-durable-owner-adoption) | [v0.7](https://github.com/hpoenixf/open-etf-agent/commit/5f70dc0b4760ad70ef211f4823828ab2fee5c525) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/durable-runtime.test.mjs` · 7.3 cancel during pending model is durable and late proposal cannot dispatch<br>持久取消阻止迟到提案执行并跨进程保持；非完整控制事件系统 | verified |
| [定时研究：会话结束后继续](https://hpoenixf.com/eff-agent-article/articles/agent-autonomous-scheduled-research) | [v0.9](https://github.com/hpoenixf/open-etf-agent/commit/dad9c6e64f32c3d7579aea96613776b40917ec6d) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/worker-cli.test.mjs` · 9.1 submit exits before a separate work process drives and reads the original Run<br>显式 submit 与独立 work 进程沿原 Run 回读；无定时触发、Task 编排、通知或前台并发 | verified |
| [Langfuse：从 Trace 到可信观测](https://hpoenixf.com/eff-agent-article/articles/025-agent-langfuse-from-trace-to-trustworthy-observability) | — | —<br>缺 Langfuse exporter/span/session 归属与远端失败隔离 | 无公开对应 |
| [Publication：为什么需要独立发布系统](https://hpoenixf.com/eff-agent-article/articles/019-agent-answer-publication) | [v0.8](https://github.com/hpoenixf/open-etf-agent/commit/2c096ce47be2161f97531170af07ef255872f8b1) | [2ddd44f](https://github.com/hpoenixf/open-etf-agent/commit/2ddd44fe5e6546c62d0347916bf11bb5f7cd2a9e) + `test/publication-cli.test.mjs` · 8.2 local CLI starts same Runtime and separately reads body, current event and immutable Artifact<br>同一 Runtime 提交正文并经独立 CLI 回读，与报告 Artifact 分离；不含 Web / SSE / Worker 或完整发布系统 | verified |
| [渐进式回答如何保持连贯](https://hpoenixf.com/eff-agent-article/articles/agent-progressive-answer-coherence) | — | —<br>缺 committed blocks/revision、前端渐进展示和历史一致性 | 无公开对应 |
| [异步研究：离开页面后怎样按时交付](https://hpoenixf.com/eff-agent-article/articles/agent-asynchronous-research-time-bound-delivery) | — | —<br>缺离开后持续任务、by/at 交付约定、通知和同 Run 恢复 | 无公开对应 |
| [Agent 问完用户之后：持久人机交互](https://hpoenixf.com/eff-agent-article/articles/agent-durable-human-interaction-response-adoption) | — | —<br>缺 request/response/adoption/effect 身份、Human Park/Continue 与认证用户回复 | 无公开对应 |
<!-- article-coverage:end -->

```sh
# 默认快速检查：真实 Git commit / 公开元数据 + 源码与既有实跑回执一致性；不重跑 case
node scripts/check-article-coverage.mjs
# 显式有界复跑：仅现有 CLI 和精确 node:test，去重；不允许 live 或任意 shell 命令
node scripts/check-article-coverage.mjs --smoke
# 清单修改后更新表；render 本身不给 verified 资格
node scripts/check-article-coverage.mjs --render
```

`since` 的历史 commit/tree/原文件 blob 也会核对；例如 MCP 始于 v0.2，Result/Context 始于 v0.4，Compaction 始于 v0.5，不能把相邻模块或后续验证提交写成首次引入。`verifiedAt` 固定提交是本次可复现的验证锚点；当前 `main` 的相关源码、fixtures、锁文件及原测试必须仍与 [冻结输入](docs/verification/article-coverage-source.json)逐字节匹配。两者相同才复用同一实际执行；源码、case 或校验器变更会使 [回执](docs/verification/article-coverage-receipts.json)失效，须重新冻结和实跑，不能只改链接维持绿灯。历史锚点不是“永远最新 main”的别名。`--check` 检查已有实跑证据，**不声称这台机器刚执行了 case**；没有本地 Git 对象时只尝试公共 GitHub 元数据，离线或失败不会假 pass。`--smoke` 需要 quickstart 的已安装依赖与 Node 范围，最多 16 个去重目标、每个 30 秒、总计 120 秒；仅原创合成数据，不继承模型凭据或任意 Node 预加载；子进程及嵌套 Node 使用固定 512 MiB heap，`TMPDIR` 指向本次自有输出目录，输出留在 `test-output/`，safe 回执只存身份与执行/产物摘要，不发布数据库或原始日志。

多篇文章若共用 target，则共享同一次最小机制执行证据，不增加实现数量。上述 Gateway 测试的离线 transport、脚本 Child 和 fixture MCP 都不是新真实模型调用。证据是可复核执行记录而非防伪签名；当前运行仍只有 Runtime 验收，`semanticStatus: unreviewed` 不变。

从零开始可先读 [v0.1：从第一份可回读报告开始](https://hpoenixf.com/eff-agent-article/articles/open-etf-agent-v01-first-readable-report?lang=zh)（[完整英文版](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v01-first-readable-report?lang=en)）。更多内容见[文章阅读站](https://hpoenixf.com/eff-agent-article/)。

<a id="roadmap"></a>
## 后续路线 · Planned, not shipped

v0.9 的单 Run Worker 已列入上方固定阶段；以下仍是候选，没有启动 v0.10 实现。

| 阶段 | 规划方向 |
| --- | --- |
| **v0.10（候选）** | CLI 先行；有明确网络消费者时再加最小只读交付适配，不预设 SSE 或浏览器验收 |
| **后续 0.x** | Web 取材、PDF 解析、隔离 Python 分别独立评估；一版一个模块，不赶编号 |
| **v1.0 / v2.0** | 已完成模块的稳定资格里程碑，不新增一包功能；见[修订路线](docs/plan/v1-to-v2.md) |

[PR #1 原始提案](https://github.com/hpoenixf/open-etf-agent/pull/1) · [完整路线与验收合同](https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/README.md) · [目标能力矩阵](https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/05-coverage-matrix.md)

原始提案保留为历史设计记录；后续按“一版一个真实模块、CLI/API 优先、少依赖配置、从原 ETF Agent 模块提炼”的修订方向推进。已有较大候选只保留为 WIP，不因代码已写就捆绑发布。当前公开实现见固定版本表，路线不是已交付清单。

### 反馈与参与

欢迎通过 [Issues](https://github.com/hpoenixf/open-etf-agent/issues) 提交问题或讨论。可复现问题请附**阶段/提交、Node 版本、最小步骤、预期与实际结果**；请勿提交密钥、私人资料、数据库、真实持仓或未经清理的原始日志。改进建议优先说明它解决的具体问题，以及如何验证。

<a id="english"></a>
## English at a glance

**Open ETF Agent** is a small research Agent built through independently runnable development snapshots. Start with a source-linked Markdown report, then add Skills, MCP, bounded cooperation, exact source rereading, derived notes and explicit Memory.

- **Run:** clone `main` directly using [Quickstart](#quickstart). The default branch contains the latest verified stable development code, **v0.9**, with a [fixed stage snapshot](https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d). Node.js 26.8.1–26.x is required; local v0.9 qualification uses 26.11.1, and demos run offline after dependency installation.
- **Publication:** v0.8 adds one durable body block, stable identity/ordinal, revision CAS and independent CLI readback. It records 286 provider-free checks followed by a separately verified version-metadata-only promotion; see the [machine-readable full-suite record](docs/verification/v08-observations.safe.json) and [historical output extract](docs/verification/v08-full-suite-extract.safe.json). That v0.8 slice did not include Worker or Web Chat and did not obtain new live-model qualification.
- **Worker:** v0.9 adds explicit submit in one process and bounded work in another through the original Session lease and same Runtime. Host stop is not user cancellation; unknown dispatched requests are not automatically retried. The current combined input passed [309 provider-free cases](docs/verification/v09-combined-observations.safe.json). Original install/eight-process CLI evidence is retained only with [exact unchanged delivery-input proof](docs/verification/v09-delivery-equivalence.safe.json), not relabeled as a fresh run. No queue, scheduler, foreground-chat concurrency or new model calls are added.
- **Inspect:** each [stage](#versions) retains its fixed implementation, fixtures and evidence. The [v0.7 README](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/README.md) has detailed English instructions for trusted packages and same-Run continuation. The [v0.6 README](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/README.md) remains available for the earlier artifact/HTTP stage.
- **Interpret honestly:** v0.6 qualification records 171 offline tests, eight demos, eleven report readbacks and four-case HTTP checks, with no new model calls. v0.7 records 249/249 tests, independent installation/build, five durable profiles, nine report receipts and HTTP 4/4, with zero new provider calls. Real process interruption/new-PID checks, not terminal file readback alone, qualify its bounded recovery. Unknown effects are not retried. “Stable” means bounded Runtime qualification, not a formal release or production-readiness claim.
- **Real calls:** [16 historical HTTP requests across v0.1–v0.5](#live-evidence) are separate from the offline demos. Model quality remains unreviewed. The demo CLI refuses `--live`; the separate `scripts/live-validate.mjs` runner requires explicit provider/data/cost authorization. This is **not v0.9 live-recovery qualification**.
- **Scope:** local, single-user, synthetic examples; no trading or investment advice. These snapshots are not formal releases, and original project code is licensed under [MIT](LICENSE); third-party licenses and notices remain in force.

---

<p align="center">小步演进，保留证据。<br /><sub>Build small. Keep evidence.</sub></p>



