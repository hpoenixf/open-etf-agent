[English](v023-release.md) | **简体中文**

# v0.23 已准入 Knowledge：Runtime 证据与模型边界

[v0.23.1 维护：收尾修复与源码适用性](v0231-maintenance.zh-CN.md)。下文原结果仍绑定其原执行源码及身份。

Knowledge 是本版唯一主要模块：把显式导入文本、有界词法检索连接起来，返回完整原文页，并沿既有 Report、Publication、Reader 保留原 Source/ResultRef 身份。Runtime、Session、来源导入、Context、Child 及原权限和预算 Owner 只是支持组件，不作为多个新模块发布。

## 三个结果分别阅读

修复后固定源码批次的十个原任务全部完成。独立审阅结果为：

- **本批观察到的 Runtime 合同：10/10**，已审阅检查内没有确认的适用实现缺陷。检查覆盖准入身份和来源范围、模型实际消费原文、Report/Publication 持久化、冷读及 HTTP 字节、有界组合与同 Run 恢复。这是有限场景的观察，不是实现不存在其他缺陷的证明。
- **冻结机械结果：9/10**。K10 因模型选择的 query 不同于要求的字面值，保留原机械失败；它的同 Run 接续与终态检查通过。Runtime 接受有界 query 字符串，没有用 const/enum 将自然语言任务中的 query 固定为唯一值。
- **严格完整自然任务质量：5/10**。K01 对明确的联网要求出现实质矛盾；K05、K08、K09、K10 改写了要求的 query。这些模型选择不记为已确认的 Runtime 实现失败。十题均包含核心所需事实，但措辞、归属及多余推断等小问题仍保留；不能称十份完美答案或通用模型质量验收。

原冻结计划把语义审阅列为门槛，其严格完整任务标准**未达成**。[2026-11-06 的 Runtime 范围发布决定](v023-runtime-release-decision.safe.json)保留原机械口径的九个成功样本，将发布依据限定为实际观察到的 Runtime 机制。仅属模型的问题仍与实现失败分开。这项后续范围澄清不改写原计划、不抹去 K10，也不声称严格任务门已通过。独立审阅已核实声明来自原票；最终包验证和发布仍须分别完成。

[结构化批次摘要](v023-real-ten.safe.json) · [冻结输入哈希](v023-execution-inputs.safe.json)。

## 历史批次原样保留

早先固定源码批次保留**原机械口径 8/10**，不重评、不与新批次合并，也不挑选成功任务替换。[前瞻修复记录](../../openspec/changes/v023-knowledge/repair-2026-11-05.md)和[早先无提供方证据](../../openspec/changes/v023-knowledge/evidence.md)保留各自日期的状态与限制；其中当时未完成的表述属于历史，新增结果记在本文。

修复后批次的十个原任务共完成 38 次物理模型请求，无新增 unknown 请求结果。独立审阅检查了保留的完整原 provider 响应及请求关联，未新增模型调用或 HTTP 探测。不公开原始 provider 请求、响应、报告、数据库、私人账户历史或凭据。

## 固定源码与无提供方验证

[已测试实现](https://github.com/hpoenixf/open-etf-agent/tree/4e893ead9ebe8cdd13146ddc96fe1d56a1e56365)：`4e893ead9ebe8cdd13146ddc96fe1d56a1e56365`，tree `4531111e641200ab046f28b618f3ffda5a1b2a87`。[对应精确 HEAD 的 CI](https://github.com/hpoenixf/open-etf-agent/actions/runs/42142073211)已完成锁定依赖安装、原生 ESM 构建和 **959/959** 无提供方测试，无失败、跳过或取消。工作流实测 Node.js **26.11.1**；声明支持范围仍为 **>=26.8.1 <27**，不代表区间内每个版本都已测试。

[固定源码 CI / fullSuite 结构化回执](v023-provider-free.safe.json)与真实批次分别记录。元数据准备仅修改 package.json 的项目版本，以及 package-lock.json 中对应的两个项目版本字段，依赖条目保持不变。最终 0.23.0 发布包、其 CI、tag 和 GitHub Release 须分别核验精确提交；后续文档或元数据提交不是重新执行十题。

## 范围与升级边界

固定批次包含来源快照绑定、无证据/部分检索、计算/CSV、显式只读 Memory、串行只读 Child，以及原 Run 的安全暂停/恢复。搜索分数只是排序提示；Main 启用 Knowledge 不会给 Child 添加 Knowledge 工具。Knowledge + Schedule 明确拒绝，PDF 保留独立 reader，不隐式加入索引。

本版没有向量服务、embedding、reranker、目录监听、外部动态 ACL、多租户资料库或自动重建索引。不据此认定生产检索质量、金融语义、浏览器验收或更广泛的并发能力。

指引修复改变了 Knowledge 任务问题和 Host 工具定义哈希。此前已准入的 Knowledge 任务必须继续使用原固定可执行源码，绑定不一致时关闭失败，不支持透明迁移；普通非 Knowledge 指引未变。未知已派发工作不自动重放。

[用法](../knowledge.zh-CN.md) · [原范围](../../openspec/changes/v023-knowledge/proposal.md) · [文章与代码导读](../articles-and-code.zh-CN.md)。现有文章 target 和历史回执不变，不据此宣称新增 Knowledge 文章资格或站点已发布。
