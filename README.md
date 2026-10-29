<p align="center"><strong>English</strong> | <a href="README.zh-CN.md">简体中文</a></p>

# Open ETF Agent

**Read an Agent architecture article. Run its corresponding implementation. Open a report and trace it back to sources, fixed code and evidence.**

A learning-by-building research Agent: each module explains one engineering decision and keeps a runnable implementation. Start with the offline synthetic-document comparison—no model key required. This is not a live fund-research or trading service.

For developers learning Agent engineering, and readers who want to check an architecture article against runnable code—not investors looking for fund recommendations.

**[Quickstart](#quickstart) · [Read all articles](https://hpoenixf.com/eff-agent-article/en/open-etf-agent)**

[Latest modules](#versions) · [Architecture](#architecture) · [Scope and safety](#scope) · [Full documentation](#documentation) · [Contribute](#feedback-and-contributions)

<a id="reading"></a>
**Latest module articles** (module order, not publication dates):

[v0.14 · Read-only Memory](https://hpoenixf.com/eff-agent-article/en/articles/026-agent-memory-forget-durable-effects) · [v0.13 · Human interaction](https://hpoenixf.com/eff-agent-article/en/articles/agent-durable-human-interaction-response-adoption) · [v0.12 · Task time](https://hpoenixf.com/eff-agent-article/en/articles/agent-temporal-semantics-market-calendar)

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
  <a href="https://hub.xerj.org/contributors/hpoenixf"><img src="https://hub.xerj.org/contributors/hpoenixf/badge.svg" alt="XERJ contributor badge" height="20" /></a><br />
  <small>The v0.9 standalone CLI Worker implementation was selected for <a href="https://hub.xerj.org/corpus/hpoenixf--open-etf-agent">XERJ Corpus Hub</a>.</small>
</p>

<a id="quickstart"></a>
## Quickstart

Requires **Node.js 26.8.1–26.x** and npm. Default examples need no model key. Dependency installation may access npm; the installed examples run offline.

```sh
# main already contains the current stable development snapshot
git clone https://github.com/hpoenixf/open-etf-agent.git
cd open-etf-agent

npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm test
npm run demo -- --case document-compare
```

`build` checks and copies native ESM and example data; it is not a TypeScript typecheck. The comparison keeps all four questions. Each Run creates a separate directory under `runs/` with `report.md`, `manifest.json` and `run.jsonl`. The CLI prints the actual directory. Inspect a Run with `node src/cli.mjs --observe runs/<run-id>`, replacing the placeholder with that ID.

[Try seven more mechanism examples →](docs/module-guide.md#try-seven-more-kinds-of-example)

**What does delivery look like?** This is a historical T1 excerpt from the [v0.5 synthetic receipts](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-demo-receipts.json), not a new execution. v0.6 adds immutable Artifact / Revision IDs and attachment identity; see its [delivery readback](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-delivery-receipts.safe.json).

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

`completed` describes execution; `semanticStatus: unreviewed` leaves answer quality unreviewed. Full receipts also include hashes and actual source references. Tests reopen the files after the producing process exits.

<a id="versions"></a>
## Latest three modules

`main` includes the released **v0.14.0** read-only Memory consumer; see the [fixed version and Release](https://github.com/hpoenixf/open-etf-agent/releases/tag/v0.14.0). Original Runtime CI and independent offline delivery checks passed; this is not real-model, financial-semantic or production certification.

| Module | What changes | Run and inspect |
| --- | --- | --- |
| v0.14 · Read-only Memory | Select an existing library and consume current revisions; temporary mode takes effect before library access | [Commands](docs/module-guide.md#v014--read-only-existing-memory) · [Contract and evidence](openspec/changes/v014-memory-consumer/evidence.md) |
| v0.13 · Ordinary reply | The CLI saves a question; submit your reply, then explicitly continue the original Run | [Commands](docs/module-guide.md#v013--one-durable-ordinary-reply) · [Contract and evidence](openspec/changes/ordinary-response/evidence.md) |
| v0.12 · Temporal | Keep one explicit timezone and UTC anchor across restart | [Commands](docs/module-guide.md#v012--fixed-task-time) · [Contract and evidence](openspec/changes/v012-temporal/evidence.md) |

[All fixed versions and commands](docs/module-guide.md#versions) · [Machine-readable version lineage](versions.json) · [GitHub Releases](https://github.com/hpoenixf/open-etf-agent/releases)

<a id="architecture"></a>
## Architecture: follow one execution path

```text
Question → Runtime ⇄ Gateway
              │ Context: the next bounded input
              ▼
           Tool Host → read / calculate / save
              ├─ ResultStore: original sources and exact references
              └─ Artifact / Revision: report, files and receipts
                       └─ Reader: reopen the delivered bytes
```

The model proposes; code checks authority and executes. Session, Publication and the single-Run Worker extend this path rather than adding a second executor. Original sources, working notes and explicitly authorized Memory remain separate.

[Owner responsibilities and limitations](docs/module-guide.md#architecture) · [Design evolution](docs/evolution/evidence-index.md)

<a id="scope"></a>
## Scope and safety

- **Use it to learn and reproduce:** local, single-user synthetic examples. Default demos use scripted Gateway fixtures, not live model judgment, real holdings or market data. No trading or investment advice.
- **Read the qualification literally:** `completed` means execution finished; model quality remains unreviewed. Offline tests and CI are not production, security, financial-semantic or live-recovery certification.
- **Keep authority explicit:** trusted Plugins run local JavaScript and are not sandboxed. The PDF parser is not a hostile-file security sandbox; no OCR, visual/table interpretation or active-PDF recovery is offered. Python isolation and broader Web capabilities are not implied by the examples.
- **Respect original identity and effects:** unknown dispatched requests are not automatically retried; host stop is not user cancellation. SQLite fencing does not provide general external exactly-once effects. [Finish or isolate incompatible active Runs before upgrade](docs/upgrade-guide.md).

<a id="live-evidence"></a>
**Real model calls:** [16 historical HTTP requests across v0.1–v0.5](docs/module-guide.md#live-evidence) are distinct from current offline demos. HTTP 200 or a saved report does not certify task quality.

<a id="live-entry"></a>
**Live runner:** the demo CLI refuses `--live`. The [separate runner](docs/live-validation.md) needs your own provider, data and cost authorization, fixed inputs and a shared budget. Other operators' credentials or authorization are not inherited; unknown outcomes stop execution.

<a id="documentation"></a>
## Go deeper

- [Full module commands and version history](docs/module-guide.md)
- [Verification evidence index](docs/verification/README.md)
- [Article-to-code mapping](docs/articles-and-code.md)

<a id="roadmap"></a>
[Roadmap](docs/plan/v1-to-v2.md): planned is not shipped. Web acquisition, isolated Python and richer PDF capabilities are separate candidates, not bundled promises.

## Author

**By hpoenixf: 10 years of software development experience, including 5 years building financial business systems.** A frontend-leaning full-stack developer focused on Agent engineering, connecting system design with runnable implementations and verification evidence. [Personal blog](https://hpoenixf.com/) · [Engineering articles](https://hpoenixf.com/eff-agent-article/en/)

## License

Original code and accompanying original documentation are [MIT](LICENSE), Copyright © 2026 Huang Pengfei. Third-party dependencies, the accompanying Evidence Kit and NOTICE retain their own licenses and attribution. This license does not cover external private source, manuscripts or other outside content. `private: true` prevents accidental npm publication; it does not restrict MIT rights.

### Feedback and contributions

See the [repository maintenance acceptance requirements](docs/verification/README.md#repository-maintenance).

Open an [issue](https://github.com/hpoenixf/open-etf-agent/issues) with the **stage/commit, Node version, minimal reproduction, expected behavior and actual result**. Do not include keys, private material, databases, real holdings or unsanitized logs. For improvements, explain the concrete problem and how the change can be verified.


<details>
<summary>Older section bookmarks (expand)</summary>

## Moved section links

Existing bookmarks continue to resolve; each link opens its corresponding guide section.

<a id="what-you-can-inspect"></a>
[What you can inspect](docs/module-guide.md#what-you-can-inspect)

<a id="v013--one-durable-ordinary-reply"></a>
[v0.13 · One durable ordinary reply](docs/module-guide.md#v013--one-durable-ordinary-reply)

<a id="v012--fixed-task-time"></a>
[v0.12 · Fixed task time](docs/module-guide.md#v012--fixed-task-time)

<a id="v011-one-local-pdf-one-physical-page-original-bytes-retained"></a>
[v0.11: one local PDF, one physical page, original bytes retained](docs/module-guide.md#v011-one-local-pdf-one-physical-page-original-bytes-retained)

<a id="v010-one-source-selection-one-result-one-report-and-csv"></a>
[v0.10: one source selection, one result, one report and CSV](docs/module-guide.md#v010-one-source-selection-one-result-one-report-and-csv)

<a id="v09-another-process-continues-the-original-run"></a>
[v0.9: another process continues the original Run](docs/module-guide.md#v09-another-process-continues-the-original-run)

<a id="v06-read-download-and-verify-over-real-http"></a>
[v0.6: read, download and verify over real HTTP](docs/module-guide.md#v06-read-download-and-verify-over-real-http)

<a id="v07-trusted-contributions-and-same-run-continuation"></a>
[v0.7: trusted contributions and same-Run continuation](docs/module-guide.md#v07-trusted-contributions-and-same-run-continuation)

<a id="v08-commit-and-read-back-one-answer-block"></a>
[v0.8: commit and read back one answer block](docs/module-guide.md#v08-commit-and-read-back-one-answer-block)

<a id="version-history-ten-fixed-snapshots"></a>
[Complete version history](docs/module-guide.md#versions)

<a id="architecture-keep-responsibilities-visible"></a>
[Architecture: keep responsibilities visible](docs/module-guide.md#architecture-keep-responsibilities-visible)

<a id="evidence-and-its-limits"></a>
[Evidence and its limits](docs/module-guide.md#evidence-and-its-limits)

<a id="real-calls-16-http-requests-not-16-capability-certifications"></a>
[Real calls: 16 HTTP requests, not 16 capability certifications](docs/module-guide.md#real-calls-16-http-requests-not-16-capability-certifications)

<a id="restricted-live-runner-separate-from-the-demo-cli"></a>
[Restricted live runner: separate from the demo CLI](docs/module-guide.md#restricted-live-runner-separate-from-the-demo-cli)

<a id="articles-and-code"></a>
[Articles and code](docs/module-guide.md#articles-and-code)

<a id="roadmap-planned-is-not-shipped"></a>
[Roadmap: planned is not shipped](docs/module-guide.md#roadmap-planned-is-not-shipped)

<a id="english"></a>
[English](docs/module-guide.md#english)

</details>
