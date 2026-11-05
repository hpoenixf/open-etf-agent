[English](knowledge.md) | **简体中文**

# Knowledge：检索已准入资料，保留原文证据

这是 **v0.23 候选实现**。本地、无提供方测试不等于真实模型验收或正式发布。[提案](../openspec/changes/v023-knowledge/proposal.md)记录了范围与验收门槛。

首轮固定源码真实十题保留 **8/10，未通过资格门**。原失败与前瞻提示修复记录在[修复说明](../openspec/changes/v023-knowledge/repair-2026-11-05.md)中，仍须完成新的整批十题验收。

Knowledge 把现有显式文件导入、有界检索与原研究流程连接起来。查询返回完整原文页，由 Host 登记到原有 Result 存储；模型获得正文和准确的 `sourceId`、`resultRef`，随后由既有 Report、Publication、Reader 保留同一字节。搜索分数只是排序提示，不是权限或语义质量判定。

## 为新研究任务启用

依照[研究项目指南](research-project.zh-CN.md)创建项目、显式导入本地文件并提交任务。在经过检查的完整项目配置中，将 `knowledge` 加入 `capabilities`：

```json
{
  "capabilities": ["report", "knowledge"],
  "knowledge": {"maxResults": 4, "maxSourceBytes": 128000}
}
```

这只是配置片段，不含完整 Gateway 设置。已有项目使用 `project update`，提供刚检查的配置哈希。变更只影响**新任务**。如自定义 `allowedTools`，要显式包含 `knowledge_query` 才会提供给模型；本流程仍需要 `read_result`、`save_report`。

例如，显式导入两份合成服务说明，然后提问：“用 Knowledge 查找两份说明的导出格式和离线限制，引用原文页保存报告；资料中没有答案的部分请明确说明。”查询词由模型选择，Runtime 不把词面命中当正确性评分。

检查任务原先准入的资料，不执行任务：

```sh
node src/research-cli.mjs knowledge inspect --project DIR --run RUN_ID
```

输出包含原资料 manifest、catalog/index 哈希、文档范围和限额。它不是来源获取或模型采用回执。`run work`、`run report`、`report serve` 保留原来的语义与真实提供方授权要求。

## 模型指引与固定绑定

任务若明确给出 query、limit、工具顺序或单调用分组，模型指引要求原样保留，不把 query 扩写成另一问题。Knowledge 任务还要求区分原文明确限制与原文未声明的信息，并依据实际问句和原始证据复核 Child 的派生评论。这些只是提示指引，不是 Runtime 对模型遵循指令或语义正确性的保证。检索器仍把合法 query 当作数据，保留其原始字节哈希。

修复候选改变了 Knowledge 工具描述和 Knowledge 任务指引。此前已准入的 Knowledge 任务应继续使用原固定可执行源码：持久化 question 与 Host definitions 都是绑定输入，变更后会关闭失败，不会透明迁移。普通非 Knowledge 任务的指引保持原样，不放松恢复校验。

## 结果与容量合同

`knowledge_query` 只接受不超过 512 个 UTF-8 字节的非空查询，以及可选的正整数 `limit`；它不能超过已准入的 `maxResults`（1–8）。参数不能指定新文档、路径、URL 或资料库。实现使用 Unicode 词项和连续汉字二元组，并做 NFKC 归一化；没有 embedding 提供方、reranker 或语义搜索质量保证。同分按文档 ID、物理页码排序。

- `complete`：本次准入资料中的全部词法命中已返回。
- `partial`：结果数量、原文字节或 JSON 编码容量省略了后面的命中页，`coverage` 记录真实限额和返回数。这不是检索失败，也不代表业务证据已经完整。
- `no-evidence`：有效资料中没有词法命中，不代表其他地方也没有答案。
- 参数无效、取消、已准入字节缺失或损坏均报错，不伪装为空搜索成功。

默认原文容量 128000 字节，可配置 64000–512000。每个返回页始终是完整原页，最多 64000 字节。响应还受到 768000 字节的 JSON 上限约束，包含 Host 后加的 ResultRef，以及 Chat 工具正文编码时的二次转义。超限时整页不返回，不在原哈希下偷偷裁短正文。

Knowledge 项目冻结 1 MiB 的消息上下文容量；未启用 Knowledge 的普通项目仍是 32000 字节。Context 还使用 Gateway 实际请求编码器，在封存请求前计入工具定义与历史转义。只有较旧证据可变成经过核验的重读引用，最新完整工具组保留原文；摘要输入过大时，在摘要预约前跳过压缩。实际模型、提供方的 token 上限另行约束。建议每个工具组只发一次查询；同组多个大查询或足够长的保留历史仍可能达到共享 Context 上限，在下一次模型请求前停止。不会裁短来源来制造成功。

## 快照、授权与恢复

Import 持有原字节和内容寻址 manifest。Knowledge 从同一份经过核验的 catalog 确定性重建派生索引，不另建索引数据库或权限存储。Run 固定资料、配置与原授权；新导入、同名文件替换和项目配置变化不重绑已准入任务。原输入文件删除后，已导入快照仍可恢复；存储快照对象缺失或损坏仍会触发完整性错误。

这里只承诺**导入时快照证据**，不声称外部个人文件持续保持最新。未实现目录监听、外部资料库服务、动态 ACL 重读、向量服务或自动重建索引。历史 `document-revocation@1` 教学 profile 保留其独立的当前资格检查，不静默迁移。

恢复时，Host 同时核验原 Result 字节，以及查询相对已准入纯索引的身份、排名和覆盖信息。安全检查点沿同一 Run、同一来源接续；终态重读不新增模型请求、不重复保存。查询结果不能扩大权限，也不能抹去未知执行结果。

## 组合与检查

无提供方测试覆盖 Main 侧 Knowledge 与显式 Memory、计算/CSV、实际 Child 执行及受管压缩的组合。Child 保留独立准入的只读工具，Main 启用 Knowledge 不会自动给 Child 添加它。PDF 保留独立 reader，不隐式进入索引。现有 Schedule 适配器的扩展合同更窄，因此 Knowledge + Schedule 在配置阶段明确拒绝。

```sh
node --test test/knowledge.test.mjs test/knowledge-project.test.mjs
```

这些检查包含真实 Chat 编码/解析接缝配合本地替身传输、进程退出与恢复、真实 loopback Reader 字节及容量拒绝。它们**不连接模型服务**，不建立真实模型验收资格。回答语义审阅、提供方执行、完整测试/构建/独立安装和发布分别保留证据。
