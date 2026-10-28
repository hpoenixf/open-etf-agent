<p align="center"><a href="README.md">English</a> | <strong>简体中文</strong></p>

# Open ETF Agent

**读一篇 Agent 架构文章，运行对应实现，打开一份报告，再追到原始来源、固定代码与验证证据。**

这是一个逐模块构建研究 Agent 的开源项目：每个模块讲清一个工程选择，留下能运行、能对照的实现。先跑离线合成文档比较，不需要模型密钥；它不是实时基金研究或交易服务。

**[快速运行](#quickstart) · [阅读全部文章](https://hpoenixf.com/eff-agent-article/open-etf-agent)**

<a id="reading"></a>
**最近模块文章**（按模块演进排序，不代表文章发布日期）：

[v0.13 · 人机交互](https://hpoenixf.com/eff-agent-article/articles/agent-durable-human-interaction-response-adoption) · [v0.12 · 任务时间](https://hpoenixf.com/eff-agent-article/articles/agent-temporal-semantics-market-calendar) · [v0.11 · 本地 PDF](https://hpoenixf.com/eff-agent-article/articles/024-agent-pdf-from-text-to-evidence)

<p align="center">
  <a href="https://github.com/hpoenixf/open-etf-agent/actions/workflows/verify.yml?query=branch%3Amain"><img src="https://github.com/hpoenixf/open-etf-agent/actions/workflows/verify.yml/badge.svg?branch=main" alt="Verify (main)" height="20" /></a>
  <a href="https://github.com/hpoenixf/open-etf-agent/releases/latest"><img src="https://img.shields.io/github/v/release/hpoenixf/open-etf-agent?label=release" alt="Latest release" height="20" /></a>
  <a href="https://github.com/hpoenixf/open-etf-agent/blob/main/LICENSE"><img src="https://img.shields.io/github/license/hpoenixf/open-etf-agent" alt="MIT license" height="20" /></a>
  <br />
  <a href="https://github.com/hpoenixf/open-etf-agent/blob/main/package.json"><img src="https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&amp;logoColor=black" alt="JavaScript" height="20" /></a>
  <a href="https://github.com/hpoenixf/open-etf-agent/blob/main/package.json"><img src="https://img.shields.io/badge/Node.js-%3E%3D26.8.1%20%3C27-339933?logo=nodedotjs&amp;logoColor=white" alt="Node.js 26.8.1 to 26.x" height="20" /></a>
  <a href="https://github.com/hpoenixf/open-etf-agent/stargazers"><img src="https://img.shields.io/github/stars/hpoenixf/open-etf-agent?style=flat" alt="GitHub stars" height="20" /></a>
</p>
<p align="center">
  <a href="https://hub.xerj.org/contributors/hpoenixf"><img src="https://hub.xerj.org/contributors/hpoenixf/badge.svg" alt="XERJ 贡献者徽章" height="20" /></a><br />
  <small>v0.9 独立 CLI Worker 实现收录于 <a href="https://hub.xerj.org/corpus/hpoenixf--open-etf-agent">XERJ Corpus Hub</a>。</small>
</p>

[最近版本](#versions) · [架构职责](#architecture) · [适用与安全边界](#scope) · [完整资料](#documentation) · [反馈与参与](#反馈与参与)

<a id="quickstart"></a>
## 快速运行 · Quickstart

需要 **Node.js 26.8.1–26.x** 与 npm。默认示例不需要模型密钥；安装依赖可能访问 npm，安装后的示例离线运行。

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

<a id="versions"></a>
## 最近三个模块

`main` 当前包含 **v0.13.0** 开发代码。模块的 Runtime 验证、GitHub Release 与模型回答质量是不同的声明。

| 模块 | 解决什么 | 运行与核对 |
| --- | --- | --- |
| v0.13 · 普通回复 | 持久登记问题、释放执行、接收回复，再显式恢复同一 Run | [运行说明](docs/module-guide.zh-CN.md#v013--一个持久普通回复) · [合同与证据](openspec/changes/ordinary-response/evidence.md) |
| v0.12 · Temporal | 跨重启保持显式时区与唯一 UTC 时间锚 | [运行说明](docs/module-guide.zh-CN.md#v012--固定任务时间) · [合同与证据](openspec/changes/v012-temporal/evidence.md) |
| v0.11 · 本地 PDF | 读取文本层物理页，同时保留原始文件 | [运行说明](docs/module-guide.zh-CN.md#v011一个本地-pdf一张物理页保留原始字节) · [合同与证据](openspec/changes/v011-local-pdf/evidence.md) |

[完整固定版本与运行说明](docs/module-guide.zh-CN.md#versions) · [机器可读版本谱系](versions.json) · [GitHub Releases](https://github.com/hpoenixf/open-etf-agent/releases)

<a id="architecture"></a>
## 架构：沿一条执行链理解

```text
问题 → Runtime ⇄ Gateway
          │ Context：下一次有界输入
          ▼
       Tool Host → 读取 / 计算 / 保存
          ├─ ResultStore：原始来源与精确引用
          └─ Artifact / Revision：报告、文件与回执
                   └─ Reader：重新打开实际交付字节
```

模型提出动作，代码检查授权并执行。Session、Publication 与单 Run Worker 接回同一条链，不另造执行器；原始来源、工作笔记与显式授权的 Memory 保持分离。

[完整 Owner 职责与边界](docs/module-guide.zh-CN.md#architecture) · [设计演进记录](docs/evolution/evidence-index.md)

<a id="scope"></a>
## 适用与安全边界

- **适合学习和复现：** 本地、单用户、合成案例。默认演示使用脚本 Gateway fixture，不代表真实模型判断、真实持仓或行情数据；不提供交易执行或投资建议。
- **按实际资格理解：** `completed` 表示执行完成，模型质量仍未评审。离线测试与 CI 不等于生产、安全、金融语义或 live 恢复认证。
- **授权必须显式：** 可信 Plugin 是有本地进程权限的 JavaScript，不是沙箱。PDF 解析器也不是恶意文件安全沙箱；不包含 OCR、视觉/表格理解或活跃 PDF 恢复。示例不暗示已具备 Python 隔离或更广泛 Web 能力。
- **尊重原身份与副作用：** 未知已派发请求不自动重试，宿主停止不等于用户取消；SQLite fence 不提供通用外部恰好一次保证。[升级前完成或隔离不兼容的活跃 Run](docs/upgrade-guide.md)。

<a id="live-evidence"></a>
**真实模型调用：** [v0.1–v0.5 的 16 次历史 HTTP 请求](docs/module-guide.zh-CN.md#live-evidence)与当前离线演示分开；HTTP 200 或保存报告都不是任务质量认证。

<a id="live-entry"></a>
**受限 live 入口：** 演示 CLI 拒绝 `--live`。[独立 runner](docs/live-validation.md)要求你自己的 provider、数据、费用授权、固定输入与共享预算；不继承别人的凭据或授权，未知结果停止执行。

<a id="documentation"></a>
## 完整资料入口

- [全部模块命令与版本历史](docs/module-guide.zh-CN.md)
- [完整验证证据索引](docs/verification/README.zh-CN.md)
- [文章与代码对应关系](docs/articles-and-code.zh-CN.md)

<a id="roadmap"></a>
[完整路线](docs/plan/v1-to-v2.zh-CN.md)：规划不等于交付。Web 取材、隔离 Python 与更丰富 PDF 能力分别评估，不打包作已实现承诺。

## 许可证

项目原创代码与随附原创文档采用 [MIT](LICENSE)，Copyright © 2026 Huang Pengfei。第三方依赖、随附 Evidence Kit 及其 NOTICE 保留原许可证与归属；本许可不覆盖项目之外的私有源码、书稿或外部内容。`private: true` 仅防止意外发布 npm 包，不限制 MIT 授予的使用权。

### 反馈与参与

参见[仓库维护验收要求](docs/verification/README.zh-CN.md#repository-maintenance)。

欢迎通过 [Issues](https://github.com/hpoenixf/open-etf-agent/issues) 提交问题或讨论。可复现问题请附**阶段/提交、Node 版本、最小步骤、预期与实际结果**；请勿提交密钥、私人资料、数据库、真实持仓或未经清理的原始日志。改进建议优先说明它解决的具体问题，以及如何验证。



## 旧章节精确入口

保留旧书签；以下每项直接进入指南中的对应章节。

<a id="在这里可以看到什么"></a>
[在这里可以看到什么](docs/module-guide.zh-CN.md#在这里可以看到什么)

<a id="v013--一个持久普通回复"></a>
[v0.13 · 一个持久普通回复](docs/module-guide.zh-CN.md#v013--一个持久普通回复)

<a id="v012--固定任务时间"></a>
[v0.12 · 固定任务时间](docs/module-guide.zh-CN.md#v012--固定任务时间)

<a id="v011一个本地-pdf一张物理页保留原始字节"></a>
[v0.11：一个本地 PDF，一张物理页，保留原始字节](docs/module-guide.zh-CN.md#v011一个本地-pdf一张物理页保留原始字节)

<a id="v010从原始选区到同一份报告与-csv"></a>
[v0.10：从原始选区到同一份报告与 CSV](docs/module-guide.zh-CN.md#v010从原始选区到同一份报告与-csv)

<a id="v09提交退出后由另一进程继续原-run"></a>
[v0.9：提交退出后，由另一进程继续原 Run](docs/module-guide.zh-CN.md#v09提交退出后由另一进程继续原-run)

<a id="v06阅读下载与实际-http-验证"></a>
[v0.6：阅读、下载与实际 HTTP 验证](docs/module-guide.zh-CN.md#v06阅读下载与实际-http-验证)

<a id="v07可信贡献与同一-run-的恢复"></a>
[v0.7：可信贡献与同一 Run 的恢复](docs/module-guide.zh-CN.md#v07可信贡献与同一-run-的恢复)

<a id="v08一个答案块的提交与回读"></a>
[v0.8：一个答案块的提交与回读](docs/module-guide.zh-CN.md#v08一个答案块的提交与回读)

<a id="版本演进--ten-fixed-snapshots"></a>
[完整版本演进](docs/module-guide.zh-CN.md#versions)

<a id="架构职责--keep-the-boundaries-visible"></a>
[架构职责 · Keep the boundaries visible](docs/module-guide.zh-CN.md#架构职责--keep-the-boundaries-visible)

<a id="验证到哪里声明到哪里"></a>
[验证到哪里，声明到哪里](docs/module-guide.zh-CN.md#验证到哪里声明到哪里)

<a id="真实调用记录16-次-http不是-16-次能力认证"></a>
[真实调用记录：16 次 HTTP，不是 16 次能力认证](docs/module-guide.zh-CN.md#真实调用记录16-次-http不是-16-次能力认证)

<a id="受限-live-入口与演示-cli-明确分开"></a>
[受限 live 入口：与演示 CLI 明确分开](docs/module-guide.zh-CN.md#受限-live-入口与演示-cli-明确分开)

<a id="许可证--license"></a>
[许可证 · License](docs/module-guide.zh-CN.md#许可证--license)

<a id="文章与代码"></a>
[文章与代码](docs/module-guide.zh-CN.md#文章与代码)

<a id="后续路线--planned-not-shipped"></a>
[后续路线 · Planned, not shipped](docs/module-guide.zh-CN.md#后续路线--planned-not-shipped)

<a id="english-at-a-glance"></a>
[历史英文概览](docs/module-guide.zh-CN.md#historical-english-overview)

<a id="english"></a>
[English](docs/module-guide.zh-CN.md#english)
