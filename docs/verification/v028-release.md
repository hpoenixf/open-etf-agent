# v0.28 Report Review: Runtime qualification and limits

Tested source: [`d53abf0`](https://github.com/hpoenixf/open-etf-agent/commit/d53abf0acc0944664ca2df6a0eb60d0529449f01), integrated on v0.27.0. Later release metadata does not change production code or tests.

## What passed

The fixed ten-case cohort used synthetic reports and source text with real model calls. All ten completed through the original Runtime and produced structurally valid Review records. Original output was persisted and matched independent-process readback. Re-executing all ten terminal identities did not invoke a Gateway or change request accounting. All ten complete provider receipts reported the existing Go subscription and zero additional cost. No new unknown outcome occurred in this cohort; historical failed and unknown attempts remain separate and retained.

Node 26.11.1 serial aggregate checks: 1,283 tests, 1,279 passed, zero failed, four old-binary compatibility skips. The 18 focused Review checks and build passed. Independent integration review found no reproduced permission expansion or Runtime regression. These observations are bounded qualification, not universal reliability.

## What it does not prove

Runtime 10/10 is not semantic 10/10. Independent claim-level reading found useful detection of numeric/unit errors, missing qualifications and wrong-source citations, but also overstrong contradiction labels where evidence was merely absent, and one label inconsistent with its explanation. Findings remain advice. The preserved original report is not rewritten, certified or withheld because a reviewer disagrees.

The cohort is not a financial research benchmark or proof of broad model quality. It does not qualify arbitrary report sizes, protected sources, binary attachment semantics, visual/dynamic Web coverage, automatic repair or automatic publication. Four skipped historical-binary checks are not passed checks.

## 中文摘要

固定十题使用合成报告与来源，真实模型调用的 Runtime 完成、结构校验、原始输出保存和独立进程读回均为 10/10；再次读取/执行终态没有新增模型请求。十份回执均确认使用既有 Go 套餐且额外费用为零，旧失败和 unknown 保留。

这不是答案质量满分。独立逐主张复核发现部分“缺少支持”被说成“已被否定”，以及标签与解释不一致。Review 只提供建议，不改写或认证原报告，也不授予新权限。正式 tag、Release 与最终提交 CI 需另行核实。

## Original CI and test-fixture repair

PR CI 42971438293 on a6fed960 passed 1278 tests, skipped four and failed the existing result-committed process-death fixture: the helper exited without the expected SIGKILL. That failure remains recorded; the exact prior exit cause was masked by the cleanup assertion. The fixture now uses a fixed per-process Session clock, with the second process explicitly advanced beyond the saved lease, and preserves real SIGKILL, fence, accounting and unknown-no-replay assertions. Helper exit diagnostics are no longer masked. This is a test-only timing repair, not a production Runtime change or a rerun of the real-model cohort. Final fixed-commit CI is reported separately.
