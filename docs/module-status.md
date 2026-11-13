# Six-layer module status

[简体中文](module-status.zh-CN.md) · [README](../README.md#module-map)

Reviewed version: **v0.30.0**. [Fixed code baseline](https://github.com/hpoenixf/open-etf-agent/tree/ba527fb502aebbe8bd601fd2115a4282cd10b94c) · [Version evidence and limits](verification/v030-release.md).

Implementation, offline checks, live workflows, release and deployment are different facts. This is not a per-module qualification checklist; modules can span layers.

## L1 · Inputs & triggers

### CLI · Bounded public implementation

Task entry. **Offline demo / explicit submit**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/cli.mjs) · [Scope guide](scheduled-tasks.md)

### Research Project · Bounded public implementation

Import and submit research. **Owned sources, frozen task**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/research-project.mjs) · [Scope guide](scheduled-tasks.md)

### Schedule · Bounded public implementation

Finite once schedule. **Not a resident scheduler**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/scheduled-tasks.mjs) · [Scope guide](scheduled-tasks.md)

## L2 · Identity, session & context

### Session · Bounded public implementation

Preserve original Run. **No identity / budget reset**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/session.mjs) · [Scope guide](project-context.md)

### Conversation · Bounded public implementation

Clarify and continue. **Received ≠ adopted**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/conversation.mjs) · [Scope guide](project-context.md)

### Temporal · Bounded public implementation

Pin task time. **Zone anchor, not market calendar**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/temporal.mjs) · [Scope guide](project-context.md)

### Context · Bounded public implementation

Project this turn’s input. **Do not rewrite originals**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/context.mjs) · [Scope guide](project-context.md)

### Compaction · Bounded public implementation

Compact working context. **Notes are not source evidence**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/compaction.mjs) · [Scope guide](project-context.md)

### Memory · Bounded public implementation

Explicit save and forget. **Separate cross-task authority**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/memory.mjs) · [Scope guide](project-context.md)

### Human Interaction · Bounded public implementation

Ask, receive and adopt. **Explicit resume, not approval engine**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/human-interaction.mjs) · [Scope guide](project-context.md)

### Specialist Profile · Bounded public implementation

Freeze specialist profiles. **Inherit original task boundaries**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/specialist-profiles.mjs) · [Scope guide](project-context.md)

### Skill · Bounded public implementation

Load task methods. **Instructions add no authority**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/skills.mjs) · [Scope guide](project-context.md)

## L3 · Agent decisions & execution

### Worker · Bounded public implementation

Resume original work. **Supported checkpoints only**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/worker.mjs) · [Scope guide](child-lifecycle.md)

### Admission · Bounded public implementation

Admission and capacity. **Queue, do not expand concurrency**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/admission.mjs) · [Scope guide](child-lifecycle.md)

### Gateway · Bounded public implementation

Encode / receive model actions. **Incomplete response is not action**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/gateway.mjs) · [Scope guide](child-lifecycle.md)

### Runtime · Bounded public implementation

Drive the same tool loop. **Do not replay unknown dispatch**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/runtime.mjs) · [Scope guide](child-lifecycle.md)

### Hooks · Bounded public implementation

Execution hooks. **Original control plane applies**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/hooks.mjs) · [Scope guide](child-lifecycle.md)

### Run Control · Bounded public implementation

Continue or stop decision. **Host stop ≠ user cancellation**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/run-control.mjs) · [Scope guide](child-lifecycle.md)

### Main → Child · v0.30.0 enhanced

Delegate, inspect, cancel. **Original Session / Root budget**. This is an existing owner’s call-site, not another independent module. [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-execution.mjs) · [Scope guide](child-lifecycle.md)

### Child Lifecycle · v0.30.0 enhanced

Independent child lifecycle. **Late-result fence / cold recovery**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-execution.mjs) · [Scope guide](child-lifecycle.md)

## L4 · Tools & domain capabilities

### Tool Host · Bounded public implementation

Check authority, then execute. **Argument, path and source bounds**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/tools.mjs) · [Scope guide](web-sources.md)

### MCP · Bounded public implementation

Connect external tools. **Connection is not blanket authority**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/mcp.mjs) · [Scope guide](web-sources.md)

### Trusted Plugin · Bounded public implementation

Trusted local extension. **Not a JavaScript sandbox**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/plugins.mjs) · [Scope guide](web-sources.md)

### Web Acquisition · Bounded public implementation

Acquire public static pages. **No browser rendering or crawler**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/web-acquisition.mjs) · [Scope guide](web-sources.md)

### PDF · Bounded public implementation

Retain file, extract text. **No OCR / visual table parsing**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/pdf-input.mjs) · [Scope guide](web-sources.md)

### Result / ResultRef · Bounded public implementation

Originals and exact references. **Source version ≠ selection**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/results.mjs) · [Scope guide](web-sources.md)

### Retrieval · Bounded public implementation

Find and reread sources. **Search hit ≠ acquired original**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/retrieval.mjs) · [Scope guide](web-sources.md)

### Knowledge · Bounded public implementation

Material and source checks. **Semantic quality has separate evidence**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/knowledge.mjs) · [Scope guide](web-sources.md)

### Calculation · Bounded public implementation

Recompute selected inputs. **Not market data or trading**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/calculation.mjs) · [Scope guide](web-sources.md)

### Child Results · Bounded public implementation

Return sources and advice. **Advice is not original evidence**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-results.mjs) · [Scope guide](web-sources.md)

## L5 · Publication & delivery

### Main → Report · Bounded public implementation

Consume sources, save report. **Completion claims need receipts**. This is an existing owner’s call-site, not another independent module. [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report.mjs) · [Scope guide](report-review.md)

### Report · Bounded public implementation

Compose source-linked report. **Readable ≠ financially accurate**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report.mjs) · [Scope guide](report-review.md)

### Artifact / Revision · Bounded public implementation

Save immutable revisions. **File exists ≠ published answer**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/artifacts.mjs) · [Scope guide](report-review.md)

### Publication · Bounded public implementation

Accept answer body. **Original revision and commit receipt**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/publication.mjs) · [Scope guide](report-review.md)

### Report Review · Bounded public implementation

Review frozen report text. **Advisory review, not certification**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report-review.mjs) · [Scope guide](report-review.md)

## L6 · User interfaces

### Loopback Reader · Bounded public implementation

Read reports and attachments. **Local HTTP, not full Web UI**.  [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/reader.mjs) · [Scope guide](module-guide.md)

### CLI Readback · Bounded public implementation

Inspect original task by identity. **No browser qualification claim**. This is an existing owner’s call-site, not another independent module. [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/observe.mjs) · [Scope guide](module-guide.md)

[All historical versions](module-guide.md#versions) · [Independent article coverage qualification](articles-and-code.md)

Maintenance: edit module-status.json, then run npm run docs:sync. Review scope and evidence before updating reviewedVersion; never merely relabel an old snapshot.
