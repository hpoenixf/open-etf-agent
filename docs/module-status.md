# Six-layer module status

[简体中文](module-status.zh-CN.md) · [README](../README.md#module-map)

Reviewed version: **v0.30.0**. [Fixed code baseline](https://github.com/hpoenixf/open-etf-agent/tree/ba527fb502aebbe8bd601fd2115a4282cd10b94c) · [Version evidence and limits](verification/v030-release.md).

Implementation, offline checks, live workflows, release and deployment are different facts. This is not a per-module qualification checklist; modules can span layers.

## L1 · Inputs & triggers

### CLI · Bounded public implementation

Task entry. **Offline demo / explicit submit**.  [Agents in 15 Minutes](https://hpoenixf.com/eff-agent-article/en/articles/agent-in-15-minutes) (overview) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/cli.mjs) · [Scope guide](scheduled-tasks.md)

### Research Project · Bounded public implementation

Import and submit research. **Owned sources, frozen task**.  [Bring Your Own Documents to an Agent: From the First Report to a Resumable Research Project](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-research-project-workshop) (workshop) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/research-project.mjs) · [Scope guide](scheduled-tasks.md)

### Schedule · Bounded public implementation

Finite once schedule. **Not a resident scheduler**.  [Agents Don't Need to Think Continuously: How Research Continues on Schedule After a Conversation Ends](https://hpoenixf.com/eff-agent-article/en/articles/agent-autonomous-scheduled-research) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/scheduled-tasks.mjs) · [Scope guide](scheduled-tasks.md)

## L2 · Identity, session & context

### Session · Bounded public implementation

Preserve original Run. **No identity / budget reset**.  [Agent Execution Identity Panorama: From a Conversation to Model Turns—What Actually Continues?](https://hpoenixf.com/eff-agent-article/en/articles/agent-task-session-run-worker-schedule) (overview) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/session.mjs) · [Scope guide](project-context.md)

### Conversation · Bounded public implementation

Clarify and continue. **Received ≠ adopted**.  [Keep Chatting Is Not Keep Executing: Agent Conversation Admission and Task Continuation](https://hpoenixf.com/eff-agent-article/en/articles/agent-conversation-admission-task-continuation) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/conversation.mjs) · [Scope guide](project-context.md)

### Temporal · Bounded public implementation

Pin task time. **Zone anchor, not market calendar**.  [When an Agent Says “Today,” Which Day Does It Mean? Task Time, User Time, and Market Sessions](https://hpoenixf.com/eff-agent-article/en/articles/agent-temporal-semantics-market-calendar) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/temporal.mjs) · [Scope guide](project-context.md)

### Context · Bounded public implementation

Project this turn’s input. **Do not rewrite originals**.  [Agent Context Governance Panorama · Practice: From the First Request to Long-Term Memory](https://hpoenixf.com/eff-agent-article/en/articles/agent-context-governance-actions) (overview) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/context.mjs) · [Scope guide](project-context.md)

### Compaction · Bounded public implementation

Compact working context. **Notes are not source evidence**.  [When Context Is Nearly Full, Why Can't We Simply Ask a Model to Summarize History?](https://hpoenixf.com/eff-agent-article/en/articles/agent-main-run-context-compaction) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/compaction.mjs) · [Scope guide](project-context.md)

### Memory · Bounded public implementation

Explicit save and forget. **Separate cross-task authority**.  [The Full Lifecycle of Agent Memory: From Remembering Preferences to Safe Forgetting](https://hpoenixf.com/eff-agent-article/en/articles/026-agent-memory-forget-durable-effects) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/memory.mjs) · [Scope guide](project-context.md)

### Human Interaction · Bounded public implementation

Ask, receive and adopt. **Explicit resume, not approval engine**.  [After an Agent Asks the User: Returning a Durable Human Response to the Original Research](https://hpoenixf.com/eff-agent-article/en/articles/agent-durable-human-interaction-response-adoption) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/human-interaction.mjs) · [Scope guide](project-context.md)

### Specialist Profile · Bounded public implementation

Freeze specialist profiles. **Inherit original task boundaries**.  [A Custom Expert Should Be More Than a Prompt Field](https://hpoenixf.com/eff-agent-article/en/articles/agent-custom-expert-from-prompt-to-recovery) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/specialist-profiles.mjs) · [Scope guide](project-context.md)

### Skill · Bounded public implementation

Load task methods. **Instructions add no authority**.  [How Is a Skill Different from a Prompt? From Loading to Script Execution](https://hpoenixf.com/eff-agent-article/en/articles/agent-skill-from-markdown-to-callable-research) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/skills.mjs) · [Scope guide](project-context.md)

## L3 · Agent decisions & execution

### Worker · Bounded public implementation

Resume original work. **Supported checkpoints only**.  [Agent Deep Dive: From One Report to Durable Execution and Specialist Collaboration](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v010-system-design) (open-walkthrough) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/worker.mjs) · [Scope guide](child-lifecycle.md)

### Admission · Bounded public implementation

Admission and capacity. **Queue, do not expand concurrency**.  [Why the Next Model Request Still Queues After HTTP 200: Provider Admission, Leases and Unknown Occupancy](https://hpoenixf.com/eff-agent-article/en/articles/agent-provider-admission-capacity-lease) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/admission.mjs) · [Scope guide](child-lifecycle.md)

### Gateway · Bounded public implementation

Encode / receive model actions. **Incomplete response is not action**.  [Inside an Agent’s Provider Layer: Why a Unified API Still Needs Shared Admission](https://hpoenixf.com/eff-agent-article/en/articles/agent-provider-architecture-and-admission) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/gateway.mjs) · [Scope guide](child-lifecycle.md)

### Runtime · Bounded public implementation

Drive the same tool loop. **Do not replay unknown dispatch**.  [A Research Agent Needs More Than Tools: How Model, Harness, and Loop Work Together](https://hpoenixf.com/eff-agent-article/en/articles/etf-agent-model-harness-research-loop) (overview) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/runtime.mjs) · [Scope guide](child-lifecycle.md)

### Hooks · Bounded public implementation

Execution hooks. **Original control plane applies**.  [From Claude and Pi to Codex: Running Multi-Ecosystem Hooks Inside Our Agent Runtime](https://hpoenixf.com/eff-agent-article/en/articles/agent-multi-ecosystem-hook-execution) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/hooks.mjs) · [Scope guide](child-lifecycle.md)

### Run Control · Bounded public implementation

Continue or stop decision. **Host stop ≠ user cancellation**.  [When Every Module Can Say No: Agent Run Termination, Stage Budgets, and Safe Recovery](https://hpoenixf.com/eff-agent-article/en/articles/agent-veto-authority-and-run-termination) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/run-control.mjs) · [Scope guide](child-lifecycle.md)

### Main → Child · v0.30.0 enhanced

Delegate, inspect, cancel. **Original Session / Root budget**. This is an existing owner’s call-site, not another independent module. [Subagent Panorama: Independent Context, Specialist Work and Real Handoffs](https://hpoenixf.com/eff-agent-article/en/articles/agent-subagent-context-specialization) (overview) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-execution.mjs) · [Scope guide](child-lifecycle.md)

### Child Lifecycle · v0.30.0 enhanced

Independent child lifecycle. **Late-result fence / cold recovery**.  [Subagent Panorama: Independent Context, Specialist Work and Real Handoffs](https://hpoenixf.com/eff-agent-article/en/articles/agent-subagent-context-specialization) (overview) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-execution.mjs) · [Scope guide](child-lifecycle.md)

## L4 · Tools & domain capabilities

### Tool Host · Bounded public implementation

Check authority, then execute. **Argument, path and source bounds**.  [From Tool Invocation to Model Input: Connecting an Agent's Observability Chain](https://hpoenixf.com/eff-agent-article/en/articles/agent-tool-lifecycle-and-model-input) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/tools.mjs) · [Scope guide](web-sources.md)

### MCP · Bounded public implementation

Connect external tools. **Connection is not blanket authority**.  [From Connecting MCP to Actually Using Its Tools: Building an End-to-End Agent Integration Path](https://hpoenixf.com/eff-agent-article/en/articles/mcp-host-from-discovery-to-consumption) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/mcp.mjs) · [Scope guide](web-sources.md)

### Trusted Plugin · Bounded public implementation

Trusted local extension. **Not a JavaScript sandbox**.  [How Agent Extensions Enter the Host: Plugin Lifecycle and Runtime Boundaries](https://hpoenixf.com/eff-agent-article/en/articles/020-agent-extension-host-smartphone) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/plugins.mjs) · [Scope guide](web-sources.md)

### Web Acquisition · Bounded public implementation

Acquire public static pages. **No browser rendering or crawler**.  [From Finding Pages to Reading Further: How We Taught an Agent to Browse the Web](https://hpoenixf.com/eff-agent-article/en/articles/021-agent-web-research-from-search-to-deep-reading) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/web-acquisition.mjs) · [Scope guide](web-sources.md)

### PDF · Bounded public implementation

Retain file, extract text. **No OCR / visual table parsing**.  [From Being Able to Read to Being Able to Research: Evolving PDF into Traceable Multimodal Evidence](https://hpoenixf.com/eff-agent-article/en/articles/024-agent-pdf-from-text-to-evidence) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/pdf-input.mjs) · [Scope guide](web-sources.md)

### Result / ResultRef · Bounded public implementation

Originals and exact references. **Source version ≠ selection**.  [Why Tool Results Should Not All Enter Model Context](https://hpoenixf.com/eff-agent-article/en/articles/tool-results-outside-model-context) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/results.mjs) · [Scope guide](web-sources.md)

### Retrieval · Bounded public implementation

Find and reread sources. **Search hit ≠ acquired original**.  [The RAG Lifecycle: From Document Ingestion to Cited Answers](https://hpoenixf.com/eff-agent-article/en/articles/agent-knowledge-retrieval-end-to-end) (overview) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/retrieval.mjs) · [Scope guide](web-sources.md)

### Knowledge · Bounded public implementation

Material and source checks. **Semantic quality has separate evidence**.  [The RAG Lifecycle: From Document Ingestion to Cited Answers](https://hpoenixf.com/eff-agent-article/en/articles/agent-knowledge-retrieval-end-to-end) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/knowledge.mjs) · [Scope guide](web-sources.md)

### Calculation · Bounded public implementation

Recompute selected inputs. **Not market data or trading**.  [Agent Deep Dive: From One Report to Durable Execution and Specialist Collaboration](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v010-system-design) (open-walkthrough) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/calculation.mjs) · [Scope guide](web-sources.md)

### Child Results · Bounded public implementation

Return sources and advice. **Advice is not original evidence**.  [How Do We Know the Main Agent Actually Used a Specialist’s Findings?](https://hpoenixf.com/eff-agent-article/en/articles/agent-subagent-contribution-evidence) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/child-results.mjs) · [Scope guide](web-sources.md)

## L5 · Publication & delivery

### Main → Report · Bounded public implementation

Consume sources, save report. **Completion claims need receipts**. This is an existing owner’s call-site, not another independent module. [Start with a Report You Can Read Back: Open ETF Agent v0.1](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v01-first-readable-report) (open-walkthrough) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report.mjs) · [Scope guide](report-review.md)

### Report · Bounded public implementation

Compose source-linked report. **Readable ≠ financially accurate**.  [Start with a Report You Can Read Back: Open ETF Agent v0.1](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v01-first-readable-report) (open-walkthrough) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report.mjs) · [Scope guide](report-review.md)

### Artifact / Revision · Bounded public implementation

Save immutable revisions. **File exists ≠ published answer**.  [A Report Is Generated: Why Can’t It Be Shared Yet?](https://hpoenixf.com/eff-agent-article/en/articles/agent-artifact-version-access-sharing) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/artifacts.mjs) · [Scope guide](report-review.md)

### Publication · Bounded public implementation

Accept answer body. **Original revision and commit receipt**.  [The Agent Has Generated an Answer. Why Does It Still Need a Separate Publication System?](https://hpoenixf.com/eff-agent-article/en/articles/019-agent-answer-publication) (module-article) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/publication.mjs) · [Scope guide](report-review.md)

### Report Review · Bounded public implementation

Review frozen report text. **Advisory review, not certification**.  [After the report: source checks, specialist work, and independent review](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-report-review-workshop) (workshop) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/report-review.mjs) · [Scope guide](report-review.md)

## L6 · User interfaces

### Loopback Reader · Bounded public implementation

Read reports and attachments. **Local HTTP, not full Web UI**.  [Agent Deep Dive: From One Report to Durable Execution and Specialist Collaboration](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v010-system-design) (open-walkthrough) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/reader.mjs) · [Scope guide](module-guide.md)

### CLI Readback · Bounded public implementation

Inspect original task by identity. **No browser qualification claim**. This is an existing owner’s call-site, not another independent module. [Start with a Report You Can Read Back: Open ETF Agent v0.1](https://hpoenixf.com/eff-agent-article/en/articles/open-etf-agent-v01-first-readable-report) (open-walkthrough) · [Fixed source](https://github.com/hpoenixf/open-etf-agent/blob/ba527fb502aebbe8bd601fd2115a4282cd10b94c/src/observe.mjs) · [Scope guide](module-guide.md)

[All historical versions](module-guide.md#versions) · [Independent article coverage qualification](articles-and-code.md)

Maintenance: edit module-status.json, then run npm run docs:sync. Review scope and evidence before updating reviewedVersion; never merely relabel an old snapshot.
