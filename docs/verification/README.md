**English** | [简体中文](README.zh-CN.md)

# Verification evidence index · v0.1–v0.11

[Project home](../../README.md) · [Coverage contract for the 31 registered articles](../../README.md#reading)

## How to read this index

Start with **observations** (what happened, failures and fixes), then inspect **receipts** (actual files, HTTP responses and execution results). Use **provenance / frozen inputs** to align source identity, and finally read the acceptance boundaries in **qualification / evidence**. Every stage link below is pinned to a public commit: updates to `main` do not rewrite history. This page provides navigation only; it neither supplements nor relabels original evidence.

- `*.safe.json` and provenance contain portable, sanitized engineering summaries and source hashes. They are neither raw logs nor tamper-proof execution attestations. Databases, credentials, dependency caches and private raw logs are not published.
- A stage's test count describes that execution against its frozen inputs only; **counts are not added across versions as a measure of maturity**. Earlier candidate / prepared-only / license-pending wording records the state at that time; it does not override the current MIT license and publicly available code stated on the home page.
- The historical acceptance records cover the Runtime: legal boundaries, original-content identity, durable effects and actual delivery. They make no acceptance claim about the semantic quality of model answers. New normal real-task qualification and earlier-version rechecks follow the [2026-10-29 release amendment](../live-validation.md#release-qualification); this index does not upgrade historical results.

## Full-suite execution and version lineage

- The v0.8 [original structured observations / fullSuite](v08-observations.safe.json) records the complete command, exit code, duration, input digest and 286/286 count; these do not exist only in prose.
- The [historical execution-output extract](v08-full-suite-extract.safe.json) directly checks the 286 cases and summary in retained output, listing inherited execution metadata separately. It is not a new execution or a full-suite rerun under the final 0.8.0 digest.
- [versions.json](../../versions.json) registers only existing, pinned public code. `since` identifies the introduction of a minimal slice; the coverage manifest's `verifiedAt` identifies the current receipt's verification point. It is neither an implementation-status table for the old plan nor a formal Release registry.

## v0.13 · Ordinary response candidate

[Exact contract](../../openspec/changes/ordinary-response/spec.md) · [Failures and qualification](../../openspec/changes/ordinary-response/evidence.md) · [Structured input/command/readback receipt](v013-ordinary-response.safe.json). This records local provider-free Runtime qualification; independent code review is GO; remote publication remains separately tracked.

## Browse by stage

### v0.1 · The first report that can be read back

Pinned code: [`f9370b8`](https://github.com/hpoenixf/open-etf-agent/tree/f9370b81beef84199293120ee23d245bb0129553)

- **Observations:** [observations.md](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/observations.md)
- **Receipts:** [demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/demo-receipts.json)
- **Provenance / frozen inputs:** [evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/evidence-provenance.json) · [candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/candidate-inputs.sha256) · [baseline-delivery-manifest.json](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/baseline-delivery-manifest.json)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/openspec/changes/v01-first-report/evidence.md)
- **Unverified boundary:** Runtime behavior, provenance and file receipts for four synthetic questions; not live fund research or model-quality certification.

### v0.2 · Skill / MCP / complete SSE

Pinned code: [`a79e89b`](https://github.com/hpoenixf/open-etf-agent/tree/a79e89bf709d4a2245b5a8652882a591ba467519)

- **Observations:** [v02-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-observations.md)
- **Receipts:** [v02-demo-receipt.json](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-demo-receipt.json)
- **Provenance / frozen inputs:** [v02-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-evidence-provenance.json) · [v02-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-candidate-inputs.sha256)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/openspec/changes/v02-skills-mcp-stream/evidence.md)
- **Unverified boundary:** A real stdio fixture round trip is not a sandbox for arbitrary third parties. The separate snapshot below records subsequent wording maintenance.

### v0.3 · Hook / worker / one-level Child

Pinned code: [`5d57314`](https://github.com/hpoenixf/open-etf-agent/tree/5d57314826447f024d878674b98057742b4ce4cd)

- **Observations:** [v03-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-observations.md)
- **Receipts:** [v03-demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-demo-receipts.json)
- **Provenance / frozen inputs:** [v03-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-evidence-provenance.json) · [v03-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-candidate-inputs.sha256) · [v03-pre-review-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-pre-review-inputs.sha256)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/openspec/changes/v03-hooks-workers/evidence.md)
- **Unverified boundary:** Fixed workers and scripted Child execution are not independent real-model experts; a shared budget is not Provider admission.

### v0.4 · ResultStore / Context / exact readback

Pinned code: [`ecf6cb4`](https://github.com/hpoenixf/open-etf-agent/tree/ecf6cb45b4062586614e83aed917c92d704cb63b)

- **Observations:** [v04-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-observations.md)
- **Receipts:** [v04-demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-demo-receipts.json)
- **Provenance / frozen inputs:** [v04-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-evidence-provenance.json) · [v04-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-candidate-inputs.sha256)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/openspec/changes/v04-results-context/evidence.md)
- **Unverified boundary:** A lexical candidate is not original content already read; byte projection is neither token-quality optimization nor a complete RAG revocation platform.

### v0.5 · Compaction / explicit Memory

Pinned code: [`05c0dd2`](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf)

- **Observations:** [v05-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-observations.md)
- **Receipts:** [v05-demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-demo-receipts.json)
- **Provenance / frozen inputs:** [v05-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-evidence-provenance.json) · [v05-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-candidate-inputs.sha256)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/openspec/changes/v05-notes-memory/evidence.md)
- **Unverified boundary:** Derived notes are not promoted to original content. Forgetting affects future typed input without deleting historical reports; offline scripts do not prove real summarization quality.

### v0.6 · Artifact / Reader / HTTP readback

Pinned code: [`7480b65`](https://github.com/hpoenixf/open-etf-agent/tree/7480b656b18192e6d6b44aab65255b970d58e6f8)

- **Observations:** [v06-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-observations.md)
- **Receipts:** [v06-delivery-receipts.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-delivery-receipts.safe.json)
- **Provenance / frozen inputs:** [v06-observations.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-observations.safe.json) · [v06-candidate-inputs.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-candidate-inputs.json) · [v06-delivery-manifest.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-delivery-manifest.json)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/openspec/changes/v06-artifact-reader/evidence.md)
- **Unverified boundary:** Real loopback HTTP verifies downloaded bytes, not a public authenticated service, background work or cold recovery. This stage added no model calls.

### v0.7 · Trusted Plugin / SQLite / same-Run recovery

Pinned code: [`5f70dc0`](https://github.com/hpoenixf/open-etf-agent/tree/5f70dc0b4760ad70ef211f4823828ab2fee5c525)

- **Observations:** [v07-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-observations.md)
- **Receipts:** [v07-delivery-receipts.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-delivery-receipts.safe.json)
- **Provenance / frozen inputs:** [v07-observations.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-observations.safe.json) · [v07-candidate-inputs.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-candidate-inputs.json) · [v07-delivery-manifest.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-delivery-manifest.json)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/openspec/changes/v07-trusted-recovery/evidence.md)
- **Unverified boundary:** Recovery requires evidence of actual process interruption and a new PID; terminal resume only reads back. A DB fence does not constrain arbitrary external side effects, and unknown effects are not retried. There is no v0.7 live-recovery qualification.

### v0.8 · Publication: minimal body commit and readback

Pinned code: [`2c096ce`](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1)

- **Observations:** [v08-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-observations.md) · [Original execution summary](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-observations.safe.json)
- **Receipts:** [Independent install/build, five CLI processes, and readback of new and old Artifacts](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-independent-delivery.safe.json)
- **Provenance / frozen inputs:** [Original 119-file verification inputs](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-candidate-inputs.json) · [0.8.0 publication inputs](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-publication-inputs.json) · [Narrow verification of version-field-only promotion](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-metadata-promotion.safe.json)
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/openspec/changes/v08-publication-only/evidence.md) · [Actual RED](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-publication-red.safe.json) · [Owner / Runtime / CLI GREEN](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-publication-green.safe.json) · [Kit structural results](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-kit.safe.json)
- **Exact version boundary:** The actual 286/286 full-suite run belongs to `0.8.0-dev.0`. `0.8.0` changed only three version fields in two files; the other 117 items and 95 locked dependency records stayed unchanged, followed only by the necessary narrow verification. This is not described as another 286-case run under a new aggregate digest, and the old expanded candidate's 298 result is not borrowed.
- **Minimal module boundary:** The same Runtime commits independent body content/current events, explicit revision identity and CLI readback. Publication is not an alias for a report Artifact. Committed body content survives subsequent Run failure independently. No Web Chat, HTTP/SSE product layer, Worker, queue or authentication system was added, nor any new real-model call or browser acceptance test.
- **2026-10-27 subsequent delivery record:** [Code, README, 019 source/body, and the independent-site gap](v08-delivery-2026-10-27.md) · [Single current maintenance status](v08-maintenance-2026-10-27.safe.json). The actual 019 body was checked; publication for the overall maintenance workflow remained blocked, without full archival.
- **Coverage-manifest input scope:** The coverage check binds 115 `src/fixtures/test/package` inputs; the checker is bound separately through `runnerSha256`. The stage's 119 inputs additionally include four scripts: build, checker, live runner and live pins. Different sets do not imply source drift.


### v0.9 · An independently invoked single-Run Worker

Pinned code: [`dad9c6e`](https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d)

- **Observations:** [Version notes](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-observations.md) · [Original historical machine-readable record of 305 cases](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-observations.safe.json) · [Actual record of the current combined 309 cases](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-combined-observations.safe.json). The two executions and their inputs are preserved separately, not relabeled or added together.
- **Receipts / delivery:** [Original independent install/build](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-independent-install.safe.json) · [Original eight-process CLI and old-Artifact readback](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-independent-delivery.safe.json) · [Equivalence check of 58 delivery inputs and 55 built files](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-delivery-equivalence.safe.json); the latter is not a new execution.
- **Provenance / frozen inputs:** [Original 124 inputs](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-candidate-inputs.json) · [Current 124 inputs](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-combined-inputs.json). The combination incorporates only already-public coverage-checker/test changes; Worker behavior/package/dependencies are unchanged.
- **Qualification:** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/openspec/changes/v09-single-run-worker/evidence.md) · [Kit structural record for this combination](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-combined-kit.safe.json). Real processes/SQLite, synthetic model actions; no qualification of a scheduling platform, browser, real-model quality or formal Release.

### v0.10 · Result / Reference consumption module

Pinned source: [`ff5b927`](https://github.com/hpoenixf/open-etf-agent/tree/ff5b9273ef0d239e804f61792702cd2e94174be7); pinned qualification commit: [`ae82c26`](https://github.com/hpoenixf/open-etf-agent/tree/ae82c26e6511c1dac9d67e864284b55eee6a82c2). The old duplicate read-adapter candidate was canceled. This module carries the minimal increment originally planned for 1.1; it is not scheduled again and does not mean that 1.0 is complete.

- **Original implementation execution:** [Actual 333/333 run and counterexamples](https://github.com/hpoenixf/open-etf-agent/blob/e442f600891be79625fc78751e2d9f39905920da/docs/verification/result-consumption-observations.safe.json) belongs to frozen inputs under the original 0.9.0 metadata; it is not relabeled as another run after numbering.
- **Qualification for this numbering:** [Exact equivalence and new narrow install/build/CLI/independent byte readback](https://github.com/hpoenixf/open-etf-agent/blob/ff5b9273ef0d239e804f61792702cd2e94174be7/docs/verification/v010-numbering.safe.json): only three version fields changed; 123 non-package execution inputs and 95 dependency records stayed unchanged.
- **New pinned inputs and actual smoke:** [125 inputs](https://github.com/hpoenixf/open-etf-agent/blob/ae82c26e6511c1dac9d67e864284b55eee6a82c2/docs/verification/article-coverage-source.json) · [Actual new-version receipts for the original 15 targets](https://github.com/hpoenixf/open-etf-agent/blob/ae82c26e6511c1dac9d67e864284b55eee6a82c2/docs/verification/article-coverage-receipts.json). These are bounded Runtime cases, not a full-suite rerun or a model-semantic review.
- **Upgrade boundary:** [`tool-host@2` contract](https://github.com/hpoenixf/open-etf-agent/blob/ff5b9273ef0d239e804f61792702cd2e94174be7/openspec/changes/result-reference-consumption/design.md): finish old active Runs first; v1 checkpoints cannot resume across versions, while old immutable outputs remain readable. This does not qualify a real Provider, financial semantics, a formal Release or production use.

### v0.11 · Local text-layer PDF input

Pinned execution source: [`5f42c33`](https://github.com/hpoenixf/open-etf-agent/tree/5f42c33892d57ed05e8cd09cad48573e6901995b), including the necessary existing-Session admission repair. This single PDF module does not add OCR, visual parsing, remote acquisition or active-PDF durable resume.

- **Full Runtime regression:** [structured finalRun / 373-case receipt and frozen inputs](https://github.com/hpoenixf/open-etf-agent/blob/5f42c33892d57ed05e8cd09cad48573e6901995b/docs/verification/session-hot-journal-admission.safe.json). Original execution input digest `73148a90…` is preserved; at source `5f42` all 138 runtime/test/fixture/package/build inputs matched. Verification source `e0a6` subsequently changes only the coverage maintenance test; the remaining 137 are exact. It is not another full-suite run.
- **Maintenance execution:** [Current 16-target receipts](article-coverage-receipts.json), [fixed 137-input inventory](article-coverage-source.json) and [56 affected-consumer tests / preserved 54-of-55 failure](pdf-coverage-qualification.safe.json). The added PDF row qualifies only its stated local text-layer case; OCR, page images, layout and multimodal capabilities remain excluded. The original [15-target maintenance record](integrated-maintenance.safe.json) is retained.
- **Independent delivery:** [new locked install/build and two fresh-process PDF readbacks](integrated-install-pdf.safe.json) · [345 frozen copied inputs](integrated-install-inputs.safe.json). The operator-selection case uses an original synthetic PDF, not a real user document; original bytes, physical pages and report/source hashes match.
- **Preserved failures and scope:** [PDF observations, including the original 358/359 failure](v011-observations.safe.json) · [dated Spec evidence / remaining publication gate](../../openspec/changes/v011-local-pdf/evidence.md) · [retained and simplified responsibilities](../evolution/v011-pdf-lineage.md). No live-model, deployment or formal Release claim.

## v0.7 topic-specific entry points

These links also pin the original v0.7 snapshot, keeping successful demos separate from interrupted recovery:

- [v07-plugins.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-plugins.safe.json) — Contribution validation, activation failures and resource release.
- [v07-session.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-session.safe.json) — SQLite, lease/fence and storage contracts.
- [v07-review.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-review.safe.json) — Independent counterexamples, failures and fixes.
- [v07-cli.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-cli.safe.json) — Real CLI start / inspect / terminal resume; not a substitute for kill/restart.
- [v07-memory.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-memory.safe.json) — A single intent and the Memory owner's durable effect.
- [v07-old-artifact.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-old-artifact.safe.json) — Readback of old immutable artifacts.
- [v07-kit.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-kit.safe.json) — Evidence Kit structural checks, not test-execution certification.

## Historical live runs and maintenance: keep versions distinct

- [First real-call batch for v0.1–v0.5](https://github.com/hpoenixf/open-etf-agent/blob/d075068ac99a6c798d012c46bff4fe0c33eb9979/docs/verification/live-v01-v05-first-batch.md): historical HTTP / artifact records for their respective original versions; mechanisms not exercised remain uncovered. **Not live qualification for v0.6/v0.7/v0.8/v0.9, and not model-quality certification.**
- [Restricted live entry point and authorization](../live-validation.md): the default coverage smoke does not call this entry point; provider, synthetic data and costs still require separate authorization. The [next-batch plan](live-runtime-next-cases.md) is only a plan.
- [Independent v0.2 wording maintenance](https://github.com/hpoenixf/open-etf-agent/tree/a10d4f1bd1ecc39224272156221fe29792b64094): unread pages must not be written up as known facts; original stage evidence remains unchanged.
- [Narrow v0.6 errno maintenance](https://github.com/hpoenixf/open-etf-agent/blob/765fd771430c55e1598b3f7bc32f342215a46f33/docs/verification/v06-errno-maintenance.md): distinguishes original-stage inputs from maintenance inputs. Node 26.11.1 was actually run locally; the all-green v0.6 result on 26.8.1 is a user observation, not a claimed local v0.7 minimum-version test.

## Historical delivery before numbering · Result / Reference consumption

Pinned implementation: [source commit `e442f60`](https://github.com/hpoenixf/open-etf-agent/tree/e442f600891be79625fc78751e2d9f39905920da); the pinned main merge point for that delivery is [`ade806a`](https://github.com/hpoenixf/open-etf-agent/tree/ade806a18e0b89c07b929111ea30afbebad93279). Its execution and publication used package 0.9.0. Numbering was subsequently completed by the v0.10 qualification above, without rewriting this history or implying that roadmap 1.0 or 1.1 had been released.

- [Original RED/GREEN and complete local 333-case execution](result-consumption-observations.safe.json) · [Frozen inputs](result-consumption-inputs.json) · [Independent install/build/CLI and new-process byte readback](result-consumption-independent.safe.json). Closeout did not relabel these historical executions as reruns.
- [Spec / evidence](../../openspec/changes/result-reference-consumption/evidence.md) · [Four statuses: code, README, bilingual articles and canonical site](result-consumption-publication.safe.json). Registered coverage remains 31 entries; the actual modules catalog has 33 articles. The other two are unmapped; no verified status is fabricated.
- Upgrading uses `tool-host@2`: finish old active Runs before upgrading; v1 checkpoints cannot resume across versions. Original immutable Result, Artifact and Publication content remains readable. Production Gateway encoding was verified using an offline transport, not qualified against an actual Provider or financial semantics.
- The original Kit rejection RC.4 [historical record](result-consumption-kit.safe.json) is preserved. Subsequent work uses manual evidence registration in the existing directory and structured verify; it does not claim automatic tool archival or a formal Release.

## Machine-readable evidence for current article coverage

[Single article manifest](article-coverage.json) · [Pinned source inputs](article-coverage-source.json) · [Actual bounded-execution receipts](article-coverage-receipts.json) · [Check script](../../scripts/check-article-coverage.mjs)

`--check` confirms the existence of pinned commits and agreement between current relevant bytes and existing case receipts; it does not claim a new execution. Only `--smoke` serially invokes the original CLI / exact node:test targets. Source or case changes require requalification, not merely retaining the word `verified`. See the [home-page usage instructions](../../README.md#reading).

<a id="repository-maintenance"></a>
## Repository maintenance acceptance

Use the existing checks and evidence paths above. These are requirements for accepting a change, not a claim that every planned module has met them.

- **Normal real-task release gate — 2026-10-29:** Follow the [existing live-validation qualification policy](../live-validation.md#release-qualification) for new releases and earlier comparable live validations: pre-register fixed code/provider/model/prompt, representative cases, repetitions, deadlines and budget. The requested recheck uses five independent runs per version and at least 4/5 successes, never pooled across versions or expanded to five per case; 80% observed is not population reliability or full-feature certification. Required capability coverage remains separate. Keep task success, answer quality, mechanism coverage and abnormal Runtime handling separate; all failures/timeouts/unknowns remain counted. Safety/authorization/provenance violations or unintended duplicate effects block release. Changes require a justified new freeze and qualification while preserving all prior attempts/costs. Earlier tags/receipts stay immutable; dated rechecks state insufficient evidence and remediation without retroactively inventing release-time acceptance.
- **One runnable module per version:** identify its input, processing, observable output and readback; keep supporting adapters within existing responsibilities.
- **One consistent set of facts:** code, fixed version, amended plan, both language entrypoints and articles must agree on the actual selected case. Introduction history and current verification pins remain distinct.
- **Honest boundaries:** preserve compatibility limits, failures and unverified behavior. Fixture execution, live-model quality and production readiness are different evidence.
- **Reproducible English entry:** follow the English Quickstart from the supported setup and inspect the real output. Keep commands and Chinese navigation in sync.
- **Complete editions, real links:** register English articles only after complete-text and diagram review. A title, summary or placeholder is not a translation; retain an explicit Chinese-original fallback when needed.
- **Verify publication separately:** run the existing CI and fixed-source coverage/backlink/localization checks, then read back the actual repository ref, tree and changed blobs. Article publication additionally requires the existing blog source lock and canonical-domain receipt/body readback; a source commit alone is not a live website.

These checks do not introduce another execution owner, release platform or budget-approval process.

## v0.11 recovery-test maintenance · 2026-10-28

The later [main CI failure](https://github.com/hpoenixf/open-etf-agent/actions/runs/40690146945) remains a failed observation; the earlier publication record above is historical, not evidence that this later run passed. The Memory recovery fixture now owns its lease clock, as the compaction fixture already did. Production Runtime/Session source and the original test assertions are unchanged.

- [Fixed qualification record](https://github.com/hpoenixf/open-etf-agent/blob/1de10d40b69db9a83ff990c32e8e272121052814/docs/verification/memory-recovery-clock.safe.json): actual execution at `e1b8e4edde724548fab16d8ca4b205379bfa7f30`, 374/374 Runtime tests, 56/56 maintenance consumers and 16 fixture targets. These are separate from the original 373-case execution, not replacement history or live-model qualification.
- [Recovery publication status](v011-recovery-publication.safe.json): the newly published bilingual article pair is verified independently; final main CI and canonical site publication are separate gates.

## v0.15 · Serial specialist Child

[Contract, failures and boundaries](../../openspec/changes/serial-specialist-child/evidence.md) · [Final source and structured full-suite qualification](../../openspec/changes/serial-specialist-child/final-verification.safe.json) · [Three real-call batch summaries](../../openspec/changes/serial-specialist-child/live-evidence.safe.json). The first two failures remain; the third mechanism and bounded synthetic-source comparison passed. Of 10 attempts, 9 responses explicitly report zero Go balance charge and 1 has unknown usage/cost. This does not upgrade the older Child coverage receipt or certify general semantics or live recovery.
