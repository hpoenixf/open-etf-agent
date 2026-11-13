# Six-layer module status

[简体中文](module-status.zh-CN.md) · [README](../README.md#module-map)

Reviewed version: **v0.30.0**. [Fixed code baseline](https://github.com/hpoenixf/open-etf-agent/tree/46f7d95bbce20757a884b54cea41f8ebbf6d2540) · [Version evidence and limits](verification/v030-release.md).

Implementation, offline checks, live workflows, release and deployment are different facts. This is not a per-module qualification checklist; modules can span layers.

## L1 · Inputs & triggers

**CLI · Research Project · Schedule**

Project submission, finite once schedules, explicit continuation. Local single-user; no recurring or resident scheduler.

[Usage and limits](scheduled-tasks.md) · [research-cli.mjs](../src/research-cli.mjs) · [scheduled-tasks.mjs](../src/scheduled-tasks.mjs) · [conversation-cli.mjs](../src/conversation-cli.mjs) · [temporal.mjs](../src/temporal.mjs) · [research-project.mjs](../src/research-project.mjs)

## L2 · Identity, session & context

**Session · Context · Memory · Skill · Conversation**

Original identity, bounded context, explicit memory. Memory is not original evidence or new authority.

[Usage and limits](project-context.md) · [session.mjs](../src/session.mjs) · [context.mjs](../src/context.mjs) · [memory.mjs](../src/memory.mjs) · [skills.mjs](../src/skills.mjs) · [compaction.mjs](../src/compaction.mjs) · [conversation.mjs](../src/conversation.mjs) · [human-interaction.mjs](../src/human-interaction.mjs)

## L3 · Agent decisions & execution

**Runtime · Gateway · Worker · Child · Admission**

Resume, shared budgets, independent Child cancellation. Completion is not accuracy; unknown requests retained.

[Usage and limits](child-lifecycle.md) · [runtime.mjs](../src/runtime.mjs) · [gateway.mjs](../src/gateway.mjs) · [worker.mjs](../src/worker.mjs) · [child-execution.mjs](../src/child-execution.mjs) · [hooks.mjs](../src/hooks.mjs) · [admission.mjs](../src/admission.mjs) · [specialist-profiles.mjs](../src/specialist-profiles.mjs)

## L4 · Tools & domain capabilities

**Tools · MCP · Plugin · Result · Knowledge · Web / PDF**

Read originals, reread sources, bounded calculations. Static Web / PDF text, not live financial data.

[Usage and limits](web-sources.md) · [tools.mjs](../src/tools.mjs) · [mcp.mjs](../src/mcp.mjs) · [results.mjs](../src/results.mjs) · [web-acquisition.mjs](../src/web-acquisition.mjs) · [pdf-input.mjs](../src/pdf-input.mjs) · [calculation.mjs](../src/calculation.mjs) · [plugins.mjs](../src/plugins.mjs) · [retrieval.mjs](../src/retrieval.mjs) · [knowledge.mjs](../src/knowledge.mjs)

## L5 · Publication & delivery

**Report · Artifact · Publication · Review**

Immutable revisions, accepted body, advisory review. Saving, publication and quality are separate claims.

[Usage and limits](report-review.md) · [report.mjs](../src/report.mjs) · [artifacts.mjs](../src/artifacts.mjs) · [publication.mjs](../src/publication.mjs) · [report-review.mjs](../src/report-review.mjs)

## L6 · User interfaces

**CLI · Loopback Reader**

CLI operations, local report and attachment readback. Not a full Web workspace; no browser qualification.

[Usage and limits](module-guide.md) · [cli.mjs](../src/cli.mjs) · [reader.mjs](../src/reader.mjs) · [reader-cli.mjs](../src/reader-cli.mjs)

[All historical versions](module-guide.md#versions) · [Independent article coverage qualification](articles-and-code.md)

Maintenance: edit module-status.json, then run npm run docs:sync. Review scope and evidence before updating reviewedVersion; never merely relabel an old snapshot.
