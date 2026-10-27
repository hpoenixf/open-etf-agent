# 验证证据索引 · v0.1–v0.8

[返回项目首页](../../README.md) · [31 篇文章覆盖契约](../../README.md#reading)

## 怎样读

先读 **observations**（发生过什么、失败与修复），再查 **receipts**（实际文件/HTTP/运行结果），用 **provenance / frozen inputs** 对齐源码身份，最后读 **qualification / evidence** 的验收边界。下方链接全部固定到各阶段公开 commit，不随 `main` 更新改写历史；本页只导航，不补写或重标原始证据。

- `*.safe.json` 和 provenance 是可移植、已清理的工程摘要与来源哈希；不是原始日志，也不是防伪执行证明。数据库、凭据、依赖缓存和私有原始日志不公开。
- 一个阶段的测试数只说明其当时冻结输入的那次执行；**不跨版本加总为成熟度**。先前 candidate / prepared-only / license-pending 文本是当时状态，不覆盖首页当前 MIT 与已公开代码事实。
- 验收范围是 Runtime：合法边界、原文身份、持久效果与实际交付。模型答案语义质量不作为本索引的验收结论。

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
- **精确版本边界：** 286/286 全套实跑对应 `0.8.0-dev.0`；`0.8.0` 仅修改两个版本字段，其他117项和95条依赖锁定记录保持不变，随后只做必要窄验证。没有把这说成新聚合摘要下又跑了一次286，也不借用旧扩大候选的298结果。
- **最小模块边界：** 同一 Runtime 提交独立正文/当前事件、显式修订身份与 CLI 回读；Publication 不是报告 Artifact 的别名。已提交正文可独立于后续 Run 失败保留。没有新增 Web Chat、HTTP/SSE 产品层、Worker、队列或认证系统，也没有新真实模型调用/浏览器验收。
- **覆盖清单输入口径：** 当前覆盖检查绑定115个 `src/fixtures/test/package` 输入，checker另以 `runnerSha256` 绑定；阶段的119输入额外包括build、checker、live runner与live pins四个脚本。集合不同不是源码漂移。


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

- [v0.1–v0.5 首批真实调用](https://github.com/hpoenixf/open-etf-agent/blob/d075068ac99a6c798d012c46bff4fe0c33eb9979/docs/verification/live-v01-v05-first-batch.md)：各自原版本的历史 HTTP / 产物记录，未触达机制保持未覆盖。**不是 v0.6/v0.7/v0.8 的 live 资格，不是模型质量认证。**
- [受限 live 入口与授权](../live-validation.md)：默认覆盖 smoke 不调用此入口；provider、合成数据与费用仍需独立授权。[下一批计划](live-runtime-next-cases.md)只是计划。
- [v0.2 独立措辞维护](https://github.com/hpoenixf/open-etf-agent/tree/a10d4f1bd1ecc39224272156221fe29792b64094)：未读页面不能写成已知事实，原阶段证据保持不变。
- [v0.6 errno 窄范围维护](https://github.com/hpoenixf/open-etf-agent/blob/765fd771430c55e1598b3f7bc32f342215a46f33/docs/verification/v06-errno-maintenance.md)：区分原阶段与维护输入。Node 26.11.1 是本机实际执行；26.8.1 的 v0.6 全绿是用户观察，不冒称本机 v0.7 最低版本实测。

## 当前文章覆盖的机器证据

[唯一文章清单](article-coverage.json) · [固定源码输入](article-coverage-source.json) · [实际有界执行回执](article-coverage-receipts.json) · [检查脚本](../../scripts/check-article-coverage.mjs)

`--check` 确认固定 commit 存在、当前相关字节与既有 case 回执相符，不声称现在重新执行；`--smoke` 才串行调用原 CLI / 精确 node:test。改动源码或 case 必须重新资格，不能只保持 `verified` 字样。见[首页使用说明](../../README.md#reading)。
