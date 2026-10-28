<p align="center"><a href="README.md">English</a> | <strong>简体中文</strong></p>

<p align="center">
  <img src="docs/assets/open-etf-agent-hero.svg" alt="Open ETF Agent — Build small. Keep evidence. 从第一份报告，逐步演进到可回读的原文与显式 Memory。" width="1200" />
</p>

<p align="center"><small>图示保留截至 v0.10 的演进；当前 v0.11 本地 PDF 模块见下文。</small></p>

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

> **从哪里开始？** 直接克隆 `main`，无需切换阶段分支：默认提供最新已验证稳定的开发代码 **v0.11.0**，新增唯一模块“本地文本层 PDF 输入”，对应[固定源码 `5f42c33`](https://github.com/hpoenixf/open-etf-agent/tree/5f42c33892d57ed05e8cd09cad48573e6901995b)；此前九个阶段的 `phase/v0.1`—`phase/v0.9` 及 [v0.9 Worker 快照 `dad9c6e`](https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d)、 [v0.8 Publication 快照 `2c096ce`](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1)、 [v0.7 固定快照 `5f70dc0`](https://github.com/hpoenixf/open-etf-agent/tree/5f70dc0b4760ad70ef211f4823828ab2fee5c525) 与 [v0.6 固定快照 `7480b65`](https://github.com/hpoenixf/open-etf-agent/tree/7480b656b18192e6d6b44aab65255b970d58e6f8) 不被改写。这里的“稳定”指下文 **provider-free Runtime 回归与交付验证**，**不等于正式 Release、模型能力认证、live 恢复认证或生产就绪**。项目原创代码采用 [MIT 许可证](LICENSE)，第三方组件保留各自许可。

> **想看真实模型调用，而不只是 fixture？** 先看 [v0.1–v0.5 的 16 次真实 HTTP 调用记录](#live-evidence)，再看 [独立受限 live runner 的入口与授权条件](#live-entry)。这些是历史证据，不是 v0.11 live 恢复资格。

### 在这里可以看到什么

- **一次真实的文件交付：** 报告、来源版本、原文快照、文件哈希和保存回执，而不只有一段“已完成”的回答。
- **一条逐步增加能力的执行链：** 新机制接回既有 Runtime / Tool Host，不另造一条只供演示的执行流程。
- **可核对的验证边界：** 保留失败、修复和未验证项，区分程序机制通过、模型判断正确与正式发布。

<a id="quickstart"></a>
## 快速运行 · Quickstart

需要 **Node.js 26.8.1–26.x** 与 npm。默认示例不需要模型密钥；安装依赖可能访问 npm，安装后的示例离线运行。

Node 下限按实际 API 使用范围放宽到 26.8.1。当前 v0.11 的窄安装、构建与 CLI 验证由 Node 26.11.1 执行；26.8.1 全绿是使用者提供的 v0.6 观察，未在本执行环境重跑，不冒充 v0.11 的最低版本实测。详见 [v0.6 文件系统包装异常修复与验证](docs/verification/v06-errno-maintenance.md)与 [v0.7 工具链证据](docs/verification/v07-observations.md)。

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

### v0.11：一个本地 PDF，一张物理页，保留原始字节

本版唯一新增模块是**本地文本层 PDF 输入**，对应[固定源码 `5f42c33`](https://github.com/hpoenixf/open-etf-agent/tree/5f42c33892d57ed05e8cd09cad48573e6901995b)。由操作者选文件，模型只能请求物理页号；复用既有 Host / Result 链，再通过 Artifact 回读带引用报告与原始 PDF。

```sh
# 原创合成 PDF，不需要模型密钥或外部文档
node dist/src/cli.mjs --case local-pdf --output runs/local-pdf
# 可选：显式选择自己的本地文本层 PDF 与物理页
node dist/src/cli.mjs --case local-pdf --pdf /path/to/selected.pdf --pdf-page 3 --output runs/selected-pdf
```

第二条路径是操作者需要替换的占位符，不是模型工具参数。上限为 1 MiB、16 张物理页，并限制文本量和解析时长；空白页不改变后续页号。`pdf2json@4.1.0` 真实解析，Gateway 决策仍为脚本，不是模型语义评测。没有 OCR、视觉/表格理解、远程取材或活跃 PDF 的持久恢复；解析子进程**不是恶意文件安全沙箱**。

[验收与保留失败](openspec/changes/v011-local-pdf/evidence.md)分别记录原 Runtime 回归、当前维护检查及[新目录安装/build/独立进程字节回读](docs/verification/integrated-install-pdf.safe.json)。回归暴露的热日志准入问题由既有 Session 职责内修复，属于必要可靠性维护，不包装成第二个新模块，也不承诺 PDF 活跃恢复。另见[原职责保留与公开简化边界](docs/evolution/v011-pdf-lineage.md)。

### v0.10：从原始选区到同一份报告与 CSV

这一完整的 Result / Reference 模块现整理为 **v0.10.0**，可从[固定源码 `ff5b927`](https://github.com/hpoenixf/open-etf-agent/tree/ff5b9273ef0d239e804f61792702cd2e94174be7)复现。这是保留的已编号模块；这不是 v1.0 或 v1.1 已发布。它取代缺少独立消费者的旧 0.10 读取适配候选，并承载原计划 1.1 的这项最小增量，不重复实现一遍：

```sh
node src/cli.mjs --case result-consumption --output runs/result-consumption
```

示例从不可变合成表选择明确的行，以原值及单位、币种、日期计算，再让下一次 Gateway 请求、报告和 CSV 消费同一计算引用。尾行不在选区、币种或日期不一致、分母未知时，不伪造数值或附件，也不阻止独立合法正文；直接提供数字的算术仍不带来源资格。

[来源与交付反例](https://github.com/hpoenixf/open-etf-agent/blob/e442f600891be79625fc78751e2d9f39905920da/test/result-consumption-delivery.test.mjs)、[原 0.9.0 元数据下 333/333 实跑记录](https://github.com/hpoenixf/open-etf-agent/blob/e442f600891be79625fc78751e2d9f39905920da/docs/verification/result-consumption-observations.safe.json)和[独立安装、build、CLI 与新进程字节回读](https://github.com/hpoenixf/open-etf-agent/blob/e442f600891be79625fc78751e2d9f39905920da/docs/verification/result-consumption-independent.safe.json)分别保留实际执行边界。测试检查生产 Gateway 的请求编码，但传输由离线 fixture 注入；没有新增真实模型调用，也没有金融语义或真实市场数据资格。

本次编号只改 package/lock 的三个版本字段，123 个非 package 执行输入与 95 条依赖保持原样；[新的窄安装/build/CLI 回读及精确等价记录](https://github.com/hpoenixf/open-etf-agent/blob/ff5b9273ef0d239e804f61792702cd2e94174be7/docs/verification/v010-numbering.safe.json)单列保存，没有把旧 333 项改称在 0.10.0 下重新执行。历史 [15 个原目标的实跑回执](docs/verification/history/article-coverage-receipts-d943dd8452e4.json)绑定新版固定源码；旧执行记录保留。

**升级边界：`tool-host@1` 快照不能经 `tool-host@2` Runtime 续跑或重放。** 替换版本前，先在原版本结束活动 Run，或隔离旧部署；保留输出通过独立接口读取。详见[升级契约与操作清单](docs/upgrade-guide.zh-CN.md)。

<details>
<summary>历史版本</summary>

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

</details>

<a id="versions"></a>
## 版本演进 · Ten fixed snapshots

十个阶段链接均指向固定提交，保留当时的代码、锁文件、示例与证据。表中的测试数是**各快照已记录的离线回归**，不是成熟度评分，也不是 CI 或模型能力徽章。

| 阶段 | 这一步解决什么 | 新增可见机制 | 记录的离线回归 |
| --- | --- | --- | ---: |
| [v0.1 · 第一份报告](https://github.com/hpoenixf/open-etf-agent/tree/f9370b81beef84199293120ee23d245bb0129553) | 让“完成”对应实际文件 | Runtime、Gateway、Tool Host、来源与保存回执 | 23 |
| [v0.2 · 方法与工具](https://github.com/hpoenixf/open-etf-agent/tree/a79e89bf709d4a2245b5a8652882a591ba467519) | 外部能力沿同一工具链进入 | 显式 Skill、真实 stdio MCP、完整 SSE 接收 | 49 |
| [v0.3 · 受限分工](https://github.com/hpoenixf/open-etf-agent/tree/5d57314826447f024d878674b98057742b4ce4cd) | 并行工作仍共享边界与预算 | Hook、固定 worker、一层 fixture-child、只读观察 | 71 |
| [v0.4 · 原文可离开窗口](https://github.com/hpoenixf/open-etf-agent/tree/ecf6cb45b4062586614e83aed917c92d704cb63b) | 缩小输入，仍能找回原版本 | ResultStore、Context、词法检索、ResultRef 精确回读 | 96 |
| [v0.5 · 笔记与显式记忆](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf) | 分清原文、派生笔记和未来偏好 | Compaction、Memory 保存/修订/忘记 | 124 |
| [v0.6 · 交付与阅读](https://github.com/hpoenixf/open-etf-agent/tree/7480b656b18192e6d6b44aab65255b970d58e6f8) | 已保存结果能按身份打开、下载并核对 | Artifact / Revision、CSV 附件、loopback Reader、HTTP evaluate | 171 |
| [v0.7 · 可信贡献与恢复](https://github.com/hpoenixf/open-etf-agent/tree/5f70dc0b4760ad70ef211f4823828ab2fee5c525) | 不把包加载或文件重开冒充同一 Run 的恢复 | Trusted Plugin、SQLite、lease/fence、封存提案与结果消费检查点 | [249](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-observations.safe.json) |
| [v0.8 · 正文独立提交](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1) | 不把运行终态或文件报告当作正文提交 | 单块 Publication、稳定身份与展示位置、修订 CAS、原回执回读 | [全量机读回执](docs/verification/v08-observations.safe.json) · [原执行输出提炼](docs/verification/v08-full-suite-extract.safe.json) |
| [v0.9 · 单 Run Worker](https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d) | 提交进程退出，不等于原工作丢失或取消 | 独立 submit/work、同 Runtime 与原 lease/fence、持久终态回读 | [309 项组合实跑](docs/verification/v09-combined-observations.safe.json) · [历史交付等价核对](docs/verification/v09-delivery-equivalence.safe.json) |
| [v0.10 · 同一结果贯通消费](https://github.com/hpoenixf/open-etf-agent/tree/ff5b9273ef0d239e804f61792702cd2e94174be7) | 原选区与派生结果能核对到实际消费者 | 来源绑定计算、下一 Gateway 编码、同引用报告/CSV与独立回读 | [原实现 333 项](docs/verification/result-consumption-observations.safe.json) · [编号窄资格](docs/verification/v010-numbering.safe.json) · [15 个原目标新回执](docs/verification/history/article-coverage-receipts-d943dd8452e4.json) |
| [v0.11 · 本地 PDF](https://github.com/hpoenixf/open-etf-agent/tree/5f42c33892d57ed05e8cd09cad48573e6901995b) | 读取物理页，同时保留原文件 | 有界文本提取、原 Result、引用报告与原始 PDF 附件 | [验收与保留失败](openspec/changes/v011-local-pdf/evidence.md) · [新目录独立交付](docs/verification/integrated-install-pdf.safe.json) |

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

先看 [v0.1–v0.11 验证证据索引](docs/verification/README.zh-CN.md)：按阶段进入 observations、receipts、provenance 与 qualification，历史证据不被新测试数字覆盖。

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

这个 runner 要求读者**自己的 provider、合成数据和费用授权**，显式选择固定版本、私有配置与跨版本共用的预算 ledger；未知结果会阻止继续，不自动重试，也不继承其他操作者的预算或凭据。上方 quickstart / demo / session 命令仍是离线示例。本次 v0.11 没有新增模型请求，不把这份历史记录改称当前版本的 live 认证。

## 许可证 · License

项目原创代码与随附原创文档采用 [MIT](LICENSE)，Copyright © 2026 Huang Pengfei。第三方依赖、随附 Evidence Kit 及其 NOTICE 保留原许可证与归属；本许可不覆盖项目之外的私有源码、书稿或外部内容。`private: true` 仅防止意外发布 npm 包，不限制 MIT 授予的使用权。

[v0.7 Spec / 恢复证据](openspec/changes/v07-trusted-recovery/evidence.md) · [v0.6 验证记录](docs/verification/v06-observations.md) · [v0.6 原始 Spec / RED-GREEN 证据](openspec/changes/v06-artifact-reader/evidence.md) · [v0.6 固定来源清单](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-candidate-inputs.json)

阶段证据与交付清单保留验收时冻结输入的历史身份，文档中的 candidate / prepared-only 是发布前记录，不是当前远端状态。发布保留了原 main 的 MIT LICENSE 字节（与候选仅换行不同）并整合本首页；这些清单不声称两项文档覆盖后的哈希仍相同。所有冻结的可执行文件、测试、fixtures 与锁文件保持原样，原有首页视觉资源与维护记录也保留。

[v0.5 失败与修复记录](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-observations.md) · [产物来源与哈希](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-evidence-provenance.json) · [SDK 选择与兼容边界](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/dependencies/sdk-selection.md)

<a id="reading"></a>
## 文章与代码

完整映射、可运行用例与证据边界见[文章与代码指南](docs/articles-and-code.zh-CN.md)。

<a id="roadmap"></a>
## 后续路线 · Planned, not shipped

v0.9 的单 Run Worker 已列入固定阶段；同一条链上的 Result / Reference 闭环现按 v0.10 编号并单独核验版本身份。后续模块仍按原计划逐项完成，不因编号而扩大范围。

| 阶段 | 规划方向 |
| --- | --- |
| **v0.10（已交付）** | Result / Reference：原选区 → 计算 → 下一 Gateway 编码 → 同引用报告/CSV；旧重复读取适配候选已取消 |
| **v0.11（本地 PDF）** | 文本层输入，复用 Result/Artifact 消费；不含 OCR、视觉解析或活跃 PDF 持久恢复 |
| **后续 0.x** | Web 取材、隔离 Python 与更丰富 PDF 能力分别评估；一版一个模块 |
| **v1.0 / v2.0** | 已完成模块的稳定资格里程碑，不计作新增功能版；见[修订路线](docs/plan/v1-to-v2.zh-CN.md) |

Web 取材是原路线中的外网输入候选，仍未编号；Web 读取界面是后置输出消费者，二者不互换。原 1.1 的这项结果消费增量已由 v0.10 承载，不再重复安排；1.3/1.5 继续分别扩展既有 Memory 召回和 Child；各期前置不具备就延期，不顺带补建另一模块。

[PR #1 原始提案](https://github.com/hpoenixf/open-etf-agent/pull/1) · [完整路线与验收合同](https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/README.md) · [目标能力矩阵](https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/05-coverage-matrix.md)

原始提案保留为历史设计记录；后续按“一版一个真实模块、CLI/API 优先、少依赖配置、从原 ETF Agent 模块提炼”的修订方向推进。已有较大候选只保留为 WIP，不因代码已写就捆绑发布。当前公开实现见固定版本表，路线不是已交付清单。

### 反馈与参与

参见[仓库维护验收要求](docs/verification/README.zh-CN.md#repository-maintenance)。

欢迎通过 [Issues](https://github.com/hpoenixf/open-etf-agent/issues) 提交问题或讨论。可复现问题请附**阶段/提交、Node 版本、最小步骤、预期与实际结果**；请勿提交密钥、私人资料、数据库、真实持仓或未经清理的原始日志。改进建议优先说明它解决的具体问题，以及如何验证。

<a id="english"></a>
## English at a glance

**Open ETF Agent** is a small research Agent built through independently runnable development snapshots. Start with a source-linked Markdown report, then add Skills, MCP, bounded cooperation, exact source rereading, derived notes and explicit Memory.

- **Run:** clone `main` directly using [Quickstart](#quickstart). The default branch contains the latest verified stable development code, **v0.11.0**, with a [fixed source snapshot](https://github.com/hpoenixf/open-etf-agent/tree/5f42c33892d57ed05e8cd09cad48573e6901995b). Node.js 26.8.1–26.x is required; local v0.11 narrow qualification uses 26.11.1, and demos run offline after dependency installation.
- **Publication:** v0.8 adds one durable body block, stable identity/ordinal, revision CAS and independent CLI readback. It records 286 provider-free checks followed by a separately verified version-metadata-only promotion; see the [machine-readable full-suite record](docs/verification/v08-observations.safe.json) and [historical output extract](docs/verification/v08-full-suite-extract.safe.json). That v0.8 slice did not include Worker or Web Chat and did not obtain new live-model qualification.
- **Worker:** v0.9 adds explicit submit in one process and bounded work in another through the original Session lease and same Runtime. Host stop is not user cancellation; unknown dispatched requests are not automatically retried. That v0.9 combined input passed [309 provider-free cases](docs/verification/v09-combined-observations.safe.json). Original install/eight-process CLI evidence is retained only with [exact unchanged delivery-input proof](docs/verification/v09-delivery-equivalence.safe.json), not relabeled as a fresh run. No queue, scheduler, foreground-chat concurrency or new model calls are added.
- **Result / Reference:** the completed source-selection → calculation → next-request encoding → report/CSV loop is assigned **v0.10.0**, with [fixed source](https://github.com/hpoenixf/open-etf-agent/tree/ff5b9273ef0d239e804f61792702cd2e94174be7) and [fresh narrow install/build/process readback](https://github.com/hpoenixf/open-etf-agent/blob/ff5b9273ef0d239e804f61792702cd2e94174be7/docs/verification/v010-numbering.safe.json). The default main branch now carries this numbered module. The original 333-case execution is retained under its original metadata, not relabeled. Finish v1 active Runs before the explicit `tool-host@2` upgrade; immutable artifacts remain readable.
- **Inspect:** each [stage](#versions) retains its fixed implementation, fixtures and evidence. The [v0.7 README](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/README.md) has detailed English instructions for trusted packages and same-Run continuation. The [v0.6 README](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/README.md) remains available for the earlier artifact/HTTP stage.
- **Interpret honestly:** v0.6 qualification records 171 offline tests, eight demos, eleven report readbacks and four-case HTTP checks, with no new model calls. v0.7 records 249/249 tests, independent installation/build, five durable profiles, nine report receipts and HTTP 4/4, with zero new provider calls. Real process interruption/new-PID checks, not terminal file readback alone, qualify its bounded recovery. Unknown effects are not retried. “Stable” means bounded Runtime qualification, not a formal release or production-readiness claim.
- **Real calls:** [16 historical HTTP requests across v0.1–v0.5](#live-evidence) are separate from the offline demos. Model quality remains unreviewed. The demo CLI refuses `--live`; the separate `scripts/live-validate.mjs` runner requires explicit provider/data/cost authorization. This is **not v0.10 live-recovery qualification**.
- **Scope:** local, single-user, synthetic examples; no trading or investment advice. These snapshots are not formal releases, and original project code is licensed under [MIT](LICENSE); third-party licenses and notices remain in force.

---

<p align="center">小步演进，保留证据。<br /><sub>Build small. Keep evidence.</sub></p>



