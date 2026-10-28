**English** | [简体中文](v1-to-v2.zh-CN.md)

# From v0.8 to v2.0: CLI first, one complete module at a time

> **Status: v0.8/v0.9/v0.10 are delivered; v0.10 is the Result / Reference consumption module. See the README for its pinned source and qualification; the remaining work follows the tables below.** The subsequent sequence can be trimmed; it is not a release-date or formal Release commitment. Actual coverage is governed by the README's current-state table and the unified capability manifest it references. This page does not maintain a separate coverage table.

## Direction: extract from existing practice, complete the smallest end-to-end workflow first

Open ETF Agent builds on the module responsibilities, implementation experience and article motivations already established in ETF Agent: find the original module and contract first, then extract the smallest capability that can run independently. It is not a separate system with the same names and an article attached afterward.

- **One feature version, one primary module.** Existing consumers may be connected, but “integration” must not add another set of Owners. An Owner is the module responsible for a fact, not necessarily a new service or Manager.
- **CLI first; add APIs as consumers need them.** Complete the workflow using real files and independent processes first, then add necessary HTTP/SSE read adapters. A browser interface is not a prerequisite and needs separate qualification; API acceptance is not UI acceptance.
- **Reuse first, add dependencies second.** Prefer existing code, Node's standard capabilities, SQLite and SDKs already adopted. Mature, lightweight open source can replace generic infrastructure; check official APIs, licenses and maintenance when selecting it. Do not introduce an entire platform for a small requirement.
- **Simplify deployment, not core contracts.** Identity, authorization, budgets, provenance, partial failures and unknown outcomes must survive simplification. The model owns semantic judgment; the Runtime owns legal execution and actual effects.

Publication, Web, PDF, isolated Python, synthetic ETFs and background execution in the [original roadmap][original-roadmap] must each be completed and accepted independently by module. Versions such as 0.10 and 0.11 remain available; do not bundle deliveries to fit a number. Existing or already-planned Decimal, units, currencies, data cutoff dates and CSV are not counted again as new 1.x features.

## 2026-10-27 adjustment: finish the current single-module workflow first

The delivered [pinned v0.8 code][v08] contains Publication only: stable blocks/delivery sequence numbers, explicit revision CAS, original receipts and CLI reads. Worker and Web were not bundled into it. The subsequent [pinned v0.9 code][v09] completed the minimal Worker separately; it is not retroactively described as a v0.8 feature. The roadmap continues to 2.0, but each step first reviews the original Owner and failure contract, then develops the Spec, implementation and necessary verification. Delivered facts and future candidates are marked separately; version numbering never replaces verification.

| Stage / status | Single primary module and minimal CLI delivery | Explicit exclusions |
| --- | --- | --- |
| **0.9 · Delivered** | **Single-Run Worker.** Submit one bounded synthetic task; the submitting process exits, and another process drives the same Runtime using the original Session lease/fence. The CLI reads back the original result. | No Task/queue state machine, Scheduler or resident service. Background execution in the same generator is not an independent Worker; concurrent foreground short questions are not claimed. |
| **0.10 · Delivered** | **Result / Reference consumption.** Original selection → existing calculator → actual encoding of the next Gateway request → report and CSV with the same reference → original-byte readback in a new process. | No new ResultStore, formula library, Python, Web, financial Reviewer or model-semantic gate. Preserve the explicit `tool-host@2` upgrade boundary. |
| **Separate future version** | **PDF input.** The CLI reads one local synthetic PDF with clear permission; existing evidence can reference and read back its original pages/selections. | No OCR platform, crawler or Web. |
| **Separate future version** | **Controlled Python calculation.** The CLI produces a readable result from a calculation with bounded input; actual isolation, timeout and stop boundaries receive separate acceptance. | Do not call an ordinary subprocess a sandbox, expand permissions or add an entire platform for it. Defer if the environment is unavailable. |
| **Optional, later** | **Web reading interface.** Consume only qualified interfaces; qualify it separately once real-browser conditions are available. | Not a prerequisite for CLI 1.0/2.0; existing unverified WIP is not automatically promoted. |

**The old 0.10 read-only adapter candidate is canceled, not renamed Web.** v0.6 already has Artifact/Revision and a loopback Reader; v0.8 already has Publication CLI readback for explicit Runs. Exposing these capabilities again is not a new module. **Web sourcing** (external-network input) in the original roadmap remains an unnumbered candidate requiring a separate review of the original Web module and minimal evidence-acquisition contract. The **Web reading interface** above is an output consumer: the two are not interchangeable, and existing WIP does not automatically qualify either for the next version.

**Early read-only finding on 2026-10-27 (the cancellation recommendation at that time is preserved):** At pinned main `4ec2bb54b9747c46e8e95b9d742a50862aae9f75`, Publication CLI already exposes body/revision/events for explicit Runs; Reader already exposes reports, CSV, sources and revisions, with `evaluate` as an actual consumer. No additional independent consumer or unmet reading requirement was identified in the then-current public source, plan or user requests. The recommendation was therefore to cancel this duplicate 0.10 adapter candidate, adding neither a thin HTTP wrapper nor a renamed Web module. A real new consumer could justify a separate proposal later. This does not claim that no external reading need can ever exist, nor does canceling the candidate establish that 1.0 is complete.


**2026-10-27 22:35 numbering decision:** Accept the cancellation recommendation above; do not implement the duplicate reading wrapper. The minimal Result / Reference workflow originally planned for 1.1 had completed code, delivery and article synchronization at public `7dfb61735aa0f96166e16b7197b11b755b86bb35`. It is now organized as **v0.10**, following the already-published v0.9, rather than leaving a complete module indefinitely “unnumbered.” This change adds version identity and the corresponding qualification only, not functionality. This minimal increment from the original 1.1 has moved forward into v0.10 and will not be scheduled again; other unimplemented future modules remain. 1.0 is still a stability-qualification milestone; a numbering change cannot establish its completion.

Numbers such as 0.11 and 0.12 are assigned when each scope is confirmed, not filled by forcing in modules. Synthetic ETFs remain example inputs for the existing toolchain; only an independent Owner contract warrants a separate version, not a duplicate demonstration. The v0.9 [Spec and actual evidence](../../openspec/changes/v09-single-run-worker/evidence.md) correspond to the pinned single-Run implementation. v0.10 numbering qualification is recorded separately; it does not automatically start or qualify other future modules.

## Candidate sequence from 1.x → 2.0

| Stage | Single module and smallest runnable result | Not in this version |
| --- | --- | --- |
| **1.0** | **Qualification milestone, not a new feature version.** Declared configurations install independently; declared CLI entry points create research and read back reports and files. API acceptance covers only existing interfaces or the needs of identified consumers. | Do not rush to complete every candidate or build a complex compatibility layer. |
| **Original 1.1 · Incorporated into v0.10; not rescheduled** | **Result consumption and reference integration.** Preserve the original plan identity; this minimal workflow is implemented and carried by v0.10. Any future Result increment requires a new concrete gap and Spec. | Do not count the same feature as another version; do not rebuild Decimal/formula libraries or add a financial Reviewer. |
| **1.2** | **Temporal interpretation.** Given a task anchor and trusted timezone, the original task date stays stable across midnight, daylight-saving transitions and restarts; current time and data timestamps are listed separately. | No Scheduler, guessed market trading days or all-market calendar collection. |
| **1.3** | **On-demand Memory recall.** Query an explicit store and send only currently authorized revisions to the model. Old hits cannot return after correction or forgetting; temporary mode does not access cross-session Memory. | Do not rebuild save/forget, add automatic learning or a vector service, or use ordinary TTL eviction for explicit constraints. |
| **1.4** | **Durable ordinary responses.** A question receives the original reply through CLI/API; after restart or duplicate submission, the original nonterminal Run records actual adoption within the permitted time window. | No browser inbox, generic approvals, independent Correction or long-lived Human Park. |
| **1.5** | **One serial specialist Child.** One built-in source-checking specialty has independent context and model requests, returning its original result for Main to read and synthesize. | No personal Profile product, parallel experts, recursive network or Reviewer. |
| **1.6** | **Small-library RAG with revocation.** A few local documents are searchable. If authorization is revoked after generation, first publication, historical API reads and attachment reads all check current eligibility. | No Memory governance, enterprise ACL/vector platform or promise to retract bytes already delivered. |
| **1.7** | **Shared Admission for a fixed route.** Two local processes compete for one capacity group; complete termination, cancellation and unknown remote occupancy remain separately explainable. | No Routing, Failover, multi-group policies, billing or observability platform. |
| **1.8** | **One-shot Schedule.** Explicitly confirm a time; after restart, create the original Run under the same trigger identity and read back its report. | No recurring/conditional monitoring, refresh, notifications or second background executor. |
| **2.0** | **Stability milestone for the selected modules, not a new feature version.** Installation, deactivation, necessary upgrades and artifact readback match the support claims. | Do not rush to finish the table for 2.0 or automatically claim production readiness. |

**1.0 and 2.0 are qualification points, not new-module deliveries; increasing a version number cannot replace module acceptance.** The original 1.1 was delivered early as v0.10. 1.3 and 1.5 extend existing Memory and Child respectively, rather than claiming their first implementations again. The new focus of 1.6 is revocation eligibility, not existing lexical retrieval.

The sequence follows dependency cost: reuse local foundations first, add durable interaction next, then consider cross-process coordination and scheduling. Implementing every item is not required.

**Keep critical dependencies few:** 1.5 reuses result identity already implemented in v0.10 (originally planned for 1.1). In its first version, Main waits for Child settlement before issuing another model request; shared Admission is not a prerequisite. 1.6 needs existing Publication. 1.8 needs temporal interpretation, a managed execution entry point and the corresponding capacity qualification. If a prerequisite is missing, defer that module rather than building an entire platform in the same version.

## Minimal end-to-end workflow per version: add only one contract

The following are admission boundaries for the candidates above, not a new roadmap or already-passed qualifications. Owners retain ETF Agent's original module responsibilities and the article motivations below. Before implementation, check the original contracts and existing integration points in the public repository. Multiple existing consumers may be connected, but their Owners must not be built as incidental additions in the same version. Defer when prerequisites are unmet; do not bypass the boundary with a new platform.

| Candidate | Original module / single increment | Input → final consumer | Reused prerequisites | Failure boundaries and deferral conditions |
| --- | --- | --- | --- | --- |
| **Old 0.10 read adapter · Canceled** | No independent increment was demonstrated; create no new module | Original consumers keep using existing CLI/Reader | v0.6 Reader, v0.8 Publication CLI | Propose separately only when a real consumer emerges; do not silently turn it into Web. |
| **PDF, unnumbered** | Original PDF evidence acquisition; page/selection references for one local text PDF | Synthetic PDF with clear permission → existing ResultRef/Context → CLI report and original-page readback | Existing provenance, reference and file-delivery chain; prefer mature parsers | Corrupt, encrypted, textless and over-limit files fail explicitly. Defer if completion needs an OCR/multimodal platform or a new provenance system. |
| **Python, unnumbered** | Original Python computation; isolated execution and result readback for one bounded calculation | Bounded code/input → original result and Artifact → CLI | Qualified isolation environment, existing tools and result chain | Explain timeout, stop, unknown and valid post-failure artifacts separately. Defer without the environment; do not call a subprocess a sandbox. |
| **Web reading interface, later** | Read-only presentation slice of the original Web Chat; not Web sourcing | Qualified delivery interfaces → browser reads original bodies/files; original CLI readback stays unchanged | Existing Publication/Reader and conditions for real-browser acceptance | Explain missing/invalid content and original revision identity. Defer if new execution/permission infrastructure is needed; not a CLI prerequisite. |
| **0.10 (originally planned for 1.1)** | Result/Reference increment: derived results and actual model consumption can be checked | Synthetic calculation, original input/selection → next actual Gateway request → CLI report/CSV | v0.4 Result/Context, existing calculator, Artifact/CSV and consumption checkpoint | Do not conceal omitted tail rows, mixed currencies/dates or unknown denominators; a bad attachment does not erase body content. Use existing JS, without slipping in Python/financial Reviewer. |
| **1.2** | Temporal: durable task anchor and trusted-timezone interpretation | Task anchor/timezone → original Run model input → CLI report | Existing Run persistence and Context | No drift across midnight, daylight-saving transitions or restarts; handle unknown timezones explicitly. Narrow or defer if completion requires a market calendar or Scheduler. |
| **1.3** | Memory increment: on-demand recall and eligibility checks at adoption | Explicit store/query → model input with currently valid revision → CLI response | v0.5 save/revise/forget, existing Context | Old hits cannot return after correction/forgetting; temporary mode does not read the store. Do not reimplement the lifecycle or introduce a vector service. |
| **1.4** | Human Interaction: durable receipt of one ordinary reply and adoption by its original consumer | CLI reply to original question → original nonterminal Runtime → CLI adoption receipt and result | Original Session/lease, recovery entry point, Runtime; API not a prerequisite | Separate receipt/adoption/effect; bound duplicates, late/expired replies, cancellation and restart. Defer if a new authentication platform, Human Park or recovery engine is needed. |
| **1.5** | Child increment: one real-model specialist Child, not another fixture-child release | Main's checking task → independent Child → Main readback and synthesis → CLI report | v0.3 Child boundaries, v0.10 result identity, original Gateway and root budget | Preserve original results on failure; cancellation cannot bypass root constraints. Main waits for Child settlement. Narrow or defer if Profile, parallel scheduling or shared Admission is necessary. |
| **1.6** | Knowledge/RAG: current document eligibility and disclosure boundaries after revocation | Small-library documents/revocation → original Publication, historical Reader, attachment reads → CLI/existing HTTP | Existing lexical retrieval, Publication, Artifact/Reader integration points | Check eligibility after retrieval but before publication, and on post-publication readback. Already-delivered bytes cannot be retracted. Defer if a new enterprise ACL, Memory governance or publication platform is needed. |
| **1.7** | Provider Admission: cross-process shared admission for one capacity group | Two local calling processes → original Gateway → each CLI's original result | Existing storage, fixed Provider route and Gateway | Separate complete termination, cancellation and unknown; unknown does not automatically release/retry/reroute. Defer without real contention needs; do not add Routing/billing infrastructure. |
| **1.8** | Schedule: durable trigger identity for one confirmed time | Confirmed time → original Worker/Runtime Run → CLI report | Temporal interpretation, managed execution entry point, corresponding capacity qualification | Handle duplicate wakes, restarts, missed times and cancellation explicitly. Defer when prerequisites are missing; do not add Worker/Admission/notifications in the same version. |

1.0/2.0 are excluded from this table: they only check installation, support claims and artifact readback for selected delivered modules. 2.0 additionally checks deactivation and necessary upgrades within the declared scope; qualification must not introduce new features. Stop when the end-to-end success path and key counterexamples above pass; do not expand the first version to every advanced capability in the articles.

## The original 1.1 minimal workflow: now carried by v0.10

Use an original synthetic ETF fee or exposure comparison as input, reusing the existing deterministic calculator:

1. **Preserve provenance:** Link the original ResultRef, actual selection, calculation inputs and derived result; do not build another financial ledger.
2. **Prove consumption:** Check that the next actual Gateway input carries the same result, units, cutoff date and limitations, rather than merely checking that a tool says “calculation succeeded.”
3. **Complete delivery:** Structured numeric references in the report and CSV point to the same result. After process exit, read back original bytes through CLI/files. Reuse the existing Reader when HTTP verification is needed; a new API or network consumer is not a prerequisite for this version.

Verify three counterexamples: an omitted critical tail row, mixed currencies/different cutoff dates, and an unknown denominator. A bad attachment must not erase independently valid body content; deterministic numeric checks do not certify free-text investment arguments.

**Stop once the success chain and key counterexamples pass.** If isolated Python has not been independently qualified, use the existing JavaScript calculation path first; do not make this version deliver an additional workbench.

## Modules and articles: evolve along the same design lineage

These articles explain why the original modules took shape. The public extraction keeps their core contracts while removing configuration and platform dependencies unnecessary for this version. Verification records from the original system are not qualifications for this repository.

| Original module | What the extraction preserves | Related article |
| --- | --- | --- |
| Publication | Stable blocks and delivery positions do not change with revisions; failure after commit does not erase body content. | [The body-publication commit boundary][publication] |
| Single-Run slice of ScheduledTaskWorker | claim / lease / cancel → same Runtime → settlement of original durable facts; do not copy the Schedule/Task platform wholesale. | [Bounded Runs and recovery in scheduled research][schedule]; [The difference between background delivery and concurrency][async-delivery] |
| Result / Reference | Separate original results, selections, derivation and actual consumption; provenance can be read back. | [How calculation results enter reports][result] |
| Temporal | Recovery-time “now” does not overwrite the original task time. | [When an Agent says “today,” which day is it?][time] |
| Memory | A hit does not imply current validity or adoption; correction/forgetting has durable effects. | [The complete Memory lifecycle][memory] |
| Human Interaction | Receipt of a reply, adoption by the original consumer and business effects are distinct facts. | [Durable human interaction][human] |
| Child | Share execution foundations and root constraints, not one tangled context. | [From isolation to specialized collaboration][child] |
| Knowledge / RAG | Permission at retrieval does not imply permission at first publication or later reads. | [Document revocation and historical replay][rag] |
| Provider Admission | Separate Run budgets from Provider capacity; HTTP 200 does not prove remote execution has ended. | [Capacity-admission leases and unknown occupancy][admission] |
| Schedule | Confirmed definitions, trigger opportunities, Runs and reports each retain their actual identities. | [Scheduled research: continuing after a session ends][schedule] |

Start RAG with small-scale lexical retrieval; Admission and Schedule reuse existing storage and execution entry points. **Libraries can supply parsing, indexing, transactions or wake-ups, but cannot replace provenance eligibility, authorization, unknown-outcome or idempotency contracts.**

After each version is complete, add a pinned code version, a runnable case and a failing counterexample beside the relevant argument in the original article, preserving historical context and uncovered scope. The goal is for public code to explain and reproduce the article's mechanisms, not to match every feature mentioned in the article.

## Risks, scope trimming and acceptance

**The largest risk is turning shared admission into a control platform.** 1.7 allows only one capacity group, two calling processes and a bounded queue. Unknown occupancy retains its original identity and is not automatically released, retried or rerouted. Defer the entire version without a real contention need. Later additions such as a Provider catalog, Failover, personal Profile, Human Park, controlled refresh or external observability outputs are evaluated separately, not bundled into existing versions.

RAG's challenge is ordering revocation and disclosure commits, not building a vector store first. Verify real processes and actual delivered bytes through the declared entry points first. Existing HTTP reads receive the same checks; include SSE only for an actual consumer. If necessary, reject the entire protected candidate rather than adding a semantic classifier to grant permission.

Before completing each module, answer just four questions:

- Did the input pass through a real execution entry point, and can its result be retrieved through CLI/API?
- Did the final consumer adopt the original identity and limitations, rather than merely creating an intermediate object?
- Are cancellation, duplicates, restart, partial failures and unknown outcomes explainable within this version's scope?
- Have old duplicate entry points been removed, and can independently valid outputs still be read?

Acceptance focuses on **Runtime correctness**. Semantic status may remain `unreviewed`; no separate model-scoring gate is added. A claimed real independent-model path still requires evidence of actual calls on that path, not scripted fixtures.

Keep historical support narrow: pinned snapshots run independently, delivered artifacts remain readable, and necessary adjacent data upgrades preserve original backups. Failed or unknown states must not damage the old database. Old active Runs do not resume across versions by default. Do not expand into multi-tenancy, trade execution, untrusted-plugin installation, cluster disaster recovery or universal exactly-once.

See the [original roadmap][original-roadmap] and [capability matrix][original-matrix] for the original planning and boundaries; never infer completion from version numbers.

[result]: https://hpoenixf.com/eff-agent-article/en/articles/financial-agent-python-result-consumption
[publication]: https://hpoenixf.com/eff-agent-article/en/articles/019-agent-answer-publication
[async-delivery]: https://hpoenixf.com/eff-agent-article/en/articles/agent-asynchronous-research-time-bound-delivery
[v08]: https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1
[time]: https://hpoenixf.com/eff-agent-article/en/articles/agent-temporal-semantics-market-calendar
[memory]: https://hpoenixf.com/eff-agent-article/en/articles/026-agent-memory-forget-durable-effects
[human]: https://hpoenixf.com/eff-agent-article/en/articles/agent-durable-human-interaction-response-adoption
[child]: https://hpoenixf.com/eff-agent-article/en/articles/agent-subagent-context-specialization
[rag]: https://hpoenixf.com/eff-agent-article/en/articles/027-rag-revocation-publish-replay
[admission]: https://hpoenixf.com/eff-agent-article/en/articles/agent-provider-admission-capacity-lease
[schedule]: https://hpoenixf.com/eff-agent-article/en/articles/agent-autonomous-scheduled-research
[original-roadmap]: https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/02-roadmap-research.md
[original-matrix]: https://github.com/hpoenixf/open-etf-agent/blob/c390eb2dd951b53b1dab2d64a9cd72d216fde8dc/docs/plan/05-coverage-matrix.md


[v09]: https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d
