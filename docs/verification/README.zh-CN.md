[English](README.md) | **简体中文**

# 验证证据索引 · v0.1–v0.11

[返回项目首页](../../README.zh-CN.md) · [已登记 31 篇的覆盖契约](../../README.zh-CN.md#reading)

## 怎样读

先读 **observations**（发生过什么、失败与修复），再查 **receipts**（实际文件/HTTP/运行结果），用 **provenance / frozen inputs** 对齐源码身份，最后读 **qualification / evidence** 的验收边界。下方链接全部固定到各阶段公开 commit，不随 `main` 更新改写历史；本页只导航，不补写或重标原始证据。

- `*.safe.json` 和 provenance 是可移植、已清理的工程摘要与来源哈希；不是原始日志，也不是防伪执行证明。数据库、凭据、依赖缓存和私有原始日志不公开。
- 一个阶段的测试数只说明其当时冻结输入的那次执行；**不跨版本加总为成熟度**。先前 candidate / prepared-only / license-pending 文本是当时状态，不覆盖首页当前 MIT 与已公开代码事实。
- 验收范围是 Runtime：合法边界、原文身份、持久效果与实际交付。模型答案语义质量不作为本索引的验收结论。

## 全量执行与版本血缘

- v0.8 的 [原始结构化 observations / fullSuite](v08-observations.safe.json) 已记录完整命令、退出码、耗时、输入摘要及286/286计数，不只存在于散文。
- [历史执行输出提炼](v08-full-suite-extract.safe.json) 直接核对保留输出中的286条case与汇总，并把继承的执行元数据单列；不是新执行，也不是最终0.8.0摘要下重新跑过全套。
- [versions.json](../../versions.json) 只登记已有固定公开代码；`since` 表示最小切片引入，覆盖清单的 `verifiedAt` 表示当前回执验证点。它不是旧计划的实施状态表，也不是正式 Release 注册表。

## 按阶段进入

### v0.1 · 第一份可回读报告

固定代码：[`f9370b8`](https://github.com/hpoenixf/open-etf-agent/tree/f9370b81beef84199293120ee23d245bb0129553)

- **Observations：** [observations.md](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/observations.md)
- **Receipts：** [demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/demo-receipts.json)
- **Provenance / frozen inputs：** [evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/evidence-provenance.json) · [candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/candidate-inputs.sha256) · [baseline-delivery-manifest.json](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/docs/verification/baseline-delivery-manifest.json)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/f9370b81beef84199293120ee23d245bb0129553/openspec/changes/v01-first-report/evidence.md)
- **未验边界：** 合成四题的 Runtime、出处和文件回执；不是实时基金研究或模型质量认证。

### v0.2 · Skill / MCP / 完整 SSE

固定代码：[`a79e89b`](https://github.com/hpoenixf/open-etf-agent/tree/a79e89bf709d4a2245b5a8652882a591ba467519)

- **Observations：** [v02-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-observations.md)
- **Receipts：** [v02-demo-receipt.json](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-demo-receipt.json)
- **Provenance / frozen inputs：** [v02-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-evidence-provenance.json) · [v02-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/docs/verification/v02-candidate-inputs.sha256)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/a79e89bf709d4a2245b5a8652882a591ba467519/openspec/changes/v02-skills-mcp-stream/evidence.md)
- **未验边界：** 真实 stdio fixture 往返不等于任意第三方沙箱；后续措辞维护见下方独立快照。

### v0.3 · Hook / worker / 一层 Child

固定代码：[`5d57314`](https://github.com/hpoenixf/open-etf-agent/tree/5d57314826447f024d878674b98057742b4ce4cd)

- **Observations：** [v03-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-observations.md)
- **Receipts：** [v03-demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-demo-receipts.json)
- **Provenance / frozen inputs：** [v03-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-evidence-provenance.json) · [v03-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-candidate-inputs.sha256) · [v03-pre-review-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/docs/verification/v03-pre-review-inputs.sha256)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/5d57314826447f024d878674b98057742b4ce4cd/openspec/changes/v03-hooks-workers/evidence.md)
- **未验边界：** 固定 worker 与脚本 Child 不是独立真实模型专家；共享预算不等于 Provider 准入。

### v0.4 · ResultStore / Context / 精确回读

固定代码：[`ecf6cb4`](https://github.com/hpoenixf/open-etf-agent/tree/ecf6cb45b4062586614e83aed917c92d704cb63b)

- **Observations：** [v04-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-observations.md)
- **Receipts：** [v04-demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-demo-receipts.json)
- **Provenance / frozen inputs：** [v04-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-evidence-provenance.json) · [v04-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/docs/verification/v04-candidate-inputs.sha256)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/ecf6cb45b4062586614e83aed917c92d704cb63b/openspec/changes/v04-results-context/evidence.md)
- **未验边界：** 词法候选不是已读原文；字节投影不是 token 质量优化或完整 RAG 撤权平台。

### v0.5 · Compaction / 显式 Memory

固定代码：[`05c0dd2`](https://github.com/hpoenixf/open-etf-agent/tree/05c0dd2dc550f4f7e5da034340ff5c3159768fcf)

- **Observations：** [v05-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-observations.md)
- **Receipts：** [v05-demo-receipts.json](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-demo-receipts.json)
- **Provenance / frozen inputs：** [v05-evidence-provenance.json](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-evidence-provenance.json) · [v05-candidate-inputs.sha256](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/docs/verification/v05-candidate-inputs.sha256)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/05c0dd2dc550f4f7e5da034340ff5c3159768fcf/openspec/changes/v05-notes-memory/evidence.md)
- **未验边界：** 派生便笺不升级为原文，忘记影响未来 typed 输入而不删除历史报告；离线脚本不证明真实摘要质量。

### v0.6 · Artifact / Reader / HTTP 回读

固定代码：[`7480b65`](https://github.com/hpoenixf/open-etf-agent/tree/7480b656b18192e6d6b44aab65255b970d58e6f8)

- **Observations：** [v06-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-observations.md)
- **Receipts：** [v06-delivery-receipts.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-delivery-receipts.safe.json)
- **Provenance / frozen inputs：** [v06-observations.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-observations.safe.json) · [v06-candidate-inputs.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-candidate-inputs.json) · [v06-delivery-manifest.json](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/docs/verification/v06-delivery-manifest.json)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/7480b656b18192e6d6b44aab65255b970d58e6f8/openspec/changes/v06-artifact-reader/evidence.md)
- **未验边界：** 真实 loopback HTTP 验证下载字节，不等于公网认证服务、后台工作或冷恢复；本阶段无新增模型调用。

### v0.7 · 可信 Plugin / SQLite / 同一 Run 恢复

固定代码：[`5f70dc0`](https://github.com/hpoenixf/open-etf-agent/tree/5f70dc0b4760ad70ef211f4823828ab2fee5c525)

- **Observations：** [v07-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-observations.md)
- **Receipts：** [v07-delivery-receipts.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-delivery-receipts.safe.json)
- **Provenance / frozen inputs：** [v07-observations.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-observations.safe.json) · [v07-candidate-inputs.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-candidate-inputs.json) · [v07-delivery-manifest.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-delivery-manifest.json)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/openspec/changes/v07-trusted-recovery/evidence.md)
- **未验边界：** 真实进程中断/新 PID 的证据才支持恢复；终态 resume 只回读。DB fence 不约束任意外部副作用，未知效果不重试；无 v0.7 live 恢复资格。

### v0.8 · Publication 最小正文提交与回读

固定代码：[`2c096ce`](https://github.com/hpoenixf/open-etf-agent/tree/2c096ce47be2161f97531170af07ef255872f8b1)

- **Observations：** [v08-observations.md](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-observations.md) · [原始执行摘要](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-observations.safe.json)
- **Receipts：** [独立安装/构建、五个 CLI 进程与新旧 Artifact 回读](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-independent-delivery.safe.json)
- **Provenance / frozen inputs：** [原119文件验证输入](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-candidate-inputs.json) · [0.8.0 发布输入](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-publication-inputs.json) · [仅版本字段晋级的窄验证](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-metadata-promotion.safe.json)
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/openspec/changes/v08-publication-only/evidence.md) · [实际 RED](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-publication-red.safe.json) · [Owner / Runtime / CLI GREEN](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-publication-green.safe.json) · [Kit 结构结果](https://github.com/hpoenixf/open-etf-agent/blob/2c096ce47be2161f97531170af07ef255872f8b1/docs/verification/v08-kit.safe.json)
- **精确版本边界：** 286/286 全套实跑对应 `0.8.0-dev.0`；`0.8.0` 仅修改两个文件中的三个版本字段，其他117项和95条依赖锁定记录保持不变，随后只做必要窄验证。没有把这说成新聚合摘要下又跑了一次286，也不借用旧扩大候选的298结果。
- **最小模块边界：** 同一 Runtime 提交独立正文/当前事件、显式修订身份与 CLI 回读；Publication 不是报告 Artifact 的别名。已提交正文可独立于后续 Run 失败保留。没有新增 Web Chat、HTTP/SSE 产品层、Worker、队列或认证系统，也没有新真实模型调用/浏览器验收。
- **2026-10-27 后续交付记录：** [代码、README、019 源/正文与独立站点缺口](v08-delivery-2026-10-27.md) · [唯一当前维护状态](v08-maintenance-2026-10-27.safe.json)。019 实际正文已核；整个维护流程 publication 仍 blocked，未作完整归档。
- **覆盖清单输入口径：** 当前覆盖检查绑定115个 `src/fixtures/test/package` 输入，checker另以 `runnerSha256` 绑定；阶段的119输入额外包括build、checker、live runner与live pins四个脚本。集合不同不是源码漂移。


### v0.9 · 独立调用的单 Run Worker

固定代码：[`dad9c6e`](https://github.com/hpoenixf/open-etf-agent/tree/dad9c6e64f32c3d7579aea96613776b40917ec6d)

- **Observations：** [本版说明](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-observations.md) · [原305项历史机读记录](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-observations.safe.json) · [当前组合309项实际记录](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-combined-observations.safe.json)。两次执行和输入分别保留，不改标或累加。
- **Receipts / delivery：** [原独立安装/构建](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-independent-install.safe.json) · [原八进程 CLI 与旧 Artifact 回读](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-independent-delivery.safe.json) · [58交付输入与55构建文件等价核对](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-delivery-equivalence.safe.json)，后者不是新执行。
- **Provenance / frozen inputs：** [原124输入](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-candidate-inputs.json) · [当前124输入](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-combined-inputs.json)；组合只纳入已公开的覆盖校验器/测试变更，Worker行为/package/dependencies未变。
- **Qualification：** [Spec / evidence](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/openspec/changes/v09-single-run-worker/evidence.md) · [本次Kit结构记录](https://github.com/hpoenixf/open-etf-agent/blob/dad9c6e64f32c3d7579aea96613776b40917ec6d/docs/verification/v09-combined-kit.safe.json)。真实进程/SQLite、合成模型动作；无调度平台、浏览器、真实模型质量或正式Release结论。

### v0.10 · Result / Reference 消费模块

固定源码：[`ff5b927`](https://github.com/hpoenixf/open-etf-agent/tree/ff5b9273ef0d239e804f61792702cd2e94174be7)；固定资格提交：[`ae82c26`](https://github.com/hpoenixf/open-etf-agent/tree/ae82c26e6511c1dac9d67e864284b55eee6a82c2)。旧重复读取适配候选取消；本模块承载原计划 1.1 的最小增量，不重复排期，也不代表 1.0 已完成。

- **原实现执行：** [333/333 实跑与反例](https://github.com/hpoenixf/open-etf-agent/blob/e442f600891be79625fc78751e2d9f39905920da/docs/verification/result-consumption-observations.safe.json)属于原 0.9.0 元数据下的冻结输入，不改称编号后又跑了一次。
- **本次编号资格：** [精确等价与新窄安装/build/CLI/独立字节回读](https://github.com/hpoenixf/open-etf-agent/blob/ff5b9273ef0d239e804f61792702cd2e94174be7/docs/verification/v010-numbering.safe.json)：只改三个版本字段，123 个非 package 执行输入与 95 条依赖记录未变。
- **新固定输入与实际 smoke：** [125 输入](https://github.com/hpoenixf/open-etf-agent/blob/ae82c26e6511c1dac9d67e864284b55eee6a82c2/docs/verification/article-coverage-source.json) · [原 15 目标的新版实际回执](https://github.com/hpoenixf/open-etf-agent/blob/ae82c26e6511c1dac9d67e864284b55eee6a82c2/docs/verification/article-coverage-receipts.json)。这是限定 Runtime case，不是全套重新执行或模型语义评审。
- **升级边界：** [`tool-host@2` 契约](https://github.com/hpoenixf/open-etf-agent/blob/ff5b9273ef0d239e804f61792702cd2e94174be7/openspec/changes/result-reference-consumption/design.md)：先结束旧活动 Run；v1 检查点不能跨版本续跑，旧不可变成果仍可读。真实 Provider、金融语义、正式 Release 与生产资格未由此取得。

### v0.11 · 本地文本层 PDF 输入

固定执行源码：[`5f42c33`](https://github.com/hpoenixf/open-etf-agent/tree/5f42c33892d57ed05e8cd09cad48573e6901995b)，包含回归所需的既有 Session 准入修复。本期只新增 PDF 模块，不包含 OCR、视觉解析、远程取材或活跃 PDF 持久恢复。

- **完整 Runtime 回归：** [结构化 finalRun／373 项回执与冻结输入](https://github.com/hpoenixf/open-etf-agent/blob/5f42c33892d57ed05e8cd09cad48573e6901995b/docs/verification/session-hot-journal-admission.safe.json)。保留原执行摘要 `73148a90…`；在5f42时138个 runtime/test/fixture/package/build 输入一致；随后e0a6仅改变覆盖维护测试，剩余137项逐字一致，不重标为再次全套执行。
- **维护实跑：** [当前16个目标回执](article-coverage-receipts.json)、[固定137输入](article-coverage-source.json)与[56个消费者通过及保留的54/55失败](pdf-coverage-qualification.safe.json)。新增PDF行只认领标明的本地文本层用例，不含OCR、页图、版面或多模态；[原15目标维护记录](integrated-maintenance.safe.json)保留。
- **独立交付：** [新目录锁定安装/build/两次独立进程 PDF 回读](integrated-install-pdf.safe.json) · [345 个复制输入](integrated-install-inputs.safe.json)。指定文件用例仍使用原创合成 PDF，不是真实用户文档；原始字节、物理页与报告/来源哈希匹配。
- **保留失败与范围：** [含原 358/359 失败的 PDF 观察](v011-observations.safe.json) · [带日期 Spec 证据与剩余发布门](../../openspec/changes/v011-local-pdf/evidence.md) · [职责保留与公开简化](../evolution/v011-pdf-lineage.md)。不认领真实模型、上云或正式 Release。

## v0.7 分项入口

以下也固定在 v0.7 的原快照，避免把成功 demo 与中断恢复混在一起：

- [v07-plugins.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-plugins.safe.json) — 贡献校验、激活失败与资源释放。
- [v07-session.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-session.safe.json) — SQLite、lease/fence 与存储契约。
- [v07-review.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-review.safe.json) — 独立反例、失败与修复。
- [v07-cli.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-cli.safe.json) — 真实 CLI start / inspect / terminal resume；不是 kill/restart 替身。
- [v07-memory.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-memory.safe.json) — 一次意图与 Memory owner 的持久效果。
- [v07-old-artifact.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-old-artifact.safe.json) — 旧不可变产物回读。
- [v07-kit.safe.json](https://github.com/hpoenixf/open-etf-agent/blob/5f70dc0b4760ad70ef211f4823828ab2fee5c525/docs/verification/v07-kit.safe.json) — Evidence Kit 结构检查，不冒充测试执行认证。

## 单列历史 live 与维护，不抹平版本

- [v0.1–v0.5 首批真实调用](https://github.com/hpoenixf/open-etf-agent/blob/d075068ac99a6c798d012c46bff4fe0c33eb9979/docs/verification/live-v01-v05-first-batch.md)：各自原版本的历史 HTTP / 产物记录，未触达机制保持未覆盖。**不是 v0.6/v0.7/v0.8/v0.9 的 live 资格，不是模型质量认证。**
- [受限 live 入口与授权](../live-validation.md)：默认覆盖 smoke 不调用此入口；provider、合成数据与费用仍需独立授权。[下一批计划](live-runtime-next-cases.md)只是计划。
- [v0.2 独立措辞维护](https://github.com/hpoenixf/open-etf-agent/tree/a10d4f1bd1ecc39224272156221fe29792b64094)：未读页面不能写成已知事实，原阶段证据保持不变。
- [v0.6 errno 窄范围维护](https://github.com/hpoenixf/open-etf-agent/blob/765fd771430c55e1598b3f7bc32f342215a46f33/docs/verification/v06-errno-maintenance.md)：区分原阶段与维护输入。Node 26.11.1 是本机实际执行；26.8.1 的 v0.6 全绿是用户观察，不冒称本机 v0.7 最低版本实测。

## 编号前的历史交付 · Result / Reference 消费

固定实现：[源提交 `e442f60`](https://github.com/hpoenixf/open-etf-agent/tree/e442f600891be79625fc78751e2d9f39905920da)；本次合入 main 的固定点为 [`ade806a`](https://github.com/hpoenixf/open-etf-agent/tree/ade806a18e0b89c07b929111ea30afbebad93279)。该次执行与发布的 package 为 0.9.0；随后由上方 v0.10 资格完成编号，不回改这份历史，也不表示路线中的 1.0 或 1.1 已发行。

- [原始 RED/GREEN 与完整 333 项本地执行](result-consumption-observations.safe.json) · [冻结输入](result-consumption-inputs.json) · [独立安装/build/CLI 与新进程字节回读](result-consumption-independent.safe.json)。收尾没有把这些历史执行重标为再次运行。
- [Spec / evidence](../../openspec/changes/result-reference-consumption/evidence.md) · [代码、README、双语文章与正式站点四状态](result-consumption-publication.safe.json)。已登记覆盖仍为 31 条，实际 modules 为 33 篇；另外两篇未映射，不补造 verified。
- 升级使用 `tool-host@2`：旧活动 Run 应在升级前结束，v1 检查点不能跨版本续跑；原不可变 Result、Artifact 和 Publication 可继续读取。生产 Gateway 编码由离线 transport 验证，不是实际 Provider 或金融语义资格。
- 原 Kit 的拒绝 RC.4 [历史记录](result-consumption-kit.safe.json)保留；后续采用现有目录的人工证据登记及结构化 verify，不声称工具自动归档或正式 Release。

## 当前文章覆盖的机器证据

[唯一文章清单](article-coverage.json) · [固定源码输入](article-coverage-source.json) · [实际有界执行回执](article-coverage-receipts.json) · [检查脚本](../../scripts/check-article-coverage.mjs)

`--check` 确认固定 commit 存在、当前相关字节与既有 case 回执相符，不声称现在重新执行；`--smoke` 才串行调用原 CLI / 精确 node:test。改动源码或 case 必须重新资格，不能只保持 `verified` 字样。见[首页使用说明](../../README.zh-CN.md#reading)。

<a id="repository-maintenance"></a>
## 仓库维护验收

沿用上方现有检查与证据入口。以下是接受改动的要求，不代表所有规划模块都已满足。

- **一版一个可运行模块：** 说清输入、处理、可观察产物与回读；支持适配仍归既有职责。
- **事实一致：** 代码、固定版本、修订计划、中英文入口与文章实际选定 case 一致；首次引入历史与当前验证 pin 分开保留。
- **边界诚实：** 保留兼容限制、失败与未验证行为；fixture 执行、真实模型质量和生产就绪分别取证。
- **英文入口可复现：** 从支持的环境按英文 Quickstart 运行并核对实际产物，命令与中文导航保持同步。
- **完整译文与真实链接：** 英文文章须完成正文和图表审查后才登记；标题、摘要或占位稿不算翻译，缺译时明确回落到中文原文。
- **发布单独核验：** 通过现有 CI 与固定来源的覆盖、双向回链和本地化检查，再读回实际仓库 ref、tree 与修改的 blob。文章发布还须沿用博客 source lock，核验新域回执与实际正文；源码提交不等于网站已上线。

不另建执行 Owner、发布平台或额度审批流程。
