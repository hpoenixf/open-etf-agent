# v0.36.1: keep typed Project Memory out of compaction summaries

This patch applies to opt-in Main compaction with the default Project Memory policy in persistent Projects. A settled tool-call group containing typed Memory stays intact in Main's working context rather than being rendered into opaque summary text. Main's existing pre-dispatch checks still control whether the original typed data can be sent. Saved frontiers that carry Memory dependencies or cover an ineligible Memory-bearing group are not reused. Source-only groups remain eligible. No stored Memory or report is rewritten; this does not retract prior requests or detect Memory mentioned in untyped prose.

## Verification

- Baseline: published v0.36.0 commit `3680a034e11647d637223a3f6326ee6fe6f48784`. Four synthetic regressions distinguish the fix: mixed-group exclusion, Memory-only fallback and revocation in Main, rejection of an old Memory-dependent frontier, and rejection of an old metadata-only frontier.
- Run the focused suite on Node 26.11.1 with `node --test --test-concurrency=1 test/*compaction*.test.mjs test/project-memory-isolation.test.mjs`. The original selected-Memory admission guard and source-only behavior remain covered.
- [v0.36.0's 10/10 live result](v036-release.md) remains historical evidence for that release only. No live model calls were made for this maintenance verification.

## 中文

此修复只涉及持久化项目在默认记忆策略下主动开启 Main 压缩的场景。含结构化记忆的已完成工具调用组不再转成摘要文本，也不会复用覆盖该组的旧摘要；原始数据仍由 Main 在派发前核对资格。仅含来源的调用组仍可压缩。不会改写记忆或历史报告，也不会撤回已发送的请求，不能识别普通文本里的记忆。旧版 10/10 仍只属于 v0.36.0；本次未调用真实模型。
