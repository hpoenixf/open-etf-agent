<p align="center">
  <img src="docs/assets/open-etf-agent-hero.svg" alt="Open ETF Agent — Build small. Keep evidence. 从第一份报告，逐步演进到可回读的原文与显式 Memory。" width="1200" />
</p>

<p align="center"><strong>从第一份能打开、能核对来源的报告开始，逐版构建研究 Agent。</strong></p>
<p align="center">
  <a href="#quickstart">快速运行</a> ·
  <a href="#versions">版本演进</a> ·
  <a href="#architecture">架构职责</a> ·
  <a href="#reading">文章与代码</a> ·
  <a href="#roadmap">后续路线</a> ·
  <a href="#english">English</a>
</p>

## Open ETF Agent

一个以成熟机制为基础、通过可运行版本逐步演进的 Agent 项目。先做好读取、工具往返和带出处的文件交付，再按需要加入 Skill、MCP、受限分工、上下文管理与 Memory。每期保留独立代码和验证记录，方便运行、对照，也方便看清一次能力增加究竟改变了什么。

目前的入门案例是**原创合成文档比较**，并非真实基金分析。ETF 研究工具在后续路线中；本项目不提供交易执行或投资建议。

> **从哪里开始？** `main` 是项目首页；可运行实现位于 `phase/v0.1`—`phase/v0.5`。这些是公开开发快照，**不是正式 Release**。下面的快速运行与验证说明绑定 v0.5 的固定提交 [`05c0dd2`](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf)。许可证仍待选择。

### 在这里可以看到什么

- **一次真实的文件交付：** 报告、来源版本、原文快照、文件哈希和保存回执，而不只有一段“已完成”的回答。
- **一条逐步增加能力的执行链：** 新机制接回既有 Runtime / Tool Host，不另造一条只供演示的执行流程。
- **可核对的验证边界：** 保留失败、修复和未验证项，区分程序机制通过、模型判断正确与正式发布。

<a id="quickstart"></a>
## 快速运行 · Quickstart

需要 **Node.js 26.11.1–26.x** 与 npm。默认示例不需要模型密钥；安装依赖可能访问 npm，安装后的示例离线运行。

```sh
# main 只有首页：请明确选择实现分支
git clone --branch phase/v0.5 --single-branch https://github.com/hpoenixf/open-etf-agent.git
cd open-etf-agent

# 固定到本页说明与验证记录对应的公开快照
git checkout --detach 05c0dd2dc550f4f7e5da034340ff5c3159768fcf

npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
```

`build` 检查并复制原生 ESM 与示例资料，不是 TypeScript 类型检查。默认比较保留四题完整分母；每次 Run 在 `runs/` 下产生独立目录，包含 `report.md`、`manifest.json` 和 `run.jsonl`。CLI 输出实际运行目录；观察某次运行可使用 `node src/cli.mjs --observe runs/<run-id>`，将占位符换成实际 ID。

**交付长什么样？** 以下为[已公开的 v0.5 合成示例回执](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-demo-receipts.json)中 T1 的字段节选，不是新的运行结果：

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
<summary><strong>继续体验另外六类示例</strong></summary>

```sh
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

Memory 示例使用合成的操作意图，不会保存真实用户的永久偏好。`fixture-child` 不是独立真实模型推理；在本页固定快照中，`--live` 与 `--case model-child` 会明确拒绝，而不是悄悄转为模拟成功。

所有参数及边界见 [v0.5 运行说明](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/README.md)。

</details>

<a id="versions"></a>
## 版本演进 · Five runnable stages

每个链接指向固定提交，保留当时的代码、锁文件、示例与证据。表中的测试数是**各快照已记录的离线回归**，不是成熟度评分，也不是 CI 或模型能力徽章。

| 阶段 | 这一步解决什么 | 新增可见机制 | 记录的离线回归 |
| --- | --- | --- | ---: |
| [v0.1 · 第一份报告](https://github.com/hpoenixf/open-etf-agent/tree/f9370b81beef84199293120ee23d245bb0129553) | 让“完成”对应实际文件 | Runtime、Gateway、Tool Host、来源与保存回执 | 23 |
| [v0.2 · 方法与工具](https://github.com/hpoenixf/open-etf-agent/tree/a79e89bf709d4a2245b5a8652882a591ba467519) | 外部能力沿同一工具链进入 | 显式 Skill、真实 stdio MCP、完整 SSE 接收 | 49 |
| [v0.3 · 受限分工](https://github.com/hpoenixf/open-etf-agent/tree/5d57314826447f024d878674b98057742b4ce4cd) | 并行工作仍共享边界与预算 | Hook、固定 worker、一层 fixture-child、只读观察 | 71 |
| [v0.4 · 原文可离开窗口](https://github.com/hpoenixf/open-etf-agent/tree/ecf6cb45b4062586614e83aed917c92d704cb63b) | 缩小输入，仍能找回原版本 | ResultStore、Context、词法检索、ResultRef 精确回读 | 96 |
| [v0.5 · 笔记与显式记忆](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf) | 分清原文、派生笔记和未来偏好 | Compaction、Memory 保存/修订/忘记 | 124 |

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
             └─ Report：实际文件、引用与保存回执

显式 Memory 库 → 经授权的保存 / 修订 / 忘记 → 后续输入
```

| 职责 | 负责 | 不替谁做决定 |
| --- | --- | --- |
| **Runtime / Gateway** | 有限模型–工具循环、请求编码、完整响应接收 | 不用片段 JSON 或网络 EOF 冒充完整工具调用 |
| **Tool Host** | 绑定工具、校验参数与权限、执行并返回回执 | 不接受模型指定任意宿主文件路径 |
| **ResultStore / Context** | 保存不可变原文；为下一请求组织有界工作视图 | 工作视图不改写原始来源；检索命中不冒充已读原文 |
| **Compaction / Memory** | 派生工作笔记；显式库与写入意图；排除已忘记内容的后续输入 | 摘要不升级为原文，临时要求不自动成为长期偏好 |

从 [v0.5 源码目录](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/src)进入；设计动因与真实失败见[演进证据索引](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/evolution/evidence-index.md)。

## 验证到哪里，声明到哪里

| 已有证据 | 仍需分别验证 / 当前不支持 |
| --- | --- |
| v0.5 记录了 124 项串行离线测试、独立安装/构建回归与七类示例 | 不据此宣称真实模型理解、选择资料或摘要质量已通过 |
| 真实 fixture 子进程、MCP 协议往返、文件保存与退出后回读 | fixture 进程不是任意第三方代码沙箱；初始化阶段 MCP 取消仍未专门验证 |
| 原文与派生笔记分离，Memory 有显式写入意图和忘记后的未来输入边界 | 忘记不自动抹去历史报告；文件可重开不等于中断 Run 可恢复 |
| 本机单用户、受限路径、明确的失败与部分效果 | 不承诺生产金融服务、多租户、交易、后台调度或通用向量平台 |

后续已有 [v0.1–v0.5 首批真实调用记录](https://github.com/hpoenixf/open-etf-agent/blob/d075068ac99a6c798d012c46bff4fe0c33eb9979/docs/verification/live-v01-v05-first-batch.md)，分别保留原版本、真实拒绝与文件回读。当前验收以 Runtime 正确性为目标；模型措辞仅作观察，未触达机制仍未验证。读者可从[显式受限验证入口](https://github.com/hpoenixf/open-etf-agent/blob/d075068ac99a6c798d012c46bff4fe0c33eb9979/docs/live-validation.md)了解如何使用自己的配置和费用授权；上述默认命令仍运行固定离线快照。

当前项目尚未选定许可证，`package.json` 保持 `private: true` / `UNLICENSED`；随附 Evidence Kit 的独立 MIT / NOTICE 不代表整个项目采用同一许可。

[v0.5 失败与修复记录](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-observations.md) · [产物来源与哈希](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-evidence-provenance.json) · [SDK 选择与兼容边界](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/dependencies/sdk-selection.md)

<a id="reading"></a>
## 文章与代码 · Read → inspect → run

这些文章讨论更广的 Agent 工程问题。右侧是本仓库可运行的**最小机制实验**，不是原文全部高级能力的开源实现；具体支持范围以对应快照为准。

| 从问题读起 | 对应公开实验 |
| --- | --- |
| [MCP Host：从发现到消费](https://hpoenixf.github.io/eff-agent-article/articles/mcp-host-from-discovery-to-consumption) | [v0.2 维护版](https://github.com/hpoenixf/open-etf-agent/tree/a10d4f1bd1ecc39224272156221fe29792b64094)：`skill-mcp`，发现、准入与实际取得分别记录 |
| [工具结果如何离开模型上下文](https://hpoenixf.github.io/eff-agent-article/articles/tool-results-outside-model-context) | [v0.4](https://github.com/hpoenixf/open-etf-agent/tree/ecf6cb45b4062586614e83aed917c92d704cb63b)：`retrieve-reread`，原文存储与工作视图分离 |
| [主运行上下文压缩](https://hpoenixf.github.io/eff-agent-article/articles/agent-main-run-context-compaction) | [v0.5](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf)：`compact-and-reread`，派生笔记不取代原文 |
| [Memory：忘记与持久效果](https://hpoenixf.github.io/eff-agent-article/articles/026-agent-memory-forget-durable-effects) | [v0.5](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf)：`explicit-memory`，存储回执与未来输入分别验证 |

从零开始可先读 [v0.1：从第一份可回读报告开始](https://hpoenixf.github.io/eff-agent-article/articles/open-etf-agent-v01-first-readable-report?lang=zh)（[完整英文版](https://hpoenixf.github.io/eff-agent-article/en/articles/open-etf-agent-v01-first-readable-report?lang=en)）。更多内容见[文章阅读站](https://hpoenixf.github.io/eff-agent-article/)。

<a id="roadmap"></a>
## 后续路线 · Planned, not shipped

| 阶段 | 规划方向 |
| --- | --- |
| **v0.6** | 报告阅读台、附件下载、observe/evaluate，完成基础研究闭环 |
| **v0.7** | 可信 Plugin、SQLite、Checkpoint / Recovery |
| **v0.8** | Web Chat、Publication、SSE / History、后台 Worker |
| **v0.9** | 有界 Web、真实 PDF 解析、隔离 Python、合成 ETF 案例 |
| **v1.0** | 稳定公共接口、运行配置验收与实际能力声明 |

[PR #1 原始提案](https://github.com/hpoenixf/open-etf-agent/pull/1) · [完整路线与验收合同](https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/README.md) · [目标能力矩阵](https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/05-coverage-matrix.md)

原始提案中的“全部 planned”保留为当时的设计记录；当前已公开的实现快照见上方版本表。路线是方向，不是已交付功能清单。

### 反馈与参与

欢迎通过 [Issues](https://github.com/hpoenixf/open-etf-agent/issues) 提交问题或讨论。可复现问题请附**阶段/提交、Node 版本、最小步骤、预期与实际结果**；请勿提交密钥、私人资料、数据库、真实持仓或未经清理的原始日志。改进建议优先说明它解决的具体问题，以及如何验证。

<a id="english"></a>
## English at a glance

**Open ETF Agent** is a small research Agent built through independently runnable development snapshots. Start with a source-linked Markdown report, then add Skills, MCP, bounded cooperation, exact source rereading, derived notes and explicit Memory.

- **Run:** use the pinned `phase/v0.5` checkout in [Quickstart](#quickstart), not the documentation-only `main` branch. Node.js 26.11.1–26.x is required; demos run offline after dependency installation.
- **Inspect:** each [stage](#versions) retains its own implementation, fixtures and evidence. The phase READMEs contain detailed English instructions.
- **Interpret honestly:** scripted demonstrations validate mechanisms, not live model reasoning. Sources, derived notes, memory and execution observations stay distinct.
- **Scope:** local, single-user, synthetic examples; no trading or investment advice. These snapshots are not formal releases, and the project license is still undecided.

---

<p align="center">小步演进，保留证据。<br /><sub>Build small. Keep evidence.</sub></p>
