# v0.16 qualification — revocable fixture documents

[Project home](../../README.md) · [中文入口](../../README.zh-CN.md) · [Machine-readable receipt](v016-revocable-rag.safe.json)

This release source integrates the existing revocable-document module onto public main `91ff2631a621b907d361d397d33f78b7b8bfd673`, retaining its nullable stream, Child and cancellation fixes. It contains no v0.17 shared Admission or v0.18 scheduler module. Package and lockfile identify 0.16.0; dependencies are unchanged.

## Fixed qualification

- Original provider-free test suite: **576/576**, 94 files, no skips or failures; build passed. The receipt retains exact input identities, command, output hashes and process completion.
- Independent merge review found no actionable defects. Current main's compaction, specialist Child and cooperation files were retained byte-for-byte.
- A separate source copy installed from an existing official npm cache with `npm ci --offline --ignore-scripts --no-audit --no-fund`, then built successfully. This was a new installation, not reused `node_modules`; it was **not a fresh network download**. The initial online install failed with DNS `EAI_AGAIN`; a subsequent environment launch failed before execution. Those outcomes remain in the receipt.
- Independent CLI init → start → Publication → HTTP Reader returned the original **476-byte** protected report. Revoking `atlas-a` caused the subsequent Publication CLI read to exit **2** and Reader to return **404**, while retained original report bytes stayed unchanged. Actual stage hashes and protection/run identities are in the receipt.
- **Zero real model or paid calls.** Fixture model/tool reservations are execution counters, not external billing.

## Boundaries

`document-revocation@1` remains an explicit fixture-only profile in an isolated session directory. It does not permit arbitrary live ingestion, add ACL authority, qualify real financial research, or erase prior report bytes. A revoked dependency is refused at consumption/publication boundaries. Existing session profiles are not silently migrated; use a separate directory for this profile. Historical fixed qualifications are retained rather than relabeled onto this source.

This document records code and delivery qualification, not proof that a remote ref, GitHub Release or article site has been published. Publication is established separately by actual fixed ref/tree/blob/byte readback and applicable original CI. Article mappings retain their own qualified source identities and may be updated independently.

## 中文摘要

本版仅交付 v0.16 可撤销 fixture 文档能力，保留当前 main 的修复，不夹带 v0.17 / v0.18。全量离线测试与构建通过；独立目录使用既有官方缓存按 lockfile 完成全新安装，未声称网络下载成功。独立 CLI 与 Reader 读回原报告，撤销后明确拒绝再读取，历史报告原字节保留。真实模型调用为零；公开 live 限制不变，文章/站点及正式 Release 状态另行核验。

## Published implementation identity

Immutable implementation source: [`35f244f2e06da447c110325d2ac5a5c39f36e842`](https://github.com/hpoenixf/open-etf-agent/tree/35f244f2e06da447c110325d2ac5a5c39f36e842), tree `bc127865a46b172ef0884257e4ad9d5a32a5d862`. The final package commit additionally records this source identity and version lineage; the actual `v0.16.0` tag and Release must identify that final package, not be confused with this implementation snapshot. All executable, fixture and lockfile bytes used for qualification are unchanged by this metadata-only step.
